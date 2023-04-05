import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    eval: evalJS,
    return: evalJSON,
  })

  stringId.eval = {
    hint: 'Evaluate JS/TS code',
  }
  stringId.return = {
    hint: 'Evaluate JS/TS variable dan return hasilnya',
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
    }
  )
}

const evalJSON = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  data.reactSuccess()
  return await data.reply(JSON.stringify(eval(data.args), null, 2))
}

const evalJS = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  data.reactSuccess()
  return eval(`(async () => { ${data.args} })()`)
}
