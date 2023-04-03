import { WAMessage, WASocket, downloadMediaMessage } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import * as math from 'mathjs'
import sharp from 'sharp'
import chalk from 'chalk'

export default function () {
  Object.assign(actions, {
    flip: flipHandler,
    onev: oneViewHandler,
  })

  stringId.flip = {
    hint: '🖼️ flip = vertikal, flop = horizontal',
    error: {
      noImage: '‼️ Gambar tidak ditemukan!',
    },
  }

  stringId.math = {
    hint: '🧮 Hitung rumus matematika',
    error: {
      noArgs: '‼️ Tidak ada argumen yang diberikan!',
    },
  }

  stringId.onev = {
    hint: '👁️‍🗨️ get pesan view once',
    error: {
      noOneView: '‼️ Pesan view once tidak ditemukan!',
    },
  }

  menu.push(
    {
      command: 'flip',
      hint: stringId.flip.hint,
      alias: 'flop',
      type: 'tools',
    },
    {
      command: 'onev',
      hint: stringId.onev.hint,
      alias: '1v',
      type: 'tools',
    }
  )
}

export const flipHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedImage, isImage, cmd, download, downloadQuoted } = data
  if (!isImage && !isQuotedImage) throw new Error(stringId.flip.error.noImage)
  data.reactWait()
  const mediaData = isQuotedImage ? await downloadQuoted() : await download()
  const image = await sharp(mediaData)
  if (cmd === 'flip')
    await waSocket.sendMessage(
      data.from,
      { image: await image.flip().toBuffer() },
      { quoted: msg }
    )
  if (cmd === 'flop')
    await waSocket.sendMessage(
      data.from,
      { image: await image.flop().toBuffer() },
      { quoted: msg }
    )
  data.reactSuccess()
}

export const mathHandler = async (data: MessageData) => {
  const { body } = data
  if (!body?.startsWith('=')) return null
  const args = body.slice(1)
  if (!args || args == '') return null
  if (/[\(\)$&_`~'":\\,|;\]\[?><!%]/g.test(args)) return null
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

export const oneViewHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const viewOnce =
    data.quotedMsg?.viewOnceMessageV2 ||
    data.quotedMsg?.viewOnceMessage ||
    data.quotedMsg?.viewOnceMessageV2Extension
  const isQuotedOneView = viewOnce != null
  if (!isQuotedOneView) return stringId.onev.error.noOneView
  data.reactWait()
  const { message } = viewOnce!
  const { imageMessage, videoMessage } = message!
  if (imageMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message! },
      'buffer',
      {}
    )
    await waSocket.sendMessage(
      data.from,
      { image: mediaData as Buffer },
      { quoted: msg }
    )
  }
  if (videoMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message! },
      'buffer',
      {}
    )
    await waSocket.sendMessage(
      data.from,
      { video: mediaData as Buffer },
      { quoted: msg }
    )
  }
  data.reactSuccess()
}
