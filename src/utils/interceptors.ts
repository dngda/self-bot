import { AnyMessageContent, WAMessage, WASocket, proto } from 'baileys'
import chalk from 'chalk'
import fs from 'fs'
import * as math from 'mathjs'
import { logCmd } from './_index.js'
import { getStatusListMessage } from '../cmd/owner.js'
import { actions, config } from '../handler.js'
import stringId from '../language.js'
import { getNote, getStatus } from '../lib/_index.js'
import { getCommand } from '../menu.js'
import { MessageContext } from '../types.js'
import { serializeMessage } from './serializer.js'
import { ListMemory, renderList } from '../cmd/tools.js'

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
        if (stickerSha in config.sticker_commands) {
            ctx.cmd = config.sticker_commands[stickerSha].cmd
            ctx.arg = config.sticker_commands[stickerSha].arg
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

    const listJid = quoted?.split('\n').slice(1)
    const jid =
        listJid[parseInt(ctx.body as string) - 1]
            .split(' ')[1]
            .replace('@', '') + '@s.whatsapp.net'
    const message = await getStatusListMessage(jid)

    return wa.sendMessage(ctx.from, { text: message, mentions: [jid] })
}

// msg key and timestamp
type MsgKeyForListType = Map<
    string,
    { key: proto.IMessageKey; timestamp: number }
>
const MsgKeyForList: MsgKeyForListType = new Map()

async function sendList(ctx: MessageContext, wa: WASocket) {
    const existing = MsgKeyForList.get(ctx.from)
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

    MsgKeyForList.set(ctx.from, {
        key: sent?.key as proto.IMessageKey,
        timestamp: sent?.messageTimestamp as number,
    })
    return sent
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
    // add body to list
    list.push(ctx.body!.slice(1).trim())
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

    if (index > list.length || index < 1) {
        return await ctx.reply('Nomor tidak valid!')
    }

    // Index 0 stores the list title; items start from index 1
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

    if (index > list.length || index < 1) {
        return await ctx.reply('Nomor tidak valid!')
    }

    if (newValue === '') {
        return await ctx.reply('Nilai baru tidak boleh kosong!')
    }

    // Update the specified index with the new value
    list[index] = newValue
    ListMemory.set(ctx.from, list)
    await ctx.reactSuccess()

    return sendList(ctx, wa)
}

export const handleAutoSticker = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (!config.autosticker.includes(ctx.from)) return null
    if (getCommand(ctx.cmd) === 'sticker') return null

    if (ctx.isImage || ctx.isVideo) {
        return actions['sticker'](wa, msg, ctx)
    }

    return null
}
