import { WAMessage } from '@adiwajshing/baileys'
import moment from 'moment-timezone'
import chalk from 'chalk'
import P from 'pino'
import { MessageData } from '.'
moment.tz.setDefault('Asia/Jakarta').locale('id')

const pino = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })
const logCmd = (msg: WAMessage, data: MessageData) => {
  const ts = msg.messageTimestamp
  console.log(
    chalk.green('[CMD]'),
    chalk.yellow(moment(1000 * (ts as number)).format('DD/MM/YY HH:mm:ss')),
    'cmd:',
    chalk.green(`${data.cmd}`),
    'args:',
    chalk.green(`[${data.args}]`),
    'from:',
    chalk.green(`${data.name}`),
    'Jid:',
    chalk.green(`${data.from}`)
  )
}
export { logCmd, pino }
