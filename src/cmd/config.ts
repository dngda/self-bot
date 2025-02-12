import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { actions, config, updateConfig } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { resetPrefix, setPrefix } from '../utils/_index'
import { MessageContext } from '../types'

export default () => {
    setPrefixCmd()
    toggleConfigCmd()
    togglePublicChatCmd()
    stickerAsCommandCmd()
}

const togglePublicChatCmd = () => {
    stringId.public = {
        hint: '⚙️ _Toggle public mode pada chat ini_',
        error: {
            notSelf: () => '‼️ Self only command',
        },
        usage: (_: MessageContext) => '',
        info: (isPublic: boolean, prefix: string) =>
            isPublic
                ? `🍻 Chat public-mode aktif, semua partisipan akan direspon bot!\n-> Coba kirimkan: *${prefix}help*`
                : `🤳🏼 Self-mode aktif`,
    }

    menu.push({
        command: 'public',
        hint: stringId.public.hint,
        alias: 'mode',
        type: 'config',
    })

    Object.assign(actions, {
        public: togglePublicHandler,
    })
}

const togglePublicHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) throw stringId.public.error.notSelf()
    let isPublic = config.allowedChats.includes(ctx.from)
    if (isPublic) {
        config.allowedChats = config.allowedChats.filter(
            (x: string) => x !== ctx.from
        )
        isPublic = false
    } else {
        config.allowedChats.push(ctx.from)
        isPublic = true
    }
    updateConfig()
    return ctx.reply(stringId.public.info?.(isPublic, ctx.prefix) ?? '')
}

const stickerAsCommandCmd = () => {
    stringId.stickerCmd = {
        hint: '⚙️ _Set sticker command_',
        error: {
            exist: (scmd: { cmd: string; arg: string }) =>
                `‼️ Sticker sudah terdaftar sebagai command: ${scmd.cmd} ${
                    scmd.arg ? scmd.arg : ''
                }`,
            notExist: () => '‼️ Sticker tidak terdaftar',
        },
        usage: (ctx: MessageContext) =>
            `Reply sticker dengan: ${ctx.prefix}scmd <cmd> <arg>
➡️ Contoh: ${ctx.prefix}scmd sticker -r -nobg
    atau hapus scmd dengan: ${ctx.prefix}dscmd <cmd>`,
        success: (cmd: string) =>
            `✅ Sticker dengan cmd "${cmd}" berhasil ditambahkan`,
        info: (cmd: string) =>
            `✅ Sticker dengan cmd "${cmd}" berhasil dihapus`,
    }

    menu.push({
        command: 'scmd',
        hint: stringId.stickerCmd.hint,
        alias: 'dscmd',
        type: 'config',
    })

    Object.assign(actions, {
        scmd: stickerAsCmdHandler,
    })
}

const stickerAsCmdHandler = async (
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
    const stickerSha = Buffer.from(quoted.stickerMessage?.fileSha256).toString(
        'base64'
    )

    if (ctx.cmd === 'dscmd') {
        if (stickerSha in config.stickerCommands) {
            const { cmd, arg } = config.stickerCommands[stickerSha]

            delete config.stickerCommands[stickerSha]
            updateConfig()
            await ctx.reactSuccess()
            return ctx.reply(stringId.stickerCmd.info?.(`${cmd} ${arg}`) ?? '')
        } else {
            await ctx.reactError()
            return ctx.reply(stringId.stickerCmd.error.notExist())
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
                stringId.stickerCmd.error.exist(
                    config.stickerCommands[stickerSha]
                )
            )
            return
        }
        config.stickerCommands[stickerSha] = { cmd, arg }
        updateConfig()
        await ctx.reactSuccess()
        return ctx.reply(stringId.stickerCmd.success?.(`${cmd} ${arg}`) ?? '')
    }
}

const setPrefixCmd = () => {
    stringId.setPrefix = {
        hint: '⚙️ _Set prefix_',
        error: {
            notSelf: () => '‼️ Self only command',
        },
        usage: (ctx: MessageContext) =>
            `Set prefix dengan: ${ctx.prefix}setp <prefix>
➡️ Contoh: ${ctx.prefix}setp !`,
        success: (prefix: string) =>
            `✅ Prefix berhasil diubah menjadi "${prefix}"
➡️ Coba kirimkan: *${prefix}help*
➡️ Reset prefix dengan: *${prefix}resetprefix*
Cek prefix aktif dengan: *cekprefix*`,
        info: () => '✅ Prefix berhasil direset',
    }

    menu.push({
        command: 'setp',
        hint: stringId.setPrefix.hint,
        alias: 'setprefix, resetprefix',
        type: 'config',
    })

    Object.assign(actions, {
        setp: setPrefixHandler,
    })
}

const setPrefixHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return
    if (ctx.cmd === 'resetprefix') {
        resetPrefix()
        return ctx.reply(stringId.setPrefix.info?.() ?? '')
    } else {
        const prefix = ctx.arg
        if (!prefix) {
            ctx.reply(stringId.setPrefix.usage(ctx))
            return
        }
        if (prefix.length > 1) {
            setPrefix(prefix + ' ')
            ctx.reply(stringId.setPrefix.success?.(prefix + ' ') ?? '')
        } else {
            setPrefix(prefix)
            ctx.reply(stringId.setPrefix.success?.(prefix) ?? '')
        }
    }

    return ctx.reactSuccess()
}

const toggleConfigCmd = () => {
    stringId.toggleConfig = {
        hint: '⚙️ _Toggle config_',
        error: {},
        usage: (ctx: MessageContext) =>
            `Toggle config dengan: ${ctx.prefix}con <config> / coff <config>
Config:
- public: allow global chat to use bot
- norevoke: The revoked message will be forwarded to the owner.
- oneview: The OneView message will be forwarded and showed to the owner.
➡️ Contoh: ${ctx.prefix}con norevoke`,
        success: (config: string, status: boolean) =>
            `✅ Config "${config}" berhasil diubah menjadi "${status}"`,
    }

    menu.push({
        command: 'con',
        hint: stringId.toggleConfig.hint,
        alias: 'coff',
        type: 'config',
    })

    Object.assign(actions, {
        con: configHandler,
    })
}

const configHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return
    const configName = ctx.args[0]
    const status = ctx.cmd === 'con'
    if (!configName) {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    if (configName in config) {
        config[configName] = status
    } else {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    updateConfig()
    return ctx.reply(stringId.toggleConfig.success?.(configName, status) ?? '')
}
