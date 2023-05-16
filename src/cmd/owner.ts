import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'
import { browser } from '../..'

export default function () {
  Object.assign(actions, {
    eval: evalJS,
    return: evalJSON,
    offline: offlineHandler,
    rbrowser: refreshBrowserHandler,
  })

  stringId.eval = {
    hint: '_Evaluate JS/TS code_',
  }
  stringId.return = {
    hint: '_Evaluate JS/TS variable dan return hasilnya_',
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

const evalJSON = async (_wa: WASocket, _msg: WAMessage, data: MessageData) => {
  if (!data.fromMe) return null
  data.reactSuccess()
  return await data.reply(JSON.stringify(eval(data.arg), null, 2))
}

const evalJS = async (_wa: WASocket, _msg: WAMessage, data: MessageData) => {
  if (!data.fromMe) return null
  data.reactSuccess()
  return eval(`(async () => { ${data.arg} })()`)
}

const offlineHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  await _wa.sendPresenceUpdate('unavailable')
  return data.reactSuccess()
}

const refreshBrowserHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  await browser.refreshContext()
  return data.reactSuccess()
}
