import type { Context } from 'hono'
import { Hono } from 'hono'
import { AnyMessageContent } from 'baileys'
import { waSocket } from '../../index.js'

const app = new Hono()
const EXPOSED_API_KEY = process.env.EXPOSED_API_KEY

const isValidContent = (content: unknown): content is AnyMessageContent => {
    return typeof content === 'object' && content !== null
}

const getBearerToken = (authorization: string | undefined): string | null => {
    if (!authorization) {
        return null
    }

    const match = authorization.match(/^Bearer\s+(.+)$/i)
    return match?.[1] ?? null
}

const requireAuth = (c: Context) => {
    if (!EXPOSED_API_KEY) {
        return c.json(
            { ok: false, error: 'EXPOSED_API_KEY is not configured' },
            500
        )
    }

    const token =
        getBearerToken(c.req.header('authorization')) ??
        c.req.header('x-api-key')

    if (token !== EXPOSED_API_KEY) {
        return c.json({ ok: false, error: 'Unauthorized' }, 401)
    }

    return null
}

app.get('/send', async (c) => {
    const authResponse = requireAuth(c)
    if (authResponse) {
        return authResponse
    }

    return c.json({
        method: 'POST',
        description: 'Send a message via WhatsApp using Baileys',
        payload: {
            jid: 'string - The WhatsApp ID of the recipient (e.g., 123456789@s.whatsapp.net)',
            content:
                'object - The message content to send (e.g., { text: "Hello" })',
            options:
                'object - Additional options for sending the message (e.g., { quoted: msg })',
        },
    })
})

app.post('/send', async (c) => {
    const authResponse = requireAuth(c)
    if (authResponse) {
        return authResponse
    }

    const data = await c.req.json()

    if (!waSocket?.isReady) {
        return c.json(
            { ok: false, error: 'WhatsApp socket not initialized' },
            503
        )
    }

    if (typeof data.jid !== 'string' || typeof data.content !== 'object') {
        return c.json(
            { ok: false, error: 'Invalid jid or content format' },
            400
        )
    }

    if (!isValidContent(data.content)) {
        return c.json({ ok: false, error: 'Invalid content format' }, 400)
    }

    const msg = await waSocket.sendMessage(
        data.jid,
        data.content,
        data.options || {}
    )
    return c.json({ ok: true, msg })
})

export default app
