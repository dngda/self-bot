import { WAMessage, WASocket } from '@adiwajshing/baileys'
import langId from '../src/lang'
import { config } from '../src/handler'
import { replyText } from '../utils'

export const changePublicHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
  const isPublic = config.isPublic.includes(data.from)
  if (isPublic) {
    config.isPublic = config.isPublic.filter((x) => x !== data.from)
  } else {
    config.isPublic.push(data.from)
  }
  await replyText(waSocket, data.from, langId.info(isPublic), msg)
}
