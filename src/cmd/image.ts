import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import sharp from 'sharp'
import { actions } from '../handler'
import stringId from '../language'
import {
    BACKGROUND_BLUR,
    COLOR_ENHANCE,
    FACE_LIFTING,
    Remini,
} from '../lib/_index'
import { Settings } from '../lib/types'
import { menu } from '../menu'
import { MessageContext } from '../types'

export default () => {
    flipImageCmd()
    makeHdCmd()
}

const flipImageCmd = () => {
    stringId.flip = {
        hint: '🖼️ _flip = vertikal, flop = horizontal_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n ➡️ ${ctx.prefix}flip atau ${ctx.prefix}flop`,
    }

    menu.push({
        command: 'flip',
        hint: stringId.flip.hint,
        alias: 'flop',
        type: 'images',
    })

    Object.assign(actions, {
        flip: flipHandler,
    })
}

const flipHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, cmd, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.flip.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = await sharp(mediaData)
    if (cmd === 'flip')
        await waSocket.sendMessage(
            ctx.from,
            { image: await image.flip().toBuffer() },
            { quoted: msg }
        )
    if (cmd === 'flop')
        await waSocket.sendMessage(
            ctx.from,
            { image: await image.flop().toBuffer() },
            { quoted: msg }
        )
    ctx.reactSuccess()
}

const makeHdCmd = () => {
    stringId.makeHd = {
        hint: '🖼️ _Mengubah gambar menjadi HD_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) => `🖼️ Options
Face Enhance:
- base: Remini
- v1: Remini + pre blur
- v2: Gfpgan
Bokeh: low, med, high
Face Lifting: movie, glam, natural, cute, silk, charm
Color Enhance: golden, steady, balanced, orange, silky, muted, teal, softwarm
🖼️ Kirim gambar dengan caption atau reply gambar dengan\n ➡️ ${ctx.prefix}${ctx.cmd} [options...]`,
    }

    menu.push({
        command: 'makehd',
        hint: stringId.makeHd.hint,
        alias: 'hd',
        type: 'images',
    })

    Object.assign(actions, {
        makehd: makeHdHandler,
    })
}

const makeHdHandler = async (
    waSocket: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const {
        isQuotedImage,
        isImage,
        download,
        downloadQuoted,
        isQuotedDocument,
        isQuoted,
        args,
        arg,
    } = ctx
    if (!isImage && !isQuotedImage && !isQuotedDocument)
        return ctx.reply(stringId.makeHd.usage(ctx))
    ctx.reactWait()
    const mediaData = isQuoted ? await downloadQuoted() : await download()

    const options: Partial<Settings> = {}
    if (args.includes('base')) options.face_enhance = { model: 'remini' }
    if (args.includes('v1'))
        options.face_enhance = { model: 'remini', pre_blur: 1.8 }
    if (args.includes('v2')) options.face_enhance = { model: 'gfpgan' }

    const bokehMatch = arg.match(/low|med|high/gi)
    if (bokehMatch) options.bokeh = BACKGROUND_BLUR[bokehMatch[0].toUpperCase()]

    const faceMatch = arg.match(/movie|glam|natural|cute|silk|charm/gi)
    if (faceMatch)
        options.face_lifting = {
            model: FACE_LIFTING[faceMatch[0].toUpperCase()],
        }

    const colorMatch = arg.match(
        /golden|steady|balanced|orange|silky|muted|teal|softwarm/gi
    )
    if (colorMatch)
        options.color_enhance = {
            model: COLOR_ENHANCE[colorMatch[0].toUpperCase()],
        }

    const image = await Remini(mediaData, options)
    if (!image) throw new Error('‼️ Gagal membuat gambar HD!')
    await waSocket.sendMessage(
        ctx.from,
        { image: { url: image.no_wm } },
        { quoted: msg }
    )
    return ctx.reactSuccess()
}
