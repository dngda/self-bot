import { WAMessage, WASocket } from 'baileys'
import { actions, configManager } from '../handler.js'
import stringId from '../language.js'
import { findMenu, menu } from '../menu.js'
import { getPrefix, resetPrefix, setPrefix } from '../utils/_index.js'
import { HandlerFunction, MessageContext } from '../types.js'

export default function registerConfigCommands() {
    setPrefixCmd()
    toggleConfigCmd()
    toggleAllowChatCmd()
    stickerAsCommandCmd()
    getConfigCmd()
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
                ? `🍻 Chat allowed! Send *${prefix}help* to start`
                : `🤳🏼 Self-mode aktif`,
    }

    menu.push({
        command: 'allow',
        hint: stringId.allow.hint,
        alias: 'deny',
        type: 'config',
    })

    Object.assign(actions, {
        allow: toggleAllowHandler,
    })
}

const toggleAllowHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) throw stringId.allow.error.notSelf()

    let isAllowed = configManager.isAllowedChat(ctx.from)

    if (ctx.cmd === 'allow') {
        if (!isAllowed) {
            configManager.addAllowedChat(ctx.from)
            isAllowed = true
        }
    } else if (isAllowed) {
        configManager.removeAllowedChat(ctx.from)
        isAllowed = false
    }

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
            invalidCmd: () => '‼️ Command tidak valid',
        },
        usage: (ctx: MessageContext) =>
            `Reply sticker dengan: ${ctx.prefix}scmd <cmd> <arg>
➡️ Contoh: ${ctx.prefix}scmd sticker -r -nobg
    atau hapus scmd dengan: ${ctx.prefix}dscmd <cmd>`,
        success: (cmd: string) =>
            `✅ Sticker dengan command "${cmd}" berhasil ditambahkan`,
        info: (cmd: string) =>
            `✅ Sticker dengan command "${cmd}" berhasil dihapus`,
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

const listStickerCommands = (ctx: MessageContext) => {
    const stickerCommands = configManager.getAllStickerCommands()
    const entries = Object.entries(stickerCommands)

    if (entries.length === 0) {
        return ctx.reply('‼️ Tidak ada sticker command yang terdaftar')
    }

    const replyMsg = entries
        .map(
            ([sha, { cmd, arg }]) =>
                `• Command: ${cmd} ${arg}\n  Sticker SHA256: ${sha}`
        )
        .join('\n\n')

    return ctx.reply(`📋 Daftar Sticker Command:\n\n${replyMsg}`)
}

const deleteStickerCommand = async (sha: string, ctx: MessageContext) => {
    const stickerCmd = configManager.getStickerCommand(sha)

    if (!stickerCmd) {
        await ctx.reactError()
        return ctx.reply(stringId.stickerCmd.error.notExist())
    }

    const { cmd, arg } = stickerCmd
    configManager.deleteStickerCommand(sha)
    await ctx.reactSuccess()
    return ctx.reply(stringId.stickerCmd.info?.(`${cmd} ${arg}`) ?? '')
}

const addStickerCommand = async (stickerSha: string, ctx: MessageContext) => {
    const cmd = ctx.args[0]
    const arg = ctx.arg.replace(cmd, '').trim()

    if (!cmd) return ctx.reply(stringId.stickerCmd.usage(ctx))
    if (!findMenu(cmd)) return ctx.reply(stringId.stickerCmd.error.invalidCmd())

    if (configManager.hasStickerCommand(stickerSha)) {
        const existingCmd = configManager.getStickerCommand(stickerSha)!
        return ctx.reply(stringId.stickerCmd.error.exist(existingCmd))
    }

    configManager.setStickerCommand(stickerSha, { cmd, arg })
    await ctx.reactSuccess()
    return ctx.reply(stringId.stickerCmd.success?.(`${cmd} ${arg}`) ?? '')
}

