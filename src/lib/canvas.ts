import {
    createCanvas,
    loadImage,
    type CanvasRenderingContext2D,
} from 'canvas'

export async function createMeme(
    top: string,
    bottom: string,
    imageBuffer: Buffer
): Promise<Buffer> {
    const image = await loadImage(imageBuffer)
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext('2d')

    ctx.drawImage(image, 0, 0, image.width, image.height)

    const padding = Math.max(12, Math.round(image.width * 0.04))
    const maxWidth = image.width - padding * 2
    const fontSize = Math.max(24, Math.min(96, Math.round(image.width * 0.1)))
    const lineHeight = Math.round(fontSize * 1.05)

    ctx.font = `900 ${fontSize}px Impact, Arial Black, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = 'white'
    ctx.strokeStyle = 'black'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.08))

    drawMemeText(ctx, top, image.width / 2, padding, maxWidth, lineHeight)

    const bottomLines = wrapMemeText(ctx, bottom, maxWidth)
    const bottomY = image.height - padding - bottomLines.length * lineHeight
    drawMemeLines(ctx, bottomLines, image.width / 2, bottomY, lineHeight)

    return canvas.toBuffer('image/png')
}

function drawMemeText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
) {
    drawMemeLines(ctx, wrapMemeText(ctx, text, maxWidth), x, y, lineHeight)
}

function drawMemeLines(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    x: number,
    y: number,
    lineHeight: number
) {
    lines.forEach((line, index) => {
        const lineY = y + index * lineHeight
        ctx.strokeText(line, x, lineY)
        ctx.fillText(line, x, lineY)
    })
}

function wrapMemeText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const normalizedText = text.trim().replaceAll('_', '').toUpperCase()
    if (!normalizedText) return []

    const words = normalizedText.split(/\s+/)
    const lines: string[] = []
    let line = ''

    for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
            if (line) lines.push(line)
            line = ''
            let chunk = ''
            for (const character of word) {
                const candidate = `${chunk}${character}`
                if (ctx.measureText(candidate).width > maxWidth && chunk) {
                    lines.push(chunk)
                    chunk = character
                } else {
                    chunk = candidate
                }
            }
            line = chunk
            continue
        }

        const candidate = line ? `${line} ${word}` : word
        if (ctx.measureText(candidate).width <= maxWidth) {
            line = candidate
            continue
        }

        if (line) lines.push(line)
        line = word
    }

    if (line) lines.push(line)
    return lines
}

export const textToPicture = async (
    text: string,
    primaryColor = 'white',
    secondaryColor = '',
    strokeColor = 'black'
): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        try {
            text = text.replaceAll(/\s/g, '\n')
            const canvas = createCanvas(512, 512)
            const ctx = canvas.getContext('2d')
            const textData = text.split('\n')

            combineShortWords(textData)
            separateLongWords(textData)

            const posisiY = calculateStartingPositionY(ctx, textData)
            const ukuranFont = calculateFontSize(ctx, textData)
            const lineHeight = calculateLineHeight(ctx, ukuranFont)
            setCanvasStyles(
                ctx,
                primaryColor,
                secondaryColor,
                strokeColor,
                ukuranFont
            )

            textData.forEach((data, i) => {
                ctx.strokeText(data, 256, posisiY + i * lineHeight, 500)
                ctx.fillText(data, 256, posisiY + i * lineHeight, 500)
            })

            resolve(canvas.toBuffer())
        } catch (err) {
            reject(err)
        }
    })

function combineShortWords(textData: string[]) {
    let s = 0
    do {
        s = textData.findIndex((n) => n.length < 5)
        let isDepan = false
        if (s > 0 && s != textData.length - 1 && s != -1) {
            isDepan = textData[s - 1].length < textData[s + 1].length
        }
        if (s > 0 && s != textData.length - 1 && isDepan && s != -1) {
            const gabungan = `${textData[s - 1]} ${textData[s]}`
            textData.splice(s - 1, 2, gabungan)
        } else if (s != textData.length - 1 && !isDepan && s != -1) {
            const gabungan = `${textData[s]} ${textData[s + 1]}`
            textData.splice(s, 2, gabungan)
        } else if (s == textData.length - 1) {
            s = -1
        }
    } while (s != -1)
}

function separateLongWords(textData: string[]) {
    let p = -1
    do {
        p = textData.findIndex((n) => n.length > 15)
        if (p != -1) {
            const pisahan = textData[p].match(/.{1,14}/g)!
            textData.splice(p, 1, pisahan[0], pisahan[1])
        }
    } while (p != -1)
}

function calculateStartingPositionY(
    ctx: CanvasRenderingContext2D,
    textData: string[]
) {
    let posisiY = 256
    const longest = textData.reduce((a, b) => {
        return a.length > b.length ? a : b
    }, '')
    const inpText = ctx.measureText(longest)
    const ukuranFont = 150 - inpText.width - textData.length * 5
    const lineHeight = inpText.actualBoundingBoxAscent + ukuranFont
    posisiY = posisiY - ((textData.length - 1) * lineHeight) / 2
    return posisiY
}

function calculateFontSize(ctx: CanvasRenderingContext2D, textData: string[]) {
    const longest = textData.reduce((a, b) => {
        return a.length > b.length ? a : b
    }, '')
    const inpText = ctx.measureText(longest)
    return 150 - inpText.width - textData.length * 5
}

function calculateLineHeight(ctx: CanvasRenderingContext2D, fontSize: number) {
    const lineHeight = ctx.measureText('M').actualBoundingBoxAscent + fontSize
    return lineHeight
}

function setCanvasStyles(
    ctx: CanvasRenderingContext2D,
    primaryColor: string,
    secondaryColor: string,
    strokeColor: string,
    ukuranFont: number
) {
    ctx.font = `${ukuranFont}px Nimbus Sans`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (secondaryColor === '') {
        ctx.fillStyle = primaryColor
    } else {
        const grd = ctx.createLinearGradient(0, 0, 500, 0)
        grd.addColorStop(0, primaryColor)
        grd.addColorStop(1, secondaryColor)
        ctx.fillStyle = grd
    }
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 4
}
