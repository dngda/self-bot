import axios from 'axios'
import FormData from 'form-data'
import ocrApi from 'ocr-space-api-wrapper'
import fs from 'fs'

export async function uploadImage(imageBuffer: Buffer): Promise<string> {
    const formData = new FormData()
    formData.append('file', imageBuffer, 'tmp.jpg')

    const response = await axios.post('https://tmpfiles.org/api/v1/upload', formData, {
        headers: formData.getHeaders(),
    })

    const {
        data: { url: fileUrl },
    } = response.data

    return fileUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/')
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
