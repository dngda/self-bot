import chalk from 'chalk'
import { Sequelize, DataTypes } from 'sequelize'

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'data/note.sqlite',
})

const Note = sequelize.define('note', {
  id: {
    type: new DataTypes.INTEGER(),
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: new DataTypes.STRING(128),
    unique: true,
    allowNull: false,
  },
  content: {
    type: new DataTypes.TEXT(),
    allowNull: false,
  },
})

export async function initNoteDatabase() {
  console.log(chalk.yellow('Initializing database...'))
  await sequelize.sync()
  console.log(chalk.green('Database synced!'))
}

export async function createNote(title: string, content: string) {
  const note = await Note.create({ title, content })
  return note.toJSON()
}

export async function getNotesNames() {
  const notes = await Note.findAll()
  return notes.map((note) => note.toJSON().title)
}

export async function getNoteContent(title: string) {
  const note = await Note.findOne({ where: { title } })
  return note?.toJSON().content
}

export async function updateNoteContent(title: string, content: string) {
  const note = await Note.findOne({ where: { title } })
  if (note) {
    note.toJSON().content = content
    await note.save()
  }
  return note
}

export async function deleteNote(title: string) {
  const note = await Note.findOne({ where: { title } })
  await note?.destroy()
  return note?.toJSON()
}
