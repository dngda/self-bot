import { WAMessage, WASocket } from 'baileys'
import { existsSync, readFileSync, unlink, writeFileSync } from 'fs'
import { actions } from '../handler.js'
import stringId from '../language.js'
import {
    LANGUAGES,
    addNote,
    deleteNote,
    getNotesList,
    initDatabase,
    mp3ToOpus,
    saveTextToSpeech,
    updateNote,
} from '../lib/_index.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'
import {
    addReminder,
    deleteAllReminders,
    deleteReminder,
    getRemindersList,
    ReminderAttributes,
} from '../lib/reminder.js'

export default () => {
    initDatabase()

    gttsCmd()
    noteCreatorCmd()
    collectListCmd()
    reminderCmd()
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
    const note = await getNotesList(id)
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

    const res = await (isEdit ? updateNote : addNote)(id, noteName, _note, path)

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

const reminderCmd = () => {
    stringId.reminder = {
        hint: '⏰ _Set a reminder message using cronjob_',
        error: {
            invalidFormat: () =>
                '‼️ Format salah! Gunakan salah satu:\n' +
                '• <YYYY-MM-DD> <HH:MM> <pesan>\n' +
                '• <HH:MM> <pesan> (untuk hari ini)\n' +
                '• every <daily|weekly|monthly> <HH:MM> <pesan>\n' +
                'Contoh: 2025-12-31 14:30 Meeting penting!',
            pastDate: () => '‼️ Tanggal/waktu sudah lewat!',
            noReminders: () => '‼️ Tidak ada reminder yang aktif!',
        },
        usage: (
            ctx: MessageContext
        ) => `⏰ ➡️ ${ctx.prefix}remind <YYYY-MM-DD> <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}remind <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}remind every <daily|weekly|monthly> <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}reminders
⏰ ➡️ ${ctx.prefix}delreminder <id>
⏰ ➡️ ${ctx.prefix}delallreminders`,
    }

    menu.push({
        command: 'remind',
        hint: stringId.reminder.hint,
        alias: 'reminders, delreminder, delallreminders',
        type: 'tools',
    })

    Object.assign(actions, {
        remind: reminderHandler,
    })
}

const reminderHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { from, cmd, arg, args, reply } = ctx

    switch (cmd) {
        case 'remind': {
            if (!arg) return reply(stringId.reminder.usage(ctx))

            let nextRunAt: Date
            let repeatType: 'none' | 'daily' | 'weekly' | 'monthly' = 'none'
            let message: string

            // Check if it's a recurring reminder: every <type> <HH:MM> <message>
            if (args[0].toLowerCase() === 'every') {
                const type = args[1]?.toLowerCase()
                if (!['daily', 'weekly', 'monthly'].includes(type)) {
                    return reply(stringId.reminder.error.invalidFormat())
                }
                repeatType = type as 'daily' | 'weekly' | 'monthly'

                const time = args[2]
                if (!time || !/^\d{2}[:.]\d{2}$/.test(time)) {
                    return reply(stringId.reminder.error.invalidFormat())
                }

                message = args.slice(3).join(' ')
                if (!message) {
                    return reply(stringId.reminder.error.invalidFormat())
                }

                // Set next run to today at specified time
                const [hours, minutes] = time.split(/[:.]/).map(Number)
                nextRunAt = new Date()
                nextRunAt.setHours(hours, minutes, 0, 0)

                // If time already passed today, set to tomorrow
                if (nextRunAt <= new Date()) {
                    nextRunAt.setDate(nextRunAt.getDate() + 1)
                }
            }
            // Check if args[0] is time (HH:MM) or date (YYYY-MM-DD)
            else if (/^\d{2}[:.]\d{2}$/.test(args[0])) {
                // Format: <HH:MM> <pesan>
                const time = args[0]
                const [hours, minutes] = time.split(/[:.]/).map(Number)

                message = args.slice(1).join(' ')
                if (!message) {
                    return reply(stringId.reminder.error.invalidFormat())
                }

                nextRunAt = new Date()
                nextRunAt.setHours(hours, minutes, 0, 0)

                // If time already passed today, set to tomorrow
                if (nextRunAt <= new Date()) {
                    nextRunAt.setDate(nextRunAt.getDate() + 1)
                }
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
                // Format: <YYYY-MM-DD> <HH:MM> <pesan>
                const date = args[0]
                const time = args[1]

                if (!time || !/^\d{2}[:.]\d{2}$/.test(time)) {
                    return reply(stringId.reminder.error.invalidFormat())
                }

                message = args.slice(2).join(' ')
                if (!message) {
                    return reply(stringId.reminder.error.invalidFormat())
                }

                const [year, month, day] = date.split('-').map(Number)
                const [hours, minutes] = time.split(/[:.]/).map(Number)

                nextRunAt = new Date(year, month - 1, day, hours, minutes, 0, 0)

                // Check if date is in the past
                if (nextRunAt <= new Date()) {
                    return reply(stringId.reminder.error.pastDate())
                }
            } else {
                return reply(stringId.reminder.error.invalidFormat())
            }

            const reminder = await addReminder(
                from,
                message,
                nextRunAt,
                repeatType
            )

            if (!reminder) {
                return reply('‼️ Error creating reminder!')
            }

            const formattedDate = nextRunAt.toLocaleString('id-ID', {
                dateStyle: 'medium',
                timeStyle: 'short',
            })

            const repeatInfo = repeatType !== 'none' ? ` (${repeatType})` : ''

            return reply(
                `✅ Reminder set\n` +
                    `[ID: ${reminder.id}]${repeatInfo}\n` +
                    `📅 ${formattedDate}\n` +
                    `💬 ${message}`
            )
        }
        case 'reminders': {
            const reminders = await getRemindersList(from)

            if (reminders.length === 0) {
                return reply(stringId.reminder.error.noReminders())
            }

            let list = '⏰ *Your Reminders:*\n\n'
            reminders.forEach((r: ReminderAttributes) => {
                const date = new Date(r.nextRunAt)
                const formattedDate = date.toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                })
                const repeatInfo =
                    r.repeatType !== 'none' ? ` (${r.repeatType})` : ''
                list += `*[ID ${r.id}]${repeatInfo}*\n`
                list += `📅 ${formattedDate}\n`
                list += `💬 ${r.message}\n\n`
            })

            return reply(list.trim())
        }
        case 'delreminder': {
            const id = parseInt(arg)
            if (isNaN(id)) return reply(stringId.reminder.usage(ctx))

            const success = await deleteReminder(id)
            return reply(
                success
                    ? `✅ Reminder ID ${id} deleted!`
                    : `‼️ Reminder ID ${id} not found!`
            )
        }
        case 'delallreminders': {
            const success = await deleteAllReminders(from)
            return reply(
                success
                    ? '✅ All your reminders have been deleted!'
                    : '‼️ You have no reminders to delete!'
            )
        }
        default:
            return
    }
}
