import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { replyText, sendMessageReply, sendText } from '../utils'
import { getMenu } from '../src/menu'

export const pingHandler = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  const processTime = Date.now() - msg.messageTimestamp * 1000
  await replyText(waSocket, data.from, `Pong _${processTime} ms!_`, msg)
}

export const menuHandler = (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
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
  const setMenuTypes = [...new Set(menuTypes)]
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

export const evalJSON = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
  const { quotedMsg } = data
  if (quotedMsg) {
    await replyText(
      waSocket,
      data.from,
      JSON.stringify(quotedMsg, null, 2),
      msg
    )
  } else {
    await replyText(
      waSocket,
      data.from,
      JSON.stringify(eval(data.args), null, 2),
      msg
    )
  }
}

export const evalJS = async (
  waSocket: WASocket,
  msg: WAMessage,
  data: Record<string, any>
) => {
  if (!data.fromMe) return
  eval(`(async () => { ${data.args} })()`)
}
