import {
    getNoteContent,
    getNotesNames,
    getStatus,
    getStatusList,
} from '../lib/_index'
import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'
import { browser } from '../..'
import chalk from 'chalk'
import { MessageContext } from '../types'

export default () => {
    evalJS_Cmd()
    offline_Cmd()
    evalJSON_Cmd()
    getStatus_Cmd()
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
        eval: evalJS,
    })
}

const evalJS = async (_w: WASocket, _m: WAMessage, _c: MessageContext) => {
    if (!_c.fromMe) return null
    if (_c.cmd == 'eval') {
        _w.sendMessage(_c.from, { edit: _m.key, text: '_Evaluating..._' })
    }
    _c.reactSuccess()
    return eval(`(async () => { ${_c.arg} })()`)
}

export const executeSavedScriptInNote = async (_w: WASocket) => {
    const notes = await getNotesNames('me')
    const scripts = notes.filter((note) => note.startsWith('#script_'))
    if (scripts.length == 0) return console.log('No saved script found')
    for (const script of scripts) {
        const { content } = await getNoteContent('me', script)
        console.log(chalk.cyan('[CMD]'), 'Executing script:', script)
        await eval(`(async () => { ${content} })()`)
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

const offlineHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return null
    await _wa.sendPresenceUpdate('unavailable')
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

const refreshBrowserHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return null
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

const getStatusHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return null
    if (ctx.cmd == 'gls') {
        const list = getStatusList()

        let i = 1
        let msg = 'List Status Update:\n'
        const mentions: string[] = []
        list.forEach((el) => {
            msg += `${i}. @${el.key.replace('@s.whatsapp.net', '')} (${
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
    const status = await getStatus(jid)
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
