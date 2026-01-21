import { Sequelize } from 'sequelize'
import chalk from 'chalk'

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'data/app.sqlite',
    logging: false,
})

export async function initDatabase() {
    console.log(chalk.yellow('Initializing database...'))
    await sequelize.sync({ alter: true })
    console.log(chalk.green('Database synced successfully!'))
}
