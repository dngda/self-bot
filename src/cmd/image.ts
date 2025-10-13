import { WAMessage, WASocket } from 'baileys'
import sharp from 'sharp'
import { actions } from '../handler.js'
import stringId from '../language.js'
import {
    BACKGROUND_BLUR,
    COLOR_ENHANCE,
    FACE_LIFTING,
    Remini,
    removeWm,
    upscaleImage,
} from '../lib/_index.js'
import { Settings } from '../lib/types'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'

export default () => {
    flipImageCmd()
    reminiCmd()
    upscaleImageCmd()
    removeWmCmd()
    rwmHdCmd()
}

const flipImageCmd = () => {
    stringId.flip = {
        hint: '🖼️ _flip = vertikal, flop = horizontal_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n➡️ ${ctx.prefix}flip atau ${ctx.prefix}flop`,
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

const flipHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, cmd, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.flip.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = sharp(mediaData)

    ctx.reactSuccess()
    if (cmd === 'flip')
        return ctx.replyContent({ image: await image.flip().toBuffer() })
    if (cmd === 'flop')
        return ctx.replyContent({ image: await image.flop().toBuffer() })
    return undefined
}

const reminiCmd = () => {
    stringId.remini = {
        hint: '🖼️ _Mengubah gambar menjadi HD dengan remini.ai_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) => `🖼️ Options
Face Enhance:
- default: Remini
- v1: Remini + pre blur
- v2: Gfpgan
- none: none
Bokeh: low, med, high
Face Lifting: movie, glam, natural, cute, silk, charm
Color Enhance: golden, steady, balanced, orange, silky, muted, teal, softwarm
🖼️ Kirim gambar dengan caption atau reply gambar dengan\n➡️ ${ctx.prefix}${ctx.cmd} [options...]`,
    }

    menu.push({
        command: 'remini',
        hint: stringId.remini.hint,
        alias: 'rhd',
        type: 'images',
    })

    Object.assign(actions, {
        remini: reminiHandler,
    })
}

const reminiHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
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
        return ctx.reply(stringId.remini.usage(ctx))
    ctx.reactWait()
    const mediaData = isQuoted ? await downloadQuoted() : await download()

    const options: Partial<Settings> = {}
    options.face_enhance = { model: 'remini' }
    if (args.includes('v1'))
        options.face_enhance = { model: 'remini', pre_blur: 1.8 }
    if (args.includes('v2')) options.face_enhance = { model: 'gfpgan' }
    if (args.includes('none')) options.face_enhance = { model: undefined }

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

    ctx.reactSuccess()
    return ctx.replyContent({ image: { url: image.no_wm } })
}

const upscaleImageCmd = () => {
    stringId.upscale = {
        hint: '🖼️ _Mengubah gambar menjadi HD dengan pixelcut.ai_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'upscale',
        hint: stringId.upscale.hint,
        alias: 'hd',
        type: 'images',
    })

    Object.assign(actions, {
        upscale: upscaleHandler,
    })
}

const upscaleHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.upscale.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = await upscaleImage(mediaData)

    ctx.reactSuccess()
    return ctx.replyContent({ image: { url: image.result_url } })
}

const removeWmCmd = () => {
    stringId.removeWm = {
        hint: '🖼️ _Menghapus watermark pada gambar_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'removewm',
        hint: stringId.removeWm.hint,
        alias: 'rwm',
        type: 'images',
    })

    Object.assign(actions, {
        removewm: removeWmHandler,
    })
}

const removeWmHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.removeWm.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = await removeWm(mediaData)
    ctx.reactSuccess()
    return ctx.replyContent({ image: { url: image.output[0] } })
}

const rwmHdCmd = () => {
    stringId.rwmHd = {
        hint: '🖼️ _Menghapus watermark dan buat gambar HD_',
        error: {
            noImage: () => '‼️ Gambar tidak ditemukan!',
        },
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n➡️ ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'rwmhd',
        hint: stringId.rwmHd.hint,
        alias: 'rwmhd',
        type: 'images',
    })

    Object.assign(actions, {
        rwmhd: rwmHdHandler,
    })
}

const rwmHdHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedImage, isImage, download, downloadQuoted } = ctx
    if (!isImage && !isQuotedImage)
        throw new Error(stringId.rwmHd.error.noImage())
    ctx.reactWait()
    const mediaData = isQuotedImage ? await downloadQuoted() : await download()
    const image = await removeWm(mediaData)
    const wget = await fetch(image.output[0])
    if (!wget.ok) throw new Error('‼️ Gagal mengunduh gambar!')
    const arrayBuffer = await wget.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const hdImage = await upscaleImage(buffer)

    ctx.reactSuccess()
    return ctx.replyContent({ image: { url: hdImage.result_url } })
}
