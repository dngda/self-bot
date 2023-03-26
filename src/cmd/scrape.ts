import { pinterest, tiktokScraper } from '../scrape'
import { sample, sampleSize } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@adiwajshing/baileys'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    pinterest: pinterestHandler,
    tiktok: tiktokHandler,
  })

  stringId.pinterest = {
    hint: '🔍 Search gambar di pinterest',
    usage: (data: MessageData) =>
      `🔍 Search gambar di pinterest dengan cara ➡️ ${data.prefix}${data.cmd} <query>`,
  }

  stringId.tiktokdl = {
    hint: '📩 Download video tiktok',
    error: {
      invalidUrl: '‼️ URL tiktok tidak valid!',
    },
    usage: (data: MessageData) =>
      `📩 Download video tiktok dengan cara ➡️ ${data.prefix}${data.cmd} <url>`,
  }

  menu.push(
    {
      command: 'pinterest',
      hint: stringId.pinterest.hint,
      alias: 'pin',
      type: 'scraper',
    },
    {
      command: 'tiktok',
      hint: stringId.tiktokdl.hint,
      alias: 'ttdl, tiktokdl',
      type: 'scraper',
    }
  )
}

// const urlPattern =
//   /(?:https?):\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/

export const pinterestHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { from, args } = data
  if (!args || args == '') throw new Error(stringId.pinterest.usage(data))
  const result = await pinterest(args)

  const qty = Number(args.split(' ')[0])
  if (qty <= 10) {
    const images = sampleSize(result, qty)
    for (const image of images) {
      await waSocket.sendMessage(
        from,
        { image: { url: image }, caption: `HD: ${image}` },
        { quoted: msg }
      )
    }
    return null
  } else {
    if (qty > 10) {
      return data.reply(`Max 10, bro.`)
    }
  }

  const image = sample(result) as string
  return await waSocket.sendMessage(
    from,
    { image: { url: image }, caption: `HD: ${image}` },
    { quoted: msg }
  )
}

const tiktokPattern =
  /(?:https?):\/\/(?:www\.)?tiktok\.com\/@(\w+)\/video\/(\d+)/
const tiktokShortPattern = /(?:https?):\/\/vt\.tiktok\.com\/(\w+)(\/?)/

export const tiktokHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { from, args, isQuoted, quotedMsg } = data
  const url = isQuoted ? (quotedMsg?.extendedTextMessage?.text as string) : args
  if ((!args || args == '') && !isQuoted)
    throw new Error(stringId.tiktokdl.usage(data))
  if (!url.match(tiktokPattern) && !url.match(tiktokShortPattern))
    throw new Error(stringId.tiktokdl.error.invalidUrl)
  const result = await tiktokScraper(url)
  await waSocket.sendMessage(
    from,
    { video: { url: result.url[0].url }, caption: `Niki, nggih.` },
    { quoted: msg }
  )
}
