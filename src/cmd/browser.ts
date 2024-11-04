import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { browser } from '../..'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { MessageContext } from '../types'

const citraRadarJogjaCmd = () => {
    stringId.crjogja = {
        hint: '🌐 _Citra radar cuaca di Jogja_',
        error: {
            timeOut: () => '‼️ Gagal mendapatkan citra radar!',
        },
        usage: (ctx: MessageContext) =>
            `🌐 Lihat radar cuaca Jogja ➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'cuaca',
        hint: stringId.crjogja.hint,
        alias: 'cj',
        type: 'browser',
    })

    // property must be the same as the command name above
    Object.assign(actions, {
        cuaca: citraRadarHandler,
    })
}

const citraRadarHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    ctx.reactWait()
    browser
        .takeScreenshot(
            'http://sipora-yogya.bmkg.go.id/radar/',
            'tmp/radar.png',
            { width: 1200, height: 1000 },
            0,
            async (page) => {
                await page.click('a.leaflet-control-zoom-in')
                await page.waitForTimeout(1000)
                await page.click('a.leaflet-control-zoom-in')
                await page.waitForTimeout(3000)
            }
        )
        .then((r) => {
            if (!r) {
                ctx.reactError()
                return ctx.reply(stringId.crjogja.error.timeOut())
            }

            waSocket.sendMessage(
                ctx.from,
                { image: { url: 'tmp/radar.png' } },
                { quoted: msg, ephemeralExpiration: ctx.expiration! }
            )
            return ctx.reactSuccess()
        })
        .catch((e) => {
            console.log(e)
            ctx.reactError()
            return ctx.reply(stringId.crjogja.error.timeOut())
        })
}

const duckduckgoSearchCmd = () => {
    stringId.ddg = {
        hint: '🔍 _DuckDuckGo search_',
        error: {
            timeOut: () => '‼️ Gagal mendapatkan hasil pencarian!',
        },
        usage: (ctx: MessageContext) =>
            `🔍 Cari dengan DuckDuckGo ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
    }

    menu.push({
        command: 'ddg',
        hint: stringId.ddg.hint,
        alias: 'q',
        type: 'browser',
    })

    Object.assign(actions, {
        ddg: ddgSearchHandler,
    })
}

const ddgSearchHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (ctx.args[0] == '') return ctx.reply(stringId.ddg.usage(ctx))
    ctx.reactWait()
    const query = ctx.args.join(' ')
    const url = `https://duckduckgo.com/?q=${encodeURIComponent(
        query
    )}&hps=1&start=1&ia=web`
    browser
        .takeScreenshot(url, 'tmp/ddg.png', { width: 750, height: 1200 })
        .then((r) => {
            if (!r) {
                ctx.reactError()
                return ctx.reply(stringId.ddg.error.timeOut())
            }

            return waSocket.sendMessage(
                ctx.from,
                { image: { url: 'tmp/ddg.png' } },
                { quoted: msg, ephemeralExpiration: ctx.expiration! }
            )
        })
        .catch((e) => {
            console.log(e)
            ctx.reactError()
            return ctx.reply(stringId.ddg.error.timeOut())
        })
    return ctx.reactSuccess()
}

const googleSearchCmd = () => {
    stringId.gs = {
        hint: '🔍 _Google search_',
        error: {
            timeOut: () => '‼️ Gagal mendapatkan hasil pencarian!',
        },
        usage: (ctx: MessageContext) =>
            `🔍 Cari dengan Google ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
    }

    menu.push({
        command: 'gsrc',
        hint: stringId.gs.hint,
        alias: 'g',
        type: 'browser',
    })

    Object.assign(actions, {
        gsrc: googleSearchHandler,
    })
}

const googleSearchHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (ctx.args[0] == '') return ctx.reply(stringId.gs.usage(ctx))
    ctx.reactWait()
    const query = ctx.args.join(' ')
    const url = `https://www.google.com/search?client=firefox-b-d&q=${encodeURIComponent(
        query
    )}`
    browser
        .takeScreenshot(url, 'tmp/google.png', {
            width: 1300,
            height: 1700,
        })
        .then((r) => {
            if (!r) {
                ctx.reactError()
                return ctx.reply(stringId.gs.error.timeOut())
            }

            return waSocket.sendMessage(
                ctx.from,
                { image: { url: 'tmp/google.png' } },
                { quoted: msg, ephemeralExpiration: ctx.expiration! }
            )
        })
        .catch((e) => {
            console.log(e)
            ctx.reactError()
            return ctx.reply(stringId.gs.error.timeOut())
        })

    return ctx.reactSuccess()
}

export default () => {
    citraRadarJogjaCmd()
    duckduckgoSearchCmd()
    googleSearchCmd()
}
