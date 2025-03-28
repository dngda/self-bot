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
    const json: Partial<QuoteRequest> = {
        type: 'quote',
        format: 'webp',
        backgroundColor: '#000000',
        scale: 2,
        messages: [
            {
                entities: [],
                avatar: true,
                from: {
                    id: 1,
                    name: username,
                    photo: { url: avatar },
                },
                text: message,
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
