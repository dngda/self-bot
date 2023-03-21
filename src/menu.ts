import stringId from './language'

const menu = [
  {
    command: 'menu',
    hint: stringId.menu.hint,
    alias: 'm, start, help, ?',
    type: 'general',
  },
  {
    command: 'ping',
    hint: stringId.ping.hint,
    alias: 'p',
    type: 'general',
  },
  {
    command: 'sticker',
    hint: stringId.sticker.hint,
    alias: 'stiker, s',
    type: 'sticker',
  },
  {
    command: 'flip',
    hint: stringId.flip.hint,
    alias: 'flop',
    type: 'tools',
  },
  {
    command: 'pinterest',
    hint: stringId.pinterest.hint,
    alias: 'pin',
    type: 'scraper',
  },
  {
    command: 'tiktokdl',
    hint: stringId.tiktokdl.hint,
    alias: 'ttdl, tiktok',
    type: 'scraper',
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
    alias: '>',
    type: 'owner',
  },
  {
    command: 'return',
    hint: stringId.return.hint,
    alias: '=',
    type: 'owner',
  },
]

export const getCommand = (cmd: string) => {
  return (
    menu.find((m) => m.alias.split(', ').concat(m.command).indexOf(cmd) !== -1)
      ?.command || ''
  )
}

export const getMenu = () => {
  return menu
}
