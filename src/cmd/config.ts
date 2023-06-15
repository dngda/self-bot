import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageData } from '../utils'
import stringId from '../language'
import { actions, config } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    toggle: togglePublicHandler,
    scmd: stickerCmdHandler,
  })

  stringId.public = {
    hint: '⚙️ _Toggle public mode pada chat ini_',
    info: (isPublic: boolean, prefix: string) =>
      isPublic
        ? `❕Public-mode aktif, semua member akan direspon bot!\n-> Coba kirimkan: _${prefix}help_`
        : `❕Self-mode aktif`,
  }

  stringId.stickerCmd = {
    hint: '⚙️ _Set sticker command_',
    error: {
      exist: (scmd: { cmd: string; arg: string }) =>
        `‼️ Sticker sudah terdaftar sebagai command: ${scmd.cmd} ${
          scmd.arg ? scmd.arg : ''
        }`,
      notExist: '‼️ Sticker tidak terdaftar',
    },
    usage: (data: MessageData) =>
      `Reply sticker dengan: ${data.prefix}scmd <cmd> <arg>
➡️ Contoh: ${data.prefix}scmd sticker -r -nobg
   atau hapus scmd dengan: ${data.prefix}dscmd <cmd>`,
    success: (cmd: string) =>
      `✅ Sticker dengan cmd "${cmd}" berhasil ditambahkan`,
    deleted: (cmd: string) => `✅ Sticker dengan cmd "${cmd}" berhasil dihapus`,
  }

  menu.push(
    {
      command: 'toggle',
      hint: stringId.public.hint,
      alias: 'mode',
      type: 'config',
    },
    {
      command: 'scmd',
      hint: stringId.stickerCmd.hint,
      alias: 'dscmd',
      type: 'config',
    }
  )
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

const stickerCmdHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  if (!data.fromMe) return

  const quoted = data.quotedMsg
  if (!quoted?.stickerMessage?.fileSha256) {
    data.reply(stringId.stickerCmd.usage(data))
    return
  }
  const stickerSha = Buffer.from(quoted.stickerMessage?.fileSha256!).toString(
    'base64'
  )

  if (data.cmd === 'dscmd') {
    if (stickerSha in config.stickerCommands) {
      const { cmd, arg } = config.stickerCommands[stickerSha]

      delete config.stickerCommands[stickerSha]
      data.reply(stringId.stickerCmd.deleted(`${cmd} ${arg}`))
    } else {
      data.reply(stringId.stickerCmd.error.notExist)
    }
  } else {
    const cmd = data.args[0]
    const arg = data.arg.replace(cmd, '').trim()
    if (!cmd) {
      data.reply(stringId.stickerCmd.usage(data))
      return
    }
    if (stickerSha in config.stickerCommands) {
      data.reply(
        stringId.stickerCmd.error.exist(config.stickerCommands[stickerSha])
      )
      return
    }
    config.stickerCommands[stickerSha] = { cmd, arg }
    data.reply(stringId.stickerCmd.success(`${cmd} ${arg}`))
  }
}
