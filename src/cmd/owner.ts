import { getNoteContent, getNotesNames, getStatus } from '../lib'
import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageContext } from '../utils'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'
import { browser } from '../..'
import chalk from 'chalk'

export default function () {
  Object.assign(actions, {
    eval: evalJS,
    return: evalJSON,
    gs: getStatusHandler,
    offline: offlineHandler,
    rbrowser: refreshBrowserHandler,
  })

  stringId.eval = {
    hint: '_Evaluate JS code_',
  }
  stringId.return = {
    hint: '_Evaluate variable at runtime dan return hasilnya_',
  }
  stringId.offline = {
    hint: '_Mark bot as offline_',
  }

  stringId.refreshBrowser = {
    hint: '_Refresh playwright browser context._',
  }

  stringId.getStatus = {
    hint: '_Get status from contact._',
    usage: (prefix: string) =>
      `Get list status: ${prefix}gs <number> atau reply contact`,
    error: {
      notFound: '🫙 Status update not found',
    },
  }

  menu.push(
    {
      command: 'eval',
      hint: stringId.eval.hint,
      alias: '>',
      type: 'owner',
    },
    {
      command: 'return',
      hint: stringId.return.hint,
      alias: '=',
      type: 'owner',
    },
    {
      command: 'offline',
      hint: stringId.offline.hint,
      alias: 'off',
      type: 'owner',
    },
    {
      command: 'rbrowser',
      hint: stringId.refreshBrowser.hint,
      alias: 'rb',
      type: 'owner',
    },
    {
      command: 'gs',
      hint: stringId.getStatus.hint,
      alias: 'getstatus',
      type: 'owner',
    }
  )
}

const evalJSON = async (_w: WASocket, _m: WAMessage, _c: MessageContext) => {
  if (!_c.fromMe) return null
  _c.reactSuccess()
  return await _c.reply(JSON.stringify(eval(_c.arg), null, 2))
}

/* @ts-expect-error : reserved variables for eval */
let var1, var2, var3, var4, var5, var6, var7, var8, var9, var10

const evalJS = async (_w: WASocket, _m: WAMessage, _c: MessageContext) => {
  if (!_c.fromMe) return null
  if (_c.cmd == 'eval') {
    _w.sendMessage(_c.from, { edit: _m.key, text: '_Evaluating..._' })
  }
  _c.reactSuccess()
  return eval(`(async () => { ${_c.arg} })()`)
}

export const executeSavedScriptInNote = async (_wa: WASocket) => {
  const notes = await getNotesNames('me')
  const scripts = notes.filter((note) => note.startsWith('#script_'))
  if (scripts.length == 0) return console.log('No saved script found')
  for (const script of scripts) {
    const { content } = await getNoteContent('me', script)
    console.log(chalk.cyan('[CMD]'), 'Executing script:', script)
    await eval(`(async () => { ${content} })()`)
  }
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

const refreshBrowserHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  if (!ctx.fromMe) return null
  await browser.refreshContext()
  return ctx.reactSuccess()
}

const getStatusHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  if (!ctx.fromMe) return null
  if (ctx.args[0] == '' && !ctx.contextInfo?.quotedMessage?.contactMessage) {
    return ctx.reply(stringId.getStatus.usage(ctx.prefix))
  }
  let jid = ctx.args[0]

  const vcard = ctx.contextInfo?.quotedMessage?.contactMessage?.vcard || ''
  if (vcard) {
    const _jid = vcard.match(/waid=(\d+)/)?.[1]
    if (!_jid) return ctx.reply(stringId.getStatus.error.notFound)
    jid = _jid
  }

  if (jid.startsWith('0')) jid = jid.replace('0', '62')
  if (!jid.endsWith('@s.whatsapp.net')) jid += '@s.whatsapp.net'

  const status = await getStatus(jid)
  if (!status) return ctx.reply(stringId.getStatus.error.notFound)

  let message = `Status from @${jid.replace('@s.whatsapp.net', '')}\n\n`
  let i = 1
  for (const stat of status) {
    message += `${i}. ${
      stat.message.conversation ||
      stat.message.extendedTextMessage?.text ||
      stat.message.imageMessage?.caption ||
      stat.message.videoMessage?.caption ||
      '(no caption)'
    }\n`
    i++
  }
  message += `\nReply this message with number to download status`

  return _wa.sendMessage(ctx.from, { text: message, mentions: [jid] })
}
