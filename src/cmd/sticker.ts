import { WAMessage, WASocket, proto } from '@whiskeysockets/baileys'
import fs from 'fs'
import lodash from 'lodash'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import sharp from 'sharp'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { actions } from '../handler'
import stringId from '../language'
import { gifToMp4, memegen, textToPicture, uploadImage } from '../lib'
import { menu } from '../menu'
import { MessageContext } from '../types'

export default function () {
    Object.assign(actions, {
        sticker: stickerHandler,
        ttpc: ttpHandler,
        memefy: memefyHandler,
        sdl: downloadStickerHandler,
    })

    stringId.sticker = {
        hint: '🖼️ _Convert media ke sticker_',
        error: {
            videoLimit: (s: number) =>
                `‼️ Video terlalu panjang, maksimal ${s} detik`,
            quality: (q: number) =>
                `⚠️ Result exceeded 1 MB with Q: ${q}%\n⏳ Hold on, decreasing quality...`,
            q: (q: number) => `⏳ Q: ${q}% still not yet...`,
            fail: () =>
                `‼️ Gagal mengubah video ke sticker, coba kurangi durasi.`,
        },
        usage: (ctx: MessageContext) =>
            `Kirim gambar/video atau balas gambar/video dengan caption ${ctx.prefix}${ctx.cmd}
⚙️ Gunakan: '-r' rounded corner, '-c' square cropped, '-nobg' hapus bg,
⚙️ Custom packname/author dengan args 'packname|author',
➡️ Contoh: ${ctx.prefix}${ctx.cmd} -r -nobg created with|serobot✨`,
        success: (q: number) => `✅ Success with Quality: ${q}%`,
    }

    stringId.ttp = {
        hint: '🖼️ _Convert teks ke sticker_',
        error: {
            textLimit: (s: number) =>
                `‼️ Teks terlalu panjang, maksimal ${s} karakter`,
        },
        usage: (ctx: MessageContext) =>
            `Tambahkan teks atau balas teks dengan ${ctx.prefix}${ctx.cmd} <teks>\n` +
            `➡️ Contoh: ${ctx.prefix}ttp Serobot\n` +
            `Custom color dengan args 'color1|color2|strokecolor'\n` +
            `➡️ Contoh: ${ctx.prefix}ttpc red|blue|white Serobot`,
    }

    stringId.memefy = {
        hint: '🖼️ _Tambah tulisan di gambar/sticker_',
        error: {
            textLimit: (s: number) =>
                `‼️ Teks terlalu panjang, maksimal ${s} karakter`,
        },
        usage: (ctx: MessageContext) =>
            `Tambahkan teks atau balas gambar/sticker dengan ${ctx.prefix}${ctx.cmd} <atas|bawah>\n⚙️ Gunakan: '-c' square cropped`,
    }

    stringId.dls = {
        hint: '💾 _Download sticker_',
        error: {
            notSticker: () => `‼️ Ini bukan sticker`,
        },
        usage: (ctx: MessageContext) =>
            `Balas sticker dengan ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push(
        {
            command: 'sticker',
            hint: stringId.sticker.hint,
            alias: 's, stiker',
            type: 'sticker',
        },
        {
            command: 'ttpc',
            hint: stringId.ttp.hint,
            alias: 'ttp',
            type: 'sticker',
        },
        {
            command: 'memefy',
            hint: stringId.memefy.hint,
            alias: 'sm',
            type: 'sticker',
        },
        {
            command: 'sdl',
            hint: stringId.dls.hint,
            alias: 'toimg, tomedia',
            type: 'sticker',
        }
    )
}

const stickerHandler = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const {
        arg,
        isMedia,
        isImage,
        isVideo,
        isQuoted,
        isQuotedImage,
        isQuotedVideo,
        replySticker,
    } = ctx
    if (!isMedia) throw new Error(stringId.sticker.usage(ctx))
    ctx.reactWait()
    let mediaData = isQuoted ? await ctx.downloadQuoted() : await ctx.download()
    let Stype = arg.includes('-r') ? StickerTypes.ROUNDED : StickerTypes.FULL
    Stype = arg.includes('-c') ? StickerTypes.CROPPED : Stype
    if (arg.includes('-nobg')) {
        const base64 = mediaData.toString('base64')
        const res = await removeBackgroundFromImageBase64({
            base64img: base64,
            apiKey: lodash.sample(
                process.env.REMOVEBG_APIKEY!.split(', ')
            ) as string,
            size: 'auto',
        })
        mediaData = Buffer.from(res.base64img, 'base64')
    }
    const argMeta = arg.replace(/-r|-c|-nobg/g, '').trim()
    const packname = argMeta.split('|')[0] || process.env.PACKNAME!
    const author = argMeta.split('|')[1] || process.env.AUTHOR!

    if (isImage || isQuotedImage) {
        const sticker = new Sticker(mediaData, {
            pack: packname,
            author: author,
            type: Stype,
            quality: 100,
        })
        ctx.reactSuccess()
        await replySticker(await sticker.toBuffer())
    }

    if (isVideo || isQuotedVideo) {
        await processVideo(wa, msg, mediaData, ctx, packname, author, Stype)
    }
}

const processVideo = async (
    wa: WASocket,
    msg: WAMessage,
    mediaData: Buffer,
    ctx: MessageContext,
    packname: string,
    author: string,
    Stype: StickerTypes
) => {
    const seconds =
        msg.message?.videoMessage?.seconds ||
        ctx.quotedMsg?.videoMessage?.seconds ||
        0
    const videoLimit = 10
    if (seconds >= videoLimit)
        throw new Error(stringId.sticker.error.videoLimit(videoLimit))

    let quality = 80
    const doConvert = (q: number) => {
        return new Sticker(mediaData, {
            pack: packname,
            author: author,
            type: Stype,
            quality: q,
        }).toBuffer()
    }

    let resultBuffer = await doConvert(quality)
    let isSendNotif = false
    let msgKey: proto.IMessageKey | undefined
    const STICKER_ANIMATED_LIMIT = 1024 * 1024 // WA limit only max 1 MB for animated sticker
    while (resultBuffer.length > STICKER_ANIMATED_LIMIT) {
        if (!isSendNotif) {
            const msgInfo = await wa.sendMessage(
                ctx.from,
                {
                    text: stringId.sticker.error.quality(quality),
                },
                {
                    ephemeralExpiration: ctx.expiration!,
                }
            )
            msgKey = msgInfo?.key
            isSendNotif = true
        } else {
            const garbage =
                quality == 30
                    ? '. At this point, the sticker may look like garbage.'
                    : ''
            wa.sendMessage(ctx.from, {
                edit: msgKey,
                text: stringId.sticker.error.q(quality) + garbage,
            })
        }

        if (quality == 5) throw new Error(stringId.sticker.error.fail())
        if (quality == 10) quality = 5
        else quality -= 10
        resultBuffer = await doConvert(quality)
    }

    if (isSendNotif) {
        wa.sendMessage(ctx.from, {
            edit: msgKey,
            text: stringId.sticker.success?.(quality) || '',
        })
    }

    ctx.reactSuccess()
    await ctx.replySticker(resultBuffer)
}

const ttpHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, args, cmd, isQuoted, isMedia, replySticker } = ctx
    if ((!arg && !isQuoted) || isMedia) throw new Error(stringId.ttp.usage(ctx))
    ctx.reactWait()
    const text =
        arg ||
        ctx.quotedMsg?.conversation ||
        ctx.quotedMsg?.extendedTextMessage?.text ||
        ''
    const textLimit = 100
    if (text.length > textLimit)
        throw new Error(stringId.ttp.error.textLimit(textLimit))

    let image: Buffer
    if (cmd === 'ttpc') {
        const col = args[0].split('|')[0]
        const col2 = args[0].split('|')[1] || col
        const col3 = args[0].split('|')[2] || 'black'
        image = await textToPicture(text.replace(args[0], ''), col, col2, col3)
    } else {
        image = await textToPicture(text)
    }
    const sticker = await new Sticker(image, {
        pack: process.env.PACKNAME!,
        author: process.env.AUTHOR!,
        type: StickerTypes.FULL,
        quality: 100,
    }).toFile('tmp/sticker-ttp.webp')
    ctx.reactSuccess()
    await replySticker({ url: sticker })
}

const memefyHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, cmd, isQuoted, isQuotedSticker, isMedia, replySticker } = ctx
    let _arg = arg
    if (!_arg && !isQuoted && !isQuotedSticker && !isMedia)
        throw new Error(stringId.memefy.usage(ctx))
    ctx.reactWait()

    const textLimit = 30
    if (_arg.length > textLimit)
        throw new Error(stringId.memefy.error.textLimit(textLimit))

    let image: Buffer
    if (isQuotedSticker) image = await ctx.downloadSticker()
    else image = isQuoted ? await ctx.downloadQuoted() : await ctx.download()

    const simage = await sharp(image).png()
    if (_arg.includes('-c')) simage.resize(512, 512)
    _arg = _arg.replace('-c', '')
    image = await simage.toBuffer()

    const top = _arg.trim().split('|')[0] || '_'
    const bottom = _arg.trim().split('|')[1] || '_'

    const uploadedImageUrl = await uploadImage(image)
    const memeBuffer = await memegen(top, bottom, uploadedImageUrl)

    if (cmd === 'memefy') {
        ctx.reactSuccess()
        await ctx.replyContent({ image: memeBuffer })
    }

    if (cmd === 'sm') {
        const sticker = await new Sticker(memeBuffer, {
            pack: process.env.PACKNAME!,
            author: process.env.AUTHOR!,
            type: StickerTypes.FULL,
            quality: 100,
        }).toBuffer()
        ctx.reactSuccess()
        await replySticker(sticker)
    }
}

const downloadStickerHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedSticker, replyContent } = ctx
    if (!isQuotedSticker) throw new Error(stringId.dls.usage(ctx))
    ctx.reactWait()
    let sticker = await ctx.downloadQuoted()

    const isAnimated = sticker.toString('utf-8').includes('ANMF')
    if (isAnimated) {
        const gif = await sharp(sticker, { animated: true }).gif().toBuffer()
        const mp4 = await gifToMp4(gif)
        await replyContent({ video: { url: mp4 } })
        fs.unlink(mp4, (_) => _)
    } else {
        sticker = await sharp(sticker).png().toBuffer()
        await replyContent({ image: sticker })
    }
    ctx.reactSuccess()
}
