import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { getNoteContent, getNotesNames } from '../lib'
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
    }
  )
}

const evalJSON = async (
  _wa: WASocket,
  _msg: WAMessage,
  _ctx: MessageContext
) => {
  if (!_ctx.fromMe) return null
  _ctx.reactSuccess()
  return await _ctx.reply(JSON.stringify(eval(_ctx.arg), null, 2))
}

/* @ts-expect-error : reserved variables for eval */
let var1, var2, var3, var4, var5, var6, var7, var8, var9, var10

const evalJS = async (_wa: WASocket, _msg: WAMessage, ctx: MessageContext) => {
  if (!ctx.fromMe) return null
  if (ctx.cmd == 'eval') {
    _wa.sendMessage(ctx.from, { edit: _msg.key, text: '_Evaluating..._' })
  }
  ctx.reactSuccess()
  return eval(`(async () => { ${ctx.arg} })()`)
}

export const executeSavedScriptInNote = async (
  _wa: WASocket,
  _msg: WAMessage,
  _ctx: MessageContext
) => {
  const owner = process.env.OWNER_NUMBER!
  const notes = await getNotesNames(owner)
  const scripts = notes.filter((note) => note.startsWith('script_'))
  if (scripts.length == 0) return console.log('No saved script found')
  for (const script of scripts) {
    const content = await getNoteContent(owner, script)
    console.log(chalk.red('[CMD]'), 'Executing script:', script)
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
