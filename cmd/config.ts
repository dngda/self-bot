import { WAMessage, WASocket } from '@adiwajshing/baileys'
import langId from '../src/lang'
import { config } from '../src/handler'
import { MessageData, replyText } from '../utils'

export const changePublicHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return
  const isPublic = config.publicModeChats.includes(data.from)
  if (isPublic) {
    config.publicModeChats = config.publicModeChats.filter(
      (x) => x !== data.from
    )
  } else {
    config.publicModeChats.push(data.from)
  }
  await replyText(waSocket, data.from, langId.info(isPublic), msg)
}
