import stringId from '../src/language'
import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import moment from 'moment-timezone'
import axios from 'axios'

const q3 = '```'
const get = axios.get

export const jadwalSholatHandler = async (
  _: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const args = data.args.split(' ')
  if (!data.args || data.args == '')
    return data.reply(stringId.jsholat.usage(data))
  if (args[0] == 'daerah') {
    let { data: semuaKota } = await get(
      'https://api.myquran.com/v1/sholat/kota/semua'
    )
    let hasil = '╔══✪〘 Daftar Kota 〙✪\n'
    for (let kota of semuaKota) {
      hasil += '╠> '
      hasil += `${kota.lokasi}\n`
    }
    hasil += '╚═〘 *SeroBot* 〙'
    await data.reply(hasil)
  } else {
    let { data: cariKota } = await get(
      'https://api.myquran.com/v1/sholat/kota/cari/' + args
    )
    try {
      var kodek = cariKota.data[0].id
    } catch (err) {
      return data.reply(stringId.jsholat.error.notFound(data))
    }
    var tgl = moment((msg.messageTimestamp as number) * 1000).format(
      'YYYY/MM/DD'
    )
    let { data: jadwalData } = await get(
      `https://api.myquran.com/v1/sholat/jadwal/${kodek}/${tgl}`
    )
    if (jadwalData.status === 'false')
      return data.reply('Internal server error')
    var jadwal = jadwalData.data.jadwal
    let jadwalMsg = `╔══✪〘 Jadwal Sholat di ${jadwalData.data.lokasi} 〙✪\n`
    jadwalMsg += `╠> ${jadwal.tanggal}\n`
    jadwalMsg += `╠> ${q3}Imsak    : ${jadwal.imsak}${q3}\n`
    jadwalMsg += `╠> ${q3}Subuh    : ${jadwal.subuh}${q3}\n`
    jadwalMsg += `╠> ${q3}Dzuhur   : ${jadwal.dzuhur}${q3}\n`
    jadwalMsg += `╠> ${q3}Ashar    : ${jadwal.ashar}${q3}\n`
    jadwalMsg += `╠> ${q3}Maghrib  : ${jadwal.maghrib}${q3}\n`
    jadwalMsg += `╠> ${q3}Isya'    : ${jadwal.isya}${q3}\n`
    jadwalMsg += '╚═〘 *SeroBot* 〙'
    data.reply(jadwalMsg)
  }
}
