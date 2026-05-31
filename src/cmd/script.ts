import { WAMessage, WASocket } from 'baileys'
import { actions } from '../handler.js'
import stringId from '../language.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'
import { spawn } from 'node:child_process'

export default function registerScriptCommands() {
    execScriptCmd()
}

const execScriptCmd = () => {
    stringId.exec = {
        hint: '📜 _Menjalankan script php di user/script_',
        error: {
            internal: () => 'Terjadi error, coba lagi.',
        },
        usage: (ctx: MessageContext) =>
            `Gunakan _${ctx.prefix}${ctx.cmd} [php script]_`,
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
    const spec = buildScriptCommand(ctx.arg)

    await executeScript(spec, ctx)

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

type ScriptSpec = { cmd: string; args: string[]; cwd?: string }

const buildScriptCommand = (arg: string): ScriptSpec => {
    const scriptDir = process.env.EXT_SCRIPT_PATH || ''

    if (arg.includes('.php')) {
        if (!scriptDir) throw new Error('EXT_SCRIPT_PATH not configured')

        const parts = arg.trim().split(/\s+/)
        const filename = parts.find((p) => p.endsWith('.php')) || ''

        if (!filename) throw new Error('Invalid script name')
        if (
            filename.includes('..') ||
            filename.includes('/') ||
            filename.includes('\\')
        ) {
            throw new Error('Invalid script path')
        }

        return { cmd: 'php', args: [filename], cwd: scriptDir }
    }

    // For non-php (owner-only), run as single executable without shell
    const parts = arg.trim().split(/\s+/)
    return { cmd: parts[0], args: parts.slice(1) }
}

const validateCommand = (script: string) => {
    // prettier-ignore
    const forbiddenCommands = new Set([
        'sudo', 'rm', 'mv', 'cp', 'nano', 'vim', 'vi', 'chmod', 'chown',
        'dd', 'mkfs', 'shutdown', 'reboot', 'kill', 'pkill', 'init',
        'halt', 'poweroff', 'wget', 'curl', 'cd', 'git', 'npm', 'yarn',
        'pnpm', 'docker', 'systemctl', 'apt', 'ls', 'less', 'more',
        'head', 'tail', 'cat', 'echo', 'env', 'export',
    ])

    const tokens = script.split(/\s+/)
    if (tokens.some((cmd) => forbiddenCommands.has(cmd))) {
        throw new Error('Tidak diizinkan menjalankan command tersebut.')
    }

    // Reject shell metacharacters to avoid accidental shell interpretation
    if (/[;&|$`<>]/.test(script)) {
        throw new Error('Invalid characters in command')
    }
}

const executeScript = (
    spec: ScriptSpec,
    ctx: MessageContext
): Promise<void> => {
    return new Promise((resolve) => {
        try {
            const child = spawn(spec.cmd, spec.args, {
                cwd: spec.cwd,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false,
            })

            child.stdout?.on('data', (chunk) => {
                const text = chunk.toString().trim()
                if (text) ctx.send(text)
            })

            child.stderr?.on('data', (chunk) => {
                const text = chunk.toString().trim()
                if (text) ctx.reply(text)
            })

            child.on('error', (err) => {
                console.error('Script execution error:', err)
                ctx.reply('Error executing script')
                resolve()
            })

            child.on('close', () => resolve())
        } catch (err) {
            console.error('Failed to spawn script:', err)
            ctx.reply('Failed to execute script')
            resolve()
        }
    })
}
