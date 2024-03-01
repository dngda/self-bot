import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageContext } from '../utils'
import { apiCall } from '../lib'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'

export default function () {
    Object.assign(actions, {
        meme: gimmeHandler,
    })

    stringId.gimme = {
        hint: '🌠 _Random reddit meme_',
        error: {
            internal: 'Terjadi error, coba lagi.',
        },
        usage: (p: string) =>
            `Custom subreddit setelah cmd, contoh: _${p}meme dankmemes_`,
    }

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
    const result = await apiCall(`https://meme-api.com/gimme/${param}`).catch(
        (err) => {
            throw new Error(err.response.ctx.message)
        }
    )

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
