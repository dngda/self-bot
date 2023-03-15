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
dotenv.config()

export const serializeMessage = (waSocket: WASocket, msg: WAMessage) => {
  const data: Record<string, any> = {}
  data.body =
    msg?.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption
  data.isCmd = data.body?.substring(0, 1).match(process.env.PREFIX) != null

  data.command = data.isCmd ? data.body!.substring(1).split(' ')[0] : ''
  data.prefix = data.isCmd ? data.body!.substring(0, 1) : ''
  data.args = data.body?.split(' ').slice(1)
  data.from = msg.key.remoteJid!
  data.name = msg.pushName

  data.isGroup = data.from.endsWith('@g.us')
  data.quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  data.isQuotedImage = data.quotedMsg?.imageMessage != null
  data.isQuotedVideo = data.quotedMsg?.videoMessage != null
  data.isQuoted = data.quotedMsg != null
  data.isImage = msg.message?.imageMessage != null
  data.isVideo = msg.message?.videoMessage != null
  data.isMedia =
    data.isImage || data.isVideo || data.isQuotedImage || data.isQuotedVideo
  data.groupName = msg.message?.groupInviteMessage?.groupName
  data.download = async () => {
    return await downloadMediaMessage(msg, 'buffer', {})
  }
  data.downloadQuoted = async () => {
    return await downloadMediaMessage(
      { key: msg.key, message: data.quotedMsg },
      'buffer',
      {}
    )
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
