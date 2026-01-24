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
    getAllReminders,
    getRemindersList,
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
        hint: '📝 Buat Daftar_',
        error: {
            textOnly: () => '‼️ Hanya support text!',
        },
        usage: (ctx: MessageContext) => `📝 CRUD List.
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
    const title = list[0].charAt(0).toUpperCase() + list[0].slice(1)

    let listText = `🧵 List: ${title}\n`
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
            'Reply list dengan\n`+(isi)` untuk add ke list\n`-(nomor)` untuk remove dari list\n`e(nomor)` untuk edit item di list'
        )
        reactSuccess()

        return sent
    }

    if (arg == 'end') {
        if (list.length == 0) {
            await reply('‼️ Tidak ada list yang sedang berjalan.')
            return
        }

        ListMemory.delete(ctx.from)
        reactSuccess()
        return send(`🏁 List ${list[0]} selesai!`)
    }

    if (list.length > 0) {
        return reply(
            `‼️ List sudah dimulai dengan nama *${list[0]}*.\nKirim \`${ctx.prefix}list end\` untuk mengakhiri list sebelum memulai yang baru.`
        )
    }

    const title = arg.replace(/list/i, '').trim()
    const listName = title.charAt(0).toUpperCase() + title.slice(1)
    list.push(listName)
    ListMemory.set(ctx.from, list)

    reactSuccess()
    return reply(
        `🧵 ${listName}!\n1.\nReply list dengan \`+(isi)\` untuk add ke list\n\`-(nomor)\` untuk remove dari list.\n\`e(nomor)\` untuk edit item di list`
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
                '• every <senin,rabu,jumat> <HH:MM> <pesan>\n' +
                'Contoh: 2025-12-31 14:30 Meeting penting!',
            pastDate: () => '‼️ Tanggal/waktu sudah lewat!',
            noReminders: () => '‼️ Tidak ada reminder yang aktif!',
            invalidDays: () =>
                '‼️ Hari tidak valid! Gunakan: senin, selasa, rabu, kamis, jumat, sabtu, minggu',
            ownerOnly: () => '‼️ Command ini hanya untuk owner!',
            notFound: () => '‼️ Reminder tidak ditemukan!',
        },
        usage: (
            ctx: MessageContext
        ) => `⏰ ➡️ ${ctx.prefix}remind <YYYY-MM-DD> <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}remind <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}remind every <daily|weekly|monthly> <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}remind every <senin,rabu,jumat> <HH:MM> <pesan>
⏰ ➡️ ${ctx.prefix}reminders
⏰ ➡️ ${ctx.prefix}delreminder <id>
⏰ ➡️ ${ctx.prefix}delallreminders
⏰ ➡️ ${ctx.prefix}updatereminder <id> [format sama seperti remind]`,
    }

    menu.push({
        command: 'remind',
        hint: stringId.reminder.hint,
        alias: 'reminders, delreminder, delallreminders, updatereminder',
        type: 'tools',
    })

    Object.assign(actions, {
        remind: reminderHandler,
    })
}

// Helper: Parse day names to day numbers
const parseDayNames = (daysStr: string): number[] | null => {
    // prettier-ignore
    const dayMap: { [key: string]: number } = {
        'minggu': 0, 'sunday': 0, 'min': 0,
        'senin': 1, 'monday': 1, 'sen': 1,
        'selasa': 2, 'tuesday': 2, 'sel': 2,
        'rabu': 3, 'wednesday': 3, 'rab': 3,
        'kamis': 4, 'thursday': 4, 'kam': 4,
        'jumat': 5, 'friday': 5, 'jum': 5,
        'sabtu': 6, 'saturday': 6, 'sab': 6,
    }

    const days = daysStr
        .toLowerCase()
        .split(',')
        .map((d) => d.trim())
    const dayNumbers: number[] = []

    for (const day of days) {
        if (dayMap[day] !== undefined) {
            dayNumbers.push(dayMap[day])
        } else {
            return null
        }
    }

    return [...new Set(dayNumbers)].sort()
}

