import { WAMessage, WASocket, downloadMediaMessage } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import sharp from 'sharp'
import { browser } from '../..'

export default function () {
  Object.assign(actions, {
    flip: flipHandler,
    onev: oneViewHandler,
    crjogja: crjogjaHandler,
  })

  stringId.flip = {
    hint: '🖼️ flip = vertikal, flop = horizontal',
    error: {
      noImage: '‼️ Gambar tidak ditemukan!',
    },
  }

  stringId.onev = {
    hint: '👁️‍🗨️ get pesan view once',
    error: {
      noOneView: '‼️ Pesan view once tidak ditemukan!',
    },
  }

  stringId.crjogja = {
    hint: '🌐 Citra radar cuaca di Jogja',
    error: {
      timeOut: '‼️ Gagal mendapatkan citra radar!',
    },
  }

  menu.push(
    {
      command: 'flip',
      hint: stringId.flip.hint,
      alias: 'flop',
      type: 'tools',
    },
    {
      command: 'onev',
      hint: stringId.onev.hint,
      alias: '1v',
      type: 'tools',
    },
    {
      command: 'crjogja',
      hint: stringId.crjogja.hint,
      alias: 'crj',
      type: 'tools',
    }
  )
}

const flipHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedImage, isImage, cmd, download, downloadQuoted } = data
  if (!isImage && !isQuotedImage) throw new Error(stringId.flip.error.noImage)
  data.reactWait()
  const mediaData = isQuotedImage ? await downloadQuoted() : await download()
  const image = await sharp(mediaData)
  if (cmd === 'flip')
    await waSocket.sendMessage(
      data.from,
      { image: await image.flip().toBuffer() },
      { quoted: msg }
    )
  if (cmd === 'flop')
    await waSocket.sendMessage(
      data.from,
      { image: await image.flop().toBuffer() },
      { quoted: msg }
    )
  data.reactSuccess()
}

const oneViewHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const viewOnce =
    data.quotedMsg?.viewOnceMessageV2 ||
    data.quotedMsg?.viewOnceMessage ||
    data.quotedMsg?.viewOnceMessageV2Extension
  const isQuotedOneView = viewOnce != null
  if (!isQuotedOneView) return stringId.onev.error.noOneView
  data.reactWait()
  const { message } = viewOnce!
  const { imageMessage, videoMessage } = message!
  if (imageMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message! },
      'buffer',
      {}
    )
    await waSocket.sendMessage(
      data.from,
      { image: mediaData as Buffer },
      { quoted: msg }
    )
  }
  if (videoMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message! },
      'buffer',
      {}
    )
    await waSocket.sendMessage(
      data.from,
      { video: mediaData as Buffer },
      { quoted: msg }
    )
  }
  data.reactSuccess()
}

const crjogjaHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  data.reactWait()
  browser
    .takeScreenshot(
      'http://sipora.staklimyogyakarta.com/radar/',
      'tmp/radar.png',
      { width: 600, height: 600 }
    )
    .then((r) => {
      if (!r) {
        data.reactError()
        return data.reply(stringId.crjogja.error.timeOut)
      }

      waSocket.sendMessage(
        data.from,
        { image: { url: 'tmp/radar.png' } },
        { quoted: msg, ephemeralExpiration: data.expiration! }
      )
      return data.reactSuccess()
    })
    .catch((e) => {
      console.log(e)
      data.reactError()
      return data.reply(stringId.crjogja.error.timeOut)
    })
}
