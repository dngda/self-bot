import { HandlerFunction, MessageContext } from '../types.js'
import { WAMessage, WASocket } from 'baileys'
import { getPrefix } from '../utils/_index.js'
import { actions } from '../handler.js'
import { getMenu, menu } from '../menu.js'
import stringId from '../language.js'
import lodash from 'lodash'

export default () => {
    pingCmd()
    menuCmd()
    hideTagCmd()
}

const pingCmd = () => {
    stringId.ping = {
        hint: '➡️ _Balas dengan pong!_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'ping',
        hint: stringId.ping.hint,
        alias: 'p',
        type: 'general',
    })

    Object.assign(actions, {
        ping: pingHandler,
    })
}

const pingHandler: HandlerFunction = async (
    _wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const processTime = Date.now() - (msg.messageTimestamp as number) * 1000
    const sent = await ctx.reply(`Pong _${processTime} ms!_`)
    if (ctx.fromMe) {
        _wa.chatModify(
            {
                deleteForMe: {
                    key: msg.key,
                    timestamp: msg.messageTimestamp as number,
                    deleteMedia: false,
                },
            },
            ctx.from
        )
    }
    return sent
}

const menuCmd = () => {
    stringId.menu = {
        hint: '📜 _Menampilkan pesan ini_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'menu',
        hint: stringId.menu.hint,
        alias: 'm, start, help, ?',
        type: 'general',
    })

    Object.assign(actions, {
        menu: menuHandler,
    })
}

const q3 = '```'

const menuHandler: HandlerFunction = (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const m = (namaMenu: string) => `${q3}${ctx.prefix}${namaMenu}${q3}`

    let menuMsg = `
!------------ Help - Usage ------------!\n`

    menuMsg += `${q3} ___              ___      _
/ __| ___ _ _ ___| _ ) ___| |_
\\__ \\/ -_) '_/ _ \\ _ \\/ _ \\  _|
|___/\\___|_| \\___/___/\\___/\\__|${q3}
`

    menuMsg += `\u200E`.repeat(2000) // Add spoiler tag (read more button)
    menuMsg += `\n_Active prefix:_ ${
        getPrefix().startsWith('[') ? 'regex: ' + getPrefix() : getPrefix()
    }\n`

    let menus = getMenu()
    if (!ctx.fromMe) {
        menus = menus.filter((menu) => !menu.hidden)
    }

    const menuTypes = menus.map((menu) => {
        return menu.type
    })

    let setMenuTypes = lodash.uniq(menuTypes)
    if (!ctx.fromMe)
        setMenuTypes = setMenuTypes.filter(
            (type) => !type.match(/owner|config/i)
        )
    for (const type of setMenuTypes) {
        menuMsg += `\n✪ 〘 ${type.replace(/^\w/, (c: string) =>
            c.toUpperCase()
        )} 〙 ✪`
        for (const sub of menus.filter((menu) => menu.type === type)) {
            const alias = [sub.command]
                .concat((sub.alias || '').split(/, ?| ,/).filter((a) => a))
                .map((a: string) => {
                    if (sub.noprefix) return m(a).replace(ctx.prefix, '')
                    return m(a)
                })
            menuMsg += `\n${alias.join(' or ')}\n`
            menuMsg += `   ${sub.hint}`
        }
        menuMsg += '\n\n'
    }
    menuMsg += `\n-> Perhitungan matematika pake prefix '='`
    menuMsg += `\n\t\t(cth: =10x1+2)\n`
    menuMsg += `\n-> Quote pesan perintah dengan '-r' untuk mengulang perintah\n`
    if (!ctx.fromMe) {
        menuMsg += `\nCode: https://github.com/dngda/self-bot `
        menuMsg += `\nPlease star ⭐ or fork 🍴 if you like!`
        menuMsg += `\nThanks for using this bot! 🙏`
    }

    return ctx.send(menuMsg)
}

const hideTagCmd = () => {
    stringId.tag = {
        hint: '🏷️ _Mention semua member group_',
        error: {
            noArgs: () => '‼️ Tidak ada isi pesan yang diberikan!',
            nonGroup: () =>
                '‼️ Perintah ini hanya bisa digunakan di dalam grup!',
        },
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'tag',
        hint: stringId.tag.hint,
        alias: 'all',
        type: 'general',
    })

    Object.assign(actions, {
        tag: hideTagHandler,
    })
}

const hideTagHandler: HandlerFunction = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, from, isGroup, expiration, isQuoted } = ctx
    if (!isGroup) throw new Error(stringId.tag.error.nonGroup())
    if (!arg && !isQuoted) throw new Error(stringId.tag.error.noArgs())

    await ctx.reactWait()
    const groupMetadata = await wa.groupMetadata(from)
    const participants = groupMetadata.participants
    const mentions: string[] = []
    for (const participant of participants) {
        const contact = participant.id
        if (contact) mentions.push(contact)
    }

    ctx.reactSuccess()
    if (isQuoted) {
        return wa.sendMessage(
            from,
            {
                forward: {
                    key: {
                        id: ctx.contextInfo?.stanzaId,
                    },
                    message: ctx.quotedMsg,
                },
                contextInfo: {
                    mentionedJid: mentions,
                },
            },
            {
                ephemeralExpiration: expiration!,
            }
        )
    } else {
        return wa.sendMessage(
            from,
            {
                text: arg,
                contextInfo: {
                    mentionedJid: mentions,
                },
            },
            {
                ephemeralExpiration: expiration!,
            }
        )
    }
}
