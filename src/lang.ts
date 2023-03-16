const langId: Record<string, any> = {}

langId.menu = {
  hint: 'Menampilkan menu bot',
}
langId.ping = {
  hint: 'Balas dengan pong!',
}
langId.sticker = {
  hint: 'Convert media ke sticker',
  error: {
    videoLimit: 'Video terlalu panjang, maksimal 5 detik',
  },
  usage: (data: Record<string, any>) =>
    `Kirim gambar/video atau balas gambar/video dengan caption ${data.prefix}${data.command}`,
}
langId.public = {
  hint: 'Toggle public mode pada chat ini',
  info: (isPublic: boolean) =>
    `Bot sekarang dalam mode ${
      isPublic ? '*public*' : '*private*'
    } di chat ini!`,
}
langId.eval = {
  hint: 'Evaluate JS/TS code',
}
langId.return = {
  hint: 'Evaluate JS/TS variable dan return hasilnya',
}

export default langId
