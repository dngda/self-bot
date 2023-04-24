import { WAMessage, WASocket } from '@adiwajshing/baileys'
import { MessageData } from '../utils'
import { actions } from '../handler'
import { getMenu, menu } from '../menu'
import stringId from '../language'
import * as math from 'mathjs'
import lodash from 'lodash'
import chalk from 'chalk'

export default function () {
  Object.assign(actions, {
    ping: pingHandler,
    menu: menuHandler,
  })

  stringId.ping = {
    hint: '➡️ Balas dengan pong!',
  }
  stringId.menu = {
    hint: '📜 Menampilkan pesan ini',
  }
  stringId.math = {
    hint: '🧮 Hitung rumus matematika',
    error: {
      noArgs: '‼️ Tidak ada argumen yang diberikan!',
    },
  }

  menu.push(
    {
      command: 'ping',
      hint: stringId.ping.hint,
      alias: 'p',
      type: 'general',
    },
    {
      command: 'menu',
      hint: stringId.menu.hint,
      alias: 'm, start, help, ?',
      type: 'general',
    }
  )
}

const pingHandler = async (
  _wa: WASocket,
  msg: WAMessage,
  data: MessageData
) => {
  const processTime = Date.now() - (msg.messageTimestamp as number) * 1000
  await data.reply(`Pong _${processTime} ms!_`)
}

const q3 = '```'

const menuHandler = (_wa: WASocket, _msg: WAMessage, data: MessageData) => {
  const m = (namaMenu: string) => `*${data.prefix}${namaMenu}*`

  let menuMsg = `${q3} ___              ___      _   
/ __| ___ _ _ ___| _ ) ___| |_ 
\\__ \\/ -_) '_/ _ \\ _ \\/ _ \\  _|
|___/\\___|_| \\___/___/\\___/\\__|${q3}
`

  menuMsg += `
!-------------- Help - Usage --------------!\n`
  menuMsg += `*Accepted prefix:* ${process.env.PREFIX!}\n`
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
  menuMsg += `\n(cth: =10x1+2)\n`
  if (!data.fromMe) {
    menuMsg += `\nCode: https://github.com/dngda/self-bot `
    menuMsg += `\nPlease star ⭐ or fork 🍴 if you like!`
    menuMsg += `\nThanks for using this bot! 🙏`
  }
  data.send(menuMsg)
}

export const mathHandler = async (data: MessageData) => {
  const { body } = data
  if (!body?.startsWith('=')) return null
  const args = body.slice(1)
  if (!args || args == '') return null
  if (/[()$&_`~'":\\,|;\][?><!%]/g.test(args) && !/\(.+\)/g.test(args))
    return null
  console.log(chalk.blue('[MATH]'), 'Doing =', args)
  const result = math.evaluate(
    args
      .replace(/x/gi, '*')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/%/g, '/100')
      .replace('**', '^')
  )
  return await data.reply(`${result}`)
}
