import axios from 'axios'
import FormData from 'form-data'
import ocrApi from 'ocr-space-api-wrapper'
import fs from 'fs'

export async function uploadImage(image: Buffer): Promise<string> {
    const form = new FormData()
    form.append('file', image, 'tmp.jpg')
    const res = await axios.post('https://telegra.ph/upload', form, {
        headers: {
            ...form.getHeaders(),
        },
    })
    const resJson = await res.data
    if (resJson.error) throw new Error(resJson.error)
    return `https://telegra.ph${resJson[0].src}`
}

export async function memegen(
    top: string,
    bottom: string,
    image: string
): Promise<Buffer> {
    const topText = top
        .trim()
        .replace(/\s/g, '_')
        .replace(/\?/g, '~q')
        .replace(/%/g, '~p')
        .replace(/#/g, '~h')
        .replace(/\//g, '~s')
    const bottomText = bottom
        .trim()
        .replace(/\s/g, '_')
        .replace(/\?/g, '~q')
        .replace(/%/g, '~p')
        .replace(/#/g, '~h')
        .replace(/\//g, '~s')
    const url = `https://api.memegen.link/images/custom/${topText}/${bottomText}.png?background=${image}`
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    return Buffer.from(res.data)
}

export async function ocr(language: ocrApi.OcrSpaceLanguages, image: Buffer) {
    const path = 'tmp/ocr.jpg'
    fs.writeFileSync(path, image)
    const res = await ocrApi.ocrSpace(path, {
        apiKey: process.env.OCR_API_KEY!,
        language,
    })

    fs.unlinkSync(path)
    return res
}
