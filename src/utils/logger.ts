import { WAMessage } from '@whiskeysockets/baileys'
import moment from 'moment-timezone'
import chalk from 'chalk'
import P from 'pino'
import { MessageContext } from '.'
moment.tz.setDefault('Asia/Jakarta').locale('id')

export default P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })
const logCmd = (msg: WAMessage, ctx: MessageContext) => {
  const ts = msg.messageTimestamp
  console.log(
    chalk.green('[CMD]'),
    chalk.yellow(moment(1000 * (ts as number)).format('DD/MM/YY HH:mm:ss')),
    'cmd:',
    chalk.green(`${ctx.cmd}`),
    'arg:',
    chalk.green(`"${ctx.arg}"`),
    'from:',
    chalk.green(`${ctx.name}`),
    'Jid:',
    chalk.green(`${ctx.from}`)
  )
}
export { logCmd }
