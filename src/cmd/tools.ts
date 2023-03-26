import { WAMessage, WASocket } from '@adiwajshing/baileys'
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

  menu.push({
    command: 'flip',
    hint: stringId.flip.hint,
    alias: 'flop',
    type: 'tools',
  })
}

export const flipHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedImage, isImage, cmd, download, downloadQuoted } = data
  if (!isImage && !isQuotedImage) throw new Error(stringId.flip.error.noImage)
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
}

export const mathHandler = async (data: MessageData) => {
  const { body } = data
  if (!body?.startsWith('=')) return null
  const args = body.slice(1)
  if (!args || args == '') return null
  console.log(chalk.blue('[MATH]'), 'Doing =', args)
  return await data.reply(
    `${math.evaluate(
      args
        .replace(/x/gi, '*')
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/%/g, '/100')
    )}`
  )
}