const getStickerSha = (ctx: MessageContext): string | null => {
    const quoted = ctx.quotedMsg
    if (!quoted?.stickerMessage?.fileSha256) return null
    return Buffer.from(quoted.stickerMessage.fileSha256).toString('base64')
}

const stickerAsCmdHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined

    // Handle list command
    if (ctx.arg === 'list') {
        return listStickerCommands(ctx)
    }

    // Handle delete by SHA (without quoted message)
    if (ctx.cmd === 'dscmd' && !ctx.quotedMsg) {
        const sha = ctx.args[0]
        if (!sha) return ctx.reply(stringId.stickerCmd.usage(ctx))
        return deleteStickerCommand(sha, ctx)
    }

    // Get sticker SHA from quoted message
    const stickerSha = getStickerSha(ctx)
    if (!stickerSha) {
        return ctx.reply(stringId.stickerCmd.usage(ctx))
    }

    // Handle delete with quoted sticker
    if (ctx.cmd === 'dscmd') {
        return deleteStickerCommand(stickerSha, ctx)
    }

    // Handle add sticker command
    return addStickerCommand(stickerSha, ctx)
}

const setPrefixCmd = () => {
    stringId.setPrefix = {
        hint: '⚙️ _Prefix management_',
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

const setPrefixHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined
    if (ctx.cmd === 'resetprefix') {
        resetPrefix()
        return ctx.reply(stringId.setPrefix.info?.() ?? '')
    } else if (ctx.cmd === 'cekprefix') {
        return ctx.reply(`Prefix: '${getPrefix()}'`)
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
        return ctx.reply(stringId.setPrefix.success?.(prefix) ?? '')
    }
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
- norevoke_status: The revoked status message will be forwarded to the owner.
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

const configHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined

    const configName = ctx.args[0]
    const thisChat = ctx.arg.includes('this')
    const status = ctx.cmd === 'con'

    if (!configName) {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    const validConfigs = [
        'public',
        'norevoke',
        'norevoke_status',
        'oneview',
        'autosticker',
    ]

    if (!validConfigs.includes(configName)) {
        ctx.reply(stringId.toggleConfig.usage(ctx))
        return
    }

    if (['norevoke', 'autosticker'].includes(configName) && thisChat) {
        toggleChatSpecificConfig(configName, status, ctx.from)
    } else {
        if (configName === 'autosticker') return ctx.reactError()
        toggleGlobalConfig(configName, status)
    }

    return ctx.reactSuccess()
}

const toggleGlobalConfig = (configName: string, status: boolean) => {
    switch (configName) {
        case 'public':
            configManager.setPublic(status)
            break
        case 'norevoke':
            configManager.setNoRevoke(status)
            break
        case 'oneview':
            configManager.setPeekOneView(status)
            break
        case 'norevoke_status':
            configManager.setNoRevokeStatus(status)
            break
    }
}

const toggleChatSpecificConfig = (
    configName: string,
    status: boolean,
    chatId: string
) => {
    const isNorevoke = configName === 'norevoke'
    const shouldRemove = isNorevoke ? status : !status

    if (isNorevoke) {
        if (shouldRemove) {
            configManager.removeNoRevokeException(chatId)
        } else {
            configManager.addNoRevokeException(chatId)
        }
    } else if (shouldRemove) {
        configManager.disableAutoSticker(chatId)
    } else {
        configManager.enableAutoSticker(chatId)
    }
}

const getConfigCmd = () => {
    stringId.getConfig = {
        hint: '⚙️ _Get current config_',
        error: {},
        usage: (_) => '',
        success: (configSummary: string) =>
            `📋 Current Config:\n\n${configSummary}`,
    }

    menu.push({
        command: 'conf',
        hint: stringId.getConfig.hint,
        type: 'config',
    })

    Object.assign(actions, {
        conf: getConfigHandler,
    })
}

const getConfigHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.fromMe) return undefined

    const configSummary = configManager.getConfigSummary()
    return ctx.reply(stringId.getConfig.success?.(configSummary) ?? '')
}
