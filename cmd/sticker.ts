import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { convertMp4ToWebp } from '../utils/converter'
import { sendSticker } from '../utils'
import sharp from 'sharp'
import fs from 'fs'

export const stickerHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  const {
    cmd,
    from,
    isMedia,
    isImage,
    isVideo,
    isQuoted,
    isQuotedImage,
    isQuotedVideo,
    quotedMsg,
  } = data
  if (!isMedia)
    throw `Error! Kirim gambar/video atau balas gambar/video dengan caption !${cmd}`
  const mediaData = isQuoted
    ? await data.downloadQuoted()
    : await data.download()
  if (isImage || isQuotedImage) {
    const buffer = await sharp(mediaData)
      .flatten()
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp()
      .toBuffer()
    await sendSticker(waSocket, from, buffer, msg)
  }
  if (isVideo || isQuotedVideo) {
    if (
      msg.message?.videoMessage?.seconds! > 5 ||
      quotedMsg?.videoMessage?.seconds! > 5
    )
      throw 'Video terlalu panjang! max 5 detik'
    const inputFilename = `./tmp/${Math.floor(Math.random() * 10000)}.mp4`
    const outputFilename = `./tmp/${Math.floor(Math.random() * 10000)}.webp`
    fs.writeFileSync(inputFilename, mediaData)
    await convertMp4ToWebp(inputFilename, outputFilename)
    await sendSticker(waSocket, from, { url: outputFilename }, msg)
    fs.unlink(inputFilename, () => {})
    fs.unlink(outputFilename, () => {})
  }
}
