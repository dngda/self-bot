import { WAMessage, WASocket } from '@adiwajshing/baileys'
import stringId from '../src/language'
import { config } from '../src/handler'
import { MessageData, replyText } from '../utils'

export const changePublicHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return
  let isPublic = config.publicModeChats.includes(data.from)
  if (isPublic) {
    config.publicModeChats = config.publicModeChats.filter(
      (x) => x !== data.from
    )
    isPublic = false
  } else {
    config.publicModeChats.push(data.from)
    isPublic = true
  }
  await replyText(waSocket, data.from, stringId.public.info(isPublic), msg)
}
