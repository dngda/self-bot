import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import { replyText, sendMessageReply, serializeMessage } from '../utils/index'
import { evalJS, evalJSON, menuHandler, pingHandler } from '../cmd/info'
import { changePublicHandler } from '../cmd/config'
import { stickerHandler } from '../cmd/sticker'
import { logCmd } from '../utils/logger'
import chalk from 'chalk'
import { getCommand } from './menu'

interface BotConfig {
  publicModeChats: string[]
}

export const config: BotConfig = {
  publicModeChats: [],
}

const actions: { [index: string]: any } = {
  ping: pingHandler,
  menu: menuHandler,
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
      const from = msg.key.remoteJid!
      if (msg.key.fromMe || config.publicModeChats.includes(from)) {
        const data = serializeMessage(waSocket, msg)
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
