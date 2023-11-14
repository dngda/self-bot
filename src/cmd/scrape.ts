import { pinterest, tinyUrl } from '../lib'
import { sample, sampleSize } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@whiskeysockets/baileys'
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
      maxDuration: '‼️ Durasi video melebihi 10 menit!',
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
  if (result.length == 0) {
    data.reactError()
    return data.reply(`Tidak ada hasil.`)
  }

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
  /(?:https?):\/\/(?:www\.)?tiktok\.com\/@([^\W]+)(\.)?([^\W]+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/
const twitterPattern = /(?:https?):\/\/twitter\.com\/(\w+)\/status\/(\d+)/
const xPattern = /(?:https?):\/\/x\.com\/(\w+)\/status\/(\d+)/
const reelsPattern = /(?:https?):\/\/www\.instagram\.com\/reels?\/[\w-]+/
const instagramPattern = /(?:https?):\/\/www\.instagram\.com\/p\/[\w-]+/
const youtubePattern = /(?:https?):\/\/www\.youtube\.com\/watch\?v=(\w+)/
const youtubeShortPattern = /(?:https?):\/\/youtu\.be\/(\w+)/
const youtubeShortsPattern = /(?:https?):\/\/www\.youtube\.com\/shorts\/(\w+)/

const getDuration = (result: any) => {
  let duration: number
  if (result.meta?.hasOwnProperty('duration')) {
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

  if (
    tiktokPattern.test(url) ||
    tiktokShortPattern.test(url) ||
    reelsPattern.test(url) ||
    instagramPattern.test(url)
  ) {
    await tiktokReels(url, data)
  } else if (
    twitterPattern.test(url) || 
    xPattern.test(url)
    ) {
    await twitter(url, data)
  } else if (
    youtubePattern.test(url) ||
    youtubeShortPattern.test(url) ||
    youtubeShortsPattern.test(url)
  ) {
    await youtube(url, data)
  } else {
    data.reply(stringId.videodl.error.invalidUrl)
    return data.reactError()
  }
}

async function tiktokReels(url: string, data: MessageData) {
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

  data.reactSuccess()
}

async function twitter(url: string, data: MessageData) {
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

  data.reactSuccess()
}

async function youtube(url: string, data: MessageData) {
  let urls: string[] =
    youtubePattern.exec(url) ??
    youtubeShortPattern.exec(url) ??
    youtubeShortsPattern.exec(url) ??
    []
  const result = await browser.scrapeSSyoutube(urls[0])
  const duration = getDuration(result)

  if (duration / 60 > 10) throw new Error(stringId.videodl.error.maxDuration)

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

  data.reactSuccess()
}
