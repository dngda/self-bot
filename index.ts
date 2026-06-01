import { Boom } from '@hapi/boom'
import makeWASocket, {
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    WASocket as _WASocket,
    ParticipantAction,
    DisconnectReason,
    GroupParticipant,
    ConnectionState,
    GroupMetadata,
    Browsers,
    proto,
} from 'baileys'
import qrTerminal from 'qrcode-terminal'
import MAIN_LOGGER from './src/utils/logger.js'
import { mainMessageProcessor } from './src/handler.js'
import { serve } from '@hono/node-server'
import NodeCache from 'node-cache'
import figlet from 'figlet'
import dotenv from 'dotenv'
import chalk from 'chalk'

import {
    PlaywrightBrowser,
    getMessage,
    initiateReminderCron,
} from './src/lib/_index.js'
import { executeSavedScriptInNote } from './src/cmd/owner.js'
import app from './src/lib/exposed.js'
import { rmSync } from 'fs'

// Types
interface WASocket extends _WASocket {
    isReady?: boolean
}

// Constants
const AUTH_DIR = './env/baileys_auth_info'
const EXPOSED_PORT = 3333
const GROUP_CACHE_TTL = 5 * 60 // 5 minutes

// Global state
export let browser: PlaywrightBrowser
export let waSocket: WASocket = undefined as unknown as WASocket

let lastDisconnectReason = ''
let isStarting = false
let reconnectAttempts = 0

// Initialize environment and logger
dotenv.config()
const logger = MAIN_LOGGER.child({})
logger.level = 'fatal'

// Caches
const msgRetryCounterCache = new NodeCache()
const groupCache = new NodeCache({ stdTTL: GROUP_CACHE_TTL, useClones: false })

/**
 * Display application banner
 */
const displayBanner = (): void => {
    console.log(
        chalk.red(
            figlet.textSync('SERO SELFBOT', {
                horizontalLayout: 'fitted',
                font: 'Letters',
            })
        )
    )
}

/**
 * Initialize the browser instance
 */
const initializeBrowser = async (): Promise<void> => {
    if (!browser) {
        browser = await PlaywrightBrowser.create()
    }
}

/**
 * Display QR code for authentication
 */
const displayQRCode = (qr: string): void => {
    console.log(chalk.blue('QR CODE'))
    qrTerminal.generate(qr, { small: true }, (renderedQR: unknown) => {
        console.log(renderedQR)
    })
}

/**
 * Send notification to owner
 */
const notifyOwner = async (sock: WASocket, message: string): Promise<void> => {
    const ownerJid = process.env.OWNER_JID
    if (!ownerJid) {
        console.warn('OWNER_JID not set in environment variables')
        return
    }

    try {
        await sock.sendMessage(ownerJid, { text: message })
    } catch (error) {
        console.error('Failed to notify owner:', error)
    }
}

/**
 * Handle connection events
 */
const handleConnectionUpdate =
    (sock: WASocket) => async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            displayQRCode(qr)
            return
        }

        console.log('Connection update:', update)

        if (connection === 'close') {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut

            if (shouldReconnect) {
                lastDisconnectReason =
                    lastDisconnect?.error?.message || lastDisconnectReason
                console.log('Connection closed. Scheduling reconnect...')
                scheduleReconnect()
            } else {
                console.log('Connection closed. You are logged out.')
                // delete auth files and restart
                try {
                    rmSync(AUTH_DIR, { recursive: true, force: true })
                } catch (err) {
                    console.error('Failed to remove auth dir:', err)
                }
                scheduleReconnect()
            }
        }

        if (connection === 'open') {
            console.log(
                chalk.yellow('!---------------BOT IS ONLINE---------------!')
            )

            const notificationMessage = lastDisconnectReason
                ? `🔰Reconnected! reason: ${lastDisconnectReason}`
                : '🔰Bot is online!'

            await notifyOwner(sock, notificationMessage)
            lastDisconnectReason = ''

            // reset reconnect attempts on successful connect
            reconnectAttempts = 0
            isStarting = false

            executeSavedScriptInNote(sock)

            if (waSocket) {
                waSocket.isReady = true
            }
        }
    }

