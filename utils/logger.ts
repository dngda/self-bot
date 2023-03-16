import { WAMessage } from '@adiwajshing/baileys'
import moment from 'moment-timezone'
import chalk from 'chalk'
import P from 'pino'
moment.tz.setDefault('Asia/Jakarta').locale('id')

const pino = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })
const logCmd = (msg: WAMessage, data: Record<string, any>) =>
  console.log(
    chalk.green('[CMD]'),
    chalk.yellow(
      moment(msg.messageTimestamp * 1000).format('DD/MM/YY HH:mm:ss')
    ),
    'cmd:',
    chalk.green(`${data.command}`),
    'args:',
    chalk.green(`[${data.args}]`),
    'from:',
    chalk.green(`${data.name}`),
    'Jid:',
    chalk.green(`${data.from}`)
  )
export { logCmd, pino }
