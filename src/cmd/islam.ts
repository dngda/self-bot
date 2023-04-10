import stringId from '../language'
import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import moment from 'moment-timezone'
import { actions } from '../handler'
import { menu } from '../menu'
import axios from 'axios'

export default function () {
  Object.assign(actions, {
    jsholat: jadwalSholatHandler,
  })

  stringId.jsholat = {
    hint: '🕌 Jadwal sholat',
    error: {
      noArgs: '‼️ Tidak ada argumen yang diberikan!',
      notFound: (
        data: MessageData
      ) => `‼️ Daerah "${data.args[0]}" tidak ditemukan!
      cek daerah dengan cara ➡️ ${data.prefix}jsh daerah`,
    },
    usage: (data: MessageData) =>
      `🕌 Jadwal sholat dengan cara ➡️ ${data.prefix}${data.cmd} <daerah>
⚠️ Daerah harus berupa nama kota atau kabupaten
⚠️ Contoh: ${data.prefix}${data.cmd} sleman`,
  }

  menu.push({
    command: 'jsholat',
    hint: stringId.jsholat.hint,
    alias: 'jsh, jadwalsholat',
    type: 'islam',
  })
}

const q3 = '```'
const get = axios.get

const jadwalSholatHandler = async (
  _: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const args = data.args
  if (!data.arg || data.arg == '')
    return data.reply(stringId.jsholat.usage(data))
  data.reactWait()
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
  data.reactSuccess()
}
