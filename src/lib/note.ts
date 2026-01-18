import { DataTypes } from 'sequelize'
import { sequelize } from './database.js'

export interface NoteAttributes {
    from: string
    title: string
    content: string
    media?: string | null
}

const Note = sequelize.define('note', {
    from: {
        type: DataTypes.STRING(128),
        primaryKey: true,
        key: 'from',
    },
    title: {
        type: DataTypes.STRING(128),
        primaryKey: true,
        key: 'title',
    },
    content: {
        type: DataTypes.TEXT(),
        allowNull: false,
    },
    media: {
        type: DataTypes.STRING(128),
        allowNull: true,
    },
})

export async function addNote(
    from: string,
    title: string,
    content: string,
    media?: string
): Promise<NoteAttributes | null> {
    const note = await Note.create({ from, title, content, media }).catch(
        (error) => {
            console.log('[ERR]', error)
            return null
        }
    )
    return note?.toJSON() as NoteAttributes | null
}

export async function getNotesList(from: string): Promise<string[]> {
    const notes = await Note.findAll({
        where: { from },
        order: [['title', 'ASC']],
    })
    return notes.map((note) => (note.toJSON() as NoteAttributes).title)
}

export async function getNote(
    from: string,
    title: string
): Promise<NoteAttributes | null> {
    const note = await Note.findOne({ where: { from, title } })
    return note ? (note.toJSON() as NoteAttributes) : null
}

export async function updateNote(
    from: string,
    title: string,
    content: string,
    media?: string
): Promise<boolean> {
    const result = await Note.update(
        { content, media },
        { where: { from, title } }
    ).catch((error) => {
        console.log('[ERR]', error)
        return [0]
    })
    return result[0] > 0
}

export async function deleteNote(
    from: string,
    title: string
): Promise<string | null> {
    const note = await Note.findOne({ where: { from, title } })
    if (!note) return null

    const noteData = note.toJSON() as NoteAttributes
    const mediaPath = noteData.media || null
    await note.destroy()
    return mediaPath
}
