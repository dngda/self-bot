import {
    proto,
    WASocket,
    WAMessage,
    WAMediaUpload,
    AnyMessageContent,
    downloadMediaMessage,
    downloadContentFromMessage,
} from '@whiskeysockets/baileys'
import dotenv from 'dotenv'
import { config } from '../handler'
import { MessageContext } from '../types'
dotenv.config()

let prefix = process.env.PREFIX!

export const setPrefix = (newPrefix: string) => {
    prefix = newPrefix
}

export const resetPrefix = () => {
    prefix = process.env.PREFIX!
}

export const getPrefix = () => {
    return prefix
}

export const serializeMessage = async (waSocket: WASocket, msg: WAMessage) => {
    const getBody = () => {
        return (
            msg?.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            msg.message?.documentWithCaptionMessage?.message?.documentMessage
                ?.caption ||
            msg.message?.ephemeralMessage?.message?.conversation ||
            msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
            msg.message?.ephemeralMessage?.message?.imageMessage?.caption ||
            msg.message?.ephemeralMessage?.message?.videoMessage?.caption ||
            msg.message?.ephemeralMessage?.message?.documentWithCaptionMessage
                ?.message?.documentMessage?.caption ||
            msg.message?.editedMessage?.message?.protocolMessage?.editedMessage
                ?.conversation ||
            msg.message?.editedMessage?.message?.protocolMessage?.editedMessage
                ?.extendedTextMessage?.text
        )
    }

    const getCmdProperties = (ctx: MessageContext) => {
        const isBracketed = prefix.startsWith('[') && prefix.endsWith(']')

        if (isBracketed) {
            const prefixMatch = ctx.body
                ?.substring(0, 1)
                .match(process.env.PREFIX!)
            ctx.isCmd = prefixMatch !== null && prefixMatch !== undefined
        } else {
            ctx.isCmd = ctx.body?.startsWith(prefix) ?? false
        }

        if (ctx.isCmd) {
            ctx.cmd = ctx
                .body!.substring(isBracketed ? 1 : prefix.length)
                .split(' ')[0]
            ctx.prefix = isBracketed ? ctx.body!.substring(0, 1) : prefix
        } else {
            ctx.cmd = ''
            ctx.prefix = ''
        }

        ctx.arg = ctx.body?.replace(ctx.prefix + ctx.cmd, '').trim() ?? ''
        ctx.args = ctx.arg.split(' ')
    }

    const getContextInfo = () => {
        return (
            msg.message?.extendedTextMessage?.contextInfo ||
            msg.message?.imageMessage?.contextInfo ||
            msg.message?.videoMessage?.contextInfo ||
            msg.message?.stickerMessage?.contextInfo ||
            msg.message?.ephemeralMessage?.message?.extendedTextMessage
                ?.contextInfo ||
            msg.message?.ephemeralMessage?.message?.imageMessage?.contextInfo ||
            msg.message?.ephemeralMessage?.message?.videoMessage?.contextInfo ||
            msg.message?.ephemeralMessage?.message?.stickerMessage?.contextInfo
        )
    }

    const getQuotedMsg = (
        contextInfo: proto.IContextInfo | null | undefined
    ) => {
        return (
            contextInfo?.quotedMessage?.ephemeralMessage?.message ||
            contextInfo?.quotedMessage
        )
    }

    const getGroupName = async (isGroup: boolean, from: string) => {
        if (isGroup) {
            return (await waSocket.groupMetadata(from)).subject
        }
        return null
    }

    const ctx: MessageContext = {
        from: msg.key.remoteJid!,
        name: msg.pushName,
        body: getBody(),
        fromMe: msg.key.fromMe,
        participant: msg.key.participant,
        contextInfo: getContextInfo(),
        isGroup: msg.key.remoteJid!.endsWith('@g.us'),
    } as MessageContext

    getCmdProperties(ctx)
    ctx.groupName = await getGroupName(ctx.isGroup, ctx.from)
    ctx.quotedMsg = getQuotedMsg(ctx.contextInfo)
    ctx.isQuotedImage =
        ctx.quotedMsg?.imageMessage != null ||
        ctx.quotedMsg?.documentMessage?.mimetype?.includes('image') != null ||
        ctx.quotedMsg?.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.includes(
            'image'
        ) != null
    ctx.isQuotedVideo = ctx.quotedMsg?.videoMessage != null
    ctx.isQuotedSticker = ctx.quotedMsg?.stickerMessage != null
    ctx.isQuotedDocument =
        ctx.quotedMsg?.documentMessage != null ||
        ctx.quotedMsg?.documentWithCaptionMessage?.message?.documentMessage !=
            null
    ctx.isQuoted = ctx.quotedMsg != null
    ctx.isImage =
        msg.message?.imageMessage != null ||
        msg.message?.ephemeralMessage?.message?.imageMessage != null ||
        msg.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.includes(
            'image'
        ) != null ||
        msg.message?.ephemeralMessage?.message?.documentWithCaptionMessage?.message?.documentMessage?.mimetype?.includes(
            'image'
        ) != null
    ctx.isVideo =
        msg.message?.videoMessage != null ||
        msg.message?.ephemeralMessage?.message?.videoMessage != null
    ctx.isMedia =
        ctx.isImage ||
        ctx.isVideo ||
        ctx.isQuotedImage ||
        ctx.isQuotedVideo ||
        ctx.isQuotedSticker ||
        ctx.isQuotedDocument
    ctx.isEphemeral = msg.message?.ephemeralMessage != null
    ctx.isStatusMessage =
        msg.message?.senderKeyDistributionMessage?.groupId ==
            'status@broadcast' ||
        msg.key.remoteJid == 'status@broadcast' ||
        null
    ctx.expiration = ctx.contextInfo?.expiration

    ctx.download = async () => {
        let msgData: WAMessage
        if (ctx.isEphemeral) {
            msgData = {
                key: msg.key,
                message: msg.message?.ephemeralMessage?.message,
            }
        } else {
            msgData = msg
        }
        return (await downloadMediaMessage(msgData, 'buffer', {})) as Buffer
    }

    ctx.downloadQuoted = async () => {
        return (await downloadMediaMessage(
            { key: msg.key, message: ctx.quotedMsg },
            'buffer',
            {}
        )) as Buffer
    }

    ctx.downloadSticker = async () => {
        if (!ctx.isQuotedSticker) {
            throw new Error('No quoted sticker')
        }
        const stickerMessage = ctx.contextInfo?.quotedMessage?.stickerMessage
        const stream = await downloadContentFromMessage(
            stickerMessage!,
            'sticker'
        )
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
        return buffer
    }

    ctx.reply = async (text: string) => {
        return waSocket.sendMessage(
            ctx.from,
            { text: text },
            { quoted: msg, ephemeralExpiration: ctx.expiration! }
        )
    }

    ctx.quoteReply = async (text: string, quoted: proto.IWebMessageInfo) => {
        return waSocket.sendMessage(
            ctx.from,
            { text: text },
            { quoted: quoted, ephemeralExpiration: ctx.expiration! }
        )
    }

    ctx.send = async (text: string) => {
        return waSocket.sendMessage(
            ctx.from,
            { text: text },
            { ephemeralExpiration: ctx.expiration! }
        )
    }

    ctx.replySticker = async (inputMedia: WAMediaUpload) => {
        return waSocket.sendMessage(
            ctx.from,
            { sticker: inputMedia },
            { quoted: msg, ephemeralExpiration: ctx.expiration! }
        )
    }

    ctx.replyContent = async (content: AnyMessageContent) => {
        return waSocket.sendMessage(ctx.from, content, {
            quoted: msg,
            ephemeralExpiration: ctx.expiration!,
        })
    }

    ctx.quoteReplyContent = async (
        content: AnyMessageContent,
        quoted: proto.IWebMessageInfo
    ) => {
        return waSocket.sendMessage(ctx.from, content, {
            quoted: quoted,
            ephemeralExpiration: ctx.expiration!,
        })
    }

    ctx.replyVoiceNote = async (path: string) => {
        return waSocket.sendMessage(
            ctx.from,
            {
                audio: { url: path },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
            },
            {
                quoted: msg,
                ephemeralExpiration: ctx.expiration!,
            }
        )
    }

    ctx.reactWait = async () => {
        return waSocket.sendMessage(ctx.from, {
            react: { text: '⏳', key: msg.key },
        })
    }

    ctx.reactSuccess = async () => {
        return waSocket.sendMessage(ctx.from, {
            react: { text: '✅', key: msg.key },
        })
    }

    ctx.reactError = async () => {
        return waSocket.sendMessage(ctx.from, {
            react: { text: '❌', key: msg.key },
        })
    }

    ctx.config = config

    const hiddenProps = [
        'quotedMsg',
        'download',
        'downloadQuoted',
        'downloadSticker',
        'reply',
        'send',
        'replySticker',
        'replyContent',
        'replyVoiceNote',
        'reactWait',
        'reactSuccess',
        'reactError',
        'quoteReply',
        'quoteReplyContent',
        'config',
    ]
    for (const prop of hiddenProps) {
        Object.defineProperty(ctx, prop, {
            enumerable: false,
        })
    }

    return ctx
}
