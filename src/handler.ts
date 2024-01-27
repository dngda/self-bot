import {
  WASocket,
  WAMessage,
  MessageUpsertType,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys'
import { serializeMessage, MessageContext, logCmd, getPrefix } from './utils'
import { getMessage, storeMessage } from './lib/store'
import { getNoteContent } from './lib'
import { getCommand } from './menu'
import * as math from 'mathjs'
import initCmds from './cmd'
import chalk from 'chalk'
import util from 'util'
import fs from 'fs'

interface BotConfig {
  [key: string]: any
  publicModeChats: string[]
  stickerCommands: { [index: string]: { cmd: string; arg: string } }
  norevoke: boolean
  oneview: boolean
}

export let config: BotConfig = {
  publicModeChats: [],
  stickerCommands: {},
  norevoke: false,
  oneview: false,
}

if (fs.existsSync('./data/config.json')) {
  let conf = fs.readFileSync('./data/config.json', 'utf-8')
  if (conf != '') config = JSON.parse(conf)
}

export let updateConfig = () => {
  fs.promises.writeFile('./data/config.json', JSON.stringify(config, null, 2))
}

// every handler must have 3 parameters:
export const actions: { [index: string]: any } = {}
initCmds()

export const messageHandler = async (
  waSocket: WASocket,
  event: {
    messages: WAMessage[]
    type: MessageUpsertType
  }
) => {
  const { type, messages } = event
  if (type === 'append') return null

  for (const msg of messages) {
    if (isStatusMessage(msg)) return null
    if (isHistorySync(msg))
      return console.log(chalk.green('[LOG]'), 'Syncing chats history...')
    console.log(
      chalk.green('[LOG]'),
      'Message received',
      util.inspect(msg, false, null, true)
    )
    const ctx = await serializeMessage(waSocket, msg)
    try {
      if (msg.key.fromMe || isAllowedChat(ctx)) {
        noPrefixHandler(waSocket, msg, ctx)

        const cmd = getCommand(ctx.cmd) as string
        if (ctx.isCmd && cmd in actions) {
          console.log(
            chalk.green('[LOG]'),
            'Serialized cmd msg:',
            util.inspect(ctx, false, null, true)
          )
          logCmd(msg, ctx)
          await actions[cmd](waSocket, msg, ctx)
        }
      }
    } catch (error: any) {
      console.log(error)
      ctx.reply(`${error}`)
      ctx.reactError()
    }

    storeMessageData(msg)
    if (config.norevoke) listenDeletedMessage(waSocket, msg)
    if (config.oneview) listenOneViewMessage(waSocket, msg)
  }
}

const isAllowedChat = (ctx: MessageContext) =>
  config?.publicModeChats.includes(ctx.from)
const isStatusMessage = (msg: WAMessage) =>
  msg.message?.senderKeyDistributionMessage?.groupId == 'status@broadcast' ||
  msg.key.remoteJid == 'status@broadcast'
const isHistorySync = (msg: WAMessage) =>
  msg.message?.protocolMessage?.type ==
  proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION

// --------------------------------------------------------- //
const handleNoteCommand = async (ctx: MessageContext) => {
  const { fromMe, participant, from, body, reply } = ctx
  const id = fromMe ? 'me' : participant ?? from
  const note = await getNoteContent(id, body as string)
  if (note) reply(note)
}

const handleRepeatCommand = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  const quoted = ctx.quotedMsg
  if (quoted) {
    const msg: proto.IWebMessageInfo = {
      key: _msg.key,
      messageTimestamp: _msg.messageTimestamp,
      pushName: _msg.pushName,
      message: quoted,
    }
    const quotedData = await serializeMessage(_wa, msg)
    if (quotedData.isCmd) {
      const cmd = getCommand(quotedData.cmd) as string
      if (cmd in actions) {
        console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', ctx)
        logCmd(msg, quotedData)
        await actions[cmd](_wa, quoted, quotedData)
      }
    }
  }
}

const handleStickerCommand = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  const { stickerMessage } = _msg.message ?? {}
  const stickerSha = stickerMessage?.fileSha256
    ? Buffer.from(stickerMessage.fileSha256!).toString('base64')
    : ''

  try {
    if (stickerSha in config.stickerCommands) {
      ctx.cmd = config.stickerCommands[stickerSha].cmd
      ctx.arg = config.stickerCommands[stickerSha].arg
      ctx.args = ctx.arg.split(' ')
      const cmd = getCommand(ctx.cmd)
      await actions[cmd]?.(_wa, _msg, ctx)
    }
  } catch (error) {
    console.error(error)
  }
}

