import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import {
  MessageData,
  replyText,
  sendText,
  serializeMessage,
  logCmd,
} from '../utils'
import { menuHandler, pingHandler } from '../cmd/general'
import { changePublicHandler } from '../cmd/config'
import { pinterestHandler, tiktokDLHandler } from '../cmd/scrape'
import { stickerHandler } from '../cmd/sticker'
import { evalJS, evalJSON } from '../cmd/owner'
import { flipHandler } from '../cmd/tools'
import { getCommand } from './menu'
import chalk from 'chalk'
import fs from 'fs'

interface BotConfig {
  publicModeChats: string[]
}

export let config: BotConfig = {
  publicModeChats: [],
}

if (fs.existsSync('./src/data/config.json')) {
  fs.promises.readFile('./src/data/config.json', 'utf-8').then((data) => {
    config = JSON.parse(data)
  })
}

setInterval(() => {
  fs.promises.writeFile(
    './src/data/config.json',
    JSON.stringify(config, null, 2)
  )
}, 5000)

// 'src/menu' command : 'cmd/type' related handler
const actions: { [index: string]: any } = {
  eval: evalJS,
  flip: flipHandler,
  menu: menuHandler,
  ping: pingHandler,
  pinterest: pinterestHandler,
  tiktokdl: tiktokDLHandler,
  public: changePublicHandler,
  return: evalJSON,
  sticker: stickerHandler,
}

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
    plainHandler(waSocket, msg, data)

    try {
      if ((msg.key.fromMe || isAllowedChat(data)) && data.isCmd) {
        console.log(chalk.green('[LOG]'), 'Serialized', data)
        logCmd(msg, data)
        const cmd = getCommand(data.cmd) as string
        if (cmd in actions) {
          await actions[cmd](waSocket, msg, data)
        }
      }
    } catch (error) {
      console.log(error)
      replyText(waSocket, data.from, `${error}`, msg)
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

const plainHandler = async (
  waSocket: WASocket,
  _: WAMessage,
  data: MessageData
) => {
  switch (data.body) {
    case '-i':
      sendText(waSocket, data.from, '/ingfo-atas')
      break
    case '-c':
      sendText(waSocket, data.from, '/ingfo-cuaca')
      break
    default:
      break
  }
}
