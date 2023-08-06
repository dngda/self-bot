import { Boom } from '@hapi/boom'
import makeWASocket, {
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  proto,
} from '@whiskeysockets/baileys'
import { pino as MAIN_LOGGER } from './src/utils/logger'
import { messageHandler } from './src/handler'
import NodeCache from 'node-cache'
import { textSync } from 'figlet'
import dotenv from 'dotenv'
import chalk from 'chalk'

import { PlaywrightBrowser } from './src/lib'
export const browser = new PlaywrightBrowser()
browser.initBrowser()

const logger = MAIN_LOGGER.child({})
dotenv.config()
logger.level = 'error'

const msgRetryCounterCache = new NodeCache()

const store = makeInMemoryStore({ logger })

/* disable store persistence because of high cpu usage
store?.readFromFile('./env/baileys_store_multi.json')

setInterval(() => {
  store?.writeToFile('./env/baileys_store_multi.json')
}, 10_000)
*/

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
    shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast'),
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid!, key.id!)
        return msg?.message || undefined
      }
      return proto.Message.fromObject({})
    },
  })

  store?.bind(waSocket.ev)

  waSocket.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update']
      const { connection, lastDisconnect } = update
      if (connection === 'close') {
        if (
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut
        ) {
          startSock()
        } else {
          console.log('Connection closed. You are logged out.')
        }
      }
      console.log('Connection update:', update)

      if (connection === 'open') {
        console.log(
          chalk.yellow('!---------------BOT IS READY---------------!')
        )
        waSocket.sendMessage(process.env.OWNER_NUMBER!, {
          text: '✅ Bot is ready!',
        })
      }
    }

    if (events['creds.update']) {
      await saveCreds()
    }

    if (events.call) {
      console.log('recv call event', events.call)
    }

    // received a new message
    if (events['messages.upsert']) {
      const upsert = events['messages.upsert']
      messageHandler(waSocket, upsert)
    }
  })
}

startSock()
