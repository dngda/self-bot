import { proto } from '@whiskeysockets/baileys'
import util from 'util'
import fs from 'fs'

interface StoredMessage {
  timestamp: number
  message: proto.IMessage
  key: proto.IMessageKey | null
}

const MessageStore = new Map<string, StoredMessage>()
let StatusStore = new Map<string, StoredMessage[]>()

if (!fs.existsSync('data/status.json')) {
  fs.writeFileSync('data/status.json', '{}', 'utf-8')
}
StatusStore = JSON.parse(fs.readFileSync('status.json', 'utf-8')) as Map<
  string,
  StoredMessage[]
>

export const storeMessage = (
  id: string,
  timestamp: number,
  message: proto.IMessage
) => {
  MessageStore.set(id, { timestamp, message, key: null })
}

export const storeStatus = (
  key: proto.IMessageKey,
  jid: string,
  timestamp: number,
  message: proto.IMessage
) => {
  const messages = StatusStore.get(jid) || []
  messages.push({ timestamp, message, key })
  StatusStore.set(jid, messages)
}

export const getMessage = (id: string) => {
  return MessageStore.get(id)
}

export const getStatus = (jid: string) => {
  return StatusStore.get(jid)
}

// for debugging
export const printStatusStore = (...txt: any[]) => {
  console.log(...txt, util.inspect(StatusStore, false, null, true))
}

export const printMessageStore = (...txt: any[]) => {
  console.log(...txt, util.inspect(MessageStore, false, null, true))
}

// clean up 3 hours old messages every 1 hour
setInterval(() => {
  const now = Date.now()
  MessageStore.forEach((value, key) => {
    if (now - value.timestamp > 1000 * 60 * 60 * 3) {
      MessageStore.delete(key)
    }
  })
}, 1000 * 60 * 60)

// clean up 1 day old status every 1 hour
setInterval(() => {
  const now = Date.now()
  StatusStore.forEach((value, key) => {
    const newMessages = value.filter(
      (msg) => now - msg.timestamp < 1000 * 60 * 60 * 24
    )
    if (newMessages.length === 0) {
      StatusStore.delete(key)
    } else {
      StatusStore.set(key, newMessages)
    }
  })
}, 1000 * 60 * 60)

// save status every 1 hour
setInterval(() => {
  fs.writeFileSync('data/status.json', JSON.stringify(StatusStore), 'utf-8')
}, 1000 * 60 * 60)
