import {
    WAMessage,
    WASocket,
    downloadMediaMessage,
    proto,
} from '@whiskeysockets/baileys'
import { unlink, writeFileSync } from 'fs'
import { getVideoDurationInSeconds } from 'get-video-duration'
import { delay } from 'lodash'
import ocrApi from 'ocr-space-api-wrapper'
import sharp from 'sharp'
import { Readable } from 'stream'
import { actions } from '../handler'
import stringId from '../language'
import {
    LANGUAGES,
    createNote,
    deleteNote,
    getNotesNames,
    initNoteDatabase,
    mp3ToOpus,
    ocr,
    saveTextToSpeech,
    splitVideo,
    updateNoteContent,
    videoToMp3,
} from '../lib/_index'
import { menu } from '../menu'
import { MessageContext } from '../types'

const flipImageCmd = () => {
    stringId.flip = {
        hint: '🖼️ _flip = vertikal, flop = horizontal_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n ➡️ ${ctx.prefix}flip atau ${ctx.prefix}flop`,
    }

    menu.push({
        command: 'flip',
        hint: stringId.flip.hint,
        alias: 'flop',
        type: 'tools',
    })

    Object.assign(actions, {
        flip: flipHandler,
    })
}

const flipHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, cmd, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.flip.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = await sharp(mediaData)
    if (cmd === 'flip')
        await waSocket.sendMessage(
            ctx.from,
            { image: await image.flip().toBuffer() },
            { quoted: msg }
        )
    if (cmd === 'flop')
        await waSocket.sendMessage(
            ctx.from,
            { image: await image.flop().toBuffer() },
            { quoted: msg }
        )
    ctx.reactSuccess()
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
        type: 'tools',
    })

    Object.assign(actions, {
        onev: oneViewHandler,
    })
}

const oneViewHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const viewOnce =
        ctx.quotedMsg?.viewOnceMessageV2 ||
        ctx.quotedMsg?.viewOnceMessage ||
        ctx.quotedMsg?.viewOnceMessageV2Extension
    const isQuotedOneView = viewOnce != null
    if (!isQuotedOneView) throw new Error(stringId.onev.error.noOneView())
    ctx.reactWait()
    const { message } = viewOnce
    const { imageMessage, videoMessage } = message as proto.IMessage
    if (imageMessage) {
        const mediaData = await downloadMediaMessage(
            { key: msg.key, message: message },
            'buffer',
            {}
        )
        await waSocket.sendMessage(
            ctx.from,
            { image: mediaData as Buffer },
            { quoted: msg }
        )
    }
    if (videoMessage) {
        const mediaData = await downloadMediaMessage(
            { key: msg.key, message: message },
            'buffer',
            {}
        )
        await waSocket.sendMessage(
            ctx.from,
            { video: mediaData as Buffer },
            { quoted: msg }
        )
    }
    ctx.reactSuccess()
}

const noteCreatorCmd = () => {
    stringId.note = {
        hint: '📝 _Database catatan_',
        error: {
            noNote: () => '‼️ Catatan tidak ditemukan!',
            duplicate: () =>
                '‼️ Error atau Catatan dengan nama tersebut sudah ada!',
        },
        usage: (ctx: MessageContext) =>
            `📝 Simpan catatan dengan cara ➡️ ${ctx.prefix}addnote #nama <catatan>`,
    }

    menu.push({
        command: 'notes',
        hint: stringId.note.hint,
        alias: 'addnote, delnote, editnote',
        type: 'tools',
    })

    Object.assign(actions, {
        notes: noteHandler,
    })
}

const noteHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { from, fromMe, participant, cmd, args, isQuoted, quotedMsg } = ctx
    const noteName = args[0].toLowerCase().startsWith('#')
        ? args[0].toLowerCase()
        : `#${args[0].toLowerCase()}`
    const id = fromMe ? 'me' : participant ?? from

    switch (cmd) {
        case 'notes':
            return handleNoteCommand(id, ctx)
        case 'addnote':
        case 'editnote':
            return handleAddEditNoteCommand(
                id,
                noteName,
                args,
                isQuoted ?? false,
                quotedMsg,
                ctx,
                cmd === 'editnote'
            )
        case 'delnote':
            return handleDeleteNoteCommand(id, noteName, ctx)
        default:
            return
    }
}

async function handleNoteCommand(id: string, ctx: MessageContext) {
    const note = await getNotesNames(id)
    if (note.length == 0) throw stringId.note.error.noNote()
    let noteList = '📝 Note List:\n'
    note.forEach((n) => {
        noteList += `· ${n}\n`
    })

    return ctx.reply(noteList.replace(/\n$/, ''))
}

