import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageContext, resetPrefix, setPrefix } from '../utils'
import stringId from '../language'
import { actions, config, updateConfig } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    toggle: togglePublicHandler,
    scmd: stickerCmdHandler,
    setp: setPrefixHandler,
  })

  stringId.public = {
    hint: '⚙️ _Toggle public mode pada chat ini_',
    info: (isPublic: boolean, prefix: string) =>
      isPublic
        ? `❕Public-mode aktif, semua member akan direspon bot!\n-> Coba kirimkan: *${prefix}help*`
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
    usage: (ctx: MessageContext) =>
      `Reply sticker dengan: ${ctx.prefix}scmd <cmd> <arg>
➡️ Contoh: ${ctx.prefix}scmd sticker -r -nobg
   atau hapus scmd dengan: ${ctx.prefix}dscmd <cmd>`,
    success: (cmd: string) =>
      `✅ Sticker dengan cmd "${cmd}" berhasil ditambahkan`,
    deleted: (cmd: string) => `✅ Sticker dengan cmd "${cmd}" berhasil dihapus`,
  }

  stringId.setPrefix = {
    hint: '⚙️ _Set prefix_',
    usage: (ctx: MessageContext) =>
      `Set prefix dengan: ${ctx.prefix}setp <prefix>
➡️ Contoh: ${ctx.prefix}setp !`,
    success: (prefix: string) =>
      `✅ Prefix berhasil diubah menjadi "${prefix}"`,
    reseted: '✅ Prefix berhasil direset',
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
    },
    {
      command: 'setp',
      hint: stringId.setPrefix.hint,
      alias: 'setprefix, resetprefix',
      type: 'config',
    }
  )
}

const togglePublicHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  if (!ctx.fromMe) return
  let isPublic = config.publicModeChats.includes(ctx.from)
  if (isPublic) {
    config.publicModeChats = config.publicModeChats.filter(
      (x: any) => x !== ctx.from
    )
    isPublic = false
  } else {
    config.publicModeChats.push(ctx.from)
    isPublic = true
  }
  updateConfig()
  return ctx.reply(stringId.public.info(isPublic, ctx.prefix))
}

const stickerCmdHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  if (!ctx.fromMe) return

  const quoted = ctx.quotedMsg
  if (!quoted?.stickerMessage?.fileSha256) {
    ctx.reply(stringId.stickerCmd.usage(ctx))
    return
  }
  const stickerSha = Buffer.from(quoted.stickerMessage?.fileSha256!).toString(
    'base64'
  )

  if (ctx.cmd === 'dscmd') {
    if (stickerSha in config.stickerCommands) {
      const { cmd, arg } = config.stickerCommands[stickerSha]

      delete config.stickerCommands[stickerSha]
      updateConfig()
      await ctx.reactSuccess()
      return ctx.reply(stringId.stickerCmd.deleted(`${cmd} ${arg}`))
    } else {
      await ctx.reactError()
      return ctx.reply(stringId.stickerCmd.error.notExist)
    }
  } else {
    const cmd = ctx.args[0]
    const arg = ctx.arg.replace(cmd, '').trim()
    if (!cmd) {
      ctx.reply(stringId.stickerCmd.usage(ctx))
      return
    }
    if (stickerSha in config.stickerCommands) {
      ctx.reply(
        stringId.stickerCmd.error.exist(config.stickerCommands[stickerSha])
      )
      return
    }
    config.stickerCommands[stickerSha] = { cmd, arg }
    updateConfig()
    await ctx.reactSuccess()
    return ctx.reply(stringId.stickerCmd.success(`${cmd} ${arg}`))
  }
}

const setPrefixHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  if (!ctx.fromMe) return
  if (ctx.cmd === 'resetprefix') {
    resetPrefix()
    return ctx.reply(stringId.setPrefix.reseted)
  } else {
    const prefix = ctx.arg
    if (!prefix) {
      ctx.reply(stringId.setPrefix.usage(ctx))
      return
    }
    if (prefix.length > 1) {
      setPrefix(`${prefix} `)
      ctx.reply(stringId.setPrefix.success(`${prefix} `))
    } else {
      setPrefix(prefix)
      ctx.reply(stringId.setPrefix.success(prefix))
    }
  }

  return ctx.reactSuccess()
}
