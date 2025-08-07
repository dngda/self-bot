import { WAMessage } from 'baileys'
import chalk from 'chalk'
import moment from 'moment-timezone'
import P from 'pino'
import { MessageContext } from '../types'
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
