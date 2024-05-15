import { VideoData, pinterest, tinyUrl } from '../lib'
import { sample, sampleSize } from 'lodash'
import { MessageContext } from '../utils'
import { WASocket, WAMessage } from '@whiskeysockets/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { browser } from '../..'
import chalk from 'chalk'

export default function () {
    Object.assign(actions, {
        pint: pinterestHandler,
        vdl: videoDownloadHandler,
    })

    stringId.pinterest = {
        hint: '🔍 _Search gambar di pinterest_',
        usage: (ctx: MessageContext) =>
            `🔍 Search gambar di pinterest dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <query>`,
    }

    stringId.videodl = {
        hint: '📩 _Download video tiktok/reel/twitter/yt_',
        error: {
            invalidUrl: '‼️ URL tidak valid!',
            internalError: '‼️ Terjadi kesalahan! Coba refresh browser.',
            maxDuration: '‼️ Durasi video melebihi 10 menit!',
        },
        usage: (ctx: MessageContext) =>
            `📩 Download video tiktok/reel/twitter/yt dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <url>`,
        getAudio: (ctx: MessageContext) =>
            `🎶 Convert to Audio by reply this with *${ctx.prefix}mp3*`,
        sent: (q: string) => `✅ Sent ${q}p\n\nother format:\n`,
    }

    menu.push(
        {
            command: 'pint',
            hint: stringId.pinterest.hint,
            alias: 'pin',
            type: 'scraper',
        },
        {
            command: 'vdl',
            hint: stringId.videodl.hint,
            alias: 'v',
            type: 'scraper',
        }
    )
}

const pinterestHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, args } = ctx
    if (arg == '') throw new Error(stringId.pinterest.usage(ctx))
    ctx.reactWait()
    const result = await pinterest(arg)
    if (result.length == 0) {
        ctx.reactError()
        return ctx.reply(`Tidak ada hasil.`)
    }

    const qty = Number(args[0])
    if (qty <= 10) {
        const images = sampleSize(result, qty)
        for (const image of images) {
            await ctx.replyContent({
                image: { url: image },
                caption: `Origin: ${await tinyUrl(image)}`,
            })
        }
        ctx.reactSuccess()
        return null
    } else {
        if (qty > 10) {
            ctx.reactError()
            return ctx.reply(`Max 10, bro.`)
        }
    }

    const image = sample(result) as string
    ctx.reactSuccess()

    return await ctx.replyContent({
        image: { url: image },
        caption: `Origin: ${await tinyUrl(image)}`,
    })
}

const tiktokPattern =
    /(?:https?):\/\/(?:www\.)?tiktok\.com\/@([^\W]+)(\.)?([^\W]+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const xPattern = /(?:https?):\/\/x\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reels?\/[\w-]+/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/[\w-]+/
const youtubePattern = /(?:https?):\/\/www\.youtube\.com\/watch\?v=(\w+)/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern = /(?:https?):\/\/www\.youtube\.com\/shorts\/(\w+)/

const getDuration = (result: VideoData) => {
    if (result.meta?.duration) {
        const timeParts = result.meta.duration.split(':').map(Number)
        if (timeParts.length === 2) {
            // Format MM:SS
            const [minutes, seconds] = timeParts
            return minutes * 60 + seconds
        } else if (timeParts.length === 3) {
            // Format HH:MM:SS
            const [hours, minutes, seconds] = timeParts
            return hours * 3600 + minutes * 60 + seconds
        }
    }
    return 0
}

export const videoDownloadHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, isQuoted, quotedMsg } = ctx
    const quotedMsgText =
        quotedMsg?.extendedTextMessage?.text || quotedMsg?.conversation || ''
    const url = isQuoted ? quotedMsgText : arg
    if (arg == '' && !isQuoted) throw new Error(stringId.videodl.usage(ctx))

    ctx.reactWait()

    if (
        tiktokPattern.test(url) ||
        tiktokShortPattern.test(url) ||
        reelsPattern.test(url) ||
        instagramPattern.test(url)
    ) {
        await tiktokReels(url, ctx)
    } else if (twitterPattern.test(url) || xPattern.test(url)) {
        await twitter(url, ctx)
    } else if (
        youtubePattern.test(url) ||
        youtubeShortPattern.test(url) ||
        youtubeShortsPattern.test(url)
    ) {
        await youtube(url, ctx)
    } else {
        throw stringId.videodl.error.invalidUrl
    }

    return ctx.reactSuccess()
}

