import {
    AnyMessageContent,
    WAMediaUpload,
    WAMessage,
    WAMessageContent,
    WASocket,
    proto,
} from 'baileys'

export interface StickerCommand {
    cmd: string
    arg: string
}

type Menu = {
    command: string
    hint: string
    type: string
    alias?: string
    noprefix?: boolean
    hidden?: boolean
}

export interface BotConfig {
    allowed_chats: string[]
    sticker_commands: { [key: string]: StickerCommand }
    norevoke: boolean
    norevoke_exceptions: string[]
    norevoke_status: boolean
    disabled_chats: string[]
    autosticker: string[]
    oneview: boolean
    public: boolean
}

type snu = string | null | undefined

export interface MessageContext {
    from: string
    fromMe: boolean | null | undefined
    name: snu
    participant: snu
    body: snu
    prefix: string
    isCmd: boolean
    cmd: string
    arg: string
    args: string[]
    groupName: string | null
    quotedMsg: WAMessageContent | null | undefined
    quotedMsgBody: snu
    contextInfo: proto.IContextInfo | null | undefined
    expiration: number | null | undefined

    isGroup: boolean
    isQuotedImage: boolean | null
    isQuotedVideo: boolean | null
    isQuotedSticker: boolean | null
    isQuotedDocument: boolean | null
    isQuoted: boolean | null
    isImage: boolean | null
    isVideo: boolean | null
    isMedia: boolean | null
    isEphemeral: boolean | null
    isStatusMessage: boolean | null

    config: BotConfig
    download: () => Promise<Buffer>
    downloadQuoted: () => Promise<Buffer>
    downloadSticker: () => Promise<Buffer>
    reply: (text: string) => Promise<WAMessage | undefined>
    quoteReply: (
        text: string,
        quoted: WAMessage
    ) => Promise<WAMessage | undefined>
    send: (text: string) => Promise<WAMessage | undefined>
    replySticker: (inputMedia: WAMediaUpload) => Promise<WAMessage | undefined>
    replyContent: (content: AnyMessageContent) => Promise<WAMessage | undefined>
    quoteReplyContent: (
        content: AnyMessageContent,
        quoted: WAMessage
    ) => Promise<WAMessage | undefined>
    replyVoiceNote: (path: string) => Promise<WAMessage | undefined>

    reactWait: () => Promise<WAMessage | undefined>
    reactSuccess: () => Promise<WAMessage | undefined>
    reactError: () => Promise<WAMessage | undefined>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface LanguageString {
    hint: string
    error: { [key: string]: (...args: any[]) => string }
    usage: (ctx: MessageContext) => string
    info?: (...args: any[]) => string
    success?: (...args: any[]) => string
    sent?: (...args: any[]) => string
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type HandlerFunction = (
    wa: WASocket,
    msg: WAMessage,
    ctx: MessageContext
) => Promise<WAMessage | undefined>
