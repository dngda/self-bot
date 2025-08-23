import { WAMessage, WASocket } from 'baileys'
import { MessageContext } from '../types.js'

interface Translation {
    en: string
    id: string
}

interface Transliteration {
    en: string
    id: string
}

interface Name {
    short: string
    long: string
    transliteration: Transliteration
    translation: Translation
}

interface Revelation {
    arab: string
    en: string
    id: string
}

interface Tafsir {
    id: string
}

export interface Surah {
    number: number
    sequence: number
    numberOfVerses: number
    name: Name
    revelation: Revelation
    tafsir: Tafsir
}

export interface SurahRepo {
    code: number
    status: string
    message: string
    data: Surah[]
}

export type HandlerFunction = (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => Promise<void>
