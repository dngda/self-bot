import stringId from '../language'
import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import moment from 'moment-timezone'
import { actions } from '../handler'
import { menu } from '../menu'
import axios from 'axios'
import fs from 'fs'

export default function () {
  Object.assign(actions, {
    jsholat: jadwalSholatHandler,
    surah: surahHandler,
  })

  stringId.jsholat = {
    hint: '🕌 _Jadwal sholat_',
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

  stringId.surah = {
    hint: "📖 _Baca surah Al-Qur'an_",
    error: {
      noArgs: '‼️ Tidak ada argumen yang diberikan!',
      notFound: (
        data: MessageData
      ) => `‼️ Surah '${data.args[0]}' tidak ditemukan atau ayat ${data.args[1]} tidak ada!
Cek daftar surah dengan cara ➡️ ${data.prefix}surah daftar`,
      invalidAyat: (data: MessageData) =>
        `‼️ Ayat '${data.args[1]}' tidak valid!`,
      tooManyAyat: '‼️ Ayat yang diminta terlalu banyak! Maksimal 10 ayat',
    },
    usage: (data: MessageData) =>
      `📖 Baca surah Al-Qur'an dengan cara ➡️ ${data.prefix}${data.cmd} <nama surah> <ayat/ayat from-to>
⚠️ Nama surah harus berupa nama surah atau nomor surah
⚠️ Contoh: ${data.prefix}${data.cmd} al-fatihah 1 atau ${data.prefix}${data.cmd} 1 1-5`,
  }

  menu.push(
    {
      command: 'jsholat',
      hint: stringId.jsholat.hint,
      alias: 'jsh, jadwalsholat',
      type: 'islam',
    },
    {
      command: 'surah',
      hint: stringId.surah.hint,
      alias: 'quran, recite',
      type: 'islam',
    }
  )
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
    let kodek = ''
    try {
      kodek = cariKota.data[0].id
    } catch (err) {
      return data.reply(stringId.jsholat.error.notFound(data))
    }
    const tgl = moment((msg.messageTimestamp as number) * 1000).format(
      'YYYY/MM/DD'
    )
    let { data: jadwalData } = await get(
      `https://api.myquran.com/v1/sholat/jadwal/${kodek}/${tgl}`
    )
    if (jadwalData.status === 'false')
      return data.reply('Internal server error')
    const jadwal = jadwalData.data.jadwal
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

const SurahDatas = JSON.parse(fs.readFileSync('./src/raw/surah.json', 'utf-8'))

const surahHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const { args, cmd, from } = data
  const arg = args[0]

  if (!arg) {
    return data.reply(stringId.surah.usage(data))
  }

  data.reactWait()

  if (arg === 'daftar') {
    const list = SurahDatas.data
      .map(
        (surah: any) =>
          `${surah.number}. ${surah.name.transliteration.id.toLowerCase()}`
      )
      .join('\n')
    const message = `╔══✪〘 Daftar Surah 〙✪\n${list}\n╚═〘 *SeroBot* 〙`
    data.reactSuccess()
    return await data.reply(message)
  }

  const surah = isNaN(Number(arg))
    ? SurahDatas.data.find(
        (s: any) =>
          s.name.transliteration.id.toLowerCase().includes(arg.toLowerCase()) ||
          s.name.transliteration.en.toLowerCase().includes(arg.toLowerCase())
      )
    : SurahDatas.data.find((s: any) => s.number === Number(arg))

  if (!surah) {
    return data.reply(stringId.surah.error.notFound(data))
  }

  const { number: surahNumber } = surah

  const getAyatSurahDataAndSend = async (ayatNumber: number) => {
    try {
      const result = await get(
        `https://api.quran.gading.dev/surah/${surahNumber}/${ayatNumber}`
      )
      const sdata = result.data.data

      if (cmd === 'recite') {
        await waSocket.sendMessage(
          from,
          {
            audio: { url: sdata.audio.primary },
            mimetype: 'audio/mp4',
            ptt: true,
          },
          { quoted: msg, ephemeralExpiration: data.expiration! }
        )
      }

      const message = `${q3}${sdata.text.arab}${q3}\n\n_${sdata.translation.id}_\n\nQS. ${sdata.surah.name.transliteration.id} : ${sdata.number.inSurah}`
      await data.send(message)

      return true
    } catch (err: any) {
      data.reactError()
      return data.reply(err.response.data.message)
    }
  }

  const processMultipleAyat = async () => {
    const [fromAyat, toAyat] = args[1].split('-').map(Number)

    if (
      isNaN(fromAyat) ||
      isNaN(toAyat) ||
      fromAyat > toAyat ||
      toAyat - fromAyat > 10
    ) {
      return data.reply(stringId.surah.error.invalidAyat(data))
    }

    for (let i = fromAyat; i <= toAyat; i++) {
      await getAyatSurahDataAndSend(i)
    }
  }

  const processSingleAyat = async () => {
    const ayatNumber = isNaN(Number(args[1])) ? 1 : Number(args[1])
    await getAyatSurahDataAndSend(ayatNumber)
  }

  const isMultipleAyat = args[1] && args[1].includes('-')

  if (isMultipleAyat) {
    await processMultipleAyat()
  } else {
    await processSingleAyat()
  }

  data.reactSuccess()
}
