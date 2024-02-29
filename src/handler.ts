import {
  WASocket,
  WAMessage,
  MessageUpsertType,
  proto,
} from '@whiskeysockets/baileys'
import {
  logCmd,
  getPrefix,
  MessageContext,
  serializeMessage,
  handleNoteCommand,
  handleRepeatCommand,
  handleMathEquation,
  handleStickerCommand,
  listenDeletedMessage,
  listenOneViewMessage,
  handleReplyToStatusList,
} from './utils'
import { storeMessage, storeStatus } from './lib'
import { getCommand } from './menu'
import initCmds from './cmd'
import chalk from 'chalk'
import util from 'util'
import fs from 'fs'

export interface BotConfig {
  [index: string]: any
  allowedChats: string[]
  stickerCommands: { [index: string]: { cmd: string; arg: string } }
  norevoke: boolean
  oneview: boolean
  public: boolean
}

export let config: BotConfig = {
  allowedChats: [],
  stickerCommands: {},
  norevoke: false,
  oneview: false,
  public: false,
}

if (fs.existsSync('./data/config.json')) {
  const conf = fs.readFileSync('./data/config.json', 'utf-8')
  if (conf != '') config = JSON.parse(conf)
  if (!config.allowedChats) config.allowedChats = []
  if (!config.stickerCommands) config.stickerCommands = {}
  if (!config.norevoke) config.norevoke = false
  if (!config.oneview) config.oneview = false
  if (!config.public) config.public = false
}

export const updateConfig = () => {
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
      'RAW Message Received',
      util.inspect(msg, false, null, true)
    )
    const ctx = await serializeMessage(waSocket, msg)
    try {
      if (msg.key.fromMe || isAllowedChat(ctx) || config.public) {
        noPrefixHandler(waSocket, msg, ctx)

        const cmd = getCommand(ctx.cmd) as string
        if (ctx.isCmd && cmd in actions) {
          console.log(
            chalk.green('[CTX]'),
            'Serialized CMD Message Context:',
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
    storeStatusData(msg)
    if (config.norevoke) listenDeletedMessage(waSocket, msg)
    if (config.oneview) listenOneViewMessage(waSocket, msg)
  }
}

const isAllowedChat = (ctx: MessageContext) =>
  config?.allowedChats.includes(ctx.from)
const isStatusMessage = (msg: WAMessage) =>
  msg.message?.senderKeyDistributionMessage?.groupId == 'status@broadcast' ||
  msg.key.remoteJid == 'status@broadcast'
const isHistorySync = (msg: WAMessage) =>
  msg.message?.protocolMessage?.type ==
  proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION

// --------------------------------------------------------- //
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
  } else if (/^\d\d?$/.test(body as string)) {
    await handleReplyToStatusList(_wa, _msg, ctx)
  } else {
    await handleMathEquation(ctx)
    await handleStickerCommand(_wa, _msg, ctx)
  }
}

const storeMessageData = (msg: WAMessage) => {
  const key = msg.key
  if (!key) return null
  if (msg.message?.protocolMessage) return null

  storeMessage(key.id!, msg.messageTimestamp! as number, msg.message!)
  return true
}

const storeStatusData = (msg: WAMessage) => {
  const key = msg.key
  if (!key) return null
  if (msg.message?.protocolMessage) return null
  if (key.remoteJid != 'status@broadcast') return null

  storeStatus(
    key,
    key.remoteJid!,
    msg.messageTimestamp! as number,
    msg.message!
  )
  return true
}
