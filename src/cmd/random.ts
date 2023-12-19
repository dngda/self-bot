import { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { MessageData } from '../utils'
import { apiCall } from '../lib/apicall'
import stringId from '../language'
import { actions } from '../handler'
import { menu } from '../menu'

export default function () {
  Object.assign(actions, {
    gimme: gimmeHandler,
  })

  stringId.gimme = {
    hint: '🌠 _Random reddit meme_',
    error: {
      internal: 'Terjadi error, coba lagi.',
    },
  }

  menu.push({
    command: 'gimme',
    hint: stringId.gimme.hint,
    alias: 'meme',
    type: 'random',
  })
}

const gimmeHandler = async (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  await data.reactWait()
  const result = await apiCall('https://meme-api.com/gimme')

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
