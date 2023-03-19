import { MessageData } from '../utils'

const stringId: Record<string, any> = {}

stringId.menu = {
  hint: 'Menampilkan menu bot',
}
stringId.ping = {
  hint: 'Balas dengan pong!',
}
stringId.sticker = {
  hint: 'Convert media ke sticker',
  error: {
    videoLimit: 'Video terlalu panjang, maksimal 5 detik',
    quality: (q: number) =>
      `Hasil > 1MB dengan Q: ${q}%, mencoba menurunkan kualitas...`,
  },
  usage: (data: MessageData) =>
    `Kirim gambar/video atau balas gambar/video dengan caption ${data.prefix}${data.command}
    tambahkan argument -r untuk membuat sticker rounded, -c untuk membuat sticker cropped,
    edit packname/author dengan menambahkan argument packname|author,
    contoh: ${data.prefix}${data.command} -r packname|author`,
}
stringId.flip = {
  hint: 'Flop gambar horizontal, Flip gambar vertikal',
  error: {
    noImage: 'Error! Gambar tidak ditemukan!',
  },
}
stringId.public = {
  hint: 'Toggle public mode pada chat ini',
  info: (isPublic: boolean) =>
    `Bot sekarang dalam mode ${
      isPublic ? '*public*.\nGunakan prefix !' : '*private*'
    } di chat ini!`,
}
stringId.eval = {
  hint: 'Evaluate JS/TS code',
}
stringId.return = {
  hint: 'Evaluate JS/TS variable dan return hasilnya',
}

export default stringId
