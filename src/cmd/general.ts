import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import { getMenu } from '../menu'
import lodash from 'lodash'

export const pingHandler = async (
  _wa: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const processTime = Date.now() - (msg.messageTimestamp as number) * 1000
  await data.reply(`Pong _${processTime} ms!_`)
}

export const menuHandler = (
  _wa: WASocket,
  _msg: WAMessage,
  data: MessageData
) => {
  const m = (namaMenu: string) => `*${data.prefix}${namaMenu}*`

  let menuMsg = `🤖 ------ SeroBot (Self) Menu ------ 🤖\n`
  const menus = getMenu()
  const menuTypes = menus.map((menu) => {
    return menu.type
  })
  let setMenuTypes = lodash.uniq(menuTypes)
  if (!data.fromMe)
    setMenuTypes = setMenuTypes.filter((type) => !type.match(/owner|config/i))
  for (const type of setMenuTypes) {
    menuMsg += `\n╔══✪〘 ${type.replace(/^\w/, (c: string) =>
      c.toUpperCase()
    )} 〙✪`
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
  menuMsg += `\nPerhitungan mathjs gunakan prefiks '='`
  menuMsg += `\nContoh: =1+2\n`
  if (!data.fromMe) {
    menuMsg += `\nCode: https://github.com/dngda/self-bot `
    menuMsg += `\nPlease star ⭐ or fork 🍴 if you like!`
    menuMsg += `\nThanks for using this bot! 🙏`
  }
  data.send(menuMsg)
}
