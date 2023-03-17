import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData, replyText, sendMessageReply, sendText } from '../utils'
import { getMenu } from '../src/menu'

export const pingHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const processTime = Date.now() - msg.messageTimestamp * 1000
  await replyText(waSocket, data.from, `Pong _${processTime} ms!_`, msg)
}

export const menuHandler = (
  waSocket: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const m = (namaMenu: string) => `*${data.prefix}${namaMenu}*`

  let menuMsg = `  ╔══╗────────╔══╗───╔═╦╗──╔╗
  ║══╬═╦╦╦═╦══╣══╬═╦╗║═╣╚╦═╣╚╗
  ╠══║╩╣╔╣╬╠══╬══║╩╣╚╣╔╣╬║╬║╔╣
  ╚══╩═╩╝╚═╝──╚══╩═╩═╩╝╚═╩═╩═╝
  `
  const menus = getMenu()
  const menuTypes = menus.map((menu) => {
    return menu.type
  })
  let setMenuTypes = [...new Set(menuTypes)]
  if (!data.fromMe)
    setMenuTypes = setMenuTypes.filter((type) => type.match(/owner|config/i))
  for (const type of setMenuTypes) {
    menuMsg += `\n╔══✪〘 ${type.replace(/^\w/, (c) => c.toUpperCase())} 〙✪`
    for (const sub of menus.filter((menu) => menu.type === type)) {
      const alias = sub.alias
        .split(', ')
        .concat(sub.command)
        .map((a: string) => {
          return m(a)
        })
      menuMsg += `\n╠> ${alias.join(' or ')}\n`
      menuMsg += `║   ${sub.hint}`
    }
    menuMsg += '\n╚══✪\n'
  }
  sendText(waSocket, data.from, menuMsg)
}
