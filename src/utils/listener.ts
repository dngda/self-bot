import { WAMessage, WASocket, downloadMediaMessage, proto } from 'baileys'
import { getMessage } from '../lib/_index.js'
import { config } from '../handler.js'

// Constants
const OWNER_JID = process.env.OWNER_JID!
const STATUS_BROADCAST = 'status@broadcast'
const WHATSAPP_LID_SUFFIX_PATTERN = /(@s.whatsapp.net)|(@lid)/g

/**
 * Check if message should be ignored based on sender
 */
const shouldIgnoreMessage = (wa: WASocket, msg: WAMessage): boolean => {
    if (msg.key.fromMe) return true
    if (wa.user?.lid?.replace(':47', '') === msg.key.participant) return true
    return false
}

/**
 * Format message source information
 */
const formatMessageSource = async (
    wa: WASocket,
    msg: WAMessage,
    prefix: string
): Promise<{ text: string; from: string }> => {
    const from = msg.key.participant || msg.key.remoteJid!
    const cleanNumber = from.replace(WHATSAPP_LID_SUFFIX_PATTERN, '')

    // Status update
    if (msg.key.remoteJid === STATUS_BROADCAST) {
        return {
            text: `${prefix} status by @${from.replace(
                WHATSAPP_LID_SUFFIX_PATTERN,
                ''
            )}`,
            from,
        }
    }

    // Group message
    if (msg.key.participant && msg.key.remoteJid !== STATUS_BROADCAST) {
        try {
            const { subject } = await wa.groupMetadata(msg.key.remoteJid!)
            return {
                text: `${prefix} from _${subject}_ by @${cleanNumber}`,
                from,
            }
        } catch (error) {
            console.error('Failed to fetch group metadata:', error)
        }
    }

    // Direct message
    return {
        text: `${prefix} from @${cleanNumber}`,
        from,
    }
}

/**
 * Send notification to owner with mentions
 */
const notifyOwner = async (
    wa: WASocket,
    text: string,
    mentions: string[]
): Promise<void> => {
    if (!OWNER_JID) {
        console.warn('OWNER_JID not configured')
        return
    }

    try {
        await wa.sendMessage(OWNER_JID, { text, mentions })
    } catch (error) {
        console.error('Failed to notify owner:', error)
    }
}

/**
 * Listen for deleted messages and forward them to owner
 */
export const listenDeletedMessage = async (
    wa: WASocket,
    msg: WAMessage
): Promise<boolean | null> => {
    // Skip if chat is in exceptions list
    if (config.norevoke_exceptions.includes(msg.key.remoteJid!)) {
        return null
    }

    // Skip own messages
    if (shouldIgnoreMessage(wa, msg)) {
        return null
    }

    // Check if this is a revoke message
    const isRevokeMessage =
        msg.message?.protocolMessage?.type ===
        proto.Message.ProtocolMessage.Type.REVOKE

    if (!isRevokeMessage) {
        return null
    }

    try {
        const key = msg.message?.protocolMessage?.key
        if (!key?.id) return null

        // Retrieve the original message
        const originalMessage = getMessage(key.id)
        if (!originalMessage) return null

        // Format source information
        const { text, from } = await formatMessageSource(wa, msg, 'Deleted msg')

        // Notify owner about deleted message
        await notifyOwner(wa, `${text}:`, [from])

        // Forward the original message
        if (!OWNER_JID) return null

        await wa.sendMessage(OWNER_JID, {
            forward: {
                key: originalMessage.key,
                message: originalMessage.message,
            },
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })

        return true
    } catch (error) {
        console.error('Error handling deleted message:', error)
        return null
    }
}

/**
 * Listen for edited messages and forward originals to owner
 */
export const listenEditedMessage = async (
    wa: WASocket,
    msg: WAMessage
): Promise<boolean | null> => {
    // Skip own messages
    if (shouldIgnoreMessage(wa, msg)) {
        return null
    }

    // Skip status broadcasts
    if (msg.key.remoteJid === STATUS_BROADCAST) {
        return null
    }

    // Check if this is an edit message
    const isEditMessage =
        msg.message?.editedMessage?.message?.protocolMessage?.type ===
            proto.Message.ProtocolMessage.Type.MESSAGE_EDIT ||
        msg.message?.protocolMessage?.type ===
            proto.Message.ProtocolMessage.Type.MESSAGE_EDIT

    if (!isEditMessage) {
        return null
    }

    try {
        // Extract the key to the original message
        const key =
            msg.message?.editedMessage?.message?.protocolMessage?.key ||
            msg.message?.protocolMessage?.key

        if (!key?.id) return null

        // Retrieve the original message
        const originalMessage = getMessage(key.id)
        if (!originalMessage) return null

        // Format source information
        const { text, from } = await formatMessageSource(
            wa,
            msg,
            'Original msg edited'
        )

        // Notify owner about edited message
        await notifyOwner(wa, `${text}:`, [from])

        // Extract original text content
        const originalText =
            originalMessage.message?.conversation ||
            originalMessage.message?.extendedTextMessage?.text

        if (originalText && OWNER_JID) {
            await wa.sendMessage(OWNER_JID, {
                text: originalText,
                contextInfo: { forwardingScore: 2, isForwarded: true },
            })
        }

        return true
    } catch (error) {
        console.error('Error handling edited message:', error)
        return null
    }
}

/**
 * This function is no longer usable due to WhatsApp restrictions on view-once messages
 */
export const listenOneViewMessage = async (wa: WASocket, msg: WAMessage) => {
    if (msg.key.fromMe) return null
    if (wa.user?.lid?.replace(':47', '') === msg.key.participant) return null
    const viewOnce =
        msg.message?.viewOnceMessage ||
        msg.message?.viewOnceMessageV2 ||
        msg.message?.viewOnceMessageV2Extension ||
        msg.message?.ephemeralMessage?.message?.viewOnceMessage ||
        msg.message?.ephemeralMessage?.message?.viewOnceMessageV2 ||
        msg.message?.ephemeralMessage?.message?.viewOnceMessageV2Extension

    if (!viewOnce) return null

    const from = msg.key.participant || msg.key.remoteJid!
    let sumber = `from @${from.replace('@s.whatsapp.net', '')}`
    if (msg.key.participant) {
        const subject = (await wa.groupMetadata(msg.key.remoteJid!)).subject
        sumber = `from _${subject}_ by @${msg.key.participant!.replace(
            '@s.whatsapp.net',
            ''
        )}`
    }

    const msgdata = `One view msg ${sumber}:`

    await wa.sendMessage(process.env.OWNER_JID!, {
        text: msgdata,
        mentions: [from],
    })

    const { message } = viewOnce
    const { imageMessage, videoMessage } = message as proto.IMessage
    const caption = imageMessage?.caption ?? videoMessage?.caption ?? ''
    if (imageMessage) {
        const mediaData = await downloadMediaMessage(
            { key: msg.key, message: message },
            'buffer',
            {}
        )
        await wa.sendMessage(process.env.OWNER_JID!, {
            image: mediaData as Buffer,
            caption,
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })
    }
    if (videoMessage) {
        const mediaData = await downloadMediaMessage(
            { key: msg.key, message: message },
            'buffer',
            {}
        )
        await wa.sendMessage(process.env.OWNER_JID!, {
            video: mediaData as Buffer,
            caption,
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })
    }

    return true
}
