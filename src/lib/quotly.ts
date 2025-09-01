import axios from 'axios'

interface Message {
    entities: unknown[]
    media?: {
        url: string
    }
    avatar: boolean
    from: {
        id: number
        name: string
        photo: { url: string }
    }
    text: string
    replyMessage: Record<string, unknown>
}

interface QuoteRequest {
    type: string
    format: string
    backgroundColor: string
    width: number
    height: number
    scale: number
    messages: Message[]
}

interface QuoteResponse {
    result: {
        image: string
        type: string
        width: number
        height: number
    }
}

export async function quotly(
    username: string,
    message: string,
    avatar: string = 'https://i.ibb.co.com/zTtYZSQR/pl.png',
    image: string = ''
): Promise<QuoteResponse['result']> {
    const { text, entities } = generateEntities(message)

    const json: Partial<QuoteRequest> = {
        type: 'quote',
        format: 'webp',
        backgroundColor: '#000000',
        scale: 2,
        messages: [
            {
                text,
                entities,
                avatar: true,
                from: {
                    id: 1,
                    name: username,
                    photo: { url: avatar },
                },
                replyMessage: {},
            },
        ],
    }

    if (json.messages && image.length > 0)
        json.messages[0].media = { url: image }

    const response = await axios.post<QuoteResponse>(
        'https://bot.lyo.su/quote/generate',
        json,
        {
            headers: { 'Content-Type': 'application/json' },
        }
    )

    return response.data.result
}

/**
 * Parse "*bold*" dan "_italic_" jadi entities,
 * sambil menghapus markernya dari text.
 * Support escape: \* dan \_ -> jadi literal * dan _
 */
function generateEntities(input: string) {
    const entities: { type: string; offset: number; length: number }[] = []
    let out = ''

    let i = 0
    const n = input.length

    // helper: tulis konten & catat entity
    function consumeMarked(startIdx: number, endIdx: number, type: string) {
        // content tanpa marker
        const content = input.slice(startIdx + 1, endIdx)
        const offset = out.length // posisi di teks OUTPUT
        const length = content.length

        // simpan entity
        entities.push({ type, offset, length })

        // tulis konten ke output
        out += content
    }

    while (i < n) {
        const ch = input[i]

        // Escape handling: "\*" atau "\_"
        if (
            ch === '\\' &&
            i + 1 < n &&
            (input[i + 1] === '*' || input[i + 1] === '_')
        ) {
            out += input[i + 1]
            i += 2
            continue
        }

        // Bold: *...*
        if (ch === '*') {
            const end = input.indexOf('*', i + 1)
            if (end !== -1) {
                consumeMarked(i, end, 'bold')
                i = end + 1
                continue
            }
            // unmatched -> treat as literal
            out += ch
            i += 1
            continue
        }

        // Italic: _..._
        if (ch === '_') {
            const end = input.indexOf('_', i + 1)
            if (end !== -1) {
                consumeMarked(i, end, 'italic')
                i = end + 1
                continue
            }
            // unmatched -> literal
            out += ch
            i += 1
            continue
        }

        // default: salin karakter
        out += ch
        i += 1
    }

    return { text: out, entities }
}
