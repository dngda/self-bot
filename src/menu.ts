type Menu = {
    command: string
    hint: string
    alias: string
    type: string
    noprefix?: boolean
}

export const menu: Menu[] = []

export const findMenu = (cmd: string) => {
    return (
        menu.find(
            (m) =>
                m.alias
                    .split(/, ?| ,/)
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
