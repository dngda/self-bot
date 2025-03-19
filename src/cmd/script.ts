import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { MessageContext } from '../types'
import { exec } from 'child_process'

export default () => {
    execScriptCmd()
}

const execScriptCmd = () => {
    stringId.exec = {
        hint: '📜 _Menjalankan script_',
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
    const script = ctx.arg
    
    if (!script.includes('php') && !script.includes('php')) {
        throw new Error('Hanya script php file yang diizinkan.')
    }

    const childProcess = exec(`cd ${scriptDir} && ${script}`, (err, stdout, stderr) => {
        if (err) {
            throw new Error(err.message)
        }
        if (stderr) {
            throw new Error(stderr)
        }
        if (stdout) {
            return stdout
        }
        return 'Success'
    })

    childProcess.stdout?.on('data', (data) => {
        ctx.reply(data)
    })
}
