import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions, config } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    toggle: togglePublicHandler,
  })

  stringId.public = {
    hint: '⚙️ _Toggle public mode pada chat ini_',
    info: (isPublic: boolean, prefix: string) =>
      `ℹ️ Bot sekarang dalam mode ${
        isPublic
          ? `*Public* di chat ini.\n➡️ Coba kirimkan "${prefix}help"`
          : '*Private*'
      }`,
  }

  menu.push({
    command: 'toggle',
    hint: stringId.public.hint,
    alias: 'mode',
    type: 'config',
  })
}

const togglePublicHandler = async (
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
  data.reply(stringId.public.info(isPublic, data.prefix))
}
