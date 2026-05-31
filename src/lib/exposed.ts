import type { Context } from 'hono'
import { Hono } from 'hono'
import { AnyMessageContent } from 'baileys'
import { waSocket } from '../../index.js'

const app = new Hono()
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
    const EXPOSED_API_KEY = process.env.EXPOSED_API_KEY
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

    const requestId = Math.random().toString(36).slice(2, 10)

    let data: unknown
    try {
        data = await c.req.json()
    } catch (err) {
        return c.json(
            { ok: false, error: 'Invalid JSON payload', requestId },
            400
        )
    }

    if (!waSocket?.isReady) {
        return c.json(
            { ok: false, error: 'WhatsApp socket not initialized', requestId },
            503
        )
    }

    if (!data || typeof data !== 'object') {
        return c.json({ ok: false, error: 'Invalid payload', requestId }, 400)
    }

    const payload = data as {
        jid?: unknown
        content?: unknown
        options?: unknown
    }

    if (typeof payload.jid !== 'string') {
        return c.json(
            { ok: false, error: 'Invalid or missing jid', requestId },
            400
        )
    }

    if (!isValidContent(payload.content)) {
        return c.json(
            { ok: false, error: 'Invalid content format', requestId },
            400
        )
    }

    try {
        const msg = await waSocket.sendMessage(
            payload.jid,
            payload.content as AnyMessageContent,
            (payload.options as Record<string, unknown>) || {}
        )
        return c.json({ ok: true, msg, requestId })
    } catch (err) {
        console.error('Exposed API send error:', err)
        return c.json(
            { ok: false, error: 'Failed to send message', requestId },
            500
        )
    }
})

export default app
