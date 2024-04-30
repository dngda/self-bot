import { WAMessage, WASocket, delay } from '@whiskeysockets/baileys'
import { MessageContext } from '../utils'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'
import crypto from 'crypto'
import axios from 'axios'

export default function () {
    Object.assign(actions, {
        meme: gimmeHandler,
        roll: rollHandler,
    })

    stringId.gimme = {
        hint: '🌠 _Random reddit meme_',
        error: {
            internal: 'Terjadi error, coba lagi.',
        },
        usage: (p: string) =>
            `Custom subreddit setelah cmd, contoh: _${p}meme dankmemes_`,
    }

    stringId.roll = {
        hint: '🎲 _Roll a dice_',
    }

    menu.push({
        command: 'roll',
        hint: stringId.roll.hint,
        alias: 'r',
        type: 'random',
    })

    menu.push({
        command: 'meme',
        hint: stringId.gimme.hint,
        alias: 'reddit, ri',
        type: 'random',
    })
}

const gimmeHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    let param = ''
    if (ctx.args[0]) {
        param = ctx.args[0].toLowerCase()
    }
    if (ctx.cmd == 'ri' && ctx.arg == '') {
        throw new Error(stringId.gimme.usage(ctx.prefix))
    }

    await ctx.reactWait()
    const { data: result } = await axios
        .get(`https://meme-api.com/gimme/${param}`)
        .catch((err) => {
            throw new Error(err.response.ctx.message)
        })

    if (result?.url) {
        await ctx.replyContent({
            image: { url: result.url },
            caption: result.title,
        })
        return ctx.reactSuccess()
    } else {
        throw new Error(stringId.gimme.error.internal)
    }
}

const rollHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    let roll = crypto.randomInt(6)
    let roll2 = crypto.randomInt(6)
    const m_id = await _wa.sendMessage(
        ctx.from,
        { text: `⏳ ${roll} ⏳ ${roll2}` },
        { ephemeralExpiration: ctx.expiration! }
    )
    await delay(500)
    for (let i = 0; i < 3; i++) {
        roll = crypto.randomInt(6)
        roll2 = crypto.randomInt(6)
        await _wa.sendMessage(
            ctx.from,
            { edit: m_id?.key, text: `⏳ ${roll} ⏳ ${roll2}` },
            { ephemeralExpiration: ctx.expiration! }
        )
        await delay(500)
    }

    roll = crypto.randomInt(6)
    roll2 = crypto.randomInt(6)
    await _wa.sendMessage(
        ctx.from,
        { edit: m_id?.key, text: `🎲 ${roll} 🎲 ${roll2}` },
        { ephemeralExpiration: ctx.expiration! }
    )
}
