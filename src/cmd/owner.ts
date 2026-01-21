import {
    getNote,
    getNotesList,
    getStatus,
    getStatusList,
} from '../lib/_index.js'
import { WAMessage, WASocket } from 'baileys'
import stringId from '../language.js'
import { actions, config } from '../handler.js'
import { menu } from '../menu.js'
import { browser } from '../../index.js'
import chalk from 'chalk'
import { HandlerFunction, MessageContext } from '../types.js'

export default () => {
    super_Cmd()
    evalJS_Cmd()
    offline_Cmd()
    evalJSON_Cmd()
    getStatus_Cmd()
    dumpMessage_Cmd()
    refreshBrowser_Cmd()
}

const evalJSON_Cmd = () => {
    stringId.evalJSON = {
        hint: '_Evaluate JSON code_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'return',
        hint: stringId.evalJSON.hint,
        alias: '=',
        type: 'owner',
    })

    Object.assign(actions, {
        return: evalJSON,
    })
}

const evalJSON = async (_w: WASocket, _m: WAMessage, _c: MessageContext) => {
    if (!_c.fromMe) return null
    _c.reactSuccess()
    return await _c.reply(JSON.stringify(eval(_c.arg), null, 2))
}

const evalJS_Cmd = () => {
    stringId.eval = {
        hint: '_Evaluate JS code_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'eval',
        hint: stringId.eval.hint,
        alias: '>',
        type: 'owner',
    })

    Object.assign(actions, {
        eval: evalJSHandler,
    })
}

const evalJSHandler: HandlerFunction = async (
    _w: WASocket,
    _m: WAMessage,
    _c: MessageContext
) => {
    if (!_c.fromMe) return null
    if (_c.cmd == 'eval') {
        _w.sendMessage(_c.from, { edit: _m.key, text: '_Evaluating..._' })
    }
    _c.reactSuccess()
    return eval(`(async () => { ${_c.arg} })()`)
}

export const executeSavedScriptInNote = async (_w: WASocket) => {
    const notes = await getNotesList('me')
    if (!notes) return console.log('No saved note found')
    const scripts = notes.filter((note) => note.startsWith('#script_'))
    if (scripts.length == 0) return console.log('No saved script found')
    for (const script of scripts) {
        const note = await getNote('me', script)
        console.log(chalk.cyan('[CMD]'), 'Executing script:', script)
        await eval(`(async () => { ${note?.content} })()`)
    }
}

const offline_Cmd = () => {
    stringId.offline = {
        hint: '_Mark bot as offline_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'offline',
        hint: stringId.offline.hint,
        alias: 'off',
        type: 'owner',
    })

    Object.assign(actions, {
        offline: offlineHandler,
    })
}

const offlineHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined

    _wa.sendPresenceUpdate('unavailable')
    return ctx.reactSuccess()
}

const refreshBrowser_Cmd = () => {
    stringId.refreshBrowser = {
        hint: '_Refresh playwright browser context._',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'rbrowser',
        hint: stringId.refreshBrowser.hint,
        alias: 'rb',
        type: 'owner',
    })

    Object.assign(actions, {
        rbrowser: refreshBrowserHandler,
    })
}

const refreshBrowserHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined

    await browser.refreshContext()
    return ctx.reactSuccess()
}

const getStatus_Cmd = () => {
    stringId.getStatus = {
        hint: '_Get status from contact._',
        usage: (ctx: MessageContext) =>
            `📑 Get list status: ${ctx.prefix}gls
      \n📑 Get status: ${ctx.prefix}gs <number> atau reply contact`,
        error: {
            notFound: () => '🫙 Status update not found',
            invalidJId: () => '🫙 Invalid JID',
        },
    }

    menu.push({
        command: 'gs',
        hint: stringId.getStatus.hint,
        alias: 'gls',
        type: 'owner',
    })

    Object.assign(actions, {
        gs: getStatusHandler,
    })
}

const getStatusHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined
    if (ctx.cmd == 'gls') {
        const list = getStatusList()

        let i = 1
        let msg = 'List Status Update:\n'
        const mentions: string[] = []
        list.forEach((el) => {
            msg += `${i}. @${el.key?.replace('@s.whatsapp.net', '')} (${
                el.length
            })\n`
            mentions.push(el.key)
            i++
        })
        msg += `\nReply this message with number for detail`

        return _wa.sendMessage(
            ctx.from,
            { text: msg, mentions },
            { quoted: _msg }
        )
    }

    if (ctx.args[0] == '' && !ctx.contextInfo?.quotedMessage?.contactMessage) {
        return ctx.reply(stringId.getStatus.usage(ctx))
    }

    let jid = ctx.arg
    jid = jid.replace(' ', '').replace(/-/g, '')

    const vcard = ctx.contextInfo?.quotedMessage?.contactMessage?.vcard ?? ''
    if (vcard) {
        const _jid = vcard.match(/waid=(\d+)/)?.[1]
        if (!_jid) return ctx.reply(stringId.getStatus.error.invalidJId())
        jid = _jid
    }

    if (jid.startsWith('0')) jid = jid.replace('0', '62')
    if (!jid.endsWith('@s.whatsapp.net')) jid += '@s.whatsapp.net'

    const message = await getStatusListMessage(jid)

    return _wa.sendMessage(ctx.from, { text: message, mentions: [jid] })
}

export const getStatusListMessage = async (jid: string): Promise<string> => {
    const status = getStatus(jid)
    if (!status) throw new Error(stringId.getStatus.error.notFound())

    let message = `Status from @${jid.replace('@s.whatsapp.net', '')}\n\n`
    let i = 1
    for (const stat of status) {
        const msg = stat.message
        let mediaType: string
        if (msg?.imageMessage) mediaType = 'image'
        else if (msg?.videoMessage) mediaType = 'video'
        else if (msg?.audioMessage) mediaType = 'audio'
        else mediaType = 'text'

        message += `${i}. (${mediaType}) ${
            msg?.conversation ||
            msg?.extendedTextMessage?.text ||
            msg?.imageMessage?.caption ||
            msg?.videoMessage?.caption ||
            '(no caption)'
        }\n`
        i++
    }
    message += `\nReply this message with number to download status`
    return message
}

const super_Cmd = () => {
    stringId.superconfig = {
        hint: '_Toggle bot in chat_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'disb',
        hint: stringId.superconfig.hint,
        alias: 'ensb',
        type: 'owner',
        noprefix: true,
    })
}

// called directly in handler.ts
export const handleSuperConfig = async (ctx: MessageContext) => {
    const { body, fromMe } = ctx
    if (!fromMe) return null
    if (!body) return null
    switch (true) {
        case 'disb' == body:
            config.disabled_chats.push(ctx.from)
            return ctx.reactSuccess()
        case 'ensb' == body:
            config.disabled_chats = config.disabled_chats.filter(
                (x: string) => x !== ctx.from
            )
            return ctx.reactSuccess()
    }
    return null
}

const dumpMessage_Cmd = () => {
    stringId.dumpMessage = {
        hint: '_Dump json quoted message into owner chat_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'dump',
        hint: stringId.dumpMessage.hint,
        alias: 'd',
        type: 'owner',
    })

    Object.assign(actions, {
        dump: dumpMessageHandler,
    })
}

const dumpMessageHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined
    if (!ctx.contextInfo?.quotedMessage) {
        return ctx.reply('Reply a message to dump its JSON')
    }

    const ownerJid = process.env.OWNER_JID
    if (!ownerJid) {
        return ctx.reply('OWNER_JID is not set in environment variables')
    }

    const dump = JSON.stringify(ctx.quotedMsg, null, 2)
    await _wa.sendMessage(
        ownerJid,
        { text: '```json\n' + dump + '\n```' },
        { quoted: _msg }
    )
    return ctx.reactSuccess()
}
