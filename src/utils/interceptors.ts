import { AnyMessageContent, WAMessage, WASocket } from 'baileys'
import chalk from 'chalk'
import fs from 'fs'
import * as math from 'mathjs'
import { logCmd } from './_index.js'
import { getStatusListMessage } from '../cmd/owner.js'
import { actions, configManager } from '../handler.js'
import stringId from '../language.js'
import { getNote, getStatus } from '../lib/_index.js'
import { getCommand } from '../menu.js'
import { MessageContext } from '../types.js'
import { serializeMessage } from './serializer.js'
import {
    getListMessageKey,
    ListMemory,
    renderList,
    storeListMessageKey,
} from '../cmd/tools.js'

export const handleNoteCommand = async (ctx: MessageContext) => {
    const { fromMe, participant, from, body } = ctx
    const id = fromMe ? 'me' : participant ?? from
    const note = await getNote(id, body as string)
    if (note?.media) {
        const media = fs.readFileSync(note.media)
        const contentType = note.media.endsWith('.mp4') ? 'video' : 'image'
        const content: AnyMessageContent =
            contentType === 'video'
                ? { video: media, caption: note.content }
                : { image: media, caption: note.content }
        if (ctx.isQuoted) {
            await ctx.quoteReplyContent(content, {
                key: {
                    fromMe: ctx.fromMe,
                    id: ctx.contextInfo?.stanzaId,
                    remoteJid: ctx.contextInfo?.participant,
                },
                message: ctx.quotedMsg,
            })
        } else {
            await ctx.replyContent(content)
        }
    } else if (note) {
        if (ctx.isQuoted) {
            await ctx.quoteReply(note.content, {
                key: {
                    fromMe: ctx.fromMe,
                    id: ctx.contextInfo?.stanzaId,
                    remoteJid: ctx.contextInfo?.participant,
                },
                message: ctx.quotedMsg,
            })
        } else {
            await ctx.reply(note.content)
        }
    }
}

export const handleRepeatCommand = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const quoted = ctx.quotedMsg
    if (quoted) {
        const msg: WAMessage = {
            key: _msg.key,
            messageTimestamp: _msg.messageTimestamp,
            pushName: _msg.pushName,
            message: quoted,
        }
        const quotedData = await serializeMessage(_wa, msg)
        if (quotedData.isCmd) {
            const cmd = getCommand(quotedData.cmd) as string
            if (cmd in actions) {
                console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', ctx)
                logCmd(msg, quotedData)
                await actions[cmd](_wa, msg, quotedData)
            }
        }
    }
}

export const handleStickerCommand = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { stickerMessage } = _msg.message ?? {}
    const stickerSha = stickerMessage?.fileSha256
        ? Buffer.from(stickerMessage.fileSha256!).toString('base64')
        : ''

    try {
        const stickerCmd = configManager.getStickerCommand(stickerSha)
        if (stickerCmd) {
            ctx.cmd = stickerCmd.cmd
            ctx.arg = stickerCmd.arg
            ctx.args = ctx.arg.split(' ')
            const cmd = getCommand(ctx.cmd)
            logCmd(_msg, ctx)
            await actions[cmd]?.(_wa, _msg, ctx)
        }
    } catch (error) {
        console.error(error)
    }
}

