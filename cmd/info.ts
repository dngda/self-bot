import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { sendMessageReply } from '../utils'

export const pingHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  await sendMessageReply(waSocket, data.from, { text: 'pong!' }, msg)
}

export const helpHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  await sendMessageReply(
    waSocket,
    data.from,
    {
      text: `Commands yang tersedia:
ping - balas dengan pong!
help - tampilkan pesan ini
s - convert media to sticker`,
    },
    msg
  )
}
