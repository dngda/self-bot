import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import { MessageData } from '../utils'
import { actions } from '../handler'
import stringId from '../language'
import lodash from 'lodash'
import { menu } from '../menu'
import { textToPicture } from '../lib'

export default function () {
  Object.assign(actions, {
    sticker: stickerHandler,
    ttp: ttpHandler,
  })

  stringId.sticker = {
    hint: '🖼️ _Convert media ke sticker_',
    error: {
      videoLimit: (s: number) =>
        `‼️ Video terlalu panjang, maksimal ${s} detik`,
      quality: (q: number) =>
        `⚠️ Result exceeded 1 MB with Q: ${q}%\n⏳ Hold on, decreasing quality...`,
    },
    usage: (data: MessageData) =>
      `Kirim gambar/video atau balas gambar/video dengan caption ${data.prefix}${data.cmd}
⚙️ Gunakan: '-r' rounded corner, '-c' square cropped, '-nobg' hapus bg,
⚙️ Custom packname/author dengan args 'packname|author',
➡️ Contoh: ${data.prefix}${data.cmd} -r -nobg created with|serobot✨`,
  }

  stringId.ttp = {
    hint: '🖼️ _Convert teks ke sticker_',
    error: {
      textLimit: (s: number) =>
        `‼️ Teks terlalu panjang, maksimal ${s} karakter`,
    },
    usage: (data: MessageData) =>
      `Tambahkan teks atau balas teks dengan ${data.prefix}${data.cmd} <teks>`,
  }

  menu.push(
    {
      command: 'sticker',
      hint: stringId.sticker.hint,
      alias: 'stiker, s',
      type: 'sticker',
    },
    {
      command: 'ttp',
      hint: stringId.ttp.hint,
      alias: 'ttpc',
      type: 'sticker',
    }
  )
}

const stickerHandler = async (
  _wa: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const {
    arg,
    isMedia,
    isImage,
    isVideo,
    isQuoted,
    isQuotedImage,
    isQuotedVideo,
    replySticker,
  } = data
  if (!isMedia) throw new Error(stringId.sticker.usage(data))
  data.reactWait()
  let mediaData = isQuoted ? await data.downloadQuoted() : await data.download()
  let Stype = arg.includes('-r') ? StickerTypes.ROUNDED : StickerTypes.FULL
  Stype = arg.includes('-c') ? StickerTypes.CROPPED : Stype
  if (arg.includes('-nobg')) {
    const base64 = mediaData.toString('base64')
    const res = await removeBackgroundFromImageBase64({
      base64img: base64,
      apiKey: lodash.sample(process.env.REMOVEBG_APIKEY!.split(', ')) as string,
      size: 'auto',
    })
    mediaData = Buffer.from(res.base64img, 'base64')
  }
  const argMeta = arg.replace(/-r|-c|-nobg/g, '').trim()
  const packname = argMeta.split('|')[0] || process.env.PACKNAME!
  const author = argMeta.split('|')[1] || process.env.AUTHOR!

  if (isImage || isQuotedImage) {
    const sticker = new Sticker(mediaData, {
      pack: packname,
      author: author,
      type: Stype,
      quality: 100,
    })
    data.reactSuccess()
    await replySticker(await sticker.toBuffer())
  }

  if (isVideo || isQuotedVideo) {
    await processVideo(msg, mediaData, data, packname, author, Stype)
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
  const videoLimit = 10
  if (seconds >= videoLimit)
    throw new Error(stringId.sticker.error.videoLimit(videoLimit))

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
    data.send(stringId.sticker.error.quality(defaultQuality))
    defaultQuality -= 10
    resultBuffer = await doConvert(defaultQuality)
  }
  data.reactSuccess()
  await data.replySticker(resultBuffer)
}

const ttpHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { arg, args, cmd, isQuoted, isMedia, replySticker } = data
  if ((!arg && !isQuoted) || isMedia) throw new Error(stringId.ttp.usage(data))
  data.reactWait()
  const text =
    arg ||
    data.quotedMsg?.conversation! ||
    data.quotedMsg?.extendedTextMessage?.text!
  const textLimit = 100
  if (text.length > textLimit)
    throw new Error(stringId.ttp.error.textLimit(textLimit))

  let image: Buffer
  if (cmd === 'ttpc') {
    const col = args[0].split('|')[0]
    const col2 = args[0].split('|')[1] || col
    image = await textToPicture(text.replace(args[0], ''), col, col2)
  } else {
    image = await textToPicture(text)
  }
  const sticker = await new Sticker(image, {
    pack: process.env.PACKNAME!,
    author: process.env.AUTHOR!,
    type: StickerTypes.FULL,
    quality: 100,
  }).toFile('tmp/sticker-ttp.webp')
  data.reactSuccess()
  await replySticker({ url: sticker })
}