async function tiktokReels(url: string, ctx: MessageContext) {
    const urls: string[] =
        tiktokPattern.exec(url) ??
        tiktokShortPattern.exec(url) ??
        reelsPattern.exec(url) ??
        instagramPattern.exec(url) ??
        []

    const result = await browser.getSocialVideo(urls[0])
    if (result.message) throw `‼️ ${result.message}`
    const duration = getDuration(result)
    const resultArray = result as unknown as VideoData[]

    if (resultArray.length > 1) {
        let body = ''
        let i = 1
        for (const media of resultArray) {
            body += `📩 ${i}. (${media.url[0].type}) ${await tinyUrl(
                media.url[0].url
            )}\n`
            i++
        }

        await ctx.reply(body)
    } else {
        if (result.url[0].type == 'jpg') {
            await ctx.replyContent({
                image: { url: result.url[0].url },
                caption: `Origin: ${await tinyUrl(result.url[0].url)}`,
            })
        } else {
            await ctx.replyContent({
                video: { url: result.url[0].url },
                seconds: duration,
                caption: stringId.videodl.getAudio(ctx),
            })
        }
    }
}

async function twitter(url: string, ctx: MessageContext) {
    const urls: string[] = twitterPattern.exec(url) ?? xPattern.exec(url) ?? []
    const result = await browser.getSocialVideo(urls[0])
    if (result.message) throw `‼️ ${result.message}`
    const resultUrls = [...result.url].sort((a, b) => {
        return Number(a.quality) - Number(b.quality)
    })
    const selectedUrl = resultUrls[0].url
    let captions = ''
    for (const video of resultUrls) {
        if (video?.url == selectedUrl) {
            captions += stringId.videodl.sent(video?.quality)
            continue
        }
        captions += `📩 ${video?.quality}p: ${await tinyUrl(video.url)}\n`
    }
    captions += stringId.videodl.getAudio(ctx)

    await ctx.replyContent({
        video: { url: selectedUrl },
        caption: captions,
    })
}

async function youtube(url: string, ctx: MessageContext) {
    const urls: string[] =
        youtubePattern.exec(url) ??
        youtubeShortPattern.exec(url) ??
        youtubeShortsPattern.exec(url) ??
        []
    const result = await browser.getSocialVideo(urls[0])
    if (result.message) throw `‼️ ${result.message}`
    const duration = getDuration(result)

    if (duration / 60 > 10) throw stringId.videodl.error.maxDuration

    let selectedUrl: string | URL
    let selectedQuality: string
    let captions: string = ''

    try {
        if (result.url[0].quality == '720') {
            selectedUrl = result.url[1].url
            selectedQuality = result.url[1].quality
        } else {
            selectedUrl = result.url[0].url
            selectedQuality = result.url[0].quality
        }
    } catch (error: any) {
        console.log(chalk.blue('[RES]'), result)
        console.error(chalk.red('[ERR]'), error)
        throw stringId.videodl.error.internalError
    }
    captions += stringId.videodl.sent(selectedQuality)

    for (const video of result.url) {
        if (video?.no_audio) continue
        if (video?.audio) continue
        if (video?.quality == selectedQuality) continue
        if (!video?.attr?.title) {
            captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
            continue
        }
        captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
    }
    captions += stringId.videodl.getAudio(ctx)

    await ctx.replyContent({
        video: { url: selectedUrl },
        seconds: duration,
        caption: captions.trim(),
    })
}
