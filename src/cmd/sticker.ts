import { WAMessage, WASocket, proto } from 'baileys'
import fs from 'node:fs'
import lodash from 'lodash'
import { removeBackgroundFromImageBase64 } from 'remove.bg'
import sharp from 'sharp'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import { actions } from '../handler.js'
import stringId from '../language.js'
import {
    gifToMp4,
    memegen,
    textToPicture,
    uploadImage,
    quotly,
    getPushName,
    EmojiApi,
    apngToWebp,
} from '../lib/_index.js'
import { menu } from '../menu.js'
import { HandlerFunction, MessageContext } from '../types.js'

export default function registerStickerCommands() {
    textToStickerCmd()
    stickerCreatorCmd()
    addTextToImageCmd()
    downloadStickerCmd()
    quotlyStickerCmd()
    emojiKitchenCmd()
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

const fetchMediaFromUrl = async (
    url: string
): Promise<{ mediaData: Buffer; isVideo: boolean; isImage: boolean }> => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const arrayBuffer = await response.arrayBuffer()
    let mediaData = Buffer.from(arrayBuffer)

    const contentType = response.headers.get('content-type') || ''
    const isVideo = contentType.includes('video')
    const isImage = contentType.includes('image')

    if (
        isImage &&
        (contentType.includes('png') || url.toLowerCase().endsWith('.png'))
    ) {
        const isAPNG = mediaData.toString('utf-8').includes('acTL')
        if (isAPNG) {
            mediaData = (await apngToWebp(mediaData)) as Buffer<ArrayBuffer>
        }
    }

    return { mediaData, isVideo, isImage }
}

const processQuotedSticker = async (
    mediaData: Buffer
): Promise<{ mediaData: Buffer; isVideo: boolean; isImage: boolean }> => {
    const isAnimated = mediaData.toString('utf-8').includes('ANMF')
    if (isAnimated) {
        const gif = await sharp(mediaData, { animated: true }).gif().toBuffer()
        const path = await gifToMp4(gif)
        mediaData = fs.readFileSync(path)
        fs.unlinkSync(path)
        return { mediaData, isVideo: true, isImage: false }
    }
    mediaData = await sharp(mediaData).png().toBuffer()
    return { mediaData, isVideo: false, isImage: true }
}

const removeBackgroundIfNeeded = async (
    mediaData: Buffer,
    arg: string,
    isImage: boolean,
    isQuotedImage: boolean
): Promise<Buffer> => {
    if (arg.includes('-nobg') && (isImage || isQuotedImage)) {
        const base64 = mediaData.toString('base64')
        const res = await removeBackgroundFromImageBase64({
            base64img: base64,
            apiKey: lodash.sample(
                process.env.REMOVEBG_APIKEY!.split(', ')
            ) as string,
            size: 'auto',
        })
        return Buffer.from(res.base64img, 'base64')
    }
    return mediaData
}

const getStickerType = (arg: string): StickerTypes => {
    if (arg.includes('-c')) return StickerTypes.CROPPED
    if (arg.includes('-r')) return StickerTypes.ROUNDED
    return StickerTypes.FULL
}

const fetchMediaFromUrlIfNeeded = async (
    ctx: MessageContext,
    isMedia: boolean,
    isQuoted: boolean,
    arg: string
): Promise<{
    mediaData: Buffer | undefined
    isVideo: boolean
    isImage: boolean
    isFromUrl: boolean
}> => {
    if (isMedia || isQuoted || !arg) {
        return {
            mediaData: undefined,
            isVideo: false,
            isImage: false,
            isFromUrl: false,
        }
    }

    const urlRegex = /https?:\/\/[^\s]+/i
    const urlMatch = urlRegex.exec(arg)

    if (!urlMatch) {
        return {
            mediaData: undefined,
            isVideo: false,
            isImage: false,
            isFromUrl: false,
        }
    }

    ctx.reactWait()
    try {
        const url = urlMatch[0]
        const result = await fetchMediaFromUrl(url)
        return {
            mediaData: result.mediaData,
            isVideo: result.isVideo,
            isImage: result.isImage,
            isFromUrl: true,
        }
    } catch (error) {
        throw new Error(
            `Failed to fetch from URL: ${
                error instanceof Error ? error.message : error
            }`
        )
    }
}

const downloadMediaIfNeeded = async (
    ctx: MessageContext,
    isFromUrl: boolean,
    isQuoted: boolean,
    isQuotedSticker: boolean
): Promise<{
    mediaData: Buffer
    isVideo: boolean
    isImage: boolean
}> => {
    if (isFromUrl) {
        throw new Error('Media already fetched from URL')
    }

    ctx.reactWait()
    const mediaData = isQuoted
        ? await ctx.downloadQuoted()
        : await ctx.download()

    if (isQuotedSticker) {
        return await processQuotedSticker(mediaData)
    }

    return { mediaData, isVideo: false, isImage: false }
}

