import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import {
  MessageData,
  replyText,
  sendMessageReply,
  sendText,
  serializeMessage,
} from '../utils/index'
import { menuHandler, pingHandler } from '../cmd/general'
import { changePublicHandler } from '../cmd/config'
import { stickerHandler } from '../cmd/sticker'
import { evalJS, evalJSON } from '../cmd/owner'
import { flipHandler } from '../cmd/tools'
import { logCmd } from '../utils/logger'
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
  ping: pingHandler,
  menu: menuHandler,
  flip: flipHandler,
  sticker: stickerHandler,
  public: changePublicHandler,
  return: evalJSON,
  eval: evalJS,
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
    console.log(chalk.green('[LOG]'), 'Data type', messages[0].message)

    for (const msg of messages) {
      const data = serializeMessage(waSocket, msg)
      plainHandler(waSocket, msg, data)

      if (msg.key.fromMe || config.publicModeChats.includes(data.from)) {
        console.log(chalk.green('[LOG]'), 'Serialized', data)
        if (data.isCmd) {
          try {
            logCmd(msg, data)
            const cmd = getCommand(data.command) || ''
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
  msg: WAMessage,
  data: MessageData
) => {
  switch (data.body) {
    case '--i':
      sendText(waSocket, data.from, '/ingfo-atas')
      break

    default:
      break
  }
}
