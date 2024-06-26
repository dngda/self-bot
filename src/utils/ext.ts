import { WAMessage, WASocket, proto } from '@whiskeysockets/baileys'
import chalk from 'chalk'
import fs from 'fs'
import * as math from 'mathjs'
import { logCmd } from './_index'
import { getStatusListMessage } from '../cmd/owner'
import { actions, config } from '../handler'
import stringId from '../language'
import { getNoteContent, getStatus } from '../lib/_index'
import { getCommand } from '../menu'
import { MessageContext } from '../types'
import { serializeMessage } from './serializer'

export const handleNoteCommand = async (ctx: MessageContext) => {
    const { fromMe, participant, from, body, reply } = ctx
    const id = fromMe ? 'me' : participant ?? from
    const note = await getNoteContent(id, body as string)
    if (note) {
        if (note.media) {
            const media = fs.readFileSync(note.media)
            if (note.media.endsWith('.mp4')) {
                await ctx.replyContent({ video: media, caption: note.content })
            }
            if (note.media.endsWith('.jpg')) {
                await ctx.replyContent({ image: media, caption: note.content })
            }
        } else {
            await reply(note.content)
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
        const msg: proto.IWebMessageInfo = {
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
        if (stickerSha in config.stickerCommands) {
            ctx.cmd = config.stickerCommands[stickerSha].cmd
            ctx.arg = config.stickerCommands[stickerSha].arg
            ctx.args = ctx.arg.split(' ')
            const cmd = getCommand(ctx.cmd)
            await actions[cmd]?.(_wa, _msg, ctx)
        }
    } catch (error) {
        console.error(error)
    }
}

export const handleMathEquation = async (ctx: MessageContext) => {
    const { body } = ctx
    if (!body?.startsWith('=')) return null
    const args = body.slice(1)
    if (!args || args == '') return null
    if (/[()$&_`~'":\\,|;\][?><!%]/g.test(args) && !/\([^()]+\)/g.test(args))
        return null
    console.log(chalk.blue('[MATH]'), 'Doing =', args)
    const result = math.evaluate(
        args
            .replace(/x/gi, '*')
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/%/g, '/100')
            .replace('**', '^')
    )
    return await ctx.reply(`${result}`)
}

export const handleReplyToContactStatusList = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (!msg.key.fromMe) return null
    if (!ctx.quotedMsg?.extendedTextMessage?.text?.includes('Status from'))
        return null

    await ctx.reactWait()
    const jids = ctx.quotedMsg?.extendedTextMessage?.contextInfo?.mentionedJid
    const jid = jids ? jids[0] : ''

    if (jid == '') {
        throw stringId.getStatus.error.invalidJid
    }

    const statuses = await getStatus(jid)
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
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (!msg.key.fromMe) return null
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
