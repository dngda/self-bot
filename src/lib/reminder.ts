// sqlite database setup for reminders
import { DataTypes, Op, Model } from 'sequelize'
import { CronJob } from 'cron'
import chalk from 'chalk'
import { WASocket } from 'baileys'
import { sequelize } from './database.js'

export interface ReminderAttributes {
    id: number
    from: string
    message: string
    nextRunAt: Date
    repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days'
    repeatInterval: number
    repeatDays: number[] | null // [0,1,2,3,4,5,6] where 0=Sunday, 6=Saturday
    lastTriggeredAt: Date | null
    createdAt?: Date
    updatedAt?: Date
}

class Reminder extends Model {}

Reminder.init(
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
        nextRunAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        repeatType: {
            type: DataTypes.ENUM(
                'none',
                'daily',
                'weekly',
                'monthly',
                'custom_days'
            ),
            defaultValue: 'none',
        },
        repeatInterval: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        repeatDays: {
            type: DataTypes.JSONB, // Store as JSON array
            allowNull: true,
        },
        lastTriggeredAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'reminders',
        timestamps: true,
    }
)

export async function addReminder(
    from: string,
    message: string,
    nextRunAt: Date,
    repeatType:
        | 'none'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'custom_days' = 'none',
    repeatInterval: number = 1,
    repeatDays: number[] | null = null
): Promise<ReminderAttributes | null> {
    const reminder = await Reminder.create({
        from,
        message,
        nextRunAt,
        repeatType,
        repeatInterval,
        repeatDays,
    }).catch((error) => {
        console.log('[ERR]', error)
        return null
    })
    return reminder?.toJSON() as ReminderAttributes | null
}

export async function getRemindersList(
    from: string
): Promise<ReminderAttributes[]> {
    const reminders = await Reminder.findAll({
        where: { from },
        order: [['nextRunAt', 'ASC']],
    })
    return reminders.map((reminder) => reminder.toJSON() as ReminderAttributes)
}

export async function deleteReminder(id: number): Promise<boolean> {
    const result = await Reminder.destroy({ where: { id } }).catch((error) => {
        console.log('[ERR]', error)
        return 0
    })
    return result > 0
}

export async function deleteAllReminders(from: string): Promise<boolean> {
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
    nextRunAt: Date,
    repeatType:
        | 'none'
        | 'daily'
        | 'weekly'
        | 'monthly'
        | 'custom_days' = 'none',
    repeatInterval: number = 1,
    repeatDays: number[] | null = null
): Promise<boolean> {
    const result = await Reminder.update(
        { message, nextRunAt, repeatType, repeatInterval, repeatDays },
        { where: { id } }
    ).catch((error) => {
        console.log('[ERR]', error)
        return [0]
    })
    return result[0] > 0
}

export async function getAllRemindersList(): Promise<ReminderAttributes[]> {
    const reminders = await Reminder.findAll({
        order: [['nextRunAt', 'ASC']],
    })
    return reminders.map((reminder) => reminder.toJSON() as ReminderAttributes)
}

async function getNextRemindersJob(): Promise<ReminderAttributes[]> {
    const reminders = await Reminder.findAll({
        where: {
            nextRunAt: {
                [Op.lte]: new Date(),
            },
        },
        order: [['nextRunAt', 'ASC']],
    })
    return reminders.map((reminder) => reminder.toJSON() as ReminderAttributes)
}

const cleanStaleReminders = async () => {
    const now = new Date()
    const reminders = await getAllRemindersList()
    for (const reminder of reminders) {
        if (reminder.repeatType === 'none' && reminder.nextRunAt < now) {
            await deleteReminder(reminder.id)
        }
    }
}

export const initiateReminderCron = (_wa: WASocket) => {
    cleanStaleReminders()

    const job = new CronJob('*/1 * * * *', async () => {
        const now = new Date()
        const reminders = await getNextRemindersJob()
        if (!reminders || reminders.length === 0) return

        for (const reminder of reminders) {
            if (!reminder.nextRunAt) continue
            const nextRunAt = new Date(reminder.nextRunAt)
            // Check if reminder should trigger (within the current minute)
            if (
                nextRunAt <= now &&
                nextRunAt.getTime() > now.getTime() - 60000
            ) {
                // send reminder message to user
                _wa.sendMessage(reminder.from, {
                    text: `⏰ Reminder:\n${reminder.message}`,
                })

                // Update lastTriggeredAt
                await Reminder.update(
                    { lastTriggeredAt: now },
                    { where: { id: reminder.id } }
                )

                // Handle recurring reminders
                if (reminder.repeatType !== 'none') {
                    const nextRun = new Date(nextRunAt)
                    const interval = reminder.repeatInterval || 1

                    switch (reminder.repeatType) {
                        case 'daily':
                            nextRun.setDate(nextRun.getDate() + interval)
                            break
                        case 'weekly':
                            nextRun.setDate(nextRun.getDate() + 7 * interval)
                            break
                        case 'monthly':
                            nextRun.setMonth(nextRun.getMonth() + interval)
                            break
                        case 'custom_days':
                            // Find next valid day
                            if (
                                reminder.repeatDays &&
                                reminder.repeatDays.length > 0
                            ) {
                                const sortedDays = [
                                    ...reminder.repeatDays,
                                ].sort((a, b) => a - b)
                                let daysToAdd = 1
                                let found = false

                                while (!found && daysToAdd < 8) {
                                    nextRun.setDate(nextRun.getDate() + 1)
                                    const dayOfWeek = nextRun.getDay()
                                    if (sortedDays.includes(dayOfWeek)) {
                                        found = true
                                    }
                                    daysToAdd++
                                }
                            }
                            break
                    }

                    await Reminder.update(
                        { nextRunAt: nextRun },
                        { where: { id: reminder.id } }
                    )
                } else {
                    // Delete non-recurring reminders after triggering
                    await deleteReminder(reminder.id)
                }
            }
        }
    })

    job.start()
    console.log(chalk.green('Reminder cron job started!'))
}
