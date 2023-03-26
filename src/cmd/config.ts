import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions, config } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    public: changePublicHandler,
  })

  stringId.public = {
    hint: '⚙️ Toggle public mode pada chat ini',
    info: (isPublic: boolean) =>
      `ℹ️ Bot sekarang dalam mode ${
        isPublic ? '*Publik* di chat ini.\n➡️ Coba kirimkan "!help"' : '*Private*'
      }`,
  }

  menu.push({
    command: 'public',
    hint: stringId.public.hint,
    alias: 'mode',
    type: 'config',
  })
}

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
