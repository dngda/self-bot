import {
  AnyMessageContent,
  delay,
  WAMessage,
  WASocket,
} from '@whiskeysockets/baileys'

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
