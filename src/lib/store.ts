import { proto } from '@whiskeysockets/baileys'
import util from 'util'

interface StoredMessage {
  key: proto.IMessageKey
  timestamp: number
  message: proto.IMessage
}

const MessageStore = new Map<string, StoredMessage[]>()

export const storeMessage = (
  key: proto.IMessageKey,
  timestamp: number,
  message: proto.IMessage
) => {
  if (key.participant) delete key.participant
  const keyStr = JSON.stringify(key)
  const messages = MessageStore.get(keyStr) || []
  messages.push({ key, timestamp, message })
  MessageStore.set(keyStr, messages)
}

export const getMessage = (key: proto.IMessageKey) => {
  const keyStr = JSON.stringify(key)
  const messages = MessageStore.get(keyStr)
  return messages?.[0]
}

export const printStore = (...txt: any[]) => {
  console.log(...txt, util.inspect(MessageStore, false, null, true))
}

// clean up old messages every 1 hour
setInterval(() => {
  const now = Date.now()
  MessageStore.forEach((messages, key) => {
    const newMessages = messages.filter(
      (msg) => now - msg.timestamp < 1000 * 60 * 60 * 3 // 3 hours
    )
    MessageStore.set(key, newMessages)
  })
}, 60_000)
