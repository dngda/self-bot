import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { MessageContext } from '../utils'
import { browser } from '../..'

export default function () {
  Object.assign(actions, {
    crjogja: crjogjaHandler,
    ddg: ddgSearchHandler,
    gs: googleSearchHandler,
  })

  stringId.crjogja = {
    hint: '🌐 _Citra radar cuaca di Jogja_',
    error: {
      timeOut: '‼️ Gagal mendapatkan citra radar!',
    },
  }

  stringId.ddg = {
    hint: '🔍 _DuckDuckGo search_',
    error: {
      timeOut: '‼️ Gagal mendapatkan hasil pencarian!',
    },
    usage: (ctx: MessageContext) =>
      `🔍 Cari dengan DuckDuckGo ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
  }

  stringId.gs = {
    hint: '🔍 _Google search_',
    error: {
      timeOut: '‼️ Gagal mendapatkan hasil pencarian!',
    },
    usage: (ctx: MessageContext) =>
      `🔍 Cari dengan Google ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
  }

  menu.push(
    {
      command: 'crjogja',
      hint: stringId.crjogja.hint,
      alias: 'crj',
      type: 'browser',
    },
    {
      command: 'ddg',
      hint: stringId.ddg.hint,
      alias: 'q',
      type: 'browser',
    },
    {
      command: 'gs',
      hint: stringId.gs.hint,
      alias: 'g',
      type: 'browser',
    }
  )
}

const crjogjaHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  ctx: MessageContext
) => {
  ctx.reactWait()
  browser
    .takeScreenshot(
      'http://sipora.staklimyogyakarta.com/radar/',
      'tmp/radar.png',
      { width: 600, height: 600 }
    )
    .then((r) => {
      if (!r) {
        ctx.reactError()
        return ctx.reply(stringId.crjogja.error.timeOut)
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
      return ctx.reply(stringId.crjogja.error.timeOut)
    })
}

const ddgSearchHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  ctx: MessageContext
) => {
  if (ctx.args.length === 0) return ctx.reply(stringId.gs.usage(ctx))
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
        return ctx.reply(stringId.gs.error.timeOut)
      }

      waSocket.sendMessage(
        ctx.from,
        { image: { url: 'tmp/ddg.png' } },
        { quoted: msg, ephemeralExpiration: ctx.expiration! }
      )
      return ctx.reactSuccess()
    })
    .catch((e) => {
      console.log(e)
      ctx.reactError()
      return ctx.reply(stringId.gs.error.timeOut)
    })
}

const googleSearchHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  ctx: MessageContext
) => {
  if (ctx.args.length === 0) return ctx.reply(stringId.ddg.usage(ctx))
  ctx.reactWait()
  const query = ctx.args.join(' ')
  const url = `https://www.google.com/search?client=firefox-b-d&q=${encodeURIComponent(
    query
  )}`
  browser
    .takeScreenshot(url, 'tmp/google.png', { width: 1300, height: 1700 })
    .then((r) => {
      if (!r) {
        ctx.reactError()
        return ctx.reply(stringId.ddg.error.timeOut)
      }

      waSocket.sendMessage(
        ctx.from,
        { image: { url: 'tmp/google.png' } },
        { quoted: msg, ephemeralExpiration: ctx.expiration! }
      )
      return ctx.reactSuccess()
    })
    .catch((e) => {
      console.log(e)
      ctx.reactError()
      return ctx.reply(stringId.ddg.error.timeOut)
    })
}
