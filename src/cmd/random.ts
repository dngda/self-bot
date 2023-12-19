import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageData } from '../utils'
import { apiCall } from '../lib/apicall'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    meme: gimmeHandler,
  })

  stringId.gimme = {
    hint: '🌠 _Random reddit meme_',
    error: {
      internal: 'Terjadi error, coba lagi.',
    },
    usage: (p: string) =>
      `Custom subreddit setelah cmd, contoh: _${p}meme dankmemes_`,
  }

  menu.push({
    command: 'meme',
    hint: stringId.gimme.hint,
    alias: 'reddit, ri',
    type: 'random',
  })
}

const gimmeHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  let param = ''
  if (data.args[0]) {
    param = data.args[0].toLowerCase()
  }
  if (data.cmd == 'ri' && data.arg == '') {
    throw new Error(stringId.gimme.usage(data.prefix))
  }

  await data.reactWait()
  const result = await apiCall(`https://meme-api.com/gimme/${param}`).catch(
    (err) => {
      throw new Error(err.response.data.message)
    }
  )

  if (result?.url) {
    await data.replyContent({
      image: { url: result.url },
      caption: result.title,
    })
    return data.reactSuccess()
  } else {
    throw new Error(stringId.gimme.error.internal)
  }
}
