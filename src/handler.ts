import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import { replyText, sendMessageReply, serializeMessage } from '../utils/index'
import { evalJS, evalJSON, helpHandler, pingHandler } from '../cmd/info'
import { changePublicHandler } from '../cmd/config'
import { stickerHandler } from '../cmd/sticker'
import { logCmd } from '../utils/logger'
import { expand } from '../utils/predefined'
import chalk from 'chalk'

export const config = {
  isPublic: false,
}

const actions: { [index: string]: any } = expand({
  'ping, p': pingHandler,
  'help, h, ?': helpHandler,
  'sticker, stiker, s': stickerHandler,
  'mode, public': changePublicHandler,
  '=': evalJSON,
  '>': evalJS,
})

export const messageHandler = async (
  waSocket: WASocket,
  event: {
    messages: WAMessage[]
    type: MessageUpsertType
  }
) => {
  const { type, messages } = event
  if (type === 'notify') {
    console.log('[LOG]', 'Message received', messages)
    console.log(
      '[LOG]',
      'Message extendedTextMessage',
      messages[0].message?.extendedTextMessage
    )

    for (const msg of messages) {
      if (msg.key.fromMe || config.isPublic) {
        const data = serializeMessage(waSocket, msg)
        console.log(data)
        if (data.isCmd) {
          try {
            logCmd(msg, data)
            if (data.command in actions) {
              await actions[data.command](waSocket, msg, data)
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
