import P from 'pino'

const logPrefix = '[LOG]:'
const pino = P({ timestamp: () => `,"time":"${new Date().toJSON()}"` })

export { logPrefix, pino }
