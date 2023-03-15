import fs from 'fs'
const { writeFile } = fs
const packID =
  'com.snowcorp.stickerly.android.stickercontentprovider b5e7275f-f1de-4137-961f-57becfad34f2'
const playstore = 'https://wa.me/6285161467958'
const itunes = 'https://wa.me/6285161467958'
// const playstore = 'https://play.google.com/store/apps/details?id=com.stickify.stickermaker'
// const itunes = 'https://itunes.apple.com/app/sticker-maker-studio/id1443326857'

/**
 * @class Exif
 */
export default class Exif {
  /**
   * Create an EXIF file.
   * @param {String} packname
   * @param {String} authorname
   * @param {String} [filename=data]
   */
  create(packname: string, authorname: string, filename: string) {
    if (!filename) filename = 'data'
    const json = {
      'sticker-pack-id': packID,
      'sticker-pack-name': packname,
      'sticker-pack-publisher': authorname,
      'android-app-store-link': playstore,
      'ios-app-store-link': itunes,
    }
    let len = JSON.stringify(json).length
    const f = Buffer.from([
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
      0x07, 0x00,
    ])
    const code = [0x00, 0x00, 0x16, 0x00, 0x00, 0x00]
    if (len > 256) {
      len = len - 256
      code.unshift(0x01)
    } else {
      code.unshift(0x00)
    }
    const fff = Buffer.from(code)
    const ffff = Buffer.from(JSON.stringify(json))
    if (len < 16) {
      len = len.toString(16)
      len = '0' + len
    } else {
      len = len.toString(16)
    }
    const ff = Buffer.from(len, 'hex')
    const buffer = Buffer.concat([f, ff, fff, ffff])
    writeFile(`../tmp/sticker/${filename}.exif`, buffer, (err) => {
      if (err) return console.error(err)
      console.log('Success!')
    })
  }
}
