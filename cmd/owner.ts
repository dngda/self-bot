import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData, replyText } from '../utils'

export const evalJSON = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return
  try {
    const { quotedMsg } = data
    if (quotedMsg) {
      await replyText(
        waSocket,
        data.from,
        JSON.stringify(quotedMsg, null, 2),
        msg
      )
    } else {
      await replyText(
        waSocket,
        data.from,
        JSON.stringify(eval(data.args), null, 2),
        msg
      )
    }
  } catch (error) {
    console.log(error)
    await replyText(waSocket, data.from, `${error}`, msg)
  }
}

export const evalJS = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return
  try {
    eval(`(async () => { ${data.args} })()`)
  } catch (error) {
    console.log(error)
    await replyText(waSocket, data.from, `${error}`, msg)
  }
}
