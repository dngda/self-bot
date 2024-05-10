import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'

export const videoToMp3 = async (buffer: Buffer): Promise<string> => {
    let i = 1
    while (fs.existsSync(`tmp/video${i}.mp4`)) {
        i++
    }
    return new Promise((resolve, reject) => {
        fs.writeFileSync(`tmp/video${i}.mp4`, buffer)
        ffmpeg(`tmp/video${i}.mp4`)
            .audioBitrate(192)
            .noVideo()
            .save(`tmp/audio${i}.mp3`)
            .on('end', () => {
                fs.unlink(`tmp/video${i}.mp4`, (_) => _)
                resolve(`tmp/audio${i}.mp3`)
            })
            .on('error', (err) => {
                reject(err)
            })
    })
}

export const splitVideo = async (id: string, buffer: Buffer): Promise<string[]> => {
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
            .save(`tmp/vs/${id}_output%02d.mp4`)
            .on('end', () => {
                fs.unlink(`tmp/video${i}.mp4`, (_) => _)
                resolve(fs.readdirSync('tmp/vs'))
            })
            .on('error', (err) => {
                reject(err)
            })
    })
}

export const mp3ToOpus = async (path: string, target = ''): Promise<string> => {
    let _target = target
    if (!_target) {
        let i = 1
        while (fs.existsSync(`tmp/audio${i}.opus`)) {
            i++
        }
        _target = `tmp/audio${i}.opus`
    }

    return new Promise((resolve, reject) => {
        ffmpeg(path)
            .audioCodec('libopus')
            .save(_target)
            .on('end', () => {
                resolve(_target)
            })
            .on('error', (err) => {
                reject(err)
            })
    })
}

export const gifToMp4 = async (buffer: Buffer): Promise<string> => {
    let i = 1
    while (fs.existsSync(`tmp/sticker${i}.gif`)) {
        i++
    }

    return new Promise((resolve, reject) => {
        fs.writeFileSync(`tmp/sticker${i}.gif`, buffer)
        ffmpeg(`tmp/sticker${i}.gif`)
            .outputOptions(['-movflags faststart', '-pix_fmt yuv420p'])
            .save(`tmp/sticker${i}.mp4`)
            .on('end', () => {
                fs.unlink(`tmp/sticker${i}.gif`, (_) => _)
                resolve(`tmp/sticker${i}.mp4`)
            })
            .on('error', (err) => {
                reject(err)
            })
    })
}
