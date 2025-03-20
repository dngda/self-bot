import {
    WAMessage,
    WASocket
} from '@whiskeysockets/baileys'
import sharp from 'sharp'
import { actions } from '../handler'
import stringId from '../language'
import {
    Remini
} from '../lib/_index'
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
        usage: (ctx: MessageContext) =>
            `🖼️ Kirim gambar dengan caption atau reply gambar dengan\n ➡️ ${ctx.prefix}makehd`,
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
    } = ctx
    if (!isImage && !isQuotedImage && !isQuotedDocument)
        throw new Error(stringId.makeHd.error.noImage())
    ctx.reactWait()
    const mediaData = isQuoted ? await downloadQuoted() : await download()
    const image = await Remini(mediaData)
    if (!image) throw new Error('‼️ Gagal membuat gambar HD!')
    await waSocket.sendMessage(
        ctx.from,
        { image: { url: image.no_wm } },
        { quoted: msg }
    )
    ctx.reactSuccess()
}
