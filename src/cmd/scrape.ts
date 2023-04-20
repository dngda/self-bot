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
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { arg, args } = data
  if (arg == '') throw new Error(stringId.pinterest.usage(data))
  data.reactWait()
  const result = await pinterest(arg)

  const qty = Number(args[0])
  if (qty <= 10) {
    const images = sampleSize(result, qty)
    for (const image of images) {
      await data.replyContent({
        image: { url: image },
        caption: `Origin: ${image}`,
      })
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
  return await data.replyContent({
    image: { url: image },
    caption: `Origin: ${image}`,
  })
}

const tiktokPattern =
  /(?:https?):\/\/(?:www\.)?tiktok\.com\/@(\w+)((\.)?(\w+)?)+\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reel\/(\w+)/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/(\w+)\/(\d+)/
const youtubePattern = /(?:https?):\/\/www\.youtube\.com\/watch\?v=(\w+)/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern = /(?:https?):\/\/www\.youtube\.com\/shorts\/(\w+)/

export const videoHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { arg, isQuoted, quotedMsg } = data
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
      return data.reactSuccess()
      break
    default:
      data.reply(stringId.videodl.error.invalidUrl)
      return data.reactError()
      break
  }

  async function tiktokReels() {
    const result = await videoDownloader(url)
    await data.replyContent({ video: { url: result.url[0].url } })
  }

  async function twitter() {
    const result = await videoDownloader(url)
    let selectedUrl = result.url[0].url
    let captions = ''
    for (const video of result.url) {
      if (video?.url == selectedUrl) continue
      captions += `📩 ${video?.quality}p: ${await tinyUrl(video.url)}\n`
    }

    await data.replyContent({
      video: { url: selectedUrl },
      caption: captions,
    })
  }

  async function youtube() {
    const result = await videoDownloader(url)
    let selectedUrl: string | URL
    let selectedQuality: string
    let captions = ''

    if (result.url[0].quality == '720') {
      selectedUrl = result.url[1].url
      selectedQuality = result.url[1].quality
      captions += `Sent ${result.url[1].quality}p\nOther format:\n`
    } else {
      selectedUrl = result.url[0].url
      selectedQuality = result.url[0].quality
      captions += `Sent ${result.url[0].quality}p\nOther format:\n`
    }

    for (const video of result.url) {
      if (video?.no_audio) continue
      if (video?.audio) continue
      if (video?.quality == selectedQuality) continue
      if (!video?.attr?.title) {
        captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
        continue
      }
      captions += `📩 ${video.attr.title}:\n- ${await tinyUrl(video.url)}\n`
    }
    captions += `\n🔉 Get mp3 by replying this message with ${data.prefix}mp3`


    await data.replyContent({
      video: { url: selectedUrl },
      caption: captions.trim(),
    })
  }
}
