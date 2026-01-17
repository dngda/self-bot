import { WAMessage, WASocket } from 'baileys'
import { actions } from '../handler.js'
import stringId from '../language.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'
import { OcrSpaceLanguages } from 'ocr-space-api-wrapper'
import { ocr } from '../lib/apicall.js'
import { splitVideo, videoToMp3 } from '../lib/ffmpeg.js'
import { unlink } from 'fs'
import getVideoDurationInSeconds from 'get-video-duration'
import { storeMessage } from '../lib/store.js'
import _ from 'lodash'
import { Readable } from 'stream'

export default () => {
    ocrCmd()
    getOneViewCmd()
    videoToMp3Cmd()
    videoSplitCmd()
}

const getOneViewCmd = () => {
    stringId.onev = {
        hint: '👁️‍🗨️ _Get pesan view once_',
        error: {
            noOneView: () => '‼️ Pesan view once tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `👁️‍🗨️ Reply pesan oneView dengan ➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'onev',
        hint: stringId.onev.hint,
        alias: '1v',
        type: 'media',
    })

    Object.assign(actions, {
        onev: oneViewHandler,
    })
}

const oneViewHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const isQuotedOneView =
        ctx.quotedMsg?.imageMessage?.viewOnce ||
        ctx.quotedMsg?.videoMessage?.viewOnce ||
        ctx.quotedMsg?.audioMessage?.viewOnce
    if (!isQuotedOneView) throw new Error(stringId.onev.error.noOneView())
    const mediaData = await ctx.downloadQuoted()

    if (ctx.isQuotedImage) {
        return ctx.replyContent({
            image: mediaData,
            caption: ctx.quotedMsg?.imageMessage?.caption ?? '',
            mimetype: 'image/jpeg',
        })
    } else if (ctx.isQuotedVideo) {
        return ctx.replyContent({
            video: mediaData,
            caption: ctx.quotedMsg?.videoMessage?.caption ?? '',
            seconds: ctx.quotedMsg?.videoMessage?.seconds ?? 0,
            mimetype: 'video/mp4',
        })
    } else if (ctx.isQuoted) {
        return ctx.replyContent({
            audio: mediaData,
            seconds: ctx.quotedMsg?.audioMessage?.seconds ?? 0,
            mimetype: 'audio/mp4',
        })
    }

    return undefined
}

const ocrCmd = () => {
    stringId.ocr = {
        hint: '📖 _Optical character recognition_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `📖 Kirim gambar dengan caption atau reply gambar dengan ➡️ ${ctx.prefix}${ctx.cmd} <language>`,
    }

    menu.push({
        command: 'ocr',
        hint: stringId.ocr.hint,
        alias: 'itt',
        type: 'media',
    })

    Object.assign(actions, {
        ocr: ocrHandler,
    })
}

const ocrHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, download, downloadQuoted, args } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.ocr.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()

    const language = args[0] as OcrSpaceLanguages
    const res = await ocr(language, mediaData)

    const text = res.ParsedResults[0].ParsedText

    ctx.reactSuccess()
    return ctx.reply(text)
}

const videoToMp3Cmd = () => {
    stringId.tomp3 = {
        hint: '🎵 _Convert video to mp3_',
        error: {
            noVideo: () => '‼️ Video tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🎵 Kirim video dengan caption atau reply video dengan ➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'tomp3',
        hint: stringId.tomp3.hint,
        alias: 'mp3',
        type: 'media',
    })

    Object.assign(actions, {
        tomp3: toMp3Handler,
    })
}

const toMp3Handler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedVideo, isVideo, download, downloadQuoted } = ctx
    if (!isVideo && !isQuotedVideo)
        throw new Error(stringId.tomp3.error.noVideo())
    ctx.reactWait()
    const mediaData = isQuotedVideo ? await downloadQuoted() : await download()
    const audio = await videoToMp3(mediaData)
    const sent = await ctx.replyContent({
        document: { url: audio },
        mimetype: 'audio/mp3',
        fileName: 'converted_audio.mp3',
    })

    ctx.reactSuccess()
    unlink(audio, (_) => _)
    return sent
}

const videoSplitCmd = () => {
    stringId.vsplit = {
        hint: '🎞️ _Split video to 30s parts_',
        error: {
            duration: () => '‼️ Video harus lebih dari 30 detik!',
        },
        usage: (ctx: MessageContext) =>
            `🎞️ Kirim video dengan caption atau reply video dengan ➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'vsplit',
        hint: stringId.vsplit.hint,
        alias: 'split',
        type: 'media',
    })

    Object.assign(actions, {
        vsplit: videoSplitHandler,
    })
}

const videoSplitHandler: HandlerFunction = async (
    _wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedVideo, isVideo, download, downloadQuoted } = ctx
    if (!isVideo && !isQuotedVideo) throw new Error(stringId.vsplit.usage(ctx))
    let seconds =
        msg.message?.videoMessage?.seconds ||
        ctx.quotedMsg?.videoMessage?.seconds ||
        0

    if (seconds < 30 && seconds != 0)
        throw new Error(stringId.vsplit.error.duration())

    ctx.reactWait()
    const mediaData = isQuotedVideo ? await downloadQuoted() : await download()

    if (seconds == 0) {
        seconds = await getVideoDurationInSeconds(Readable.from(mediaData))
    }

    if (seconds < 30) throw new Error(stringId.vsplit.error.duration())

    const id = ctx.participant ?? ctx.from
    const video = await splitVideo(id, mediaData)
    const paths: string[] = []
    for (let i = 0; i < video.length; i++) {
        if (!video[i].endsWith('.mp4')) continue
        if (!video[i].includes(id)) continue

        const sent = await ctx.replyContent({
            video: { url: video[i] },
            caption: `0${i}`,
            seconds: await getVideoDurationInSeconds(video[i]),
            mimetype: 'video/mp4',
        })
        if (sent) storeMessage(sent)

        paths.push(video[i])
    }

    await ctx.reactSuccess()
    _.delay(
        () => paths.forEach((path: string) => unlink(path, (_) => _)),
        10_000
    )
    return undefined
}
