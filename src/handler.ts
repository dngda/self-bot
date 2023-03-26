import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import { serializeMessage, MessageData, logCmd } from './utils'
import initToolsCmd, { mathHandler } from './cmd/tools'
import initStickerCmd from './cmd/sticker'
import initGeneralCmd from './cmd/general'
import initScrapeCmd from './cmd/scrape'
import initConfigCmd from './cmd/config'
import initIslamCmd from './cmd/islam'
import initOwnerCmd from './cmd/owner'
import { getCommand } from './menu'
import chalk from 'chalk'
import fs from 'fs'

interface BotConfig {
  publicModeChats: string[]
}

export let config: BotConfig = {
  publicModeChats: [],
}

if (fs.existsSync('./data/config.json')) {
  fs.promises.readFile('./data/config.json', 'utf-8').then((data) => {
    config = JSON.parse(data)
  })
}

setInterval(() => {
  fs.promises.writeFile(
    './src/data/config.json',
    JSON.stringify(config, null, 2)
  )
}, 5000)

// every handler must have 3 parameters:
export const actions: { [index: string]: any } = {}

initGeneralCmd()
initStickerCmd()
initScrapeCmd()
initIslamCmd()
initToolsCmd()
initConfigCmd()
initOwnerCmd()

export const messageHandler = async (
  waSocket: WASocket,
  event: {
    messages: WAMessage[]
    type: MessageUpsertType
  }
) => {
  const { type, messages } = event
  if (type === 'append') return null
  console.log(chalk.green('[LOG]'), 'Message received', messages)

  for (const msg of messages) {
    if (isStatusMessage(msg)) return null
    if (isHistorySync(msg))
      return console.log(chalk.green('[LOG]'), 'Syncing chats history...')
    console.log(chalk.red('[LOG]'), 'Data type', msg.message)

    const data = await serializeMessage(waSocket, msg)
    if (msg.key.fromMe || isAllowedChat(data)) {
      sanesCmdHandler(waSocket, msg, data)
      mathHandler(data)
    }

    try {
      if ((msg.key.fromMe || isAllowedChat(data)) && data.isCmd) {
        console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', data)
        logCmd(msg, data)
        const cmd = getCommand(data.cmd) as string
        if (cmd in actions) {
          await actions[cmd](waSocket, msg, data)
        }
      }
    } catch (error) {
      console.log(error)
      data.reactError()
      data.reply(`${error}`)
    }
  }
}

const isAllowedChat = (data: MessageData) =>
  config.publicModeChats.includes(data.from)
const isStatusMessage = (msg: WAMessage) =>
  msg.message?.senderKeyDistributionMessage?.groupId == 'status@broadcast' ||
  msg.key.remoteJid == 'status@broadcast'
const isHistorySync = (msg: WAMessage) =>
  msg.message?.protocolMessage?.type == 5

const sanesCmdHandler = async (
  _wa: WASocket,
  _: WAMessage,
  data: MessageData
) => {
  const { body, send } = data
  switch (true) {
    case /-i/.test(body as string):
      send('/ingfo-atas')
      break
    case /-c/.test(body as string):
      send('/ingfo-cuaca')
      break
    default:
      break
  }
}
