import { proto } from '@whiskeysockets/baileys'
import util from 'util'
import Long from 'long'

interface StoredMessage {
  timestamp: number | Long | null
  message: proto.IMessage
}

const MessageStore = new Map<string, StoredMessage>()

export const storeMessage = (
  id: string,
  timestamp: number | Long | null,
  message: proto.IMessage
) => {
  MessageStore.set(id, { timestamp, message })
}

export const getMessage = (id: string) => {
  return MessageStore.get(id)
}

export const printStore = (...txt: any[]) => {
  console.log(...txt, util.inspect(MessageStore, false, null, true))
}

// clean up 3 hours old messages every 1 hour
setInterval(() => {
  const now = Date.now()
  MessageStore.forEach((value, key) => {
    if (now - (value.timestamp! as number) > 1000 * 60 * 60 * 3) {
      MessageStore.delete(key)
    }
  })
}, 1000 * 60 * 60)
