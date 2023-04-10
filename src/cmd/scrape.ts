import { pinterest, tinyUrl, videoDownloader } from '../lib'
import { sample, sampleSize } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@adiwajshing/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    pinterest: pinterestHandler,
    video: videoHandler,
  })

  stringId.pinterest = {
    hint: '🔍 Search gambar di pinterest',
    usage: (data: MessageData) =>
      `🔍 Search gambar di pinterest dengan cara ➡️ ${data.prefix}${data.cmd} <query>`,
  }

  stringId.videodl = {
    hint: '📩 Download video tiktok/reels/twitter/youtube',
    error: {
      invalidUrl: '‼️ URL tidak valid!',
    },
    usage: (data: MessageData) =>
      `📩 Download video tiktok/reels/twitter dengan cara ➡️ ${data.prefix}${data.cmd} <url>`,
  }

  menu.push(
    {
      command: 'pinterest',
      hint: stringId.pinterest.hint,
      alias: 'pin',
      type: 'scraper',
    },
    {
      command: 'video',
      hint: stringId.videodl.hint,
      alias: 'ttdl, vdl, rdl',
      type: 'scraper',
    }
  )
}

const pinterestHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { from, arg, args } = data
  if (arg == '') throw new Error(stringId.pinterest.usage(data))
  data.reactWait()
  const result = await pinterest(arg)

  const qty = Number(args[0])
  if (qty <= 10) {
    const images = sampleSize(result, qty)
    for (const image of images) {
      await waSocket.sendMessage(
        from,
        { image: { url: image }, caption: `HD: ${image}` },
        { quoted: msg, ephemeralExpiration: data.expiration! }
      )
    }
    data.reactSuccess()
    return null
  } else {
    if (qty > 10) {
      data.reactError()
      return data.reply(`Max 10, bro.`)
    }
  }

  const image = sample(result) as string
  data.reactSuccess()
  return await waSocket.sendMessage(
    from,
    { image: { url: image }, caption: `HD: ${image}` },
    { quoted: msg, ephemeralExpiration: data.expiration! }
  )
}

const tiktokPattern =
  /(?:https?):\/\/(?:www\.)?tiktok\.com\/@(\w+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reel\/(\w+)/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/(\w+)\/(\d+)/
const youtubePattern = /(?:https?):\/\/www\.youtube\.com\/watch\?v=(\w+)/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern = /(?:https?):\/\/www\.youtube\.com\/shorts\/(\w+)/

export const videoHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { from, arg, isQuoted, quotedMsg } = data
  const url = isQuoted ? (quotedMsg?.extendedTextMessage?.text as string) : arg
  if (arg == '' && !isQuoted) throw new Error(stringId.videodl.usage(data))

  data.reactWait()
  switch (true) {
    case tiktokPattern.test(url):
    case tiktokShortPattern.test(url):
    case reelsPattern.test(url):
    case instagramPattern.test(url):
      await tiktokReels()
      return data.reactSuccess()
      break
    case twitterPattern.test(url):
      await twitter()
      return data.reactSuccess()
      break
    case youtubePattern.test(url):
    case youtubeShortPattern.test(url):
    case youtubeShortsPattern.test(url):
      await youtube()
      return data.reactError()
      break
    default:
      data.reply(stringId.videodl.error.invalidUrl)
      return data.reactError()
      break
  }

  async function tiktokReels() {
    const result = await videoDownloader(url)
    await waSocket.sendMessage(
      from,
      { video: { url: result.url[0].url }, caption: `Niki, nggih.` },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )
  }

  async function twitter() {
    const result = await videoDownloader(url)
    let captions = ''
    for (const video of result.url) {
      captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
    }

    await waSocket.sendMessage(
      from,
      { video: { url: result.url[0].url }, caption: captions },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )
  }

  async function youtube() {
    const result = await videoDownloader(url)
    let captions = ''
    for (const video of result.url) {
      captions += `📩 ${video.attr.title}:\n- ${await tinyUrl(video.url)}\n`
    }

    await waSocket.sendMessage(
      from,
      { video: { url: result.url[0].url }, caption: captions },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )
  }
}
