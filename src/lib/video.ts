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
