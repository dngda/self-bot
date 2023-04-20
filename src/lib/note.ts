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
  from: {
    type: new DataTypes.STRING(128),
    allowNull: false,
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

export async function createNote(from: string, title: string, content: string) {
  const note = await Note.create({ from, title, content })
  return note.toJSON()
}

export async function getNotesNames(from: string) {
  const notes = await Note.findAll({ where: { from } })
  return notes.map((note) => note.toJSON().title)
}

export async function getNoteContent(from: string, title: string) {
  const note = await Note.findOne({ where: { from, title } })
  return note?.toJSON().content
}

export async function updateNoteContent(
  from: string,
  title: string,
  content: string
) {
  const note = await Note.update({ content }, { where: { from, title } })
  return note[0] > 0
}

export async function deleteNote(from: string, title: string) {
  const note = await Note.findOne({ where: { from, title } })
  await note?.destroy()
  return note?.toJSON()
}
