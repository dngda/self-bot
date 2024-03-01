import axios from 'axios'
import { getRandom } from 'random-useragent'
import fs from 'fs'

const escapeStringRegexp = (str: string) => {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a string')
    }

    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&').replace(/-/g, '\\x2d')
}

const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts'
const MAX_CHARS = 100
export const LANGUAGES: { [index: string]: string } = {
    af: 'Afrikaans',
    sq: 'Albanian',
    ar: 'Arabic',
    hy: 'Armenian',
    ca: 'Catalan',
    zh: 'Chinese',
    'zh-cn': 'Chinese (Mandarin/China)',
    'zh-tw': 'Chinese (Mandarin/Taiwan)',
    'zh-yue': 'Chinese (Cantonese)',
    hr: 'Croatian',
    cs: 'Czech',
    da: 'Danish',
    nl: 'Dutch',
    en: 'English',
    'en-au': 'English (Australia)',
    'en-uk': 'English (United Kingdom)',
    'en-us': 'English (United States)',
    eo: 'Esperanto',
    fi: 'Finnish',
    fr: 'French',
    de: 'German',
    el: 'Greek',
    ht: 'Haitian Creole',
    hi: 'Hindi',
    hu: 'Hungarian',
    is: 'Icelandic',
    id: 'Indonesian',
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    la: 'Latin',
    lv: 'Latvian',
    mk: 'Macedonian',
    no: 'Norwegian',
    pl: 'Polish',
    pt: 'Portuguese',
    'pt-br': 'Portuguese (Brazil)',
    ro: 'Romanian',
    ru: 'Russian',
    sr: 'Serbian',
    sk: 'Slovak',
    es: 'Spanish',
    'es-es': 'Spanish (Spain)',
    'es-us': 'Spanish (United States)',
    sw: 'Swahili',
    sv: 'Swedish',
    ta: 'Tamil',
    th: 'Thai',
    tr: 'Turkish',
    vi: 'Vietnamese',
    cy: 'Welsh',
}

const tokenize = (text: string): string[] => {
    if (!text) {
        throw new Error('No text to speak')
    }

    const punc = '¡!()[]¿?.,;:—«»\n '
    const puncRegex = new RegExp(
        `[${punc.split('').map(escapeStringRegexp).join('|')}]`
    )

    const parts = text.split(puncRegex).filter((p) => p.length > 0)

    const output: string[] = []
    let currentOffset = 0
    for (const part of parts) {
        if (!output[currentOffset]) {
            output[currentOffset] = ''
        }

        if (output[currentOffset].length + part.length < MAX_CHARS) {
            output[currentOffset] += ` ${part}`
        } else {
            currentOffset++
            output[currentOffset] = part
        }
    }

    output[0] = output[0].substring(1)
    return output
}

const getArgs = (
    text: string,
    index: number,
    total: number,
    lang: string
): string => {
    const textLength = text.length
    const encodedText = encodeURIComponent(text)
    const language = lang || 'en'

    return `?ie=UTF-8&tl=${language}&q=${encodedText}&total=${total}&idx=${index}&client=tw-ob&textlen=${textLength}`
}

const getHeader = () => {
    return {
        'User-Agent': getRandom(),
    }
}

type TTSOptions = {
    /** Output filepath */
    filepath: string
    /** Text to be converted to speech */
    text: string
    /** Language */
    lang: string
}

/**
 * Saves the text to speech output to a file using promises.
 * @param options Options for the saving process.
 * @returns Promise resolving to true on success or rejecting with error.
 */
export async function saveTextToSpeech(options: TTSOptions): Promise<boolean> {
    const { filepath, text, lang } = options
    const textParts = tokenize(text)
    const totalParts = textParts.length

    for (let i = 0; i < totalParts; i++) {
        const index = i
        const part = textParts[i]

        const args = getArgs(part, index, totalParts, lang)
        const url = `${GOOGLE_TTS_URL}${args}`

        const writeStream = fs.createWriteStream(filepath, {
            flags: index > 0 ? 'a' : 'w',
        })

        const response = await axios.get(url, {
            headers: getHeader(),
            responseType: 'stream',
        })

        response.data.pipe(writeStream)
        await new Promise((resolve, reject) => {
            response.data.on('end', resolve)
            response.data.on('error', reject)
        })
    }

    return true
}
