import { HandlerFunction, MessageContext } from '../types.js'
import { WAMessage, WASocket } from 'baileys'
import { getPrefix } from '../utils/_index.js'
import { actions } from '../handler.js'
import { getMenu, menu } from '../menu.js'
import stringId from '../language.js'
import lodash from 'lodash'
import fs from 'node:fs'

export default function registerGeneralCommands() {
    pingCmd()
    menuCmd()
    hideTagCmd()
    extCmd()
}

type RsaEntry = {
    type: 'entry'
    name: string
    value: string | null
}

type RsaGroup = {
    type: 'group'
    name: string
}

type RsaSection = {
    id: string
    title: string
    rows: Array<RsaEntry | RsaGroup>
}

type RsaRepo = {
    sections: RsaSection[]
}

const rsaRepo = JSON.parse(
    fs.readFileSync('./data/rsa.json', 'utf-8')
) as RsaRepo

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

    menuMsg += String.raw`${q3} ___              ___      _
/ __| ___ _ _ ___| _ ) ___| |_
\__ \/ -_) '_/ _ \ _ \/ _ \  _|
|___\___|_| \___/___\___\__|${q3}
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
            (type) => !/owner|config/i.exec(type)
        )
    for (const type of setMenuTypes) {
        menuMsg += `\n✪ 〘 ${type.replace(/^\w/, (c: string) =>
            c.toUpperCase()
        )} 〙 ✪`
        for (const sub of menus.filter((menu) => menu.type === type)) {
            const alias = [sub.command]
                .concat((sub.alias || '').split(/, ?| ,/).filter(Boolean))
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

const extCmd = () => {
    stringId.ext = {
        hint: '📞 _Cari ekstensi dari data RSA_ ',
        error: {
            noArgs: () => '‼️ Tidak ada argumen yang diberikan!',
            notFound: (ctx: MessageContext) =>
                `‼️ Tidak ada data ext yang cocok untuk "${ctx.arg}".`,
        },
        usage: (ctx: MessageContext) =>
            `📞 Cari ekstensi dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <kata kunci>
⚠️ Bisa cari berdasarkan nama, ext, atau bagian nama section
⚠️ Contoh: ${ctx.prefix}${ctx.cmd} farmasi`,
    }

    menu.push({
        command: 'ext',
        hint: stringId.ext.hint,
        alias: 'extension',
        type: 'general',
    })

    Object.assign(actions, {
        ext: extHandler,
    })
}

const extHandler: HandlerFunction = async (_wa, _msg, ctx) => {
    if (!ctx.arg || ctx.arg.trim() === '') throw stringId.ext.usage(ctx)

    const queryTokens = ctx.arg
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
    const matches = rsaRepo.sections
        .map((section) => ({
            sectionTitle: section.title,
            rows: section.rows.filter((row): row is RsaEntry => {
                if (row.type !== 'entry' || !row.value) return false

                const searchable = [section.title, row.name, row.value]
                    .join(' ')
                    .toLowerCase()

                return queryTokens.every((token) => searchable.includes(token))
            }),
        }))
        .filter((section) => section.rows.length > 0)

    if (matches.length === 0) throw stringId.ext.error.notFound(ctx)

    ctx.reactWait()

    let message = `Query: ${ctx.arg}\n`
    for (const section of matches) {
        message += `- ${section.sectionTitle}\n`
        for (const row of section.rows) {
            message += `${row.name} : ${row.value}\n`
        }
    }

    ctx.reactSuccess()
    return ctx.reply(message)
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
