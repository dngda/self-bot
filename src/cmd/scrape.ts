import { pinterest, tinyUrl } from '../lib'
import { sample, sampleSize } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@adiwajshing/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import { browser } from '../..'

export default function () {
  Object.assign(actions, {
    pinterest: pinterestHandler,
    video: videoHandler,
  })

  stringId.pinterest = {
    hint: '🔍 _Search gambar di pinterest_',
    usage: (data: MessageData) =>
      `🔍 Search gambar di pinterest dengan cara ➡️ ${data.prefix}${data.cmd} <query>`,
  }

  stringId.videodl = {
    hint: '📩 _Download video tiktok/reel/twitter/yt_',
    error: {
      invalidUrl: '‼️ URL tidak valid!',
      internalError: '‼️ Terjadi kesalahan! Coba refresh browser.',
    },
    usage: (data: MessageData) =>
      `📩 Download video tiktok/reel/twitter/yt dengan cara ➡️ ${data.prefix}${data.cmd} <url>`,
    getAudio: (data: MessageData) =>
      `🎶 Convert to Audio by reply this with *${data.prefix}mp3*`,
    sent: (q: string) => `✅ Sent ${q}p\n\nother format:\n`,
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
      alias: 'vdl',
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
  /(?:https?):\/\/(?:www\.)?tiktok\.com\/@(\w+)(\.)?(\w+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reels?\/[\w-]+/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/[\w-]+/
const youtubePattern = /(?:https?):\/\/www\.youtube\.com\/watch\?v=(\w+)/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern = /(?:https?):\/\/www\.youtube\.com\/shorts\/(\w+)/

const getDuration = (result: any) => {
  let duration: number
  if (result.meta.hasOwnProperty('duration')) {
    const minutes = +result.meta.duration.split(':')[0]
    const seconds = +result.meta.duration.split(':')[1]
    duration = minutes * 60 + seconds
  } else duration = 0
  return duration
}

export const videoHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { arg, isQuoted, quotedMsg } = data
  const quotedMsgText =
    quotedMsg?.extendedTextMessage?.text || quotedMsg?.conversation || ''
  const url = isQuoted ? quotedMsgText : arg
  if (arg == '' && !isQuoted) throw new Error(stringId.videodl.usage(data))

  data.reactWait()
  switch (true) {
    case tiktokPattern.test(url):
    case tiktokShortPattern.test(url):
    case reelsPattern.test(url):
    case instagramPattern.test(url):
      await tiktokReels()
      return data.reactSuccess()
    case twitterPattern.test(url):
      await twitter()
      return data.reactSuccess()
    case youtubePattern.test(url):
    case youtubeShortPattern.test(url):
    case youtubeShortsPattern.test(url):
      await youtube()
      return data.reactSuccess()
    default:
      data.reply(stringId.videodl.error.invalidUrl)
      return data.reactError()
  }

  async function tiktokReels() {
    let urls: string[] =
      tiktokPattern.exec(url) ??
      tiktokShortPattern.exec(url) ??
      reelsPattern.exec(url) ??
      instagramPattern.exec(url) ??
      []

    const result = await browser.scrapeSSyoutube(urls[0])
    const duration = getDuration(result)

    await data.replyContent({
      video: { url: result.url[0].url },
      seconds: duration,
      caption: stringId.videodl.getAudio(data),
    })
  }

  async function twitter() {
    let urls: string[] = twitterPattern.exec(url) ?? []
    const result = await browser.scrapeSSyoutube(urls[0])
    let resultUrls = result.url.sort((a: any, b: any) => {
      return Number(a.quality) - Number(b.quality)
    })
    let selectedUrl = resultUrls[0].url
    let captions = ''
    for (const video of resultUrls) {
      if (video?.url == selectedUrl) {
        captions += stringId.videodl.sent(video?.quality)
        continue
      }
      captions += `📩 ${video?.quality}p: ${await tinyUrl(video.url)}\n`
    }
    captions += stringId.videodl.getAudio(data)

    await data.replyContent({
      video: { url: selectedUrl },
      caption: captions,
    })
  }

  async function youtube() {
    let urls: string[] =
      youtubePattern.exec(url) ??
      youtubeShortPattern.exec(url) ??
      youtubeShortsPattern.exec(url) ??
      []
    const result = await browser.scrapeSSyoutube(urls[0])
    const duration = getDuration(result)
    let selectedUrl: string | URL
    let selectedQuality: string
    let captions: string = ''

    try {
      if (result.url[0].quality == '720') {
        selectedUrl = result.url[1].url
        selectedQuality = result.url[1].quality
      } else {
        selectedUrl = result.url[0].url
        selectedQuality = result.url[0].quality
      }
    } catch (error: any) {
      await data.reactError()
      return data.reply(stringId.videodl.error.internalError)
    }
    captions += stringId.videodl.sent(selectedQuality)

    for (const video of result.url) {
      if (video?.no_audio) continue
      if (video?.audio) continue
      if (video?.quality == selectedQuality) continue
      if (!video?.attr?.title) {
        captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
        continue
      }
      captions += `📩 ${video.quality}p: ${await tinyUrl(video.url)}\n`
    }
    captions += stringId.videodl.getAudio(data)

    await data.replyContent({
      video: { url: selectedUrl },
      seconds: duration,
      caption: captions.trim(),
    })
  }
}
