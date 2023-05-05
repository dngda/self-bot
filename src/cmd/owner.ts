import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    eval: evalJS,
    return: evalJSON,
    offline: offlineHandler,
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