const stickerHandler: HandlerFunction = async (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => {
    const {
        arg,
        isMedia,
        isQuoted,
        isQuotedImage,
        isQuotedSticker,
        isQuotedVideo,
        replySticker,
    } = ctx
    let { isVideo, isImage } = ctx

    const urlResult = await fetchMediaFromUrlIfNeeded(
        ctx,
        isMedia ?? false,
        isQuoted ?? false,
        arg
    )
    let mediaData = urlResult.mediaData
    const isFromUrl = urlResult.isFromUrl

    if (urlResult.isFromUrl) {
        isVideo = urlResult.isVideo
        isImage = urlResult.isImage
    }

    if (!isMedia && !isFromUrl) throw new Error(stringId.sticker.usage(ctx))

    if (!isFromUrl) {
        const downloadResult = await downloadMediaIfNeeded(
            ctx,
            isFromUrl,
            isQuoted ?? false,
            isQuotedSticker ?? false
        )
        mediaData = downloadResult.mediaData
        if (isQuotedSticker) {
            isVideo = downloadResult.isVideo
            isImage = downloadResult.isImage
        }
    }

    const Stype = getStickerType(arg)
    mediaData = await removeBackgroundIfNeeded(
        mediaData!,
        arg,
        isImage ?? false,
        isQuotedImage ?? false
    )

    const argMeta = arg
        .replaceAll(/-r|-c|-nobg/g, '')
        .replaceAll(/https?:\/\/[^\s]+/gi, '')
        .trim()

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
        return replySticker(await sticker.toBuffer())
    }

    if (isVideo || isQuotedVideo) {
        return processVideo(wa, msg, mediaData, ctx, packname, author, Stype)
    }
    return undefined
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
        if (isSendNotif) {
            const trash =
                quality == 30
                    ? '. At this point, the sticker may look like trash.'
                    : ''
            wa.sendMessage(ctx.from, {
                edit: msgKey,
                text: stringId.sticker.error.q(quality) + trash,
            })
        } else {
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
    return ctx.replySticker(resultBuffer)
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
        command: 'make',
        hint: stringId.tts.hint,
        alias: 'makec',
        type: 'sticker',
    })

    Object.assign(actions, {
        make: ttpHandler,
    })
}

const ttpHandler: HandlerFunction = async (
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
    return replySticker({ url: sticker })
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

const memefyHandler: HandlerFunction = async (
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
    const simage = sharp(image).png()
    if (arg.includes('-c') || arg.includes('-r')) simage.resize(512, 512)
    _arg = _arg.replace('-c', '').replace('-r', '')
    image = await simage.toBuffer()

    const top = _arg.trim().split('|')[0] || '_'
    const bottom = _arg.trim().split('|')[1] || '_'

    const uploadedImageUrl = await uploadImage(image)
    const memeBuffer = await memegen(top, bottom, uploadedImageUrl)

    if (cmd === 'memefy') {
        ctx.reactSuccess()
        return ctx.replyContent({ image: memeBuffer })
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
        return replySticker(sticker)
    }
    return undefined
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
        command: 'toimg',
        hint: stringId.dls.hint,
        alias: 'tomedia',
        type: 'sticker',
    })

    Object.assign(actions, {
        toimg: downloadStickerHandler,
    })
}

const downloadStickerHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { isQuotedSticker, replyContent } = ctx
    if (!isQuotedSticker) throw new Error(stringId.dls.usage(ctx))
    ctx.reactWait()
    let sticker = await ctx.downloadQuoted()

    if (ctx.quotedMsg?.stickerMessage?.isAnimated) {
        const gif = await sharp(sticker, { animated: true }).gif().toBuffer()
        const mp4 = await gifToMp4(gif)

        ctx.reactSuccess()
        const sent = await replyContent({ video: { url: mp4 } })
        fs.unlink(mp4, (_) => _)
        return sent
    } else {
        sticker = await sharp(sticker).png().toBuffer()

        ctx.reactSuccess()
        return replyContent({ image: sticker })
    }
}

const quotlyStickerCmd = () => {
    stringId.quote = {
        hint: '🖼️ _Create sticker from message bubble_',
        error: {
            textLimit: (s: number) =>
                `‼️ Text is too long, maximum ${s} characters`,
            noText: () => `‼️ No text found`,
        },
        usage: (ctx: MessageContext) =>
            `Add text or reply msg with ${ctx.prefix}${ctx.cmd} <text>\n`,
    }

    menu.push({
        command: 'quotly',
        hint: stringId.quote.hint,
        alias: 'qc',
        type: 'sticker',
    })

    Object.assign(actions, {
        quotly: quotlyHandler,
    })
}