const mathHandler = async (ctx: MessageContext) => {
  const { body } = ctx
  if (!body?.startsWith('=')) return null
  const args = body.slice(1)
  if (!args || args == '') return null
  if (/[()$&_`~'":\\,|;\][?><!%]/g.test(args) && !/\([^()]+\)/g.test(args))
    return null
  console.log(chalk.blue('[MATH]'), 'Doing =', args)
  const result = math.evaluate(
    args
      .replace(/x/gi, '*')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/%/g, '/100')
      .replace('**', '^')
  )
  return await ctx.reply(`${result}`)
}

const noPrefixHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  ctx: MessageContext
) => {
  const { body } = ctx

  if (/^#\w+$/.test(body as string)) {
    await handleNoteCommand(ctx)
  } else if (/^-r$/.test(body as string)) {
    await handleRepeatCommand(_wa, _msg, ctx)
  } else if (/^cekprefix$/.test(body as string)) {
    await ctx.reply(`Prefix: '${getPrefix()}'`)
  } else {
    await mathHandler(ctx)
    await handleStickerCommand(_wa, _msg, ctx)
  }
}

const storeMessageData = (msg: WAMessage) => {
  const key = msg.key
  if (!key) return null
  if (msg.message?.protocolMessage) return null

  storeMessage(key.id!, msg.messageTimestamp!, msg.message!)
  return true
}

const listenDeletedMessage = async (wa: WASocket, msg: WAMessage) => {
  if (
    msg.message?.protocolMessage?.type ==
    proto.Message.ProtocolMessage.Type.REVOKE
  ) {
    const key = msg.message?.protocolMessage?.key
    if (!key) return null

    const _msg = getMessage(key.id!)
    if (!_msg) return null

    const from = msg.key.participant || msg.key.remoteJid!
    let sumber = `from @${from.replace('@s.whatsapp.net', '')}`
    if (msg.key.participant) {
      const subject = (await wa.groupMetadata(msg.key.remoteJid!)).subject
      sumber = `from _${subject}_ by @${msg.key.participant!.replace(
        '@s.whatsapp.net',
        ''
      )}`
    }

    const msgdata = `Deleted msg ${sumber}:`

    await wa.sendMessage(process.env.OWNER_NUMBER!, {
      text: msgdata,
      mentions: [from],
    })

    await wa.sendMessage(process.env.OWNER_NUMBER!, {
      forward: { key: key, message: _msg?.message },
      contextInfo: { forwardingScore: 1, isForwarded: true },
    })
  }
  return true
}

const listenOneViewMessage = async (wa: WASocket, msg: WAMessage) => {
  const viewOnce =
    msg.message?.viewOnceMessage ||
    msg.message?.viewOnceMessageV2 ||
    msg.message?.viewOnceMessageV2Extension ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessage ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessageV2 ||
    msg.message?.ephemeralMessage?.message?.viewOnceMessageV2Extension

  if (!viewOnce) return null

  const { remoteJid, participant } = msg.key
  if (!remoteJid || !participant) return null
  const from = participant
  const subject = (await wa.groupMetadata(remoteJid)).subject
  const sumber = `from _${subject}_ by @${from.replace('@s.whatsapp.net', '')}`

  const msgdata = `One view msg ${sumber}:`

  await wa.sendMessage(process.env.OWNER_NUMBER!, {
    text: msgdata,
    mentions: [from],
  })

  const { message } = viewOnce
  const { imageMessage, videoMessage } = message as proto.IMessage
  if (imageMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message },
      'buffer',
      {}
    )
    await wa.sendMessage(process.env.OWNER_NUMBER!, {
      image: mediaData as Buffer,
      contextInfo: { forwardingScore: 1, isForwarded: true },
    })
  }
  if (videoMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message },
      'buffer',
      {}
    )
    await wa.sendMessage(process.env.OWNER_NUMBER!, {
      video: mediaData as Buffer,
      contextInfo: { forwardingScore: 1, isForwarded: true },
    })
  }

  return true
}
