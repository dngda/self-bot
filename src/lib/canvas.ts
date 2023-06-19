import { createCanvas, type CanvasRenderingContext2D } from 'canvas'

export const textToPicture = async (
  text: string,
  primaryColor = 'white',
  secondaryColor = '',
  strokeColor = 'black'
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    try {
      text = text.replace(/\s/g, '\n')
      const canvas = createCanvas(512, 512)
      const ctx = canvas.getContext('2d')
      let textData = text.split('\n')

      combineShortWords(textData)
      separateLongWords(textData)

      let posisiY = calculateStartingPositionY(ctx, textData)
      let ukuranFont = calculateFontSize(ctx, textData)
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
      isDepan = textData[s - 1].length < textData[s + 1].length ? true : false
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
  let longest = textData.reduce((a, b) => {
    return a.length > b.length ? a : b
  })
  let inpText = ctx.measureText(longest)
  let ukuranFont = 150 - inpText.width - textData.length * 5
  const lineHeight = inpText.actualBoundingBoxAscent + ukuranFont
  posisiY = posisiY - ((textData.length - 1) * lineHeight) / 2
  return posisiY
}

function calculateFontSize(ctx: CanvasRenderingContext2D, textData: string[]) {
  let longest = textData.reduce((a, b) => {
    return a.length > b.length ? a : b
  })
  let inpText = ctx.measureText(longest)
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
  if (secondaryColor != '') {
    const grd = ctx.createLinearGradient(0, 0, 500, 0)
    grd.addColorStop(0, primaryColor)
    grd.addColorStop(1, secondaryColor)
    ctx.fillStyle = grd
  } else {
    ctx.fillStyle = primaryColor
  }
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = 4
}
