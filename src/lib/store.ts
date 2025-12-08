import { proto, WAMessage } from 'baileys'
import fs from 'fs/promises'
import path from 'path'
import type Long from 'long'

interface StoredMessage {
    timestamp: number | Long
    message: proto.IMessage
    key: proto.IMessageKey
}

const DATA_DIR = 'data'
const STATUS_FILE = path.join(DATA_DIR, 'status.json')
const MESSAGE_FILE = path.join(DATA_DIR, 'message.json')
const PUSHNAME_FILE = path.join(DATA_DIR, 'pushname.json')

let MessageStore = new Map<string, StoredMessage>()
let StatusStore = new Map<string, StoredMessage[]>()
let PushNameStore = new Map<string, string>()

const dirty = { message: false, status: false, pushname: false }

async function ensureFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true })
    for (const file of [STATUS_FILE, MESSAGE_FILE, PUSHNAME_FILE]) {
        try {
            await fs.access(file)
        } catch {
            await fs.writeFile(file, '{}', 'utf-8')
        }
    }
}

async function loadStore() {
    const [statusData, messageData, pushnameData] = await Promise.all([
        fs.readFile(STATUS_FILE, 'utf-8'),
        fs.readFile(MESSAGE_FILE, 'utf-8'),
        fs.readFile(PUSHNAME_FILE, 'utf-8'),
    ])

    StatusStore = new Map(Object.entries(JSON.parse(statusData)))
    MessageStore = new Map(Object.entries(JSON.parse(messageData)))
    PushNameStore = new Map(Object.entries(JSON.parse(pushnameData)))
}

async function saveStore() {
    if (dirty.message) {
        const messageObj = Object.fromEntries(MessageStore)
        await fs.writeFile(MESSAGE_FILE, JSON.stringify(messageObj), 'utf-8')
        dirty.message = false
    }
    if (dirty.status) {
        const statusObj = Object.fromEntries(StatusStore)
        await fs.writeFile(STATUS_FILE, JSON.stringify(statusObj), 'utf-8')
        dirty.status = false
    }
    if (dirty.pushname) {
        const pushnameObj = Object.fromEntries(PushNameStore)
        await fs.writeFile(PUSHNAME_FILE, JSON.stringify(pushnameObj), 'utf-8')
        dirty.pushname = false
    }
}

ensureFiles()
    .then(() => {
        loadStore().catch((err) => {
            console.error('Error loading store:', err)
        })
    })
    .catch((err) => {
        console.error('Error initializing store:', err)
    })

export const storeMessage = (msg: WAMessage) => {
    const { key, message, messageTimestamp } = msg
    if (!key.id || !message) return
    const id = key.id
    const timestamp = messageTimestamp || Math.floor(Date.now() / 1000)

    MessageStore.set(id, { timestamp, message, key })
    dirty.message = true
}

export const storeStatus = (msg: WAMessage) => {
    const { key, message, messageTimestamp } = msg
    if (!key.participant || !message) return
    const jid = key.participant
    const timestamp = messageTimestamp || Math.floor(Date.now() / 1000)

    const messages = StatusStore.get(jid) || []
    messages.push({ timestamp, message, key })
    StatusStore.set(jid, messages)
    dirty.status = true
}

export const storePushName = (jid: string, name: string) => {
    PushNameStore.set(jid, name)
    dirty.pushname = true
}

export const getMessage = (id: string) => MessageStore.get(id)
export const getStatus = (jid: string) => StatusStore.get(jid)
export const getStatusList = () =>
    Array.from(StatusStore).map(([key, value]) => ({
        key,
        length: value.length,
    }))
export const getPushName = (jid: string) => PushNameStore.get(jid)

// Clean up old messages/status every hour
setInterval(() => {
    const now = Date.now()
    let changed = false
    MessageStore.forEach((value, key) => {
        const ts =
            typeof value.timestamp === 'number'
                ? value.timestamp
                : Number(value.timestamp)
        if (now - ts * 1000 > 1000 * 60 * 60 * 3) {
            MessageStore.delete(key)
            changed = true
        }
    })
    if (changed) dirty.message = true
}, 1000 * 60 * 60)

setInterval(() => {
    const now = Date.now()
    let changed = false
    StatusStore.forEach((value, key) => {
        const newMessages = value.filter(
            (msg) => now - Number(msg.timestamp) * 1000 < 1000 * 60 * 60 * 24
        )
        if (newMessages.length === 0) {
            StatusStore.delete(key)
            changed = true
        } else if (newMessages.length !== value.length) {
            StatusStore.set(key, newMessages)
            changed = true
        }
    })
    if (changed) dirty.status = true
}, 1000 * 60 * 60)

// Save only if dirty every 15 minutes
setInterval(() => {
    saveStore()
}, 1000 * 60 * 15)
