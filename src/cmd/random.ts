import { WAMessage, WASocket, delay } from 'baileys'
import stringId from '../language.js'
import { actions } from '../handler.js'
import { menu } from '../menu.js'
import crypto from 'crypto'
import axios from 'axios'
import { HandlerFunction, MessageContext } from '../types.js'

export default () => {
    rollCmd()
    getMemeCmd()
}

const getMemeCmd = () => {
    stringId.gimme = {
        hint: '🌠 _Random reddit meme_',
        error: {
            internal: () => 'Terjadi error, coba lagi.',
        },
        usage: (ctx: MessageContext) =>
            `Custom subreddit setelah cmd, contoh: _${ctx.prefix}${ctx.cmd} dankmemes_`,
    }

    menu.push({
        command: 'meme',
        hint: stringId.gimme.hint,
        alias: 'reddit, ri',
        type: 'random',
    })

    Object.assign(actions, {
        meme: gimmeHandler,
    })
}

const gimmeHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    let param = ''
    if (ctx.args[0]) {
        param = ctx.args[0].toLowerCase()
    }
    if (ctx.cmd == 'ri' && ctx.arg == '') {
        throw new Error(stringId.gimme.usage(ctx))
    }

    await ctx.reactWait()
    const { data: result } = await axios
        .get(`https://meme-api.com/gimme/${param}`)
        .catch((err) => {
            throw new Error(err)
        })

    if (result?.url) {
        ctx.reactSuccess()
        return ctx.replyContent({
            image: { url: result.url },
            caption: result.title,
        })
    } else {
        throw new Error(stringId.gimme.error.internal())
    }
}

const rollCmd = () => {
    stringId.roll = {
        hint: '🎲 _Roll a dice_',
        error: {},
        usage: (_: MessageContext) => '',
    }

    menu.push({
        command: 'roll',
        hint: stringId.roll.hint,
        alias: 'r',
        type: 'random',
    })

    Object.assign(actions, {
        roll: rollHandler,
    })
}

const rollHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (ctx.arg) {
        let random = crypto.randomInt(1, parseInt(ctx.arg) + 1)
        const m_id = await _wa.sendMessage(
            ctx.from,
            { text: `⏳ Rolling... ${random}` },
            { ephemeralExpiration: ctx.expiration! }
        )
        await delay(700)
        for (let i = 0; i < 3; i++) {
            random = crypto.randomInt(1, parseInt(ctx.arg) + 1)
            await _wa.sendMessage(
                ctx.from,
                { edit: m_id?.key, text: `⏳ Rolling... ${random}` },
                { ephemeralExpiration: ctx.expiration! }
            )
            await delay(700)
        }

        random = crypto.randomInt(1, parseInt(ctx.arg) + 1)
        return _wa.sendMessage(
            ctx.from,
            { edit: m_id?.key, text: `🎲 You rolled a ${random}` },
            { ephemeralExpiration: ctx.expiration! }
        )
    } else {
        let roll = crypto.randomInt(6)
        let roll2 = crypto.randomInt(6)
        const m_id = await _wa.sendMessage(
            ctx.from,
            { text: `Rolling... ⏳ ${roll} ⏳ ${roll2}` },
            { ephemeralExpiration: ctx.expiration! }
        )
        await delay(700)
        for (let i = 0; i < 3; i++) {
            roll = crypto.randomInt(6)
            roll2 = crypto.randomInt(6)
            await _wa.sendMessage(
                ctx.from,
                { edit: m_id?.key, text: `Rolling... ⏳ ${roll} ⏳ ${roll2}` },
                { ephemeralExpiration: ctx.expiration! }
            )
            await delay(700)
        }

        roll = crypto.randomInt(6)
        roll2 = crypto.randomInt(6)
        return _wa.sendMessage(
            ctx.from,
            { edit: m_id?.key, text: `You rolled 🎲 ${roll} 🎲 ${roll2}` },
            { ephemeralExpiration: ctx.expiration! }
        )
    }
}
