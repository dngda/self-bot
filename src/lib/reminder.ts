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
    return reminders.map((reminder) => {
        const data = reminder.toJSON() as ReminderAttributes
        if (typeof data.repeatDays === 'string') {
            data.repeatDays = JSON.parse(data.repeatDays)
        }
        return data
    })
}

export async function getAllReminders(): Promise<ReminderAttributes[]> {
    const reminders = await Reminder.findAll({
        order: [['nextRunAt', 'ASC']],
    })
    return reminders.map((reminder) => {
        const data = reminder.toJSON() as ReminderAttributes
        if (typeof data.repeatDays === 'string') {
            data.repeatDays = JSON.parse(data.repeatDays)
        }
        return data
    })
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
    return reminders.map((reminder) => {
        const data = reminder.toJSON() as ReminderAttributes
        if (typeof data.repeatDays === 'string') {
            data.repeatDays = JSON.parse(data.repeatDays)
        }
        return data
    })
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
    return reminders.map((reminder) => {
        const data = reminder.toJSON() as ReminderAttributes
        if (typeof data.repeatDays === 'string') {
            data.repeatDays = JSON.parse(data.repeatDays)
        }
        return data
    })
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

// Helper: Calculate next run date for custom days
const calculateNextCustomDayRun = (
    currentDate: Date,
    repeatDays: number[]
): Date => {
    const nextRun = new Date(currentDate)
    const sortedDays = [...repeatDays].sort((a, b) => a - b)

    // Start checking from tomorrow
    nextRun.setDate(nextRun.getDate() + 1)

    // Find next valid day (max 7 days ahead)
    for (let i = 0; i < 7; i++) {
        const dayOfWeek = nextRun.getDay()
        if (sortedDays.includes(dayOfWeek)) {
            return nextRun
        }
        nextRun.setDate(nextRun.getDate() + 1)
    }

    // Fallback: return tomorrow if no match found (shouldn't happen)
    return new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
}

// Helper: Calculate next run date based on repeat type
const calculateNextRun = (
    currentRunDate: Date,
    repeatType: string,
    repeatInterval: number,
    repeatDays: number[] | null
): Date => {
    const nextRun = new Date(currentRunDate)
    const interval = repeatInterval || 1

    switch (repeatType) {
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
            if (repeatDays && repeatDays.length > 0) {
                return calculateNextCustomDayRun(currentRunDate, repeatDays)
            }
            // Fallback to daily if no days specified
            nextRun.setDate(nextRun.getDate() + 1)
            break
        default:
            nextRun.setDate(nextRun.getDate() + 1)
    }

    return nextRun
}

// Helper: Send reminder message
const sendReminderMessage = async (
    wa: WASocket,
    reminder: ReminderAttributes
): Promise<void> => {
    await wa.sendMessage(reminder.from, {
        text: `⏰ Reminder:\n${reminder.message}`,
    })
}

// Helper: Process a triggered reminder
const processTriggeredReminder = async (
    wa: WASocket,
    reminder: ReminderAttributes,
    currentRunDate: Date
): Promise<void> => {
    // Send reminder message
    await sendReminderMessage(wa, reminder)

    // Update lastTriggeredAt
    await Reminder.update(
        { lastTriggeredAt: new Date() },
        { where: { id: reminder.id } }
    )

    // Handle recurring vs one-time reminders
    if (reminder.repeatType !== 'none') {
        const nextRun = calculateNextRun(
            currentRunDate,
            reminder.repeatType,
            reminder.repeatInterval,
            reminder.repeatDays
        )
        await Reminder.update(
            { nextRunAt: nextRun },
            { where: { id: reminder.id } }
        )
    } else {
        // Delete non-recurring reminders after triggering
        await deleteReminder(reminder.id)
    }
}

// Helper: Check if reminder should trigger now
const shouldTriggerReminder = (nextRunAt: Date, now: Date): boolean => {
    // Trigger if nextRunAt is in the past and within the last minute
    return nextRunAt <= now && nextRunAt.getTime() > now.getTime() - 60000
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

            if (shouldTriggerReminder(nextRunAt, now)) {
                await processTriggeredReminder(_wa, reminder, nextRunAt)
            }
        }
    })

    job.start()
    console.log(chalk.green('Reminder cron job started!'))
}
