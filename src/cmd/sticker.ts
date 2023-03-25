import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import { MessageData } from '../utils'
import stringId from '../language'
import lodash from 'lodash'

export const stickerHandler = async (
  _wa: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const {
    args,
    isMedia,
    isImage,
    isVideo,
    isQuoted,
    isQuotedImage,
    isQuotedVideo,
    replySticker,
  } = data
  if (!isMedia) throw new Error(stringId.sticker.usage(data))
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
    await replySticker(await sticker.toBuffer())
  }

  if (isVideo || isQuotedVideo) {
    processVideo(msg, mediaData, data, packname, author, Stype)
  }
}

const processVideo = async (
  msg: WAMessage,
  mediaData: Buffer,
  data: MessageData,
  packname: string,
  author: string,
  Stype: StickerTypes
) => {
  const seconds =
    msg.message?.videoMessage?.seconds! ||
    data.quotedMsg?.videoMessage?.seconds!
  const videoLimit = 5
  if (seconds > videoLimit)
    throw new Error(stringId.sticker.error.videoLimit(videoLimit))

  let stickerType = Stype
  stickerType = data.args.includes('-r')
    ? StickerTypes.ROUNDED
    : StickerTypes.CROPPED
  let defaultQuality = 80
  const doConvert = (quality: number = defaultQuality) => {
    return new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: stickerType,
      quality: quality,
    }).toBuffer()
  }
  let resultBuffer = await doConvert()
  while (resultBuffer.length > 1024 * 1024) {
    data.send(stringId.sticker.error.quality(defaultQuality))
    defaultQuality -= 10
    resultBuffer = await doConvert(defaultQuality)
  }

  await data.replySticker(resultBuffer)
}
