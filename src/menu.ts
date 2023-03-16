import langId from './lang'

const menu = [
  {
    command: 'menu',
    hint: langId.menu.hint,
    alias: 'm, start, help, ?',
    type: 'info',
  },
  {
    command: 'ping',
    hint: langId.ping.hint,
    alias: 'p',
    type: 'info',
  },
  {
    command: 'sticker',
    hint: langId.sticker.hint,
    alias: 'stiker, s',
    type: 'general',
  },
  {
    command: 'public',
    hint: langId.public.hint,
    alias: 'mode',
    type: 'config',
  },
  {
    command: 'eval',
    hint: langId.eval.hint,
    alias: '=',
    type: 'owner',
  },
  {
    command: 'return',
    hint: langId.return.hint,
    alias: '>',
    type: 'owner',
  },
]

export const getCommand = (cmd: string) => {
  return menu.find(
    (m) => m.alias.split(', ').concat(m.command).indexOf(cmd) !== -1
  )?.command
}

export const getMenu = () => {
  return menu
}
