import { pinterest, tiktokScraper } from '../src/scrape'
import { sample, sampleSize } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@adiwajshing/baileys'
import stringId from '../src/language'

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

export const tiktokDLHandler = async (
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
