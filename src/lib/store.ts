import { proto } from '@whiskeysockets/baileys'
import util from 'util'
import fs from 'fs'

interface StoredMessage {
    timestamp: number
    message: proto.IMessage
    key: proto.IMessageKey
}

let MessageStore = new Map<string, StoredMessage>()
let StatusStore = new Map<string, StoredMessage[]>()

if (!fs.existsSync('data/status.json')) {
    fs.writeFileSync('data/status.json', '{}', 'utf-8')
}

if (!fs.existsSync('data/message.json')) {
    fs.writeFileSync('data/message.json', '{}', 'utf-8')
}

const statusData = fs.readFileSync('data/status.json', 'utf-8')
const statusJSON = JSON.parse(statusData)
StatusStore = new Map(Object.entries(statusJSON))

const messageData = fs.readFileSync('data/message.json', 'utf-8')
const messageJSON = JSON.parse(messageData)
MessageStore = new Map(Object.entries(messageJSON))

export const storeMessage = (
    id: string,
    timestamp: number,
    message: proto.IMessage,
    key: proto.IMessageKey
) => {
    MessageStore.set(id, { timestamp, message, key })
}

export const storeStatus = (
    jid: string,
    timestamp: number,
    message: proto.IMessage,
    key: proto.IMessageKey
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

export const getStatusList = () => {
    const data = Array.from(StatusStore).map(([key, value]) => {
        return { key: key, length: value.length }
    })

    return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const printStatusStore = (...txt: any[]) => {
    console.log(...txt, util.inspect(StatusStore, false, null, true))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const printMessageStore = (...txt: any[]) => {
    console.log(...txt, util.inspect(MessageStore, false, null, true))
}

// clean up 3 hours old messages every 1 hour
setInterval(() => {
    const now = Date.now()
    MessageStore.forEach((value, key) => {
        if (now - value.timestamp * 1000 > 1000 * 60 * 60 * 3) {
            MessageStore.delete(key)
        }
    })
}, 1000 * 60 * 60)

// clean up 1 day old status every 1 hour
setInterval(() => {
    const now = Date.now()
    StatusStore.forEach((value, key) => {
        const newMessages = value.filter(
            (msg) => now - msg.timestamp * 1000 < 1000 * 60 * 60 * 24
        )
        if (newMessages.length === 0) {
            StatusStore.delete(key)
        } else {
            StatusStore.set(key, newMessages)
        }
    })
}, 1000 * 60 * 60)

// save status every 15 minutes
setInterval(() => {
    const messageObj = Object.create(null)
    Array.from(MessageStore).forEach((el) => {
        messageObj[el[0]] = el[1]
    })

    fs.writeFileSync('data/message.json', JSON.stringify(messageObj), 'utf-8')

    const statusObj = Object.create(null)
    Array.from(StatusStore).forEach((el) => {
        statusObj[el[0]] = el[1]
    })

    fs.writeFileSync('data/status.json', JSON.stringify(statusObj), 'utf-8')
}, 1000 * 60 * 15)