// Helper: Format date for display
const formatReminderDate = (date: Date): string => {
    return date.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

// Helper: Format repeat info for display
const formatRepeatInfo = (
    repeatType: string,
    repeatDays: number[] | null | string
): string => {
    if (repeatType === 'custom_days' && repeatDays) {
        // Handle case where repeatDays might be a JSON string from SQLite
        const daysArray =
            typeof repeatDays === 'string' ? JSON.parse(repeatDays) : repeatDays

        const dayNames = [
            'Minggu',
            'Senin',
            'Selasa',
            'Rabu',
            'Kamis',
            'Jumat',
            'Sabtu',
        ]
        const daysList = daysArray.map((d: number) => dayNames[d]).join(', ')
        return ` (setiap ${daysList})`
    } else if (repeatType !== 'none') {
        return ` (${repeatType})`
    }
    return ''
}

// Helper: Parse time string to hours and minutes
const parseTime = (time: string): [number, number] => {
    return time.split(/[:.]/).map(Number) as [number, number]
}

// Helper: Calculate next run date for custom days
const calculateNextCustomDay = (baseDate: Date, repeatDays: number[]): Date => {
    const nextRun = new Date(baseDate)

    // If time already passed today, start from tomorrow
    if (nextRun <= new Date()) {
        nextRun.setDate(nextRun.getDate() + 1)
    }

    // Find next day that matches repeatDays
    let found = false
    let attempts = 0
    while (!found && attempts < 7) {
        const dayOfWeek = nextRun.getDay()
        if (repeatDays.includes(dayOfWeek)) {
            found = true
        } else {
            nextRun.setDate(nextRun.getDate() + 1)
            attempts++
        }
    }

    return nextRun
}

// Helper: Parse recurring reminder (every ...)
const parseRecurringReminder = (
    args: string[]
): {
    nextRunAt: Date
    repeatType: 'daily' | 'weekly' | 'monthly' | 'custom_days'
    repeatDays: number[] | null
    message: string
} | null => {
    const type = args[1]?.toLowerCase()
    if (!type) return null

    // Check if it's custom days
    const parsedDays = parseDayNames(type)
    let repeatType: 'daily' | 'weekly' | 'monthly' | 'custom_days'
    let repeatDays: number[] | null = null

    if (parsedDays !== null) {
        repeatType = 'custom_days'
        repeatDays = parsedDays
    } else if (['daily', 'weekly', 'monthly'].includes(type)) {
        repeatType = type as 'daily' | 'weekly' | 'monthly'
    } else {
        return null
    }

    const time = args[2]
    if (!time || !/^\d{2}[:.]\d{2}$/.test(time)) return null

    const message = args.slice(3).join(' ')
    if (!message) return null

    const [hours, minutes] = parseTime(time)
    let nextRunAt = new Date()
    nextRunAt.setHours(hours, minutes, 0, 0)

    if (repeatType === 'custom_days' && repeatDays && repeatDays.length > 0) {
        nextRunAt = calculateNextCustomDay(nextRunAt, repeatDays)
    } else {
        // For daily/weekly/monthly, if time already passed today, set to tomorrow
        if (nextRunAt <= new Date()) {
            nextRunAt.setDate(nextRunAt.getDate() + 1)
        }
    }

    return { nextRunAt, repeatType, repeatDays, message }
}

// Helper: Parse time-only reminder (HH:MM)
const parseTimeOnlyReminder = (
    args: string[]
): { nextRunAt: Date; message: string } | null => {
    const time = args[0]
    if (!/^\d{2}[:.]\d{2}$/.test(time)) return null

    const message = args.slice(1).join(' ')
    if (!message) return null

    const [hours, minutes] = parseTime(time)
    const nextRunAt = new Date()
    nextRunAt.setHours(hours, minutes, 0, 0)

    // If time already passed today, set to tomorrow
    if (nextRunAt <= new Date()) {
        nextRunAt.setDate(nextRunAt.getDate() + 1)
    }

    return { nextRunAt, message }
}

// Helper: Parse date-time reminder (YYYY-MM-DD HH:MM)
const parseDateTimeReminder = (
    args: string[]
): { nextRunAt: Date; message: string } | null => {
    const date = args[0]
    const time = args[1]

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    if (!time || !/^\d{2}[:.]\d{2}$/.test(time)) return null

    const message = args.slice(2).join(' ')
    if (!message) return null

    const [year, month, day] = date.split('-').map(Number)
    const [hours, minutes] = parseTime(time)

    const nextRunAt = new Date(year, month - 1, day, hours, minutes, 0, 0)

    // Check if date is in the past
    if (nextRunAt <= new Date()) return null

    return { nextRunAt, message }
}

// Handle: Update reminder (owner only)
const handleUpdateReminder = async (
    ctx: MessageContext
): Promise<WAMessage | undefined> => {
    const { from, args, reply } = ctx

    // Check if user is owner
    const isOwner =
        from === process.env.OWNER_JID || from === process.env.OWNER_LID

    if (!isOwner) {
        return reply(stringId.reminder.error.ownerOnly())
    }

    // Parse ID
    const id = parseInt(args[0])
    if (isNaN(id)) {
        return reply(stringId.reminder.usage(ctx))
    }

    // Remove ID from args for parsing
    const reminderArgs = args.slice(1)

    let nextRunAt: Date
    let repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days' =
        'none'
    let repeatDays: number[] | null = null
    let message: string

    // Parse recurring reminder
    if (reminderArgs[0]?.toLowerCase() === 'every') {
        const parsed = parseRecurringReminder(reminderArgs)
        if (!parsed) return reply(stringId.reminder.error.invalidFormat())
        ;({ nextRunAt, repeatType, repeatDays, message } = parsed)
    }
    // Parse time-only reminder
    else if (/^\d{2}[:.]\d{2}$/.test(reminderArgs[0])) {
        const parsed = parseTimeOnlyReminder(reminderArgs)
        if (!parsed) return reply(stringId.reminder.error.invalidFormat())
        ;({ nextRunAt, message } = parsed)
    }
    // Parse date-time reminder
    else if (/^\d{4}-\d{2}-\d{2}$/.test(reminderArgs[0])) {
        const parsed = parseDateTimeReminder(reminderArgs)
        if (!parsed) return reply(stringId.reminder.error.pastDate())
        ;({ nextRunAt, message } = parsed)
    }
    // Invalid format
    else {
        return reply(stringId.reminder.error.invalidFormat())
    }

    // Update reminder
    const { updateReminder } = await import('../lib/reminder.js')
    const success = await updateReminder(
        id,
        message,
        nextRunAt,
        repeatType,
        1,
        repeatDays
    )

    if (!success) {
        return reply(stringId.reminder.error.notFound())
    }

    // Format response
    const formattedDate = formatReminderDate(nextRunAt)
    const repeatInfo = formatRepeatInfo(repeatType, repeatDays)

    return reply(
        `✅ Reminder updated\n` +
            `[ID: ${id}]${repeatInfo}\n` +
            `📅 ${formattedDate}\n` +
            `💬 ${message}`
    )
}

// Handle: Create reminder
const handleCreateReminder = async (
    ctx: MessageContext
): Promise<WAMessage | undefined> => {
    const { from, args, reply } = ctx

    let nextRunAt: Date
    let repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days' =
        'none'
    let repeatDays: number[] | null = null
    let message: string

    // Parse recurring reminder
    if (args[0].toLowerCase() === 'every') {
        const parsed = parseRecurringReminder(args)
        if (!parsed) return reply(stringId.reminder.error.invalidFormat())
        ;({ nextRunAt, repeatType, repeatDays, message } = parsed)
    }
    // Parse time-only reminder
    else if (/^\d{2}[:.]\d{2}$/.test(args[0])) {
        const parsed = parseTimeOnlyReminder(args)
        if (!parsed) return reply(stringId.reminder.error.invalidFormat())
        ;({ nextRunAt, message } = parsed)
    }
    // Parse date-time reminder
    else if (/^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
        const parsed = parseDateTimeReminder(args)
        if (!parsed) return reply(stringId.reminder.error.pastDate())
        ;({ nextRunAt, message } = parsed)
    }
    // Invalid format
    else {
        return reply(stringId.reminder.error.invalidFormat())
    }

    // Create reminder
    const reminder = await addReminder(
        from,
        message,
        nextRunAt,
        repeatType,
        1,
        repeatDays
    )

    if (!reminder) {
        return reply('‼️ Error creating reminder!')
    }

    // Format response
    const formattedDate = formatReminderDate(nextRunAt)
    const repeatInfo = formatRepeatInfo(repeatType, repeatDays)

    return reply(
        `✅ Reminder set\n` +
            `[ID: ${reminder.id}]${repeatInfo}\n` +
            `📅 ${formattedDate}\n` +
            `💬 ${message}`
    )
}

// Handle: List reminders
const handleListReminders = async (
    ctx: MessageContext,
    wa: WASocket
): Promise<WAMessage | undefined> => {
    const { from, reply, expiration } = ctx

    // Check if chat is in owner
    const isOwner =
        from === process.env.OWNER_JID || from === process.env.OWNER_LID

    // Get reminders (all if owner, otherwise just for the user)
    const reminders = isOwner
        ? await getAllReminders()
        : await getRemindersList(from)

    if (reminders.length === 0) {
        return reply(stringId.reminder.error.noReminders())
    }

    let list = isOwner ? '⏰ *All Reminders:*\n\n' : '⏰ *Your Reminders:*\n\n'
    const mentions: string[] = []

    for (const r of reminders) {
        const formattedDate = formatReminderDate(new Date(r.nextRunAt))
        const repeatInfo = formatRepeatInfo(r.repeatType, r.repeatDays)

        list += `*[ID ${r.id}]${repeatInfo}*\n`
        list += `📅 ${formattedDate}\n`
        list += `💬 ${r.message}\n`

        // Show from field for owner
        if (isOwner) {
            if (r.from.endsWith('@g.us')) {
                try {
                    const groupMetadata = await wa.groupMetadata(r.from)
                    list += `👥 Group: ${groupMetadata.subject}\n`
                } catch (error) {
                    list += `👥 Group: ${r.from}\n`
                }
            } else {
                list += `👤 From: @${r.from.split('@')[0]}\n`
                if (!mentions.includes(r.from)) {
                    mentions.push(r.from)
                }
            }
        }

        list += '\n'
    }

    // Send with mentions if owner and has mentions
    if (isOwner && mentions.length > 0) {
        return wa.sendMessage(
            from,
            { text: list.trim(), mentions },
            { ephemeralExpiration: expiration! }
        )
    }

    return reply(list.trim())
}

// Handle: Delete single reminder
const handleDeleteReminder = async (
    ctx: MessageContext
): Promise<WAMessage | undefined> => {
    const { arg, reply } = ctx
    const id = parseInt(arg)

    if (isNaN(id)) return reply(stringId.reminder.usage(ctx))

    const success = await deleteReminder(id)
    return reply(
        success
            ? `✅ Reminder ID ${id} deleted!`
            : `‼️ Reminder ID ${id} not found!`
    )
}

// Handle: Delete all reminders
const handleDeleteAllReminders = async (
    ctx: MessageContext
): Promise<WAMessage | undefined> => {
    const { from, reply } = ctx
    const success = await deleteAllReminders(from)

    return reply(
        success
            ? '✅ All your reminders have been deleted!'
            : '‼️ You have no reminders to delete!'
    )
}

// Main handler
const reminderHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { cmd, arg, reply } = ctx

    switch (cmd) {
        case 'remind':
            if (!arg) return reply(stringId.reminder.usage(ctx))
            return handleCreateReminder(ctx)

        case 'reminders':
            return handleListReminders(ctx, _wa)

        case 'delreminder':
            return handleDeleteReminder(ctx)

        case 'delallreminders':
            return handleDeleteAllReminders(ctx)

        case 'updatereminder':
            if (!arg) return reply(stringId.reminder.usage(ctx))
            return handleUpdateReminder(ctx)

        default:
            return
    }
}
