import { WAMessage, WASocket } from 'baileys'
import _ from 'lodash'
import { actions } from '../handler.js'
import stringId from '../language.js'
import { pinterest, storeMessage } from '../lib/_index.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'

export default () => {
    searchPinterestCmd()
    // downloadSocialVideoCmd()
}

const searchPinterestCmd = () => {
    stringId.pinterest = {
        hint: '🔍 _Search gambar di pinterest_',
        error: {
            noResult: () => '‼️ Tidak ada hasil.',
        },
        usage: (ctx: MessageContext) =>
            `🔍 Search gambar di pinterest dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
    }

    menu.push({
        command: 'pint',
        hint: stringId.pinterest.hint,
        alias: 'pin',
        type: 'scraper',
    })

    Object.assign(actions, {
        pint: pinterestHandler,
    })
}

const pinterestHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, args } = ctx
    if (arg == '') throw new Error(stringId.pinterest.usage(ctx))
    ctx.reactWait()
    const { result } = await pinterest.search(arg)
    if (result.total == 0) {
        ctx.reactError()
        return ctx.reply(`Tidak ada hasil.`)
    }

    const qty = Number(args[0]) || 1
    if (qty > 10) {
        ctx.reactError()
        return ctx.reply(`Max 10, bro.`)
    }

    const items = _.sampleSize(result.pins, qty)
    for (const item of items) {
        const content = item.media.video
            ? {
                  video: { url: item.media.video.video_list.V_HLSV4?.url },
                  caption: `Origin: ${item.pin_url}`,
              }
            : {
                  image: { url: item.media.images.orig.url },
                  caption: `Origin: ${item.pin_url}`,
              }
        const sent = await ctx.replyContent(content)
        if (sent) storeMessage(sent)
    }

    return ctx.reactSuccess()
}

/*
disabled due to yt-dlp issue

const tiktokPattern =
    /(?:https?):\/\/(?:www\.)?tiktok\.com\/@([^\W]+)(\.)?([^\W]+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const xPattern = /(?:https?):\/\/x\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reels?\/[\w-]+/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/[\w-]+/
const youtubePattern =
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([\w-]+)(?:&[\w=&]*)?/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern =
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/(\w+)(?:\?[\w=&]*)?/

const downloadSocialVideoCmd = () => {
    stringId.videodl = {
        hint: '📩 _Download video tiktok/reel/twitter/yt_',
        error: {
            invalidUrl: () => '‼️ URL tidak valid!',
            internalError: () => '‼️ Terjadi kesalahan! Coba refresh browser.',
            maxDuration: () => '‼️ Durasi video melebihi 10 menit!',
        },
        usage: (ctx: MessageContext) =>
            `📩 Download video tiktok/reel/twitter/yt dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <url>`,
        info: (ctx: MessageContext) =>
            `🎶 Convert to Audio by reply this with *${ctx.prefix}mp3*`,
        sent: (q: string) => `✅ Sent ${q}p\n\nother format:\n`,
    }

    menu.push({
        command: 'vdl',
        hint: stringId.videodl.hint,
        alias: 'v',
        type: 'scraper',
    })

    Object.assign(actions, {
        vdl: videoDownloadHandler,
    })
}

export const videoDownloadHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, isQuoted, quotedMsg } = ctx
    const quotedMsgText =
        quotedMsg?.extendedTextMessage?.text ?? quotedMsg?.conversation ?? ''
    const url = isQuoted ? quotedMsgText : arg
    if (arg == '' && !isQuoted) throw new Error(stringId.videodl.usage(ctx))

    ctx.reactWait()

    if (tiktokPattern.test(url) || tiktokShortPattern.test(url)) {
        return tiktok(url, ctx)
    } else if (reelsPattern.test(url) || instagramPattern.test(url)) {
        return instagram(url, ctx)
    } else if (twitterPattern.test(url) || xPattern.test(url)) {
        return twitter(url, ctx)
    } else if (
        youtubePattern.test(url) ||
        youtubeShortPattern.test(url) ||
        youtubeShortsPattern.test(url)
    ) {
        return youtube(url, ctx)
    } else {
        throw new Error(stringId.videodl.error.invalidUrl())
    }
}

async function tiktok(url: string, ctx: MessageContext) {
    const _url: string =
        tiktokPattern.exec(url)?.[0] ?? tiktokShortPattern.exec(url)?.[0] ?? ''

    const result = (await ytdl(_url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
    })) as Payload

    const videos = result.formats.filter(
        (f: Payload['formats'][number]) =>
            f.ext == 'mp4' && f.format_note == null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any[]

    if (videos.length == 0) {
        throw new Error('‼️ Tidak ada video yang ditemukan.')
    }

    const selected = videos.shift()

    // get tt_chain_token from cookie
    const tt_chain_token = selected.cookies.match(/tt_chain_token="([^"]+)"/)[1]

    const response = await axios.get(selected.url, {
        responseType: 'arraybuffer',
        headers: { ...selected.http_headers, Cookie: `tk=${tt_chain_token}` },
    })

    const buffer = Buffer.from(response.data)
    ctx.reactSuccess()

    return ctx.replyContent({
        video: buffer,
        seconds: Math.floor(result.duration ?? 0),
    })
}

async function instagram(url: string, ctx: MessageContext) {
    const _url: string =
        reelsPattern.exec(url)?.[0] ?? instagramPattern.exec(url)?.[0] ?? ''

    const result = (await ytdl(_url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
    })) as Payload

    const videos = result.formats.filter(
        (f: Payload['formats'][number]) => f.ext == 'mp4'
    )

    if (videos.length == 0) {
        throw new Error('‼️ Tidak ada video yang ditemukan.')
    }

    ctx.reactSuccess()
    return ctx.replyContent({
        video: { url: videos[0].url },
        seconds: Math.floor(result.duration ?? 0),
    })
}

async function twitter(url: string, ctx: MessageContext) {
    const _url: string =
        twitterPattern.exec(url)?.[0] ?? xPattern.exec(url)?.[0] ?? ''

    const result = (await ytdl(_url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
    })) as Payload

    const videos = result.formats.filter(
        (f: Payload['formats'][number]) =>
            f.ext == 'mp4' && f.protocol == 'https'
    )

    if (videos.length == 0) {
        throw new Error('‼️ Tidak ada video yang ditemukan.')
    }

    ctx.reactSuccess()
    return ctx.replyContent({
        video: { url: videos.pop()?.url ?? '' },
        seconds: Math.floor(result.duration ?? 0),
    })
}

async function youtube(url: string, ctx: MessageContext) {
    const _url: string =
        youtubePattern.exec(url)?.[0] ??
        youtubeShortPattern.exec(url)?.[0] ??
        youtubeShortsPattern.exec(url)?.[0] ??
        ''

    const result = (await ytdl(_url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
    })) as Payload

    const videos = result.formats.filter(
        (f: Payload['formats'][number]) =>
            f.ext == 'mp4' && f.audio_channels == 2
    )

    if (videos.length == 0) {
        throw new Error('‼️ Tidak ada video yang ditemukan.')
    }

    ctx.reactSuccess()
    return ctx.replyContent({
        video: { url: videos[0].url },
        seconds: Math.floor(result.duration ?? 0),
    })
}

*/