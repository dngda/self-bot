import ffmpeg from 'fluent-ffmpeg'

export const convertMp4ToWebp = (input: string, output: string) => {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libwebp')
      .outputOptions([
        '-vf crop=in_h:in_h:in_h/3:0',
        '-preset default',
        '-lossless 1',
        '-loop 0',
        '-an',
      ])
      .output(output)
      .on('error', (err) => {
        reject(err)
      })
      .on('end', () => {
        resolve('file has been converted succesfully')
      })
      .run()
  })
}
