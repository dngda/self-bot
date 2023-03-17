import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter'
import { MessageData, sendSticker } from '../utils'
import stringId from '../src/lang'
import fs from 'fs'

export const stickerHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
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
  if (!isMedia) throw `Error! ${stringId.sticker.usage(data)}`
  const mediaData = isQuoted
    ? await data.downloadQuoted()
    : await data.download()

  let Stype = args.includes('-r') ? StickerTypes.ROUNDED : StickerTypes.FULL
  Stype = args.includes('-c') ? StickerTypes.CROPPED : Stype
  const argsMeta = args.replace(/-r|-c/g, '').trim()
  const packname = argsMeta.split('|')[0] || process.env.PACKNAME!
  const author = argsMeta.split('|')[1] || process.env.AUTHOR!
  if (isImage || isQuotedImage) {
    const sticker = new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: Stype,
      quality: 100,
    })
    await sendSticker(waSocket, from, await sticker.toBuffer(), msg)
  }
  if (isVideo || isQuotedVideo) {
    if (
      msg.message?.videoMessage?.seconds! > 5 ||
      quotedMsg?.videoMessage?.seconds! > 5
    )
      throw stringId.sticker.error.videoLimit
    Stype = args.includes('-r') ? StickerTypes.ROUNDED : StickerTypes.CROPPED
    const sticker = new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: Stype,
      quality: 70,
    })
    await sendSticker(waSocket, from, await sticker.toBuffer(), msg)
  }
}
