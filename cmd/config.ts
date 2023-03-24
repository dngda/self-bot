import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../src/language'
import { config } from '../src/handler'

export const changePublicHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return
  let isPublic = config.publicModeChats.includes(data.from)
  if (isPublic) {
    config.publicModeChats = config.publicModeChats.filter(
      (x: any) => x !== data.from
    )
    isPublic = false
  } else {
    config.publicModeChats.push(data.from)
    isPublic = true
  }
  data.reply(stringId.public.info(isPublic))
}
