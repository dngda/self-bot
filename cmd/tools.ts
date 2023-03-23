import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../src/language'
import * as math from 'mathjs'
import sharp from 'sharp'
import chalk from 'chalk'

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
  const args = body?.replace('=', '')
  console.log(chalk.blue('[MATH]'), 'Doing =', args)
  if (!args || args == '') throw new Error(stringId.math.error.noArgs)
  const result = math.evaluate(args)
  return await data.reply(`${result}`)
}