const getQuotlyParticipant = (ctx: MessageContext): string => {
    if (ctx.fromMe && !ctx.isQuoted) {
        return process.env.OWNER_JID!
    }
    return ctx.contextInfo?.participant || ctx.participant || ctx.from
}

const getQuotlyAvatar = async (
    wa: WASocket,
    participant: string
): Promise<string> => {
    try {
        return (
            (await wa.profilePictureUrl(participant)) ||
            'https://i.ibb.co.com/zTtYZSQR/pl.png'
        )
    } catch {
        // Profile picture not available, use default
        return 'https://i.ibb.co.com/zTtYZSQR/pl.png'
    }
}

const getQuotlyMedia = async (
    ctx: MessageContext,
    isQuotedImage: boolean,
    isQuotedSticker: boolean
): Promise<Buffer | null> => {
    if (isQuotedImage) {
        return await ctx.downloadQuoted()
    }
    if (isQuotedSticker) {
        return await ctx.downloadSticker()
    }
    return null
}

const wrapText = (text: string, maxLength: number): string => {
    const lines: string[] = []
    let currentLine = ''

    for (const word of text.split(' ')) {
        if (currentLine.length + word.length + 1 > maxLength) {
            lines.push(currentLine)
            currentLine = word
        } else {
            currentLine += (currentLine ? ' ' : '') + word
        }
    }

    lines.push(currentLine)
    return lines.join('\n')
}

const quotlyHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, isQuoted, replySticker, isQuotedImage, isQuotedSticker } = ctx
    if ((!arg && !isQuoted) || arg.length > 100)
        throw new Error(stringId.quote.usage(ctx))
    ctx.reactWait()

    const text = arg?.split('|')[0]?.trim() || ctx.quotedMsgBody || ''
    if (!text && !isQuotedImage && !isQuotedSticker)
        throw new Error(stringId.quote.error.noText())
    if (text.length > 100) throw new Error(stringId.quote.error.textLimit(100))

    const participant = getQuotlyParticipant(ctx)
    const pushname =
        arg?.split('|')[1]?.trim() ||
        getPushName(participant) ||
        `+${participant.split('@')[0]}`

    const avatar = await getQuotlyAvatar(_wa, participant)
    const media = await getQuotlyMedia(
        ctx,
        isQuotedImage ?? false,
        isQuotedSticker ?? false
    )

    let mediaUrl = ''
    if (media) {
        mediaUrl = await uploadImage(media)
    }

    const formattedText = wrapText(text, 20)

    const quoteRes = await quotly(pushname, formattedText, avatar, mediaUrl)
    const sticker = await new Sticker(Buffer.from(quoteRes.image, 'base64'), {
        pack: process.env.PACKNAME!,
        author: process.env.AUTHOR!,
        type: StickerTypes.FULL,
        quality: 100,
    }).toBuffer()

    ctx.reactSuccess()
    return replySticker(sticker)
}

const emojiKitchenCmd = () => {
    stringId.emojiKitchen = {
        hint: '🍔 _Create sticker from two emojis_',
        error: {
            notEmoji: () => `‼️ Please use two emojis`,
        },
        usage: (ctx: MessageContext) =>
            `Add 2 emojis with ${ctx.prefix}${ctx.cmd} <emoji1><emoji2>\n` +
            `➡️ Example: ${ctx.prefix}${ctx.cmd} 🤣🐱`,
    }

    menu.push({
        command: 'combine',
        hint: stringId.emojiKitchen.hint,
        alias: 'c',
        type: 'sticker',
    })

    Object.assign(actions, {
        combine: emojiKitchenHandler,
    })
}

const emojiKitchenHandler: HandlerFunction = async (
    _wa: WASocket,
    _msg: WAMessage,
    ctx: MessageContext
) => {
    const { arg, replySticker } = ctx
    if (!arg || arg.length < 2)
        throw new Error(stringId.emojiKitchen.usage(ctx))
    ctx.reactWait()

    const emojis = Array.from(arg).filter((e) => e.trim() !== '')
    const [emojiFirst, emojiSecond] = emojis

    if (!emojiFirst || !emojiSecond)
        throw new Error(stringId.emojiKitchen.error.notEmoji())

    const result = await EmojiApi.kitchen(emojiFirst, emojiSecond)
    if (!result.status) throw new Error(result.data.message)

    const sticker = await new Sticker(result.data, {
        pack: process.env.PACKNAME!,
        author: process.env.AUTHOR!,
        type: StickerTypes.FULL,
        quality: 100,
    }).toBuffer()

    ctx.reactSuccess()
    return replySticker(sticker)
}
