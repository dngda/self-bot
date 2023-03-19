import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { Sticker, createSticker, StickerTypes } from 'wa-sticker-formatter'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import { MessageData, sendSticker, sendText } from '../utils'
import stringId from '../src/language'
import lodash from 'lodash'
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
  if (!isMedia) throw `‼️Error! ${stringId.sticker.usage(data)}`
  let mediaData = isQuoted ? await data.downloadQuoted() : await data.download()

  let Stype = args.includes('-r') ? StickerTypes.ROUNDED : StickerTypes.FULL
  Stype = args.includes('-c') ? StickerTypes.CROPPED : Stype
  if (args.includes('-nobg')) {
    const base64 = mediaData.toString('base64')
    const res = await removeBackgroundFromImageBase64({
      base64img: base64,
      apiKey: lodash.sample(process.env.REMOVEBG_APIKEY!.split(', ')) as string,
      size: 'auto',
    })
    mediaData = Buffer.from(res.base64img, 'base64')
  }
  const argsMeta = args.replace(/-r|-c|-nobg/g, '').trim()
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

    let defaultQuality = 80
    const doConvert = (quality: number = defaultQuality) => {
      return new Sticker(mediaData, {
        pack: packname,
        author: author,
        type: Stype,
        quality: quality,
      }).toBuffer()
    }
    let resultBuffer = await doConvert()
    while (resultBuffer.length > 1024 * 1024) {
      sendText(waSocket, from, stringId.sticker.error.quality(defaultQuality))
      defaultQuality -= 10
      resultBuffer = await doConvert(defaultQuality)
    }

    await sendSticker(waSocket, from, resultBuffer, msg)
  }
}
