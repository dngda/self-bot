import {
    proto,
    WASocket,
    WAMessage,
    WAMediaUpload,
    WAMessageContent,
    AnyMessageContent,
    downloadMediaMessage,
    downloadContentFromMessage,
} from '@whiskeysockets/baileys'
import dotenv from 'dotenv'
import { BotConfig, config } from '../handler'
dotenv.config()

type snu = string | null | undefined
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

export interface MessageContext {
    from: string
    fromMe: boolean | null | undefined
    name: snu
    participant: snu
    body: snu
    prefix: string
    isCmd: boolean
    cmd: string
    arg: string
    args: string[]
    groupName: string | null
    quotedMsg: WAMessageContent | null | undefined
    contextInfo: proto.IContextInfo | null | undefined
    expiration: number | null | undefined

    isGroup: boolean
    isQuotedImage: boolean | null
    isQuotedVideo: boolean | null
    isQuotedSticker: boolean | null
    isQuotedDocument: boolean | null
    isQuoted: boolean | null
    isImage: boolean | null
    isVideo: boolean | null
    isMedia: boolean | null
    isEphemeral: boolean | null
    isStatusMessage: boolean | null

    config: BotConfig
    download: () => Promise<Buffer>
    downloadQuoted: () => Promise<Buffer>
    downloadSticker: () => Promise<Buffer>
    reply: (text: string) => Promise<proto.WebMessageInfo | undefined>
    send: (text: string) => Promise<proto.WebMessageInfo | undefined>
    replySticker: (
        inputMedia: WAMediaUpload
    ) => Promise<proto.WebMessageInfo | undefined>
    replyContent: (
        content: AnyMessageContent
    ) => Promise<proto.WebMessageInfo | undefined>
    replyVoiceNote: (path: string) => Promise<proto.WebMessageInfo | undefined>

    reactWait: () => Promise<proto.WebMessageInfo | undefined>
    reactSuccess: () => Promise<proto.WebMessageInfo | undefined>
    reactError: () => Promise<proto.WebMessageInfo | undefined>
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
                ?.message?.documentMessage?.caption
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

    Object.defineProperty(ctx, 'quotedMsg', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'download', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'downloadQuoted', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'downloadSticker', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'reply', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'send', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'replySticker', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'replyContent', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'replyVoiceNote', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'reactWait', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'reactSuccess', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'reactError', {
        enumerable: false,
    })
    Object.defineProperty(ctx, 'config', {
        enumerable: false,
    })

    return ctx
}
