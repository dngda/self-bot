import { Boom } from '@hapi/boom'
import makeWASocket, {
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    proto,
} from '@whiskeysockets/baileys'
import MAIN_LOGGER from './src/utils/logger'
import { messageHandler } from './src/handler'
import NodeCache from 'node-cache'
import { textSync } from 'figlet'
import dotenv from 'dotenv'
import chalk from 'chalk'

import { PlaywrightBrowser, getMessage } from './src/lib/_index'
import { executeSavedScriptInNote } from './src/cmd/owner'
export const browser = new PlaywrightBrowser()

let lastDisconnectReason = ''

dotenv.config()
const logger = MAIN_LOGGER.child({})
logger.level = 'error'

const msgRetryCounterCache = new NodeCache()

const startSock = async () => {
    const { state, saveCreds } = await useMultiFileAuthState(
        './env/baileys_auth_info'
    )
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(
        chalk.red(
            textSync('SERO SELFBOT', {
                horizontalLayout: 'fitted',
                font: 'Letters',
            })
        )
    )
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const waSocket = makeWASocket({
        version,
        logger,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        getMessage: async (key) => {
            const msg = await getMessage(key.id!)
            return (
                msg?.message ||
                proto.Message.fromObject({
                    message: { text: '_Failed to fetch message_' },
                })
            )
        },
        shouldIgnoreJid: (jid) => {
            return jid.endsWith('bot')
        },
    })

    waSocket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            if (
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut
            ) {
                lastDisconnectReason =
                    lastDisconnect?.error?.message || lastDisconnectReason
                startSock()
            } else {
                console.log('Connection closed. You are logged out.')
            }
        }
        console.log('Connection update:', update)

        if (connection === 'open') {
            console.log(
                chalk.yellow('!---------------BOT IS ONLINE---------------!')
            )

            if (lastDisconnectReason) {
                waSocket.sendMessage(process.env.OWNER_NUMBER as string, {
                    text: `🔰Reconnected! reason: ${lastDisconnectReason}`,
                })
            } else {
                waSocket.sendMessage(process.env.OWNER_NUMBER as string, {
                    text: '🔰Bot is online!',
                })
            }

            executeSavedScriptInNote(waSocket)
        }
    })

    waSocket.ev.on('creds.update', saveCreds)

    waSocket.ev.on('messages.upsert', messageHandler.bind(null, waSocket))
}

startSock()
