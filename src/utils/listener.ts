import { WAMessage, WASocket, downloadMediaMessage, proto } from 'baileys'
import { getMessage } from '../lib/_index.js'
import { config } from '../handler.js'

export const listenDeletedMessage = async (wa: WASocket, msg: WAMessage) => {
    if (config.norevoke_exceptions.includes(msg.key.remoteJid!)) return null
    if (msg.key.fromMe) return null
    if (wa.user?.lid?.replace(':47', '') === msg.key.participant) return null
    if (
        msg.message?.protocolMessage?.type ==
        proto.Message.ProtocolMessage.Type.REVOKE
    ) {
        const key = msg.message?.protocolMessage?.key
        if (!key) return null

        const _msg = getMessage(key.id!)
        if (!_msg) return null

        const from = msg.key.participant || msg.key.remoteJid!

        let sumber = `msg from @${from.replace('@s.whatsapp.net', '')}`
        if (msg.key.participant && msg.key.remoteJid != 'status@broadcast') {
            const subject = (await wa.groupMetadata(msg.key.remoteJid!)).subject
            sumber = `msg from _${subject}_ by @${msg.key.participant!.replace(
                /(@s.whatsapp.net)|(@lid)/g,
                ''
            )}`
        }

        if (msg.key.remoteJid == 'status@broadcast') {
            sumber = `status by @${msg.key.participant!.replace(
                '@s.whatsapp.net',
                ''
            )}`
        }

        const msgdata = `Deleted ${sumber}:`

        await wa.sendMessage(process.env.OWNER_NUMBER!, {
            text: msgdata,
            mentions: [from],
        })

        await wa.sendMessage(process.env.OWNER_NUMBER!, {
            forward: { key: _msg.key, message: _msg.message },
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })
    }
    return true
}

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

    await wa.sendMessage(process.env.OWNER_NUMBER!, {
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
        await wa.sendMessage(process.env.OWNER_NUMBER!, {
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
        await wa.sendMessage(process.env.OWNER_NUMBER!, {
            video: mediaData as Buffer,
            caption,
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })
    }

    return true
}

export const listenEditedMessage = async (wa: WASocket, msg: WAMessage) => {
    if (msg.key.fromMe) return null
    if (wa.user?.lid?.replace(':47', '') === msg.key.participant) return null
    if (
        msg.message?.editedMessage?.message?.protocolMessage?.type !=
            proto.Message.ProtocolMessage.Type.MESSAGE_EDIT &&
        msg.message?.protocolMessage?.type !=
            proto.Message.ProtocolMessage.Type.MESSAGE_EDIT
    ) {
        return null
    }
    if (msg.key.remoteJid == 'status@broadcast') return null

    const key =
        msg.message?.editedMessage?.message?.protocolMessage?.key ||
        msg.message.protocolMessage?.key
    if (!key) return null

    const _msg = getMessage(key.id!)

    if (!_msg) return null

    const from = msg.key.participant || msg.key.remoteJid!

    let sumber = `@${from.replace('@s.whatsapp.net', '')}`
    if (msg.key.participant && msg.key.remoteJid != 'status@broadcast') {
        const subject = (await wa.groupMetadata(msg.key.remoteJid!)).subject
        sumber = `_${subject}_ by @${msg.key.participant!.replace(
            /(@s.whatsapp.net)|(@lid)/g,
            ''
        )}`
    }

    const msgdata = `Original msg edited from ${sumber}:`

    await wa.sendMessage(process.env.OWNER_NUMBER!, {
        text: msgdata,
        mentions: [from],
    })

    const originalText =
        _msg.message.conversation || _msg.message.extendedTextMessage?.text

    if (originalText) {
        await wa.sendMessage(process.env.OWNER_NUMBER!, {
            text: originalText,
            contextInfo: { forwardingScore: 2, isForwarded: true },
        })
    }

    return true
}
