import {
  WASocket,
  WAMessage,
  MessageUpsertType,
  proto,
} from '@whiskeysockets/baileys'
import { serializeMessage, MessageData, logCmd, getPrefix } from './utils'
import { getMessage, storeMessage } from './lib/store'
import initGeneralCmd from './cmd/general'
import initBrowserCmd from './cmd/browser'
import initStickerCmd from './cmd/sticker'
import initScrapeCmd from './cmd/scrape'
import initConfigCmd from './cmd/config'
import initRandomCmd from './cmd/random'
import initIslamCmd from './cmd/islam'
import initToolsCmd from './cmd/tools'
import initOwnerCmd from './cmd/owner'
import { getNoteContent } from './lib'
import { getCommand } from './menu'
import * as math from 'mathjs'
import chalk from 'chalk'
import util from 'util'
import fs from 'fs'

interface BotConfig {
  publicModeChats: string[]
  stickerCommands: { [index: string]: { cmd: string; arg: string } }
}

export let config: BotConfig = {
  publicModeChats: [],
  stickerCommands: {},
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

initGeneralCmd()
initStickerCmd()
initScrapeCmd()
initBrowserCmd()
initToolsCmd()
initIslamCmd()
initRandomCmd()

initConfigCmd()
initOwnerCmd()

export const messageHandler = async (
  waSocket: WASocket,
  event: {
    messages: WAMessage[]
    type: MessageUpsertType
  }
) => {
  const { type, messages } = event
  if (type === 'append') return null
  console.log(
    chalk.green('[LOG]'),
    'Message received',
    util.inspect(messages, false, null, true)
  )

  for (const msg of messages) {
    if (isStatusMessage(msg)) return null
    if (isHistorySync(msg))
      return console.log(chalk.green('[LOG]'), 'Syncing chats history...')
    const data = await serializeMessage(waSocket, msg)
    try {
      if (msg.key.fromMe || isAllowedChat(data)) {
        noPrefixHandler(waSocket, msg, data)

        const cmd = getCommand(data.cmd) as string
        if (data.isCmd && cmd in actions) {
          console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', data)
          logCmd(msg, data)
          await actions[cmd](waSocket, msg, data)
        }
      }
    } catch (error: any) {
      console.log(error)
      data.reply(`${error}`)
      data.reactError()
    }

    storeMessageData(msg)
    listenDeletedMessage(waSocket, msg)
  }
}

const isAllowedChat = (data: MessageData) =>
  config?.publicModeChats.includes(data.from)
const isStatusMessage = (msg: WAMessage) =>
  msg.message?.senderKeyDistributionMessage?.groupId == 'status@broadcast' ||
  msg.key.remoteJid == 'status@broadcast'
const isHistorySync = (msg: WAMessage) =>
  msg.message?.protocolMessage?.type == 5

// --------------------------------------------------------- //
const handleNoteCommand = async (data: MessageData) => {
  const { fromMe, participant, from, body, reply } = data
  const id = fromMe ? 'me' : participant ?? from
  const note = await getNoteContent(id, body as string)
  if (note) reply(note)
}

const handleRepeatCommand = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const quoted = data.quotedMsg
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
        console.log(chalk.green('[LOG]'), 'Serialized cmd msg:', data)
        logCmd(msg, quotedData)
        await actions[cmd](_wa, quoted, quotedData)
      }
    }
  }
}

const handleStickerCommand = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { stickerMessage } = _msg.message ?? {}
  const stickerSha = stickerMessage?.fileSha256
    ? Buffer.from(stickerMessage.fileSha256!).toString('base64')
    : ''

  try {
    if (stickerSha in config.stickerCommands) {
      data.cmd = config.stickerCommands[stickerSha].cmd
      data.arg = config.stickerCommands[stickerSha].arg
      data.args = data.arg.split(' ')
      const cmd = getCommand(data.cmd)
      await actions[cmd]?.(_wa, _msg, data)
    }
  } catch (error) {
    console.error(error)
  }
}

const mathHandler = async (data: MessageData) => {
  const { body } = data
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
  return await data.reply(`${result}`)
}

const noPrefixHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { body } = data

  if (/^#\w+$/.test(body as string)) {
    await handleNoteCommand(data)
  } else if (/^-r$/.test(body as string)) {
    await handleRepeatCommand(_wa, _msg, data)
  } else if (/^cekprefix$/.test(body as string)) {
    await data.reply(`Prefix: '${getPrefix()}'`)
  } else {
    await mathHandler(data)
    await handleStickerCommand(_wa, _msg, data)
  }
}

const storeMessageData = (msg: WAMessage) => {
  const key = msg.key
  if (!key) return null
  if (msg.message?.protocolMessage?.type == 0) return null

  storeMessage(key.id!, msg.messageTimestamp!, msg.message!)
  return true
}

const listenDeletedMessage = async (wa: WASocket, msg: WAMessage) => {
  if (msg.message?.protocolMessage?.type == 0) {
    const key = msg.message?.protocolMessage?.key
    if (!key) return null

    const _msg = getMessage(key.id!)
    if (!_msg) return null

    const from = msg.key.participant || msg.key.remoteJid!
    let sumber = `from @${from.replace('@s.whatsapp.net', '')}`
    if (msg.key.participant) {
      const subject = (await wa.groupMetadata(msg.key.remoteJid!)).subject
      sumber = `from _${subject}_ by @${msg.key.participant!.replace('@s.whatsapp.net', '')}`
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
