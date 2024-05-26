import stringId from '../language'
import { WAMessage, WASocket, delay } from '@whiskeysockets/baileys'
import moment from 'moment-timezone'
import { actions } from '../handler'
import { mp3ToOpus } from '../lib/_index'
import { menu } from '../menu'
import axios, { AxiosError } from 'axios'
import fs from 'fs'
import { Surah, SurahRepo } from '../raw/surah'
import { MessageContext } from '../types'

const jadwalSholatCmd = () => {
    stringId.jsholat = {
        hint: '🕌 _Jadwal sholat_',
        error: {
            noArgs: () => '‼️ Tidak ada argumen yang diberikan!',
            notFound: (
                ctx: MessageContext
            ) => `‼️ Daerah "${ctx.args[0]}" tidak ditemukan!
      cek daerah dengan cara ➡️ ${ctx.prefix}jsh daerah`,
        },
        usage: (ctx: MessageContext) =>
            `🕌 Jadwal sholat dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <daerah>
⚠️ Daerah harus berupa nama kota atau kabupaten
⚠️ Contoh: ${ctx.prefix}${ctx.cmd} sleman`,
    }

    menu.push({
        command: 'jsholat',
        hint: stringId.jsholat.hint,
        alias: 'jsh',
        type: 'islam',
    })

    Object.assign(actions, {
        jsholat: jadwalSholatHandler,
    })
}

const q3 = '```'
const get = axios.get

const jadwalSholatHandler = async (
    _: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    if (!ctx.arg || ctx.arg == '') throw stringId.jsholat.usage(ctx)
    ctx.reactWait()
    if (ctx.args[0] == 'daerah') {
        const { data: semuaKota } = await get(
            'https://api.myquran.com/v2/sholat/kota/semua'
        )
        let hasil = '╔══✪〘 Daftar Kota 〙✪\n'
        for (const kota of semuaKota.data) {
            hasil += '╠> '
            hasil += `${kota.lokasi}\n`
        }
        hasil += '╚═〘 *SeroBot* 〙'
        await ctx.reply(hasil)
    } else {
        const { data: cariKota } = await get(
            'https://api.myquran.com/v2/sholat/kota/cari/' +
                encodeURIComponent(ctx.arg)
        )
        let kodek = ''
        try {
            kodek = cariKota.data[0].id
        } catch (err) {
            throw stringId.jsholat.error.notFound(ctx)
        }
        const tgl = moment((msg.messageTimestamp as number) * 1000).format(
            'YYYY/MM/DD'
        )
        const { data: jadwalData } = await get(
            `https://api.myquran.com/v2/sholat/jadwal/${kodek}/${tgl}`
        )
        if (jadwalData.status === 'false')
            throw new Error('Internal server error')
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
        ctx.reply(jadwalMsg)
    }
    return ctx.reactSuccess()
}

const surahCmd = () => {
    stringId.surah = {
        hint: "📖 _Baca surah Al-Qur'an_",
        error: {
            noArgs: () => '‼️ Tidak ada argumen yang diberikan!',
            notFound: (
                ctx: MessageContext
            ) => `‼️ Surah '${ctx.args[0]}' tidak ditemukan atau ayat ${ctx.args[1]} tidak ada!
Cek daftar surah dengan cara ➡️ ${ctx.prefix}surah daftar`,
            invalidAyat: (ctx: MessageContext) =>
                `‼️ Ayat '${ctx.args[1]}' tidak valid!`,
            tooManyAyat: () =>
                '‼️ Ayat yang diminta terlalu banyak! Maksimal 10 ayat',
            invalidMaxAyat: (total: number) =>
                `‼️ Melebihi total ayat dalam surah tersebut (max ${total})`,
        },
        usage: (ctx: MessageContext) =>
            `📖 Baca surah Al-Qur'an dengan cara ➡️ ${ctx.prefix}${ctx.cmd} <nama surah> <ayat/ayat from-to>
⚠️ Nama surah harus berupa nama surah atau nomor surah
⚠️ Contoh: ${ctx.prefix}${ctx.cmd} al-fatihah 1 atau ${ctx.prefix}${ctx.cmd} 1 1-5`,
    }

    menu.push({
        command: 'surah',
        hint: stringId.surah.hint,
        alias: 'quran, recite',
        type: 'islam',
    })

    Object.assign(actions, {
        surah: surahHandler,
    })
}

const surahRepo = JSON.parse(
    fs.readFileSync('./src/raw/surah.json', 'utf-8')
) as SurahRepo

const surahHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { args, cmd } = ctx

    if (!ctx.arg || ctx.arg == '') {
        throw stringId.surah.usage(ctx)
    }

    ctx.reactWait()

    if (args[0] == 'daftar') {
        return await handleDaftar(ctx)
    }

    const surahNumber = isNaN(Number(args[0]))
        ? getSurahNumberByName(args[0])
        : Number(args[0])

    if (!surahNumber) {
        throw stringId.surah.error.notFound(ctx)
    }

    const processAyat = args[1].includes('-')
        ? processMultipleAyat
        : processSingleAyat

    await processAyat(ctx, surahNumber, cmd)

    return ctx.reactSuccess()
}

const handleDaftar = async (ctx: MessageContext) => {
    let list = '╔══✪〘 Daftar Surah 〙✪\n'
    surahRepo.data.forEach((surah) => {
        list += `${
            surah.number
        }. ${surah.name.transliteration.id.toLowerCase()}\n`
    })
    list += '╚═〘 *SeroBot* 〙'
    ctx.reactSuccess()
    return await ctx.reply(list)
}

const getSurahNumberByName = (name: string) => {
    const surahArr = surahRepo.data
    const index = surahArr.findIndex((surah) => {
        return (
            surah.name.transliteration.id
                .toLowerCase()
                .includes(name.toLowerCase()) ||
            surah.name.transliteration.en
                .toLowerCase()
                .includes(name.toLowerCase())
        )
    })
    return index != -1 ? surahArr[index].number : null
}

const getTotalVerses = (surahNumber: number): number => {
    const surahArr = surahRepo.data
    const index = surahArr.findIndex((surah) => {
        return surah.number == surahNumber
    })

    return surahArr[index].numberOfVerses
}

const processMultipleAyat = async (
    ctx: MessageContext,
    surahNumber: number,
    cmd: string
) => {
    const ayatNumbers = ctx.args[1].split('-')

    if (ayatNumbers.length > 2) {
        throw stringId.surah.error.invalidAyat(ctx)
    }

    const ayatFrom = Number(ayatNumbers[0])
    const ayatTo = Number(ayatNumbers[1])

    if (isNaN(ayatFrom) || isNaN(ayatTo)) {
        throw stringId.surah.error.invalidAyat(ctx)
    }

    if (ayatFrom > ayatTo) {
        throw stringId.surah.error.invalidAyat(ctx)
    }

    if (ayatTo - ayatFrom >= 10) {
        throw stringId.surah.error.tooManyAyat()
    }

    const totalAyat = getTotalVerses(surahNumber)
    if (ayatTo > totalAyat) {
        throw stringId.surah.error.invalidMaxAyat(totalAyat)
    }

    for (let i = ayatFrom; i <= ayatTo; i++) {
        await getAyatSurahDataAndSend(ctx, surahNumber, i, cmd)
        await delay(1000)
    }
}

const processSingleAyat = async (
    ctx: MessageContext,
    surahNumber: number,
    cmd: string
) => {
    const ayatNumber = isNaN(Number(ctx.args[1])) ? 1 : Number(ctx.args[1])
    await getAyatSurahDataAndSend(ctx, surahNumber, ayatNumber, cmd)
}

interface SurahResponse {
    code: number
    status: string
    message: string
    data: {
        number: {
            inQuran: number
            inSurah: number
        }
        text: {
            arab: string
            transliteration: string
        }
        translation: {
            id: string
            en: string
        }
        audio: {
            primary: string
            secondary: {
                0: string
                1: string
            }
        }
        surah: Surah
    }
}

const getAyatSurahDataAndSend = async (
    ctx: MessageContext,
    surahNumber: number,
    ayatNumber: number,
    cmd: string
) => {
    try {
        const result = (await get(
            `https://api.quran.gading.dev/surah/${surahNumber}/${ayatNumber}`
        )) as { data: SurahResponse }
        const sdata = result.data.data

        if (cmd === 'recite') {
            const path = `./tmp/ayat/${sdata.number.inQuran}.mp3`
            const pathConverted = `./tmp/ayat/${sdata.number.inQuran}.opus`
            if (!fs.existsSync(pathConverted)) {
                const audio = await get(sdata.audio.primary, {
                    responseType: 'arraybuffer',
                })
                fs.writeFileSync(path, audio.data)

                const opus = await mp3ToOpus(path, pathConverted)

                await ctx.replyVoiceNote(opus)
                fs.unlink(path, () => {})
            } else {
                await ctx.replyVoiceNote(pathConverted)
            }
        }

        const message = `${q3}${sdata.text.arab}${q3}\n\n_${sdata.translation.id}_\n\nQS. ${sdata.surah.name.transliteration.id} : ${sdata.number.inSurah}`
        await ctx.send(message)

        return true
    } catch (err: unknown) {
        ctx.reactError()
        if ((err as AxiosError).response?.status == 404) {
            throw stringId.surah.error.notFound(ctx)
        }
        throw ((err as AxiosError).response?.data as SurahResponse).message
    }
}

export default () => {
    jadwalSholatCmd()
    surahCmd()
}