async function handleAddEditNoteCommand(
    id: string,
    noteName: string,
    args: string[],
    isQuoted: boolean,
    quotedMsg: proto.IMessage | null | undefined,
    ctx: MessageContext,
    isEdit: boolean
) {
    let note: string
    if (isQuoted) {
        note =
            quotedMsg?.conversation ||
            quotedMsg?.extendedTextMessage?.text ||
            ''
    } else {
        if (args.length < 2) return ctx.reply(stringId.note.usage(ctx))
        note = args.slice(1).join(' ')
    }
    if (ctx.isMedia) {
        let path
        ;({ path, note } = await handleMediaNotes(
            ctx,
            note,
            quotedMsg,
            args,
            noteName
        ))

        const res = await (isEdit ? updateNoteContent : createNote)(
            id,
            noteName,
            note,
            path
        )
        if (!res)
            return ctx.reply(
                isEdit
                    ? stringId.note.error.noNote()
                    : stringId.note.error.duplicate()
            )
    } else {
        const res = await (isEdit ? updateNoteContent : createNote)(
            id,
            noteName,
            note
        )
        if (!res)
            return ctx.reply(
                isEdit
                    ? stringId.note.error.noNote()
                    : stringId.note.error.duplicate()
            )
    }

    return ctx.reply(isEdit ? '✏️ Note edited!' : '📝 Note saved!')
}

async function handleMediaNotes(
    ctx: MessageContext,
    note: string,
    quotedMsg: proto.IMessage | null | undefined,
    args: string[],
    noteName: string
) {
    const mediaData = ctx.isQuoted
        ? await ctx.downloadQuoted()
        : await ctx.download()
    let ext
    if (ctx.isVideo) {
        ext = 'mp4'
        note = quotedMsg?.videoMessage?.caption ?? args.slice(1).join(' ') ?? ''
    } else {
        ext = 'jpg'
        note = quotedMsg?.imageMessage?.caption ?? args.slice(1).join(' ') ?? ''
    }
    const path = `data/saved_media/${ctx.from}_${noteName}.${ext}`
    writeFileSync(path, mediaData)
    return { path, note }
}

async function handleDeleteNoteCommand(
    id: string,
    noteName: string,
    ctx: MessageContext
) {
    const mediaPath = await deleteNote(id, noteName)
    if (mediaPath) unlink(mediaPath, (_) => _)
    return ctx.reply('🗑️ Note deleted!')
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
        type: 'tools',
    })

    Object.assign(actions, {
        tomp3: toMp3Handler,
    })
}

const toMp3Handler = async (
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
    await ctx.replyContent({
        document: { url: audio },
        mimetype: 'audio/mp3',
        fileName: 'converted_audio.mp3',
    })
    await ctx.reactSuccess()
    unlink(audio, (_) => _)
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
        type: 'tools',
    })

    Object.assign(actions, {
        vsplit: videoSplitHandler,
    })
}

const videoSplitHandler = async (
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
        const path = `tmp/vs/${video[i]}`

        await ctx.replyContent({
            video: { url: path },
            caption: `0${i}`,
            seconds: await getVideoDurationInSeconds(path),
            mimetype: 'video/mp4',
        })

        paths.push(path)
    }

    await ctx.reactSuccess()
    delay(() => paths.forEach((path: string) => unlink(path, (_) => _)), 10_000)
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
        type: 'tools',
    })

    Object.assign(actions, {
        ocr: ocrHandler,
    })
}

const ocrHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, download, downloadQuoted, args } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.ocr.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()

    const language = args[0] as ocrApi.OcrSpaceLanguages
    const res = await ocr(language, mediaData)
    console.log('🚀 ~ file: tools.ts:366 ~ res:', res)
    const text = res.ParsedResults[0].ParsedText

    await ctx.reply(text)
    ctx.reactSuccess()
}

const gttsCmd = () => {
    stringId.say = {
        hint: '🗣️ _Google text to speech_',
        error: {
            lang: () => '‼️ Bahasa tidak disupport.',
        },
        usage: (ctx: MessageContext) =>
            `🗣️ Kirim cmd dengan text ➡️ ${ctx.prefix}${ctx.cmd} <text>`,
    }

    menu.push({
        command: 'say',
        hint: stringId.say.hint,
        alias: 'tts',
        type: 'tools',
    })

    Object.assign(actions, {
        say: gttsHandler,
    })
}

const gttsHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { args, arg, replyVoiceNote, reactWait, reactSuccess } = ctx
    if (arg == '') throw stringId.say.usage(ctx)

    let lang = 'id'
    let text = arg
    if (ctx.quotedMsg?.conversation) text = ctx.quotedMsg.conversation
    if (ctx.cmd == 'tts') {
        lang = args[0]
        text = args.slice(1).join(' ')
    }

    if (!LANGUAGES[lang]) throw stringId.say.error.lang()

    await reactWait()
    const filepath = `tmp/gtts_${_msg.key.id!}.mp3`
    await saveTextToSpeech({ filepath, text, lang })
    const opus = await mp3ToOpus(filepath)

    await replyVoiceNote(opus)
    await reactSuccess()

    unlink(filepath, (_) => _)
    unlink(opus, (_) => _)
}

export default () => {
    initNoteDatabase()

    flipImageCmd()
    getOneViewCmd()
    noteCreatorCmd()
    videoToMp3Cmd()
    videoSplitCmd()
    gttsCmd()
    ocrCmd()
}
