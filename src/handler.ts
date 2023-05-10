import {
  WASocket,
  WAMessage,
  MessageUpsertType,
  proto,
} from '@adiwajshing/baileys'
import { serializeMessage, MessageData, logCmd } from './utils'
import initGeneralCmd, { mathHandler } from './cmd/general'
import initBrowserCmd from './cmd/browser'
import initStickerCmd from './cmd/sticker'
import initScrapeCmd from './cmd/scrape'
import initConfigCmd from './cmd/config'
import initIslamCmd from './cmd/islam'
import initToolsCmd from './cmd/tools'
import initOwnerCmd from './cmd/owner'
import { getCommand } from './menu'
import chalk from 'chalk'
import fs from 'fs'
import { getNoteContent } from './lib'

interface BotConfig {
  publicModeChats: string[]
}

export let config: BotConfig = {
  publicModeChats: [],
}

if (fs.existsSync('./data/config.json')) {
  let conf = fs.readFileSync('./data/config.json', 'utf-8')
  if (conf != '') config = JSON.parse(conf)
}

setInterval(() => {
  fs.promises.writeFile('./data/config.json', JSON.stringify(config, null, 2))
}, 5000)

// every handler must have 3 parameters:
export const actions: { [index: string]: any } = {}

initGeneralCmd()
initStickerCmd()
initScrapeCmd()
initBrowserCmd()
initToolsCmd()
initIslamCmd()

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
    try {
      if (msg.key.fromMe || isAllowedChat(data)) {
        sanesCmdHandler(waSocket, msg, data)
        mathHandler(data)

        const cmd = getCommand(data.cmd) as string
        if (data.isCmd && cmd in actions) {
          console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', data)
          logCmd(msg, data)
          await actions[cmd](waSocket, msg, data)
        }
      }
    } catch (error: any) {
      console.log(error)
      data.reply(`${error}`)
      data.reactError()
    }
  }
}

const isAllowedChat = (data: MessageData) =>
  config?.publicModeChats.includes(data.from)
const isStatusMessage = (msg: WAMessage) =>
  msg.message?.senderKeyDistributionMessage?.groupId == 'status@broadcast' ||
  msg.key.remoteJid == 'status@broadcast'
const isHistorySync = (msg: WAMessage) =>
  msg.message?.protocolMessage?.type == 5

const sanesCmdHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { from, fromMe, participant, body, send, reply } = data
  switch (true) {
    case /^(-i)/.test(body as string):
      send('/ingfo-atas')
      break
    case /^(-c)/.test(body as string):
      send('/ingfo-cuaca')
      break
    case /^#\w+$/.test(body as string):
      const id = fromMe ? 'me' : participant ?? from
      const note = await getNoteContent(id, body as string)
      if (note) reply(note)
      break
    case /^-r$/.test(body as string):
      const quoted = data.quotedMsg
      if (quoted) {
        const msg: proto.IWebMessageInfo = {
          key: _msg.key,
          messageTimestamp: _msg.messageTimestamp,
          pushName: _msg.pushName,
          message: quoted,
        }
        const quotedData = await serializeMessage(_wa, msg)
        if (quotedData.isCmd) {
          const cmd = getCommand(quotedData.cmd) as string
          if (cmd in actions) {
            console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', data)
            logCmd(msg, quotedData)
            await actions[cmd](_wa, quoted, quotedData)
          }
        }
      }
      break
    default:
      break
  }
}
