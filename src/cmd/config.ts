import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { actions, config, updateConfig } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { getPrefix, resetPrefix, setPrefix } from '../utils/_index'
import { MessageContext } from '../types'

export default () => {
    setPrefixCmd()
    toggleConfigCmd()
    toggleAllowChatCmd()
    stickerAsCommandCmd()
}

const toggleAllowChatCmd = () => {
    stringId.allow = {
        hint: '⚙️ _Toggle allow pada chat ini_',
        error: {
            notSelf: () => '‼️ Self only command',
        },
        usage: (_: MessageContext) => '',
        info: (isAllowed: boolean, prefix: string) =>
            isAllowed
                ? `🍻 Chat allowed, semua partisipan akan direspon bot!\n-> Cmd: *${prefix}help*`
                : `🤳🏼 Self-mode aktif`,
    }

    menu.push({
        command: 'allow',
        hint: stringId.allow.hint,
        alias: 'forbid',
        type: 'config',
    })

    Object.assign(actions, {
        allow: toggleAllowHandler,
    })
}

const toggleAllowHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) throw stringId.allow.error.notSelf()
    let isAllowed = config.allowed_chats.includes(ctx.from)
    if (ctx.cmd === 'forbid') {
        if (isAllowed) {
            config.allowed_chats = config.allowed_chats.filter(
                (x: string) => x !== ctx.from
            )
            isAllowed = false
        }
    } else {
        if (!isAllowed) {
            config.allowed_chats.push(ctx.from)
            isAllowed = true
        }
    }
    updateConfig()
    return ctx.reply(stringId.allow.info?.(isAllowed, ctx.prefix) ?? '')
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
        if (stickerSha in config.sticker_commands) {
            const { cmd, arg } = config.sticker_commands[stickerSha]

            delete config.sticker_commands[stickerSha]
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
        if (stickerSha in config.sticker_commands) {
            ctx.reply(
                stringId.stickerCmd.error.exist(
                    config.sticker_commands[stickerSha]
                )
            )
            return
        }
        config.sticker_commands[stickerSha] = { cmd, arg }
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
Reset prefix dengan: *resetprefix*
Cek prefix aktif dengan: *cekprefix*`,
        info: () => '✅ Prefix berhasil direset',
    }

    menu.push({
        command: 'setprefix',
        hint: stringId.setPrefix.hint,
        alias: 'resetprefix, cekprefix',
        type: 'config',
        noprefix: true,
    })

    Object.assign(actions, {
        setprefix: setPrefixHandler,
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
    } else if (ctx.cmd === 'cekprefix') {
        await ctx.reply(`Prefix: '${getPrefix()}'`)
    } else {
        let prefix = ctx.arg
        if (!prefix) {
            ctx.reply(stringId.setPrefix.usage(ctx))
            return
        }

        if (prefix.length > 1 && !prefix.startsWith('[')) {
            prefix = prefix + ' '
        }

        setPrefix(prefix.trim())
        ctx.reply(stringId.setPrefix.success?.(prefix) ?? '')
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
- autosticker: Auto convert image to sticker
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
    const thisChat = ctx.arg.includes('this')
    const status = ctx.cmd === 'con'

    if (!configName) {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    if (!(configName in config)) {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    if (['norevoke', 'autosticker'].includes(configName) && thisChat) {
        toggleChatSpecificConfig(configName, status, ctx.from)
    } else {
        if (configName === 'autosticker') return ctx.reactError()
        toggleGlobalConfig(configName, status)
    }

    updateConfig()
    return ctx.reactSuccess()
}

const toggleGlobalConfig = (configName: string, status: boolean) => {
    config[configName] = status
}

const toggleChatSpecificConfig = (
    configName: string,
    status: boolean,
    chatId: string
) => {
    const isNorevoke = configName === 'norevoke'
    const key = isNorevoke ? 'norevoke_exceptions' : 'autosticker'
    const targetList = config[key] as string[]

    const shouldRemove = isNorevoke ? status : !status

    if (shouldRemove) {
        config[key] = targetList.filter((x: string) => x !== chatId)
    } else {
        if (!targetList.includes(chatId)) {
            targetList.push(chatId)
        }
    }
}
