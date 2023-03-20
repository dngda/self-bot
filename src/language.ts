import { MessageData } from '../utils'

const stringId: Record<string, any> = {}

stringId.menu = {
  hint: '📜 Menampilkan menu bot',
}
stringId.ping = {
  hint: '➡️ Balas dengan pong!',
}
stringId.sticker = {
  hint: '🖼️ Convert media ke sticker',
  error: {
    videoLimit: '‼️ Video terlalu panjang, maksimal 5 detik',
    quality: (q: number) =>
      `⏳ Hasil > 1MB dengan Q: ${q}%, mencoba menurunkan kualitas...`,
  },
  usage: (data: MessageData) =>
    `Kirim gambar/video atau balas gambar/video dengan caption ${data.prefix}${data.cmd}
⚙️ Gunakan: '-r' rounded corner, '-c' square cropped, '-nobg' hapus bg,
⚙️ Custom packname/author dengan args 'packname|author',
➡️ Contoh: ${data.prefix}${data.cmd} -r -nobg created with|serobot✨`,
}
stringId.flip = {
  hint: '🖼️ flip = vertikal, flop = horizontal',
  error: {
    noImage: '‼️Error! Gambar tidak ditemukan!',
  },
}
stringId.public = {
  hint: '⚙️ Toggle public mode pada chat ini',
  info: (isPublic: boolean) =>
    `ℹ️ Bot sekarang dalam mode ${
      isPublic ? '*Publik*.\nCoba kirimkan "!help"' : '*Private*'
    } di chat ini!`,
}
stringId.pinterest = {
  hint: '🔍 Search gambar di pinterest',
  usage: (data: MessageData) =>
    `🔍 Search gambar di pinterest dengan cara ➡️ ${data.prefix}${data.cmd} <query>`,
}
stringId.eval = {
  hint: 'Evaluate JS/TS code',
}
stringId.return = {
  hint: 'Evaluate JS/TS variable dan return hasilnya',
}

export default stringId
