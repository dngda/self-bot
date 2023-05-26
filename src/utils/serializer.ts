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
import { config } from '../handler'
dotenv.config()

export interface MessageData {
  body: string | null | undefined
  isCmd: boolean
  cmd: string
  prefix: string
  arg: string
  args: string[]
  from: string
  fromMe: boolean | null | undefined
  participant: string | null | undefined
  name: string | null | undefined
  groupName: string | null
  quotedMsg: WAMessageContent | null | undefined
  contextInfo: proto.IContextInfo | null | undefined
  expiration: number | null | undefined

  isGroup: boolean
  isQuotedImage: boolean | null
  isQuotedVideo: boolean | null
  isQuotedSticker: boolean | null
  isQuoted: boolean | null
  isImage: boolean | null
  isVideo: boolean | null
  isMedia: boolean | null
  isEphemeral: boolean | null

  config: Record<string, any>
  download: () => Promise<Buffer>
  downloadQuoted: () => Promise<Buffer>
  downloadSticker: () => Promise<Buffer>
  reply: (text: string) => Promise<void>
  send: (text: string) => Promise<void>
  replySticker: (inputMedia: WAMediaUpload) => Promise<void>
  replyContent: (content: AnyMessageContent) => Promise<void>

  reactWait: () => Promise<void>
  reactSuccess: () => Promise<void>
  reactError: () => Promise<void>
}

export const serializeMessage = async (waSocket: WASocket, msg: WAMessage) => {
  const data: MessageData = {} as any
  data.body =
    msg?.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.conversation ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg.message?.ephemeralMessage?.message?.imageMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.videoMessage?.caption
  data.isCmd = data.body?.substring(0, 1).match(process.env.PREFIX!)
    ? true
    : false

  data.cmd = data.isCmd ? data.body!.substring(1).split(' ')[0] : ''
  data.prefix = data.isCmd ? data.body!.substring(0, 1) : ''
  data.arg = data.body?.replace(data.prefix + data.cmd, '').trim() ?? ''
  data.args = data.arg.split(' ')
  data.from = msg.key.remoteJid!
  data.fromMe = msg.key.fromMe
  data.participant = msg.key.participant
  data.name = msg.pushName
  data.quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
      ?.quotedMessage?.ephemeralMessage?.message

  data.contextInfo =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
    msg.message?.ephemeralMessage?.message?.imageMessage?.contextInfo ||
    msg.message?.ephemeralMessage?.message?.videoMessage?.contextInfo

  data.isGroup = data.from.endsWith('@g.us')
  data.groupName = data.isGroup
    ? (await waSocket.groupMetadata(data.from)).subject
    : null
  data.isQuotedImage = data.quotedMsg?.imageMessage != null
  data.isQuotedVideo = data.quotedMsg?.videoMessage != null
  data.isQuotedSticker = data.quotedMsg?.stickerMessage != null
  data.isQuoted = data.quotedMsg != null
  data.isImage =
    msg.message?.imageMessage != null ||
    msg.message?.ephemeralMessage?.message?.imageMessage != null
  data.isVideo =
    msg.message?.videoMessage != null ||
    msg.message?.ephemeralMessage?.message?.videoMessage != null
  data.isMedia =
    data.isImage || data.isVideo || data.isQuotedImage || data.isQuotedVideo
  data.isEphemeral = msg.message?.ephemeralMessage != null
  data.expiration = data.contextInfo?.expiration
  data.config = config

  data.download = async () => {
    let msgData: WAMessage
    if (data.isEphemeral) {
      msgData = {
        key: msg.key,
        message: msg.message?.ephemeralMessage?.message,
      }
    } else {
      msgData = msg
    }
    return (await downloadMediaMessage(msgData, 'buffer', {})) as Buffer
  }

  data.downloadQuoted = async () => {
    return (await downloadMediaMessage(
      { key: msg.key, message: data.quotedMsg },
      'buffer',
      {}
    )) as Buffer
  }

  data.downloadSticker = async () => {
    const stickerMessage = data.contextInfo?.quotedMessage?.stickerMessage
    const stream = await downloadContentFromMessage(stickerMessage!, 'sticker')
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }
    return buffer
  }

  data.reply = async (text: string) => {
    waSocket.sendMessage(
      data.from,
      { text: text },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )
  }

  data.send = async (text: string) => {
    waSocket.sendMessage(
      data.from,
      { text: text },
      { ephemeralExpiration: data.expiration! }
    )
  }

  data.replySticker = async (inputMedia: WAMediaUpload) => {
    waSocket.sendMessage(
      data.from,
      { sticker: inputMedia },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )
  }

  data.replyContent = async (content: AnyMessageContent) => {
    waSocket.sendMessage(data.from, content, {
      quoted: msg,
      ephemeralExpiration: data.expiration!,
    })
  }

  data.reactWait = async () => {
    await waSocket.sendMessage(data.from, {
      react: { text: '⏳', key: msg.key },
    })
  }

  data.reactSuccess = async () => {
    await waSocket.sendMessage(data.from, {
      react: { text: '✅', key: msg.key },
    })
  }

  data.reactError = async () => {
    await waSocket.sendMessage(data.from, {
      react: { text: '❌', key: msg.key },
    })
  }

  return data
}
