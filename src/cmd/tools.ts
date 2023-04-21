import {
  WAMessage,
  WASocket,
  downloadMediaMessage,
  proto,
} from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import { actions } from '../handler'
import stringId from '../language'
import { menu } from '../menu'
import sharp from 'sharp'
import { browser } from '../..'
import {
  createNote,
  deleteNote,
  getNotesNames,
  initNoteDatabase,
  updateNoteContent,
  videoToMp3,
} from '../lib'

export default function () {
  Object.assign(actions, {
    flip: flipHandler,
    onev: oneViewHandler,
    crjogja: crjogjaHandler,
    note: noteHandler,
    tomp3: toMp3Handler,
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

  stringId.note = {
    hint: '📝 Database catatan',
    error: {
      noNote: '‼️ Catatan tidak ditemukan!',
    },
    usage: (data: MessageData) =>
      `📝 Simpan catatan dengan cara ➡️ ${data.prefix}addnote #nama <catatan>`,
  }

  stringId.tomp3 = {
    hint: '🎵 Convert video to mp3',
    error: {
      noVideo: '‼️ Video tidak ditemukan!',
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
    },
    {
      command: 'note',
      hint: stringId.note.hint,
      alias: 'addnote, delnote, editnote',
      type: 'tools',
    },
    {
      command: 'tomp3',
      hint: stringId.tomp3.hint,
      alias: 'mp3',
      type: 'tools',
    }
  )

  initNoteDatabase()
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
  const { message } = viewOnce
  const { imageMessage, videoMessage } = message as proto.IMessage
  if (imageMessage) {
    const mediaData = await downloadMediaMessage(
      { key: msg.key, message: message },
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
      { key: msg.key, message: message },
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

const noteHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { from, fromMe, participant, cmd, args, isQuoted, quotedMsg } = data
  if (args.length === 0) return data.reply(stringId.note.usage(data))
  const noteName = args[0].toLowerCase()
  const id = fromMe ? 'me' : participant || from
  if (cmd === 'note') {
    const note = await getNotesNames(id)
    if (note.length == 0) return data.reply(stringId.note.error.noNote)
    let noteList = '📝 Daftar catatanmu:\n'
    note.forEach((n) => {
      noteList += `- ${n}\n`
    })
    return data.reply(noteList.replace(/\n$/, ''))
  }
  if (cmd === 'addnote') {
    let note: string
    if (isQuoted) {
      note = quotedMsg?.conversation!
    } else {
      if (args.length < 2) return data.reply(stringId.note.usage(data))
      note = args.slice(1).join(' ')
    }
    await createNote(id, noteName, note)
    return data.reply('📝 Catatan berhasil disimpan!')
  }
  if (cmd === 'delnote') {
    const res = await deleteNote(id, noteName)
    if (!res) return data.reply(stringId.note.error.noNote)
    return data.reply('🗑️ Catatan berhasil dihapus!')
  }
  if (cmd === 'editnote') {
    let note: string
    if (isQuoted) {
      note = quotedMsg?.conversation!
    } else {
      if (args.length < 2) return data.reply(stringId.note.usage(data))
      note = args.slice(1).join(' ')
    }
    const res = await updateNoteContent(id, noteName, note)
    if (!res) return data.reply(stringId.note.error.noNote)
    return data.reply('✏️ Catatan berhasil diedit!')
  }
}

const toMp3Handler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedVideo, isVideo, download, downloadQuoted } = data
  if (!isVideo && !isQuotedVideo) throw new Error(stringId.tomp3.error.noVideo)
  data.reactWait()
  const mediaData = isQuotedVideo ? await downloadQuoted() : await download()
  const audio = await videoToMp3(mediaData)
  await waSocket.sendMessage(
    data.from,
    { audio: { url: audio }, mimetype: 'audio/mp4' },
    { quoted: msg, ephemeralExpiration: data.expiration! }
  )
  data.reactSuccess()
}
