import { WAMessage, WASocket } from 'baileys'
import { actions } from '../handler.js'
import stringId from '../language.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'
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
        hidden: true,
    })

    Object.assign(actions, {
        exec: execHandler,
    })
}

const execHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    validateInput(ctx)

    validateCommand(ctx.arg)
    const script = buildScriptCommand(ctx.arg)

    executeScript(script, ctx)

    return undefined
}

const validateInput = (ctx: MessageContext) => {
    if (ctx.arg === '') {
        throw new Error(stringId.exec.usage(ctx))
    }

    if (!ctx.arg.includes('.php') && !ctx.fromMe) {
        throw new Error('Hanya script file php yang diizinkan.')
    }
}

const buildScriptCommand = (arg: string): string => {
    const scriptDir = process.env.EXT_SCRIPT_PATH
    let script = arg

    if (script.includes('.php')) {
        script = script.startsWith('php') ? script : `php ${script}`
        script = `cd ${scriptDir} && /bin/${script}`
    }

    return script
}

const validateCommand = (script: string) => {
    // prettier-ignore
    const forbiddenCommands = new Set([
        'sudo', 'rm', 'mv', 'cp', 'nano', 'vim', 'vi', 'chmod', 'chown',
        'dd', 'mkfs', 'shutdown', 'reboot', 'kill', 'pkill', 'init',
        'halt', 'poweroff', 'wget', 'curl', 'cd', 'git', 'npm', 'yarn',
        'pnpm', 'docker', 'systemctl', 'apt', 'ls', 'cat',
    ])

    if (script.split(' ').some((cmd) => forbiddenCommands.has(cmd))) {
        throw new Error('Tidak diizinkan menjalankan command tersebut.')
    }
}

const executeScript = (script: string, ctx: MessageContext) => {
    const childProcess = exec(script, (err, _stdout, stderr) => {
        if (err) {
            console.error(err)
            return
        }
        if (stderr) {
            ctx.reply(`${stderr.trim()}`)
        }
    })

    childProcess.stdout?.on('data', (data) => {
        ctx.send(data.trim())
    })
}
