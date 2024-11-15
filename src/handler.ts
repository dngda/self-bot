import {
    MessageUpsertType,
    WAMessage,
    WASocket,
    proto,
} from '@whiskeysockets/baileys'
import chalk from 'chalk'
import fs from 'fs'
import util from 'util'
import loadCommands from './cmd/_index'
import { storeMessage, storeStatus } from './lib/_index'
import { getCommand } from './menu'
import { BotConfig, MessageContext } from './types'
import {
    getPrefix,
    handleAddList,
    handleDeleteList,
    handleMathEquation,
    handleNoteCommand,
    handleRepeatCommand,
    handleReplyToContactStatusList,
    handleReplyToStatusList,
    handleStickerCommand,
    listenDeletedMessage,
    listenOneViewMessage,
    logCmd,
    serializeMessage,
} from './utils/_index'
import { HandlerFunction } from './raw/surah'

export let config: BotConfig = {
    allowedChats: [],
    stickerCommands: {},
    norevoke: false,
    oneview: false,
    public: false,
}

if (fs.existsSync('./data/config.json')) {
    const conf = fs.readFileSync('./data/config.json', 'utf-8')
    if (conf != '') config = JSON.parse(conf)
    if (!config.allowedChats) config.allowedChats = []
    if (!config.stickerCommands) config.stickerCommands = {}
    if (!config.norevoke) config.norevoke = false
    if (!config.oneview) config.oneview = false
    if (!config.public) config.public = false
}

export const updateConfig = () => {
    fs.promises.writeFile('./data/config.json', JSON.stringify(config, null, 2))
}

// every handler must have 3 parameters:
export const actions: { [index: string]: HandlerFunction } = {}
loadCommands()

export const messageHandler = async (
    waSocket: WASocket,
    event: {
        messages: WAMessage[]
        type: MessageUpsertType
    }
) => {
    const { type, messages } = event
    if (type === 'append') return false

    for (const msg of messages) {
        await processMessage(waSocket, msg)
    }

    return true
}

const processMessage = async (waSocket: WASocket, msg: WAMessage) => {
    if (isHistorySync(msg)) {
        console.log(chalk.green('[LOG]'), 'Syncing chats history...')
        return
    }

    logRawMessage(msg)

    const ctx = await serializeMessage(waSocket, msg)

    try {
        await handleCommands(waSocket, msg, ctx)
    } catch (error: unknown) {
        handleError(ctx, error)
    }

    storeMessageData(msg)
    storeStatusData(msg)

    if (config.norevoke) listenDeletedMessage(waSocket, msg)
    if (config.oneview) listenOneViewMessage(waSocket, msg)
}

const logRawMessage = (msg: WAMessage) => {
    console.log(
        chalk.green('[LOG]'),
        'RAW Message Received',
        util.inspect(msg, false, null, true)
    )
}

const handleCommands = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (msg.key.fromMe || isAllowedChat(ctx) || config.public) {
        noPrefixHandler(waSocket, msg, ctx)

        const cmd = getCommand(ctx.cmd) as string
        if (ctx.isCmd && cmd in actions) {
            console.log(
                chalk.green('[CTX]'),
                'Serialized CMD Message Context:',
                util.inspect(ctx, false, null, true)
            )
            logCmd(msg, ctx)
            await actions[cmd](waSocket, msg, ctx)
        }
    }

    universalHandler(waSocket, msg, ctx)
}

const handleError = (ctx: MessageContext, error: unknown) => {
    console.log(error)
    ctx.reply(`${error}`)
    ctx.reactError()
}

const isAllowedChat = (ctx: MessageContext) =>
    config?.allowedChats.includes(ctx.from)
const isHistorySync = (msg: WAMessage) =>
    msg.message?.protocolMessage?.type ==
    proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION

// --------------------------------------------------------- //
const noPrefixHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { body } = ctx

    if (/^#\w+$/.test(body as string)) {
        await handleNoteCommand(ctx)
    } else if (/^-r$/.test(body as string)) {
        await handleRepeatCommand(_wa, _msg, ctx)
    } else if (/^cekprefix$/.test(body as string)) {
        await ctx.reply(`Prefix: '${getPrefix()}'`)
    } else if (/^\d\d?\d?$/.test(body as string)) {
        await handleReplyToStatusList(_wa, _msg, ctx)
        await handleReplyToContactStatusList(_wa, _msg, ctx)
    } else {
        await handleMathEquation(ctx)
        await handleStickerCommand(_wa, _msg, ctx)
    }
}

const universalHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { body } = ctx
    if (/^\+.+/.test(body as string)) {
        await handleAddList(_wa, _msg, ctx)
    } else if (/^-[0-9]+/.test(body as string)) {
        await handleDeleteList(_wa, _msg, ctx)
    }
}

const storeMessageData = (msg: proto.IWebMessageInfo) => {
    if (msg.message?.protocolMessage) return null

    storeMessage(
        msg.key.id!,
        msg.messageTimestamp! as number,
        msg.message!,
        msg.key
    )
    return true
}

const storeStatusData = (msg: proto.IWebMessageInfo) => {
    if (msg.key.fromMe) return null
    if (msg.message?.protocolMessage) return null
    if (msg.key.remoteJid != 'status@broadcast') return null

    storeStatus(
        msg.key.participant!,
        msg.messageTimestamp! as number,
        msg.message!,
        msg.key!
    )
    return true
}
