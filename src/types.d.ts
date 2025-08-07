import {
    AnyMessageContent,
    WAMediaUpload,
    WAMessageContent,
    proto,
} from 'baileys'

export interface StickerCommand {
    cmd: string
    arg: string
}

export interface BotConfig {
    allowed_chats: string[]
    sticker_commands: { [key: string]: StickerCommand }
    norevoke: boolean
    norevoke_exceptions: string[]
    disabled_chats: string[]
    autosticker: string[]
    oneview: boolean
    public: boolean
    [key: string]:
        | string
        | boolean
        | string[]
        | { [key: string]: string | StickerCommand }
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
    reply: (text: string) => Promise<proto.WebMessageInfo | undefined>
    quoteReply: (
        text: string,
        quoted: proto.IWebMessageInfo
    ) => Promise<proto.WebMessageInfo | undefined>
    send: (text: string) => Promise<proto.WebMessageInfo | undefined>
    replySticker: (
        inputMedia: WAMediaUpload
    ) => Promise<proto.WebMessageInfo | undefined>
    replyContent: (
        content: AnyMessageContent
    ) => Promise<proto.WebMessageInfo | undefined>
    quoteReplyContent: (
        content: AnyMessageContent,
        quoted: proto.IWebMessageInfo
    ) => Promise<proto.WebMessageInfo | undefined>
    replyVoiceNote: (path: string) => Promise<proto.WebMessageInfo | undefined>

    reactWait: () => Promise<proto.WebMessageInfo | undefined>
    reactSuccess: () => Promise<proto.WebMessageInfo | undefined>
    reactError: () => Promise<proto.WebMessageInfo | undefined>
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
