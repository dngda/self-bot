import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { getPrefix } from '../utils/_index'
import { actions } from '../handler'
import { getMenu, menu } from '../menu'
import stringId from '../language'
import lodash from 'lodash'
import { MessageContext } from '../types'

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

const pingHandler = async (
    _wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const processTime = Date.now() - (msg.messageTimestamp as number) * 1000
    const sent = await ctx.reply(`Pong _${processTime} ms!_`)
    if (sent && ctx.fromMe) {
        await _wa.chatModify(
            {
                clear: {
                    messages: [
                        {
                            id: msg.key.id as string,
                            fromMe: msg.key.fromMe as boolean,
                            timestamp: msg.messageTimestamp as number,
                        },
                    ],
                },
            },
            ctx.from
        )
    }
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

const menuHandler = (_wa: WASocket, _msg: WAMessage, ctx: MessageContext) => {
    const m = (namaMenu: string) => `*${ctx.prefix}${namaMenu}*`

    let menuMsg = `${q3} ___              ___      _   
/ __| ___ _ _ ___| _ ) ___| |_ 
\\__ \\/ -_) '_/ _ \\ _ \\/ _ \\  _|
|___/\\___|_| \\___/___/\\___/\\__|${q3}
`

    menuMsg += `
!------------ Help - Usage ------------!\n`
    menuMsg += `\u200E`.repeat(850) // Add spoiler tag (read more button)
    menuMsg += ` _Accepted prefix:_ '${getPrefix()}'\n`
    const menus = getMenu()
    const menuTypes = menus.map((menu) => {
        return menu.type
    })
    let setMenuTypes = lodash.uniq(menuTypes)
    if (!ctx.fromMe)
        setMenuTypes = setMenuTypes.filter(
            (type) => !type.match(/owner|config/i)
        )
    for (const type of setMenuTypes) {
        menuMsg += `\n╔══✪〘 ${type.replace(/^\w/, (c: string) =>
            c.toUpperCase()
        )} 〙✪`
        for (const sub of menus.filter((menu) => menu.type === type)) {
            const alias = sub.alias
                .split(', ')
                .concat(sub.command)
                .map((a: string) => {
                    return m(a)
                })
            menuMsg += `\n╠> ${alias.join(' or ')}\n`
            menuMsg += `║   ${sub.hint}`
        }
        menuMsg += '\n╚══✪\n'
    }
    menuMsg += `\n-> Perhitungan matematika pake prefix '='`
    menuMsg += `\n\t\t(cth: =10x1+2)\n`
    menuMsg += `\n-> Quote pesan perintah dengan '-r' untuk mengulang perintah\n`
    if (!ctx.fromMe) {
        menuMsg += `\nCode: https://github.com/dngda/self-bot `
        menuMsg += `\nPlease star ⭐ or fork 🍴 if you like!`
        menuMsg += `\nThanks for using this bot! 🙏`
    }
    ctx.send(menuMsg)
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

const hideTagHandler = async (
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

    if (isQuoted) {
        await wa.sendMessage(
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
        await wa.sendMessage(
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

    await ctx.reactSuccess()
}

export default () => {
    pingCmd()
    menuCmd()
    hideTagCmd()
}
