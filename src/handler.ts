import { MessageUpsertType, WAMessage, WASocket, proto } from 'baileys'
import chalk from 'chalk'
import fs from 'fs'
import util from 'util'
import { getCommand } from './menu.js'
import loadCommands from './cmd/_index.js'
import { BotConfig, HandlerFunction, MessageContext } from './types.js'
import { storeMessage, storePushName, storeStatus } from './lib/_index.js'
import {
    handleAutoSticker,
    handleAddList,
    handleDeleteList,
    handleEditList,
    handleMathEquation,
    handleNoteCommand,
    handleRepeatCommand,
    handleReplyToContactStatusList,
    handleReplyToStatusList,
    handleStickerCommand,
    listenDeletedMessage,
    listenEditedMessage,
    serializeMessage,
    logCmd,
} from './utils/_index.js'
import { handleSuperConfig } from './cmd/owner.js'

export let config: BotConfig = {
    allowed_chats: [],
    sticker_commands: {},
    norevoke: false,
    norevoke_exceptions: [],
    disabled_chats: [],
    autosticker: [],
    oneview: false,
    public: false,
}

if (fs.existsSync('./data/config.json')) {
    try {
        const conf = JSON.parse(
            fs.readFileSync('./data/config.json', 'utf-8') || '{}'
        )
        config = {
            allowed_chats: [],
            sticker_commands: {},
            norevoke: false,
            norevoke_exceptions: [],
            disabled_chats: [],
            autosticker: [],
            oneview: false,
            public: false,
            ...conf,
        }
    } catch (error) {
        console.error(chalk.red('[ERROR]'), 'Failed to load config:', error)
    }
}

export const updateConfig = () => {
    fs.promises.writeFile('./data/config.json', JSON.stringify(config, null, 2))
}

// every handler must have 3 parameters:
export const actions: { [index: string]: HandlerFunction } = {}
loadCommands()

// Main Handler
export const mainMessageProcessor = async (
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

    if (isAppStateSync(msg)) {
        console.log(chalk.green('[LOG]'), 'Syncing app state key...')
        return
    }

    logRawMessage(msg)

    const ctx = await serializeMessage(waSocket, msg)

    try {
        await handleCommands(waSocket, msg, ctx)
    } catch (error: unknown) {
        handleError(ctx, error)
    }

    storeUserPushName(msg)
    storeIncomingMessage(msg)
    storeStatusMessage(msg)

    if (config.norevoke) listenDeletedMessage(waSocket, msg)

    listenEditedMessage(waSocket, msg)
    handleAutoSticker(waSocket, msg, ctx)
    // if (config.oneview) listenOneViewMessage(waSocket, msg) NOT WORKING (Prevented by WA)
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
    if (isDisabledChat(ctx) && ctx.isCmd) {
        console.log(chalk.red('[CTX]'), 'Disabled chat:', ctx.from)
        return
    }

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
            const sent = await actions[cmd](waSocket, msg, ctx)

            if (sent) {
                storeMessage(sent)
            }
        }
    }

    listHandler(waSocket, msg, ctx)
}

const handleError = (ctx: MessageContext, error: unknown) => {
    console.log(error)
    ctx.reply(`${error}`)
    ctx.reactError()
}
const isDisabledChat = (ctx: MessageContext) =>
    ctx.from ? (config?.disabled_chats ?? []).includes(ctx.from) : false

const isAllowedChat = (ctx: MessageContext) =>
    ctx.from ? (config?.allowed_chats ?? []).includes(ctx.from) : false

const isHistorySync = (msg: WAMessage) =>
    msg.message?.protocolMessage?.type ==
    proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION
const isAppStateSync = (msg: WAMessage) =>
    msg.message?.protocolMessage?.type ==
    proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE

// --------------------------------------------------------- //
const noPrefixHandler = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const { body } = ctx

    switch (true) {
        case /^#\w+$/.test(body as string):
            await handleNoteCommand(ctx)
            break
        case /^-r$/.test(body as string):
            await handleRepeatCommand(wa, msg, ctx)
            break
        case /^\d\d?\d?$/.test(body as string):
            await handleReplyToStatusList(wa, msg, ctx)
            await handleReplyToContactStatusList(wa, msg, ctx)
            break
        case /1view/gi.test(body as string):
            ctx.from = process.env.OWNER_JID!
            await actions['onev'](wa, msg, ctx)
            break
        default:
            await handleMathEquation(ctx)
            await handleStickerCommand(wa, msg, ctx)
            await handleSuperConfig(ctx)
            break
    }
}

const listHandler = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const { body } = ctx
    if (/^\+.+/.test(body as string)) {
        await handleAddList(wa, msg, ctx)
    } else if (/^-\d+/.test(body as string)) {
        await handleDeleteList(wa, msg, ctx)
    } else if (/^e\d+/.test(body as string)) {
        await handleEditList(wa, msg, ctx)
    }
}

const storeIncomingMessage = (msg: WAMessage) => {
    if (msg.message?.protocolMessage) return null

    return storeMessage(msg)
}

const storeStatusMessage = (msg: WAMessage) => {
    if (msg.key.fromMe) return null
    if (msg.message?.protocolMessage) return null
    if (msg.key.remoteJid != 'status@broadcast') return null

    return storeStatus(msg)
}

const storeUserPushName = (msg: WAMessage) => {
    if (msg.message?.protocolMessage) return null
    const jid = msg.key.participant || msg.key.remoteJid || ''
    if (msg.key.fromMe && jid !== process.env.OWNER_JID!) return null

    const name = msg.pushName || (jid ? '+' + jid.split('@')[0] : '')
    return storePushName(jid, name)
}
