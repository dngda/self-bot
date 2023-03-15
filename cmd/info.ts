import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { replyText, sendMessageReply } from '../utils'

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
