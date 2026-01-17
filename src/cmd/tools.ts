import { WAMessage, WASocket } from 'baileys'
import { existsSync, readFileSync, unlink, writeFileSync } from 'fs'
import { actions } from '../handler.js'
import stringId from '../language.js'
import {
    LANGUAGES,
    createNote,
    deleteNote,
    getNotesNames,
    initNoteDatabase,
    mp3ToOpus,
    saveTextToSpeech,
    updateNoteContent,
} from '../lib/_index.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'

export default () => {
    initNoteDatabase()

    gttsCmd()
    noteCreatorCmd()
    collectListCmd()
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

const noteHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { from, fromMe, participant, cmd, args } = ctx
    const noteName = args[0].toLowerCase().startsWith('#')
        ? args[0].toLowerCase()
        : `#${args[0].toLowerCase()}`
    const id = fromMe ? 'me' : participant ?? from
    const isEdit = cmd === 'editnote'

    switch (cmd) {
        case 'note':
        case 'notes':
            return handleNoteCommand(id, ctx)
        case 'addnote':
        case 'editnote':
            return handleAddEditNoteCommand(id, noteName, ctx, isEdit)
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
    ctx: MessageContext,
    isEdit: boolean
) {
    let note: string
    if (ctx.isQuoted) {
        note =
            ctx.quotedMsg?.conversation ||
            ctx.quotedMsg?.extendedTextMessage?.text ||
            ''
    } else {
        if (ctx.args.length < 2) return ctx.reply(stringId.note.usage(ctx))
        note = ctx.args.slice(1).join(' ')
    }

    const { path, note: _note } = await handleMediaNotes(ctx, note, noteName)

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
    noteName: string
) {
    if (!ctx.isMedia) return { path: '', note }
    const mediaData = ctx.isQuoted
        ? await ctx.downloadQuoted()
        : await ctx.download()
    let ext
    if (ctx.isVideo) {
        ext = 'mp4'
        note =
            ctx.quotedMsg?.videoMessage?.caption ??
            ctx.args.slice(1).join(' ') ??
            ''
    } else {
        ext = 'jpg'
        note =
            ctx.quotedMsg?.imageMessage?.caption ??
            ctx.args.slice(1).join(' ') ??
            ''
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

const gttsHandler: HandlerFunction = async (
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

    const sent = await replyVoiceNote(opus)
    await reactSuccess()

    unlink(filepath, (_) => _)
    unlink(opus, (_) => _)

    return sent
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

const collectListHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, reply, send, reactWait, reactSuccess } = ctx
    const list = ListMemory.get(ctx.from) || []
    if (list.length == 0 && arg == '') throw stringId.collect_list.usage(ctx)
    await reactWait()

    if (arg == '') {
        const sent = await send(renderList(ctx))
        await send(
            'Kirim `+(isi)` untuk menambahkan ke list\nKirim `-(nomor)` untuk menghapus dari list.'
        )
        reactSuccess()

        return sent
    }

    if (arg == 'end') {
        ListMemory.delete(ctx.from)
        reactSuccess()
        return send(`✅ List ${list[0]} selesai!`)
    }

    const listName = arg
    list.push(listName)
    ListMemory.set(ctx.from, list)

    reactSuccess()
    return reply(
        `📝 ${listName} 📝 dibuat!\nKirim \`+ (isi)\` untuk menambahkan ke list!`
    )
}
