import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import stringId from '../src/language'
import sharp from 'sharp'

export const flipHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const {
    isQuotedImage,
    isImage,
    cmd,
    download,
    downloadQuoted,
  } = data
  if (!isImage && !isQuotedImage) throw stringId.flip.error.noImage
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
