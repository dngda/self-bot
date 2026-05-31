import { MessageUpsertType, WAMessage, WASocket, proto } from 'baileys'
import chalk from 'chalk'
import util from 'node:util'
import { getCommand } from './menu.js'
import loadCommands from './cmd/_index.js'
import { HandlerFunction, MessageContext } from './types.js'
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
    handleToggleList,
    listenDeletedMessage,
    listenEditedMessage,
    serializeMessage,
    logCmd,
} from './utils/_index.js'
import { handleSuperConfig } from './cmd/owner.js'
import { configManager } from './services/ConfigManager.js'

// Initialize config manager
configManager.initializeSync()

// Export configManager for modern usage
export { configManager } from './services/ConfigManager.js'

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

    // Process messages with bounded concurrency to avoid blocking
    const CONCURRENCY = 3
    const queue = messages.slice()
    const workers = Array.from({ length: CONCURRENCY }).map(async () => {
        while (queue.length > 0) {
            const msg = queue.shift()
            if (!msg) break
            try {
                await processMessage(waSocket, msg)
            } catch (err) {
                console.error('Error processing message:', err)
            }
        }
    })

    await Promise.all(workers)

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

    if (configManager.isNoRevoke()) listenDeletedMessage(waSocket, msg)

    listenEditedMessage(waSocket, msg)
    handleAutoSticker(waSocket, msg, ctx)
    // if (configManager.isOneView()) listenOneViewMessage(waSocket, msg)
    // NOT WORKING (Prevented by WA to only send one view msg to Mobile client)
}

const logRawMessage = (msg: WAMessage) => {
    const lifecycle = process.env.npm_lifecycle_event
    const debugRaw = (process.env.DEBUG_RAW || '').toLowerCase()

    // Allow raw logging when running dev or when DEBUG_RAW is enabled
    if (debugRaw !== 'true' && debugRaw !== '1' && lifecycle !== 'dev') return

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
    handleSuperConfig(ctx)

    if (isDisabledChat(ctx) && ctx.isCmd) {
        console.log(chalk.red('[CTX]'), 'Disabled chat:', ctx.from)
        return
    }

    if (msg.key.fromMe || isAllowedChat(ctx) || configManager.isPublic()) {
        noPrefixHandler(waSocket, msg, ctx)

        const cmd = getCommand(ctx.cmd)
        if (ctx.isCmd && cmd in actions) {
            console.log(
                chalk.green('[CTX]'),
                'Serialized CMD Message Context:',
                util.inspect(ctx, false, 2, true)
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
    ctx.from ? configManager.isDisabledChat(ctx.from) : false

const isAllowedChat = (ctx: MessageContext) =>
    ctx.from ? configManager.isAllowedChat(ctx.from) : false

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

    try {
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
                break
        }
    } catch (error: unknown) {
        handleError(ctx, error)
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
    } else if (/^x\d+/.test(body as string)) {
        await handleToggleList(wa, msg, ctx)
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
