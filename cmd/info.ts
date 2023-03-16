import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { replyText, sendMessageReply, sendText } from '../utils'

export const pingHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  const processTime = Date.now() - msg.messageTimestamp * 1000
  await replyText(waSocket, data.from, `Pong _${processTime} ms!_`, msg)
}

export const helpHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  await replyText(
    waSocket,
    data.from,
    `Commands yang tersedia:
ping - balas dengan pong!
help - tampilkan pesan ini
sticker - convert media to sticker`,
    msg
  )
}

export const evalJSON = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
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
}

export const evalJS = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
  eval(data.args)
}
