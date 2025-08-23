import { WAMessage, WASocket, proto } from 'baileys'
import { existsSync, readFileSync, unlink, writeFileSync } from 'fs'
import { getVideoDurationInSeconds } from 'get-video-duration'
import _ from 'lodash'
import ocrApi from 'ocr-space-api-wrapper'
import { Readable } from 'stream'
import { actions } from '../handler.js'
import stringId from '../language.js'
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
} from '../lib/_index.js'
import { menu } from '../menu.js'
import { MessageContext } from '../types.js'

export default () => {
    initNoteDatabase()
    ocrCmd()
    gttsCmd()
    getOneViewCmd()
    videoToMp3Cmd()
    videoSplitCmd()
    noteCreatorCmd()
    collectListCmd()
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
        ctx.replyContent({
            image: mediaData,
            caption: ctx.quotedMsg?.imageMessage?.caption ?? '',
            mimetype: 'image/jpeg',
        })
    } else if (ctx.isQuotedVideo) {
        ctx.replyContent({
            video: mediaData,
            caption: ctx.quotedMsg?.videoMessage?.caption ?? '',
            seconds: ctx.quotedMsg?.videoMessage?.seconds ?? 0,
            mimetype: 'video/mp4',
        })
    } else if (ctx.isQuoted) {
        ctx.replyContent({
            audio: mediaData,
            seconds: ctx.quotedMsg?.audioMessage?.seconds ?? 0,
            mimetype: 'audio/mp4',
        })
    }
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
        alias: 'note, addnote, delnote, editnote',
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
        case 'note':
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

    const { path, note: _note } = await handleMediaNotes(
        ctx,
        note,
        quotedMsg,
        args,
        noteName
    )

    const res = await (isEdit ? updateNoteContent : createNote)(
        id,
        noteName,
        _note,
        path
    )

    if (!res) {
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
    if (!ctx.isMedia) return { path: '', note }
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

        await ctx.replyContent({
            video: { url: video[i] },
            caption: `0${i}`,
            seconds: await getVideoDurationInSeconds(video[i]),
            mimetype: 'video/mp4',
        })

        paths.push(video[i])
    }

    await ctx.reactSuccess()
    _.delay(() => paths.forEach((path: string) => unlink(path, (_) => _)), 10_000)
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
            `🗣️ ➡️ ${ctx.prefix}say <text>
🗣️ ➡️ ${ctx.prefix}tts <lang> <text>
🗣️ lang: ${ctx.prefix}tts lang`,
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
    const { args, arg, replyVoiceNote, reactWait, reactSuccess, quotedMsg } =
        ctx
    if (arg == '' && quotedMsg == null) throw new Error(stringId.say.usage(ctx))

    let lang = 'id'
    let text = arg
    if (quotedMsg?.conversation) text = quotedMsg.conversation
    if (ctx.cmd == 'tts') {
        lang = args[0]
        if (lang == 'lang') {
            ctx.reply(`🗣️ Bahasa yang didukung: ${Object.keys(LANGUAGES)}`)
            return
        }

        text = args.slice(1).join(' ')
    }

    if (!LANGUAGES[lang]) throw new Error(stringId.say.error.lang())

    await reactWait()
    const filepath = `tmp/gtts_${_msg.key.id!}.mp3`
    await saveTextToSpeech({ filepath, text, lang })
    const opus = await mp3ToOpus(filepath)

    await replyVoiceNote(opus)
    await reactSuccess()

    unlink(filepath, (_) => _)
    unlink(opus, (_) => _)
}

const collectListCmd = () => {
    stringId.collect_list = {
        hint: '📝 _Collect list_',
        error: {
            textOnly: () => '‼️ Hanya support text!',
        },
        usage: (ctx: MessageContext) => `📝 Collect percakapan kedalam list.
➡️ ${ctx.prefix}${ctx.cmd} <nama list>`,
    }

    menu.push({
        command: 'list',
        hint: stringId.collect_list.hint,
        type: 'tools',
        alias: 'cl',
    })

    Object.assign(actions, {
        list: collectListHandler,
    })
}

// [jid][title][content]
export const LIST_MEMORY_PATH = 'data/list_memory.json'
export let ListMemory = new Map<string, string[]>()

// Ensure file exists and load data
if (!existsSync(LIST_MEMORY_PATH)) {
    writeFileSync(LIST_MEMORY_PATH, '{}', 'utf-8')
}

try {
    const data = readFileSync(LIST_MEMORY_PATH, 'utf-8')
    if (data) {
        const parsedData = JSON.parse(data)
        // Convert values to arrays if needed
        ListMemory = new Map(
            Object.entries(parsedData).map(([k, v]) => [
                k,
                Array.isArray(v) ? v : [],
            ])
        )
    }
} catch (e) {
    // Handle corrupted JSON gracefully
    ListMemory = new Map()
}

const saveListMemory = () => {
    const obj: Record<string, string[]> = Object.fromEntries(ListMemory)
    writeFileSync(LIST_MEMORY_PATH, JSON.stringify(obj, null, 2), 'utf-8')
}

// Save on process exit and at intervals
process.on('exit', saveListMemory)
process.on('SIGINT', () => {
    saveListMemory()
    process.exit()
})

setInterval(saveListMemory, 1000 * 60 * 15)

export const renderList = (ctx: MessageContext) => {
    const list = ListMemory.get(ctx.from) || []
    let listText = `📝 ${list[0]} 📝\n`
    list.forEach((l, i) => {
        if (i == 0) return
        listText += `${i}. ${l}\n`
    })

    if (list.length == 0) {
        listText += '(kosong)\n'
    }

    return listText.replace(/\n$/, '')
}

const collectListHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, reply, send, reactWait, reactSuccess } = ctx
    const list = ListMemory.get(ctx.from) || []
    if (list.length == 0 && arg == '') throw stringId.collect_list.usage(ctx)
    await reactWait()

    if (arg == '') {
        await send(renderList(ctx))
        await send(
            'Kirim `+(isi)` untuk menambahkan ke list\nKirim `-(nomor)` untuk menghapus dari list.'
        )
        return await reactSuccess()
    }

    if (arg == 'end') {
        ListMemory.delete(ctx.from)
        reactSuccess()
        return await send(`✅ List ${list[0]} selesai!`)
    }

    const listName = arg
    list.push(listName)
    ListMemory.set(ctx.from, list)
    await reply(
        `📝 ${listName} 📝 dibuat!\nKirim \`+ (isi)\` untuk menambahkan ke list!`
    )

    return await reactSuccess()
}
