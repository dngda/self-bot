import { Boom } from '@hapi/boom'
import makeWASocket, {
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    proto,
} from 'baileys'
import qrTerminal from 'qrcode-terminal'
import MAIN_LOGGER from './src/utils/logger.js'
import { mainMessageProcessor } from './src/handler.js'
import NodeCache from 'node-cache'
import figlet from 'figlet'
import dotenv from 'dotenv'
import chalk from 'chalk'

import { PlaywrightBrowser, getMessage } from './src/lib/_index.js'
import { executeSavedScriptInNote } from './src/cmd/owner.js'
export let browser: PlaywrightBrowser

let lastDisconnectReason = ''

dotenv.config()
const logger = MAIN_LOGGER.child({})
logger.level = 'fatal'

const msgRetryCounterCache = new NodeCache()
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })

const startSock = async () => {
    if (!browser) {
        browser = new PlaywrightBrowser()
    }

    const { state, saveCreds } = await useMultiFileAuthState(
        './env/baileys_auth_info'
    )
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(
        chalk.red(
            figlet.textSync('SERO SELFBOT', {
                horizontalLayout: 'fitted',
                font: 'Letters',
            })
        )
    )
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

    const waSocket = makeWASocket({
        browser: Browsers.baileys('SERO SELFBOT'),
        version,
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

    waSocket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (update.qr) {
            console.log(chalk.blue('QR CODE'))
            qrTerminal.generate(
                update.qr,
                {
                    small: true,
                },
                (qr: unknown) => {
                    console.log(qr)
                }
            )
        } else {
            console.log('Connection update:', update)
        }

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

    waSocket.ev.on('messages.upsert', mainMessageProcessor.bind(null, waSocket))

    waSocket.ev.on('groups.update', async ([event]) => {
        const metadata = await waSocket.groupMetadata(event.id!)
        groupCache.set(event.id!, metadata)
    })

    waSocket.ev.on('group-participants.update', async (event) => {
        const metadata = await waSocket.groupMetadata(event.id!)
        groupCache.set(event.id!, metadata)
    })
}

startSock()
