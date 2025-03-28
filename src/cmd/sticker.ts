import { WAMessage, WASocket, proto } from '@whiskeysockets/baileys'
import fs from 'fs'
import lodash from 'lodash'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import sharp from 'sharp'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { actions } from '../handler'
import stringId from '../language'
import {
    gifToMp4,
    memegen,
    textToPicture,
    uploadImage,
    quotely,
    getPushName,
} from '../lib/_index'
import { menu } from '../menu'
import { MessageContext } from '../types'

export default () => {
    textToStickerCmd()
    stickerCreatorCmd()
    addTextToImageCmd()
    downloadStickerCmd()
    quotelyStickerCmd()
}

const stickerCreatorCmd = () => {
    stringId.sticker = {
        hint: '🖼️ _Convert media to sticker_',
        error: {
            videoLimit: (s: number) =>
                `‼️ Video is too long, maximum ${s} seconds`,
            quality: (q: number) =>
                `⚠️ Result exceeded 1 MB with Q: ${q}%\n⏳ Hold on, decreasing quality...`,
            q: (q: number) => `⏳ Q: ${q}% still not yet...`,
            fail: () =>
                `‼️ Failed to convert video to sticker, try reducing the duration.`,
        },
        usage: (ctx: MessageContext) =>
            `Send image/video or reply image/video with caption ${ctx.prefix}${ctx.cmd}
⚙️ Use: '-r' rounded corner, '-c' square cropped, '-nobg' remove bg,
⚙️ Custom packname/author with args 'packname|author',
➡️ Example: ${ctx.prefix}${ctx.cmd} -r -nobg created with|serobot✨`,
        success: (q: number) => `✅ Success with Quality: ${q}%`,
    }

    menu.push({
        command: 'sticker',
        hint: stringId.sticker.hint,
        alias: 's, stiker',
        type: 'sticker',
    })

    Object.assign(actions, {
        sticker: stickerHandler,
    })
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
            text: stringId.sticker.success?.(quality) as string,
        })
    }

    ctx.reactSuccess()
    await ctx.replySticker(resultBuffer)
}

const textToStickerCmd = () => {
    stringId.tts = {
        hint: '🖼️ _Convert text to sticker_',
        error: {
            textLimit: (s: number) =>
                `‼️ Text is too long, maximum ${s} characters`,
        },
        usage: (ctx: MessageContext) =>
            `Add text or reply text with ${ctx.prefix}${ctx.cmd} <text>\n` +
            `➡️ Example: ${ctx.prefix}make Serobot\n` +
            `Custom color with args 'color1|color2|strokecolor'\n` +
            `➡️ Example: ${ctx.prefix}makec red|blue|white Serobot`,
    }

    menu.push({
        command: 'makec',
        hint: stringId.tts.hint,
        alias: 'make',
        type: 'sticker',
    })

    Object.assign(actions, {
        makec: ttpHandler,
    })
}

const ttpHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, args, cmd, isQuoted, isMedia, replySticker } = ctx
    if ((!arg && !isQuoted) || isMedia) throw new Error(stringId.tts.usage(ctx))
    ctx.reactWait()
    const text =
        arg ||
        ctx.quotedMsg?.conversation ||
        ctx.quotedMsg?.extendedTextMessage?.text ||
        ''
    const textLimit = 100
    if (text.length > textLimit)
        throw new Error(stringId.tts.error.textLimit(textLimit))

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

const addTextToImageCmd = () => {
    stringId.memefy = {
        hint: '🖼️ _Add text to image/sticker_',
        error: {
            textLimit: (s: number) =>
                `‼️ Text is too long, maximum ${s} characters`,
        },
        usage: (ctx: MessageContext) =>
            `Add text or reply image/sticker with ${ctx.prefix}${ctx.cmd} <top|bottom>\n` +
            `⚙️ Use: '-c' square cropped`,
    }

    menu.push({
        command: 'memefy',
        hint: stringId.memefy.hint,
        alias: 'sm',
        type: 'sticker',
    })

    Object.assign(actions, {
        memefy: memefyHandler,
    })
}

const memefyHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, cmd, isQuoted, isQuotedSticker, isMedia, replySticker } = ctx
    if (!arg && !isQuoted && !isQuotedSticker && !isMedia)
        throw new Error(stringId.memefy.usage(ctx))
    ctx.reactWait()

    const textLimit = 30
    if (arg.length > textLimit)
        throw new Error(stringId.memefy.error.textLimit(textLimit))

    let image: Buffer
    if (isQuotedSticker) image = await ctx.downloadSticker()
    else image = isQuoted ? await ctx.downloadQuoted() : await ctx.download()

    let _arg = arg
    const simage = await sharp(image).png()
    if (arg.includes('-c') || arg.includes('-r')) simage.resize(512, 512)
    _arg = _arg.replace('-c', '').replace('-r', '')
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
        let type = StickerTypes.FULL
        if (arg.includes('-r')) type = StickerTypes.ROUNDED
        const sticker = await new Sticker(memeBuffer, {
            pack: process.env.PACKNAME!,
            author: process.env.AUTHOR!,
            type,
            quality: 100,
        }).toBuffer()
        ctx.reactSuccess()
        await replySticker(sticker)
    }
}

const downloadStickerCmd = () => {
    stringId.dls = {
        hint: '💾 _Download sticker_',
        error: {
            notSticker: () => `‼️ This is not a sticker`,
        },
        usage: (ctx: MessageContext) =>
            `Reply sticker with ${ctx.prefix}${ctx.cmd}`,
    }

    menu.push({
        command: 'sdl',
        hint: stringId.dls.hint,
        alias: 'toimg, tomedia',
        type: 'sticker',
    })

    Object.assign(actions, {
        sdl: downloadStickerHandler,
    })
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

const quotelyStickerCmd = () => {
    stringId.quote = {
        hint: '🖼️ _Create sticker from message bubble_',
        error: {
            textLimit: (s: number) =>
                `‼️ Text is too long, maximum ${s} characters`,
        },
        usage: (ctx: MessageContext) =>
            `Add text or reply msg with ${ctx.prefix}${ctx.cmd} <text>\n`,
    }

    menu.push({
        command: 'quotely',
        hint: stringId.quote.hint,
        alias: 'qc',
        type: 'sticker',
    })

    Object.assign(actions, {
        quotely: quotelyHandler,
    })
}

const quotelyHandler = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, isQuoted, replySticker, name } = ctx
    if ((!arg && !isQuoted) || arg.length > 100)
        throw new Error(stringId.quote.usage(ctx))
    ctx.reactWait()
    const text = arg.includes('|')
        ? arg.split('|')[0]
        : arg || ctx.quotedMsg?.conversation || ''
    const avatar = await _wa.profilePictureUrl(
        isQuoted
            ? ctx.contextInfo?.participant || ctx.from
            : ctx.participant || ctx.from
    )

    const pushname = isQuoted
        ? getPushName(ctx.contextInfo?.participant || ctx.from) ||
          '+' + ctx.from.split('@')[0]
        : arg.includes('|')
        ? arg.split('|')[1]
        : name!

    const quoteRes = await quotely(pushname, text, avatar)
    const sticker = await new Sticker(Buffer.from(quoteRes.image, 'base64'), {
        pack: process.env.PACKNAME!,
        author: process.env.AUTHOR!,
        type: StickerTypes.FULL,
        quality: 100,
    }).toBuffer()

    ctx.reactSuccess()
    await replySticker(sticker)
}
