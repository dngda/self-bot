import { Boom } from '@hapi/boom'
import makeWASocket, {
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  AnyMessageContent,
  makeInMemoryStore,
  DisconnectReason,
  WAMessageContent,
  WAMessageKey,
  delay,
  proto,
} from '@adiwajshing/baileys'
import { pino as MAIN_LOGGER } from './utils/logger'
import { messageHandler } from './src/handler'
import {
  sendMessageReply,
  sendSticker,
  sendTyping,
  replyText,
  sendText,
} from './utils'

const logger = MAIN_LOGGER.child({})
logger.level = 'fatal'

const store = makeInMemoryStore({ logger })
store?.readFromFile('./baileys_store_multi.json')

setInterval(() => {
  store?.writeToFile('./baileys_store_multi.json')
}, 10_000)

const startSock = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info')
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`START! using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const waSocket = makeWASocket({
    version,
    logger,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: true,
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
      console.log('connection update', update)
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
