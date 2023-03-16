import {
  downloadMediaMessage,
  AnyMessageContent,
  WAMediaUpload,
  MessageType,
  WAMessage,
  WASocket,
  delay,
} from '@adiwajshing/baileys'
import dotenv from 'dotenv'
import { config } from '../src/handler'
dotenv.config()

export const serializeMessage = (waSocket: WASocket, msg: WAMessage) => {
  const data: Record<string, any> = {}
  data.body =
    msg?.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.conversation ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ||
    msg.message?.ephemeralMessage?.message?.imageMessage?.caption ||
    msg.message?.ephemeralMessage?.message?.videoMessage?.caption
  data.isCmd = data.body?.substring(0, 1).match(process.env.PREFIX) != null

  data.command = data.isCmd ? data.body!.substring(1).split(' ')[0] : ''
  data.prefix = data.isCmd ? data.body!.substring(0, 1) : ''
  data.args = data.body?.replace(data.prefix + data.command, '').trim()
  data.from = msg.key.remoteJid!
  data.fromMe = msg.key.fromMe
  data.name = msg.pushName
  data.config = config
  data.quotedMsg =
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo
      ?.quotedMessage?.ephemeralMessage?.message
  data.isGroup = data.from.endsWith('@g.us')
  data.groupName = () => {
    return waSocket.groupMetadata(data.from).then((res) => res.subject)
  }
  data.isQuotedImage = data.quotedMsg?.imageMessage != null
  data.isQuotedVideo = data.quotedMsg?.videoMessage != null
  data.isQuoted = data.quotedMsg != null
  data.isImage =
    msg.message?.imageMessage != null ||
    msg.message?.ephemeralMessage?.message?.imageMessage != null
  data.isVideo =
    msg.message?.videoMessage != null ||
    msg.message?.ephemeralMessage?.message?.videoMessage != null
  data.isMedia =
    data.isImage || data.isVideo || data.isQuotedImage || data.isQuotedVideo

  data.download = async () => {
    let msgData: WAMessage
    if (Object.keys(msg.message!)[0] == 'ephemeralMessage') {
      msgData = {
        key: msg.key,
        message: msg.message?.ephemeralMessage?.message,
      }
    } else {
      msgData = msg
    }
    return await downloadMediaMessage(msgData, 'buffer', {})
  }
  data.downloadQuoted = async () => {
    return await downloadMediaMessage(
      { key: msg.key, message: data.quotedMsg },
      'buffer',
      {}
    )
  }

  data.reply = async (text: string) => {
    await waSocket.sendMessage(data.from, { text: text }, { quoted: msg })
  }

  return data
}

export const sendTyping = async (waSocket: WASocket, jid: string) => {
  await waSocket.presenceSubscribe(jid)
  await delay(500)
  await waSocket.sendPresenceUpdate('composing', jid)
  await delay(2000)
  await waSocket.sendPresenceUpdate('paused', jid)
}

export const sendMessageReply = async (
  waSocket: WASocket,
  jid: string,
  msg: AnyMessageContent,
  quoted: WAMessage
) => {
  await waSocket.sendMessage(jid, msg, { quoted: quoted })
}

export const sendSticker = async (
  waSocket: WASocket,
  jid: string,
  inputMedia: WAMediaUpload,
  msg: WAMessage
) => {
  await waSocket.sendMessage(jid, { sticker: inputMedia }, { quoted: msg })
}

export const sendText = async (
  waSocket: WASocket,
  jid: string,
  text: string
) => {
  await waSocket.sendMessage(jid, { text: text })
}

export const replyText = async (
  waSocket: WASocket,
  jid: string,
  text: string,
  quoted: WAMessage
) => {
  await waSocket.sendMessage(jid, { text: text }, { quoted: quoted })
}
