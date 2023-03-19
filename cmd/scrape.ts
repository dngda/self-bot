import scrape from '../src/scrape'
import { sample } from 'lodash'
import { MessageData } from '../utils'
import { WASocket, WAMessage } from '@adiwajshing/baileys'
import stringId from '../src/language'

export const pinterestHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { from, args } = data
  if (!args || args == '') throw stringId.pinterest.usage(data)
  const result = await scrape.pinterest(args)
  const image = sample(result) as string
  await waSocket.sendMessage(
    from,
    { image: { url: image }, caption: `HD: ${image}` },
    { quoted: msg }
  )
}
