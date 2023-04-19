import axios from 'axios'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'

// support url youtube, facebook, instagram, tiktok, twitter
const API_URL = 'https://sh.xznsenpai.xyz/api/download?url='

export const videoDownloader = async (url: string) => {
  const { data } = await axios.get(`${API_URL}${url}`)
  return data
}

export const videoToMp3 = async (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.writeFileSync('/tmp/video.mp4', buffer)
    ffmpeg('/tmp/video.mp4')
      .audioBitrate(128)
      .save('/tmp/audio.mp3')
      .on('end', () => {
        resolve('/tmp/audio.mp3')
      })
      .on('error', (err: any) => {
        reject(err)
      })
  })
}