export const handleMathEquation = async (ctx: MessageContext) => {
    const { body, quotedMsg } = ctx
    if (!body?.startsWith('=')) return null
    let args = body.slice(1)
    if (!args || args == '') return null
    if (args.length < 2) return null
    if (quotedMsg?.conversation) args = quotedMsg.conversation + args
    if (/[()$&_`~'":\\,|;\][?]/g.test(args) && !/\([^()]+\)/g.test(args))
        return null
    console.log(chalk.blue('[MATH]'), 'Doing =', args)
    const result = math.evaluate(
        args
            .replace(/x/gi, '*')
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace('**', '^')
    )
    return await ctx.reply(`${result}`)
}

export const handleReplyToContactStatusList = async (
    wa: WASocket,
    _: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.quotedMsg?.extendedTextMessage?.text?.includes('Status from'))
        return null

    await ctx.reactWait()
    const jids = ctx.quotedMsg?.extendedTextMessage?.contextInfo?.mentionedJid
    const jid = jids ? jids[0] : ''

    if (jid == '') {
        throw stringId.getStatus.error.invalidJid
    }

    const statuses = getStatus(jid)
    if (!statuses) {
        throw stringId.getStatus.error.notFound
    }

    const status = statuses[parseInt(ctx.body as string) - 1]
    if (!status) {
        throw stringId.getStatus.error.notFound
    }

    await ctx.reactSuccess()
    return await wa.sendMessage(ctx.from, {
        forward: { key: status.key, message: status.message },
        contextInfo: { forwardingScore: 2, isForwarded: true },
    })
}

export const handleReplyToStatusList = async (
    wa: WASocket,
    _: WAMessage,
    ctx: MessageContext
) => {
    const quoted = ctx.quotedMsg?.extendedTextMessage?.text
    if (!quoted?.includes('List Status Update')) return null

    const listIndex = parseInt(ctx.body as string) - 1
    const jid =
        ctx.quotedMsg?.extendedTextMessage?.contextInfo?.mentionedJid?.[
            listIndex
        ]
    if (!jid) throw stringId.getStatus.error.invalidJId

    const message = await getStatusListMessage(jid)

    return wa.sendMessage(ctx.from, { text: message, mentions: [jid] })
}

async function sendList(ctx: MessageContext, wa: WASocket) {
    const existing = getListMessageKey(ctx.from)
    if (existing) {
        const timeDiff = Date.now() - existing.timestamp * 1000

        // 10 menit
        if (timeDiff < 10 * 60 * 1000) {
            return wa.sendMessage(ctx.from, {
                edit: existing.key,
                text: renderList(ctx),
            })
        }
    }

    const sent = await ctx.send(renderList(ctx))
    storeListMessageKey(ctx.from, sent)
    return sent
}

export const handleMultiListCommands = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ListMemory.has(ctx.from)) return null
    if (!ctx.quotedMsgBody?.includes('List:')) {
        return null
    }

    const bodyStr = (ctx.body as string).trim()
    const commands = bodyStr.split(',').map((cmd) => cmd.trim())

    let hasError = false
    const errors: string[] = []

    for (const command of commands) {
        if (!command) continue

        const op = command[0]
        const arg = command.slice(1).trim()

        if (op === '+') {
            if (!arg) {
                errors.push(`Invalid add command: "${command}"`)
                hasError = true
                continue
            }
            // Handle add
            const list = ListMemory.get(ctx.from) || []
            const cleanInvisibleChars = (text: string) =>
                text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim()

            const normalizeForCompare = (text: string) => text.toLowerCase()
            const existingSet = new Set(
                list.map((item) =>
                    normalizeForCompare(cleanInvisibleChars(item.text))
                )
            )

            const key = normalizeForCompare(arg)
            if (!existingSet.has(key)) {
                list.push({ text: arg, checked: false })
                ListMemory.set(ctx.from, list)
            }
        } else if (op === '-') {
            // Handle delete
            if (!/^\d+$/.test(arg)) {
                errors.push(`Invalid delete command: "${command}"`)
                hasError = true
                continue
            }
            const list = ListMemory.get(ctx.from)
            if (!list) {
                errors.push(`List not found`)
                hasError = true
                continue
            }

            const index = parseInt(arg)
            if (index >= list.length || index < 1) {
                errors.push(`Invalid index: ${index}`)
                hasError = true
                continue
            }
            list.splice(index, 1)
            ListMemory.set(ctx.from, list)
        } else if (op === 'e') {
            // Handle edit
            const space = arg.indexOf(' ')
            if (space === -1) {
                errors.push(`Invalid edit command: "${command}"`)
                hasError = true
                continue
            }
            const indexStr = arg.slice(0, space)
            if (!/^\d+$/.test(indexStr)) {
                errors.push(`Invalid edit command: "${command}"`)
                hasError = true
                continue
            }
            const newValue = arg.slice(space + 1).trim()
            const list = ListMemory.get(ctx.from)
            if (!list) {
                errors.push(`List not found`)
                hasError = true
                continue
            }

            const index = parseInt(indexStr)
            if (index >= list.length || index < 1) {
                errors.push(`Invalid index: ${index}`)
                hasError = true
                continue
            }
            if (!newValue) {
                errors.push(`Edit value cannot be empty: "${command}"`)
                hasError = true
                continue
            }
            list[index].text = newValue
            ListMemory.set(ctx.from, list)
        } else if (op === 'x') {
            // Handle toggle
            if (!/^\d+$/.test(arg)) {
                errors.push(`Invalid toggle command: "${command}"`)
                hasError = true
                continue
            }
            const list = ListMemory.get(ctx.from)
            if (!list) {
                errors.push(`List not found`)
                hasError = true
                continue
            }

            const index = parseInt(arg)
            if (index >= list.length || index < 1) {
                errors.push(`Invalid index: ${index}`)
                hasError = true
                continue
            }
            list[index].checked = !list[index].checked
            ListMemory.set(ctx.from, list)
        }
    }

    await ctx.reactSuccess()

    if (hasError && errors.length > 0) {
        await ctx.reply(`⚠️ Some commands failed:\n${errors.join('\n')}`)
    }

    return sendList(ctx, wa)
}

export const handleAddList = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ListMemory.has(ctx.from)) return null
    if (!ctx.quotedMsgBody?.includes('List:')) {
        return null
    }

    const list = ListMemory.get(ctx.from) || []
    const rawInput = ctx.body?.slice(1).trim() ?? ''

    if (!rawInput) {
        return await ctx.reply('Isi list tidak boleh kosong!')
    }

    const cleanInvisibleChars = (text: string) =>
        text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim()

    const normalizeForCompare = (text: string) => text.toLowerCase()
    const existingSet = new Set(
        list.map((item) => normalizeForCompare(cleanInvisibleChars(item.text)))
    )

    const key = normalizeForCompare(rawInput)
    if (existingSet.has(key)) {
        return await ctx.reply('Item sudah ada di list!')
    }

    list.push({ text: rawInput, checked: false })
    ListMemory.set(ctx.from, list)

    await ctx.reactSuccess()

    return sendList(ctx, wa)
}

export const handleDeleteList = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ListMemory.has(ctx.from)) return null
    if (!ctx.quotedMsgBody?.includes('List:')) {
        return null
    }

    const list = ListMemory.get(ctx.from)
    if (!list) return null

    const index = parseInt(ctx.body?.slice(1) ?? '0')

    if (index >= list.length || index < 1) {
        return await ctx.reply('Nomor tidak valid!')
    }

    list.splice(index, 1)
    ListMemory.set(ctx.from, list)
    await ctx.reactSuccess()

    return sendList(ctx, wa)
}

export const handleEditList = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ListMemory.has(ctx.from)) return null
    if (!ctx.quotedMsgBody?.includes('List:')) {
        return null
    }

    const list = ListMemory.get(ctx.from)
    if (!list) return null

    const index = parseInt(ctx.body?.slice(1).trim().split(' ')[0] ?? '0')
    const newValue = ctx.body?.trim().split(' ').slice(1).join(' ') ?? ''

    if (index >= list.length || index < 1) {
        return await ctx.reply('Nomor tidak valid!')
    }

    if (newValue === '') {
        return await ctx.reply('Nilai baru tidak boleh kosong!')
    }

    list[index].text = newValue
    ListMemory.set(ctx.from, list)
    await ctx.reactSuccess()

    return sendList(ctx, wa)
}

export const handleToggleList = async (
    wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ListMemory.has(ctx.from)) return null
    if (!ctx.quotedMsgBody?.includes('List:')) {
        return null
    }

    const list = ListMemory.get(ctx.from)
    if (!list) return null

    const index = parseInt(ctx.body?.slice(1) ?? '0')

    if (index >= list.length || index < 1) {
        return await ctx.reply('Nomor tidak valid!')
    }

    list[index].checked = !list[index].checked
    ListMemory.set(ctx.from, list)
    await ctx.reactSuccess()

    return sendList(ctx, wa)
}

export const handleAutoSticker = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (!configManager.isAutoStickerEnabled(ctx.from)) return null
    if (getCommand(ctx.cmd) === 'sticker') return null

    if (ctx.isImage || ctx.isVideo) {
        return actions['sticker'](wa, msg, ctx)
    }

    return null
}
