import axios from 'axios'

interface Message {
    entities: unknown[]
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

export async function quotely(
    username: string,
    message: string,
    avatar: string = 'https://i.ibb.co.com/jZQ0FpmY/profile-placeholder.png'
): Promise<QuoteResponse['result']> {
    const json: Partial<QuoteRequest> = {
        type: 'quote',
        format: 'webp',
        backgroundColor: '#000000',
        scale: 1,
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

    const response = await axios.post<QuoteResponse>(
        'https://bot.lyo.su/quote/generate',
        json,
        {
            headers: { 'Content-Type': 'application/json' },
        }
    )

    return response.data.result
}
