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
import { pinterestHandler } from '../cmd/scrape'
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

const actions: { [index: string]: any } = {
  eval: evalJS,
  flip: flipHandler,
  menu: menuHandler,
  ping: pingHandler,
  pinterest: pinterestHandler,
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
  if (type === 'notify') {
    console.log(chalk.green('[LOG]'), 'Message received', messages)
    for (const msg of messages) {
      console.log(chalk.green('[LOG]'), 'Data type', msg.message)
      if (
        msg.message?.senderKeyDistributionMessage?.groupId ==
          'status@broadcast' ||
        msg.key.remoteJid == 'status@broadcast'
      )
        return
      if (msg.message?.protocolMessage?.type == 5)
        return console.log(chalk.green('[LOG]'), 'Syncing chats history...')

      const data = await serializeMessage(waSocket, msg)
      plainHandler(waSocket, msg, data)

      if (msg.key.fromMe || config.publicModeChats.includes(data.from)) {
        console.log(chalk.green('[LOG]'), 'Serialized', data)
        if (data.isCmd) {
          try {
            logCmd(msg, data)
            const cmd = getCommand(data.cmd) || ''
            if (cmd in actions) {
              await actions[cmd](waSocket, msg, data)
            }
          } catch (error) {
            console.log(error)
            replyText(waSocket, data.from, `${error}`, msg)
          }
        }
      }
    }
  }
}

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
