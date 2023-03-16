import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter'
import { sendSticker } from '../utils'
import langId from '../src/lang'
import fs from 'fs'

export const stickerHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  const {
    from,
    args,
    command,
    isMedia,
    isImage,
    isVideo,
    isQuoted,
    isQuotedImage,
    isQuotedVideo,
    quotedMsg,
  } = data
  if (!isMedia) throw `Error! ${langId.sticker.usage(data)}`
  const mediaData = isQuoted
    ? await data.downloadQuoted()
    : await data.download()

  const packname = args.split('|')[0] || process.env.PACKNAME!
  const author = args.split('|')[1] || process.env.AUTHOR!
  if (isImage || isQuotedImage) {
    const sticker = new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: StickerTypes.ROUNDED,
      quality: 80,
    })
    await sendSticker(waSocket, from, await sticker.toBuffer(), msg)
  }
  if (isVideo || isQuotedVideo) {
    if (
      msg.message?.videoMessage?.seconds! > 5 ||
      quotedMsg?.videoMessage?.seconds! > 5
    )
      throw langId.sticker.error.videoLimit
    const sticker = new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: StickerTypes.CROPPED,
      quality: 50,
    })
    await sendSticker(waSocket, from, await sticker.toBuffer(), msg)
  }
}
