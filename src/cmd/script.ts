import { WAMessage, WASocket } from 'baileys'
import { actions } from '../handler.js'
import stringId from '../language.js'
import { menu } from '../menu.js'
import { MessageContext } from '../types.js'
import { exec } from 'child_process'

export default () => {
    execScriptCmd()
}

const execScriptCmd = () => {
    stringId.exec = {
        hint: '📜 _Menjalankan script php di user/script_',
        error: {
            internal: () => 'Terjadi error, coba lagi.',
        },
        usage: (ctx: MessageContext) =>
            `Gunakan _${ctx.prefix}${ctx.cmd} [script]_`,
    }

    menu.push({
        command: 'exec',
        hint: stringId.exec.hint,
        alias: 'run',
        type: 'script',
    })

    Object.assign(actions, {
        exec: execHandler,
    })
}

const execHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    if (ctx.arg == '') {
        throw new Error(stringId.exec.usage(ctx))
    }

    const scriptDir = process.env.EXT_SCRIPT_PATH
    let script = ctx.arg
    script = script.startsWith('php') ? script : `php ${script}`

    if (!script.includes('.php')) {
        throw new Error('Hanya script file php yang diizinkan.')
    }

    const forbiddenCommands = new Set([
        'sudo',
        'rm',
        'mv',
        'cp',
        'nano',
        'vim',
        'vi',
        'chmod',
        'chown',
        'dd',
        'mkfs',
        'shutdown',
        'reboot',
        'kill',
        'pkill',
        'init',
        'halt',
        'poweroff',
        'wget',
        'curl',
    ])

    if (script.split(' ').some((cmd) => forbiddenCommands.has(cmd))) {
        throw new Error('Tidak diizinkan menjalankan command tersebut.')
    }

    const childProcess = exec(
        `cd ${scriptDir} && /bin/${script}`,
        (err, _stdout, stderr) => {
            if (err) {
                return console.error(err)
            }
            if (stderr) {
                return ctx.reply(`${stderr}`)
            }
            return false
        }
    )

    childProcess.stdout?.on('data', (data) => {
        ctx.reply(data)
    })
}
