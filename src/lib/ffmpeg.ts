import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'

export const videoToMp3 = async (buffer: Buffer): Promise<string> => {
  let i = 1
  while (fs.existsSync(`tmp/video${i}.mp4`)) {
    i++
  }
  return new Promise((resolve, reject) => {
    fs.writeFileSync(`tmp/video${i}.mp4`, buffer)
    // ffmpeg -b:a 192k -vn
    ffmpeg(`tmp/video${i}.mp4`)
      .audioBitrate(192)
      .noVideo()
      .save(`tmp/audio${i}.mp3`)
      .on('end', () => {
        resolve(`tmp/audio${i}.mp3`)
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}

export const splitVideo = async (buffer: Buffer): Promise<string[]> => {
  let i = 1
  while (fs.existsSync(`tmp/video${i}.mp4`)) {
    i++
  }
  
  return new Promise((resolve, reject) => {
    fs.writeFileSync(`tmp/video${i}.mp4`, buffer)
    ffmpeg(`tmp/video${i}.mp4`)
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
  let i = 1
  while (fs.existsSync(`tmp/audio${i}.opus`)) {
    i++
  }

  return new Promise((resolve, reject) => {
    ffmpeg(path)
      .audioCodec('libopus')
      .save(`tmp/audio${i}.opus`)
      .on('end', () => {
        resolve(`tmp/audio${i}.opus`)
      })
      .on('error', (err) => {
        reject(err)
      })
  })
}