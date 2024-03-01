type Menu = {
    command: string
    hint: string
    alias: string
    type: string
}

export const menu: Menu[] = []

export const getCommand = (cmd: string) => {
    return (
        menu.find(
            (m) => m.alias.split(', ').concat(m.command).indexOf(cmd) !== -1
        )?.command || ''
    )
}

export const getMenu = () => {
    return menu
}
