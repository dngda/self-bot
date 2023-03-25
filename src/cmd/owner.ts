import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'

export const evalJSON = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  return await data.reply(JSON.stringify(eval(data.args), null, 2))
}

export const evalJS = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return null
  return eval(`(async () => { ${data.args} })()`)
}