/**
 * Handle group metadata updates
 */
const handleGroupUpdate =
    (sock: WASocket) => async (events: Partial<GroupMetadata>[]) => {
        try {
            const [event] = events
            if (!event?.id) return

            const metadata = await sock.groupMetadata(event.id)
            groupCache.set(event.id, metadata)
        } catch (error) {
            console.error('Failed to update group metadata:', error)
        }
    }

/**
 * Handle group participant updates
 */
const handleGroupParticipantsUpdate =
    (sock: WASocket) =>
    async (event: {
        id: string
        author: string
        authorPn?: string
        participants: GroupParticipant[]
        action: ParticipantAction
    }) => {
        try {
            const metadata = await sock.groupMetadata(event.id)
            groupCache.set(event.id, metadata)
        } catch (error) {
            console.error('Failed to update group participants:', error)
        }
    }

/**
 * Create and configure WhatsApp socket
 */
const createSocket = async (
    state: Awaited<ReturnType<typeof useMultiFileAuthState>>['state'],
    version: Awaited<ReturnType<typeof fetchLatestBaileysVersion>>
): Promise<WASocket> => {
    const sock = makeWASocket({
        browser: Browsers.baileys('SERO SELFBOT'),
        version: version.version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        getMessage: async (key) => {
            const msg = getMessage(key.id!)
            return (
                msg?.message ||
                proto.Message.create({
                    conversation: 'Failed to fetch message',
                })
            )
        },
        shouldIgnoreJid: (jid) => jid?.endsWith('bot'),
        cachedGroupMetadata: async (jid) => groupCache.get(jid),
    })

    return sock as WASocket
}

const scheduleReconnect = () => {
    if (isStarting) return
    const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts)
    reconnectAttempts += 1
    console.log(
        `Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`
    )
    setTimeout(() => {
        startSock().catch((err) => {
            console.error('Reconnect attempt failed:', err)
        })
    }, delay)
}

/**
 * Register event handlers for the socket
 */
const registerEventHandlers = (
    sock: WASocket,
    saveCreds: () => Promise<void>
): void => {
    sock.ev.on('connection.update', handleConnectionUpdate(sock))
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('messages.upsert', mainMessageProcessor.bind(null, sock))
    sock.ev.on('groups.update', handleGroupUpdate(sock))
    sock.ev.on('group-participants.update', handleGroupParticipantsUpdate(sock))
}

/**
 * Main function to start WhatsApp socket connection
 */
const startSock = async (): Promise<void> => {
    if (isStarting) return
    isStarting = true
    try {
        await initializeBrowser()

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
        const versionInfo = await fetchLatestBaileysVersion()

        displayBanner()
        console.log(
            `Using WA v${versionInfo.version.join('.')}, isLatest: ${
                versionInfo.isLatest
            }`
        )

        const sock = await createSocket(state, versionInfo)
        waSocket = sock

        registerEventHandlers(sock, saveCreds)
        initiateReminderCron(sock)
    } catch (error) {
        console.error('Failed to start WhatsApp socket:', error)
        throw error
    }
}

/**
 * Start the exposure server
 */
const startExposedServer = (): void => {
    serve(
        {
            fetch: app.fetch,
            port: EXPOSED_PORT,
        },
        (info) => {
            console.log(
                `Exposure Server is running on http://localhost:${info.port}`
            )
        }
    )
}

/**
 * Main application entry point
 */
const main = async (): Promise<void> => {
    try {
        await startSock()
        startExposedServer()
    } catch (error) {
        console.error('Fatal error during startup:', error)
        process.exit(1)
    }
}

// Start the application
main()
