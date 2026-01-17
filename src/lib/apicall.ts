import axios from 'axios'
import FormData from 'form-data'
import ocrApi from 'ocr-space-api-wrapper'
import fs from 'fs'

export type LyricsApiResponse = {
    status: boolean
    data: LyricsApiData | null
}

export type LyricsApiData = {
    artist_name: string
    track_name: string
    track_id: number
    search_engine: string
    artwork_url: string
    lyrics: string
}

interface ILyricsApi {
    musixmatchWithTitle(title: string): Promise<LyricsApiResponse>
    musixmatchWithArtist(
        title: string,
        artist: string
    ): Promise<LyricsApiResponse>
}

export const LyricsApi: ILyricsApi = (() => {
    const BASE_URL = 'https://lyrics.lewdhutao.my.eu.org/'

    return {
        async musixmatchWithTitle(title: string): Promise<LyricsApiResponse> {
            const res = await axios.get(
                `${BASE_URL}musixmatch/lyrics?title=${encodeURIComponent(
                    title
                )}`
            )

            if (res.data.status === 'error') {
                return {
                    status: false,
                    data: null,
                }
            }

            return {
                status: true,
                data: res.data as LyricsApiData,
            }
        },

        async musixmatchWithArtist(
            title: string,
            artist: string
        ): Promise<LyricsApiResponse> {
            const res = await axios.get(
                `${BASE_URL}musixmatch/lyrics-search?title=${encodeURIComponent(
                    title
                )}&artist=${encodeURIComponent(artist)}`
            )

            if (res.data.status === 'error') {
                return {
                    status: false,
                    data: null,
                }
            }

            return {
                status: true,
                data: res.data.data as LyricsApiData,
            }
        },
    }
})()

export const EmojiApi = {
    async kitchen(emojiFirst: string, emojiSecond: string) {
        const url = `https://emojik.vercel.app/s/${emojiFirst}_${emojiSecond}?size=128`

        // --- terima data biner ---
        const res = await axios.get<ArrayBuffer>(url, {
            responseType: 'arraybuffer',
            validateStatus: () => true, // supaya JSON error ≤400 tetap lewat
        })

        // --- handle error ---
        if (res.headers['content-type']?.includes('application/json')) {
            const err = JSON.parse(Buffer.from(res.data).toString())
            return { status: false, data: err }
        }

        const buf = Buffer.from(res.data)

        return { status: true, data: buf }
    },
}

export async function uploadImage(imageBuffer: Buffer): Promise<string> {
    const formData = new FormData()
    formData.append('image', imageBuffer, 'tmp.png')

    const response = await axios.post(
        'https://api.imgbb.com/1/upload',
        formData,
        {
            headers: formData.getHeaders(),
            params: {
                key: process.env.IMGBB_API_KEY!,
                expiration: 100,
            },
        }
    )

    const {
        data: { url },
    } = response.data
    return url
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
