import chalk from 'chalk'
import { Sequelize, DataTypes } from 'sequelize'

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'data/note.sqlite',
  logging: false,
})

const Note = sequelize.define('note', {
  from: {
    type: new DataTypes.STRING(128),
    key: 'from',
    primaryKey: true,
  },
  title: {
    type: new DataTypes.STRING(128),
    key: 'title',
    primaryKey: true,
  },
  content: {
    type: new DataTypes.TEXT(),
    allowNull: false,
  },
  media: {
    type: new DataTypes.STRING(128),
    allowNull: true,
  },
})

export async function initNoteDatabase() {
  console.log(chalk.yellow('Initializing database...'))
  await sequelize.sync({ alter: true })
  console.log(chalk.green('Database synced!'))
}

export async function createNote(
  from: string,
  title: string,
  content: string,
  media?: string
) {
  const note = await Note.create({ from, title, content, media })
  return note.toJSON()
}

export async function getNotesNames(from: string) {
  const notes = await Note.findAll({
    where: { from },
    order: [['title', 'ASC']],
  })
  return notes.map((note) => note.toJSON().title)
}

export async function getNoteContent(from: string, title: string) {
  const note = await Note.findOne({ where: { from, title } })
  return note?.toJSON()
}

export async function updateNoteContent(
  from: string,
  title: string,
  content: string,
  media?: string
) {
  const note = await Note.update({ content, media }, { where: { from, title } })
  return note[0] > 0
}

export async function deleteNote(from: string, title: string) {
  const note = await Note.findOne({ where: { from, title } })
  const hasMedia = note?.toJSON().media
  await note?.destroy()
  return hasMedia
}
