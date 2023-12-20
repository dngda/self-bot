import {
  WAMessage,
  WASocket,
  downloadMediaMessage,
  proto,
} from '@whiskeysockets/baileys'
import { getVideoDurationInSeconds } from 'get-video-duration'
import ocrApi from 'ocr-space-api-wrapper'
import { MessageData } from '../utils'
import { actions } from '../handler'
import stringId from '../language'
import { Readable } from 'stream'
import { unlink } from 'fs'
import { unlink } from 'fs'
import { menu } from '../menu'
import sharp from 'sharp'
import {
  createNote,
  deleteNote,
  getNotesNames,
  initNoteDatabase,
  saveTextToSpeech,
  updateNoteContent,
  splitVideo,
  videoToMp3,
  LANGUAGES,
  mp3toOpus,
  ocr,
} from '../lib'

export default function () {
  Object.assign(actions, {
    flip: flipHandler,
    onev: oneViewHandler,
    note: noteHandler,
    tomp3: toMp3Handler,
    vsplit: videoSplitHandler,
    ocr: ocrHandler,
    say: gttsHandler,
  })

  stringId.flip = {
    hint: '🖼️ _flip = vertikal, flop = horizontal_',
    error: {
      noImage: '‼️ Gambar tidak ditemukan!',
    },
  }

  stringId.onev = {
    hint: '👁️‍🗨️ _Get pesan view once_',
    error: {
      noOneView: '‼️ Pesan view once tidak ditemukan!',
    },
  }

  stringId.note = {
    hint: '📝 _Database catatan_',
    error: {
      noNote: '‼️ Catatan tidak ditemukan!',
    },
    usage: (data: MessageData) =>
      `📝 Simpan catatan dengan cara ➡️ ${data.prefix}addnote #nama <catatan>`,
  }

  stringId.tomp3 = {
    hint: '🎵 _Convert video to mp3_',
    error: {
      noVideo: '‼️ Video tidak ditemukan!',
    },
  }

  stringId.vsplit = {
    hint: '🎞️ _Split video by 30 seconds_',
    error: {
      duration: '‼️ Durasi video terlalu pendek!',
    },
    usage: (data: MessageData) =>
      `🎞️ Kirim video dengan caption atau reply video dengan ➡️ ${data.prefix}vsplit`,
  }

  stringId.ocr = {
    hint: '📖 _Optical character recognition_',
    error: {
      noImage: '‼️ Gambar tidak ditemukan!',
    },
    usage: (data: MessageData) =>
      `📖 Kirim gambar dengan caption atau reply gambar dengan ➡️ ${data.prefix}ocr <language>`,
  }

  stringId.say = {
    hint: '🗣️ _Google text to speech_',
    error: {
      lang: '‼️ Bahasa tidak disupport.',
    },
    usage: (data: MessageData) =>
      `🗣️ Kirim cmd dengan text ➡️ ${data.prefix}say <text>`,
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
      command: 'note',
      hint: stringId.note.hint,
      alias: 'addnote, delnote, editnote, notes',
      type: 'tools',
    },
    {
      command: 'tomp3',
      hint: stringId.tomp3.hint,
      alias: 'mp3',
      type: 'tools',
    },
    {
      command: 'vsplit',
      hint: stringId.vsplit.hint,
      alias: 'vs',
      type: 'tools',
    },
    {
      command: 'ocr',
      hint: stringId.ocr.hint,
      alias: 'itt',
      type: 'tools',
    },
    {
      command: 'say',
      hint: stringId.say.hint,
      alias: 'tts',
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
  if (!isQuotedOneView) throw new Error(stringId.onev.error.noOneView)
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

const noteHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { from, fromMe, participant, cmd, args, isQuoted, quotedMsg } = data
  if (args.length === 0) return data.reply(stringId.note.usage(data))
  const noteName = args[0].toLowerCase().startsWith('#')
    ? args[0].toLowerCase()
    : `#${args[0].toLowerCase()}`
  const id = fromMe ? 'me' : participant ?? from

  switch (cmd) {
    case 'note':
    case 'notes':
      return handleNoteCommand(id, data)
    case 'addnote':
      return handleAddNoteCommand(
        id,
        noteName,
        args,
        isQuoted ?? false,
        quotedMsg,
        data
      )
    case 'delnote':
      return handleDeleteNoteCommand(id, noteName, data)
    case 'editnote':
      return handleEditNoteCommand(
        id,
        noteName,
        args,
        isQuoted ?? false,
        quotedMsg,
        data
      )
    default:
      return
  }
}

async function handleNoteCommand(id: string, data: MessageData) {
  const note = await getNotesNames(id)
  if (note.length == 0) return data.reply(stringId.note.error.noNote)
  let noteList = '📝 Daftar catatanmu:\n'
  note.forEach((n) => {
    noteList += `- ${n}\n`
  })
  data.reply(noteList.replace(/\n$/, ''))
}

async function handleAddNoteCommand(
  id: string,
  noteName: string,
  args: string[],
  isQuoted: boolean,
  quotedMsg: proto.IMessage | null | undefined,
  data: MessageData
) {
  let note: string
  if (isQuoted) {
    note = quotedMsg?.conversation! || quotedMsg?.extendedTextMessage?.text!
  } else {
    if (args.length < 2) return data.reply(stringId.note.usage(data))
    note = args.slice(1).join(' ')
  }
  await createNote(id, noteName, note)
  data.reply('📝 Catatan berhasil disimpan!')
}

async function handleDeleteNoteCommand(
  id: string,
  noteName: string,
  data: MessageData
) {
  const res = await deleteNote(id, noteName)
  if (!res) return data.reply(stringId.note.error.noNote)
  data.reply('🗑️ Catatan berhasil dihapus!')
}

async function handleEditNoteCommand(
  id: string,
  noteName: string,
  args: string[],
  isQuoted: boolean,
  quotedMsg: proto.IMessage | null | undefined,
  data: MessageData
) {
  let note: string
  if (isQuoted) {
    note = quotedMsg?.conversation! || quotedMsg?.extendedTextMessage?.text!
  } else {
    if (args.length < 2) return data.reply(stringId.note.usage(data))
    note = args.slice(1).join(' ')
  }
  const res = await updateNoteContent(id, noteName, note)
  if (!res) return data.reply(stringId.note.error.noNote)
  data.reply('✏️ Catatan berhasil diedit!')
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

const videoSplitHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedVideo, isVideo, download, downloadQuoted } = data
  if (!isVideo && !isQuotedVideo) throw new Error(stringId.vsplit.usage(data))
  let seconds =
    msg.message?.videoMessage?.seconds! ||
    data.quotedMsg?.videoMessage?.seconds!

  if (seconds < 30 && seconds != 0)
    throw new Error(stringId.vsplit.error.duration)

  data.reactWait()
  const mediaData = isQuotedVideo ? await downloadQuoted() : await download()

  if (seconds == 0) {
    seconds = await getVideoDurationInSeconds(Readable.from(mediaData))
  }

  if (seconds < 30) throw new Error(stringId.vsplit.error.duration)

  const video = await splitVideo(mediaData)
  for (let i = 0; i < video.length; i++) {
    if (!video[i].endsWith('.mp4')) continue
    await waSocket.sendMessage(
      data.from,
      {
        video: { url: `tmp/vs/${video[i]}` },
        caption: `0${i}`,
        seconds: await getVideoDurationInSeconds(`tmp/vs/${video[i]}`),
        mimetype: 'video/mp4',
      },
      { quoted: msg, ephemeralExpiration: data.expiration! }
    )

    unlink(`tmp/vs/${video[i]}`, _ => _)
  }
  data.reactSuccess()
}

const ocrHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { isQuotedImage, isImage, download, downloadQuoted, args } = data
  if (!isImage && !isQuotedImage) throw new Error(stringId.ocr.error.noImage)
  if (args.length === 0) return data.reply(stringId.ocr.usage(data))
  data.reactWait()
  const mediaData = isQuotedImage ? await downloadQuoted() : await download()

  let language = args[0] as ocrApi.OcrSpaceLanguages
  const res = await ocr(language, mediaData)
  console.log('🚀 ~ file: tools.ts:366 ~ res:', res)
  const text = res.ParsedResults[0].ParsedText

  await waSocket.sendMessage(
    data.from,
    { text },
    { quoted: msg, ephemeralExpiration: data.expiration! }
  )
  data.reactSuccess()
}

const gttsHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const { args, arg, replyVoiceNote, reactWait, reactSuccess } = data
  if (args.length == 0) return data.reply(stringId.say.usage(data))
  
  let lang = 'id'
  let text = arg
  if (data.cmd == "tts") {
    lang = args[0]
    text = args.slice(1).join(" ")
  }
  
  let lang = 'id'
  let text = arg
  if (data.cmd == "tts") {
    lang = args[0]
    text = args.slice(1).join(" ")
  }

  if (!LANGUAGES[lang]) throw new Error(stringId.say.error.lang)

  await reactWait()
  const filepath = `tmp/gtts.mp3`
  await saveTextToSpeech({ filepath, text, lang })
  const opus = await mp3toOpus(filepath)

  await replyVoiceNote(opus)
  await reactSuccess()

  unlink(filepath, _ => _)
  unlink(opus, _ => _)
}
