import { Menu } from './types'

export const menu: Menu[] = []

export const findMenu = (cmd: string) => {
    if (!cmd) return null
    return (
        menu.find(
            (m) =>
                (m.alias ?? '')
                    .split(/, ?| ,/)
                    .filter((a) => a)
                    .concat(m.command)
                    .indexOf(cmd) !== -1
        ) ?? null
    )
}

export const getCommand = (cmd: string) => {
    return findMenu(cmd)?.command ?? ''
}

export const getMenu = () => {
    return menu
}
