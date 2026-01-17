// sqlite database setup for reminders
import { Sequelize, DataTypes } from 'sequelize'

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'data/reminder.sqlite',
    logging: false,
})

const Reminder = sequelize.define(
    'reminder',
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        from: {
            type: DataTypes.STRING(128),
            allowNull: false,
            key: 'from',
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        date: {
            type: DataTypes.DATE,
            allowNull: true, // can be null for recurring reminders
        },
        time: {
            type: DataTypes.STRING(16),
            allowNull: false,
        },
    },
    {
        timestamps: true,
    }
)

export async function initReminderDatabase() {
    console.log('Initializing reminder database...')
    await sequelize.sync()
    console.log('Reminder database synced!')
}

export async function createReminder(
    from: string,
    message: string,
    date: Date | null,
    time: string
) {
    const reminder = await Reminder.create({ from, message, date, time }).catch(
        (error) => {
            console.log('[ERR]', error)
            return null
        }
    )
    return reminder?.toJSON()
}

export async function getReminders(from: string) {
    const reminders = await Reminder.findAll({
        where: { from },
        order: [
            ['date', 'ASC'],
            ['time', 'ASC'],
        ],
    })
    return reminders.map((reminder) => reminder.toJSON())
}

export async function deleteReminder(id: number) {
    const result = await Reminder.destroy({ where: { id } }).catch((error) => {
        console.log('[ERR]', error)
        return 0
    })
    return result > 0
}

export async function deleteAllReminders(from: string) {
    const result = await Reminder.destroy({ where: { from } }).catch(
        (error) => {
            console.log('[ERR]', error)
            return 0
        }
    )
    return result > 0
}

export async function updateReminder(
    id: number,
    message: string,
    date: Date | null,
    time: string
) {
    const result = await Reminder.update(
        { message, date, time },
        { where: { id } }
    ).catch((error) => {
        console.log('[ERR]', error)
        return [0]
    })
    return result[0] > 0
}

export async function getAllReminders() {
    const reminders = await Reminder.findAll({
        order: [
            ['date', 'ASC'],
            ['time', 'ASC'],
        ],
    })
    return reminders.map((reminder) => reminder.toJSON())
}