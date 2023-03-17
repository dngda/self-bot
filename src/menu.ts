import stringId from './lang'

const menu = [
  {
    command: 'menu',
    hint: stringId.menu.hint,
    alias: 'm, start, help, ?',
    type: 'info',
  },
  {
    command: 'ping',
    hint: stringId.ping.hint,
    alias: 'p',
    type: 'info',
  },
  {
    command: 'sticker',
    hint: stringId.sticker.hint,
    alias: 'stiker, s',
    type: 'general',
  },
  {
    command: 'public',
    hint: stringId.public.hint,
    alias: 'mode',
    type: 'config',
  },
  {
    command: 'eval',
    hint: stringId.eval.hint,
    alias: '=',
    type: 'owner',
  },
  {
    command: 'return',
    hint: stringId.return.hint,
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
