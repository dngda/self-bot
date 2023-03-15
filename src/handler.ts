import { WASocket, WAMessage, MessageUpsertType } from '@adiwajshing/baileys'
import { helpHandler, pingHandler } from '../cmd/info'
import { stickerHandler } from '../cmd/sticker'
import { sendMessageReply, serializeMessage } from '../utils/index'
import { logPrefix } from '../utils/logger'
import moment from 'moment-timezone'
import chalk from 'chalk'
moment.tz.setDefault('Asia/Jakarta').locale('id')

const actions: { [index: string]: any } = {
  ping: pingHandler,
  help: helpHandler,
  sticker: stickerHandler,
  stiker: stickerHandler,
  s: stickerHandler,
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
    console.log(logPrefix, 'Message received', messages)
    console.log(
      logPrefix,
      'Message extendedTextMessage',
      messages[0].message?.extendedTextMessage
    )

    for (const msg of messages) {
      if (msg.key.fromMe) {
        const data = serializeMessage(waSocket, msg)
        console.log(data)
        if (data.isCmd) {
          console.log(
            chalk.green('[CMD]'),
            chalk.yellow(
              moment(msg.messageTimestamp * 1000).format('DD/MM/YY HH:mm:ss')
            ),
            'command:',
            chalk.green(`${data.command}`),
            'args:',
            chalk.green(`${data.args}`),
            'from:',
            chalk.green(`${data.name}`),
            'Jid:',
            chalk.green(`${data.from}`)
          )
          try {
            if (data.command in actions) {
              await actions[data.command](waSocket, msg, data)
            }
          } catch (error) {
            console.log(error)
            sendMessageReply(waSocket, data.from, { text: `${error}` }, msg)
          }
        }
      }
    }
  }
}
