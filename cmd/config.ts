import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { config } from '../src/handler'
import { replyText } from '../utils'

export const changePublicHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
  config.isPublic = !config.isPublic
  await replyText(
    waSocket,
    data.from,
    `Bot is now ${config.isPublic ? 'public' : 'private'}`,
    msg
  )
}
