import stringId from '../language'
import { WAMessage, WASocket } from '@whiskeysockets/baileys'
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

  if (!data.arg || data.arg == '') {
    return data.reply(stringId.surah.usage(data))
  }

  data.reactWait()

  if (args[0] == 'daftar') {
    return await handleDaftar(data)
  }

  let surahNumber = isNaN(Number(args[0]))
    ? getSurahNumberByName(args[0])
    : Number(args[0])

  if (!surahNumber) {
    return data.reply(stringId.surah.error.notFound(data))
  }

  const processAyat = args[1].includes('-')
    ? processMultipleAyat
    : processSingleAyat

  await processAyat(data, surahNumber, cmd, from, msg, waSocket)

  data.reactSuccess()
}

const handleDaftar = async (data: MessageData) => {
  let list = '╔══✪〘 Daftar Surah 〙✪\n'
  SurahDatas.data.forEach((surah: any) => {
    list += `${surah.number}. ${surah.name.transliteration.id.toLowerCase()}\n`
  })
  list += '╚═〘 *SeroBot* 〙'
  data.reactSuccess()
  return await data.reply(list)
}

const getSurahNumberByName = (name: string) => {
  let sdatas = SurahDatas.data
  let index = sdatas.findIndex((surah: any) => {
    return (
      surah.name.transliteration.id
        .toLowerCase()
        .includes(name.toLowerCase()) ||
      surah.name.transliteration.en.toLowerCase().includes(name.toLowerCase())
    )
  })
  return index != -1 ? sdatas[index].number : null
}

const processMultipleAyat = async (
  data: MessageData,
  surahNumber: number,
  cmd: string,
  from: string,
  msg: WAMessage,
  waSocket: WASocket
) => {
  let ayatNumbers = data.args[1].split('-')

  if (ayatNumbers.length > 2) {
    return data.reply(stringId.surah.error.invalidAyat(data))
  }

  let ayatFrom = Number(ayatNumbers[0])
  let ayatTo = Number(ayatNumbers[1])

  if (isNaN(ayatFrom) || isNaN(ayatTo)) {
    return data.reply(stringId.surah.error.invalidAyat(data))
  }

  if (ayatFrom > ayatTo) {
    return data.reply(stringId.surah.error.invalidAyat(data))
  }

  if (ayatTo - ayatFrom > 10) {
    return data.reply(stringId.surah.error.tooManyAyat(data))
  }

  for (let i = ayatFrom; i <= ayatTo; i++) {
    await getAyatSurahDataAndSend(
      data,
      surahNumber,
      i,
      cmd,
      from,
      msg,
      waSocket
    )
  }
}

const processSingleAyat = async (
  data: MessageData,
  surahNumber: number,
  cmd: string,
  from: string,
  msg: WAMessage,
  waSocket: WASocket
) => {
  let ayatNumber = isNaN(Number(data.args[1])) ? 1 : Number(data.args[1])
  await getAyatSurahDataAndSend(
    data,
    surahNumber,
    ayatNumber,
    cmd,
    from,
    msg,
    waSocket
  )
}

const getAyatSurahDataAndSend = async (
  data: MessageData,
  surahNumber: number,
  ayatNumber: number,
  cmd: string,
  from: string,
  msg: WAMessage,
  waSocket: WASocket
) => {
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
