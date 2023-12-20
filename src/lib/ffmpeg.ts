import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'

export const videoToMp3 = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.writeFileSync('tmp/video.mp4', buffer)
    // ffmpeg -b:a 192k -vn
    ffmpeg('tmp/video.mp4')
      .audioBitrate(192)
      .noVideo()
      .save('tmp/audio.mp3')
      .on('end', () => {
        resolve('tmp/audio.mp3')
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export const splitVideo = async (buffer: Buffer): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.writeFileSync('tmp/video.mp4', buffer)
    ffmpeg('tmp/video.mp4')
      .outputOptions([
        '-c copy',
        '-map 0',
        '-segment_time 27',
        '-f segment',
        '-reset_timestamps 1',
      ])
      .save('tmp/vs/output%02d.mp4')
      .on('end', () => {
        resolve(fs.readdirSync('tmp/vs'))
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export const mp3toOpus = async (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(path)
      .audioCodec('libopus')
      .save('tmp/audio.opus')
      .on('end', () => {
        resolve('tmp/audio.opus')
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export const mp3toMp3 = async (path: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg(path)
      .audioBitrate(192)
      .save('tmp/audio.mp3')
      .on('end', () => {
        resolve('tmp/audio.mp3')
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}