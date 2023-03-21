import {
  AnyMessageContent,
  delay,
  WAMediaUpload,
  WAMessage,
  WASocket,
} from '@adiwajshing/baileys'

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
