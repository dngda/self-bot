import { Hono } from 'hono'
import { waSocket } from '../../index.js'

const app = new Hono()

app.get('/send', async (c) => {
    return c.json({
        method: 'POST',
        description: 'Send a message via WhatsApp',
        payload: {
            jid: 'string - The WhatsApp ID of the recipient (e.g., 123456789@s.whatsapp.net)',
            content:
                'object - The message content to send (e.g., { text: "Hello" })',
        },
    })
})

app.post('/send', async (c) => {
    const data = await c.req.json()

    if (!waSocket || !waSocket.isReady) {
        return c.json(
            { ok: false, error: 'WhatsApp socket not initialized' },
            503
        )
    }

    const msg = await waSocket.sendMessage(data.jid, data.content)
    return c.json({ ok: true, msg })
})

export default app
