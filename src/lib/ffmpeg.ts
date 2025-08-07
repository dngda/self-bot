import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const ensureTmpDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export const videoToMp3 = async (buffer: Buffer): Promise<string> => {
    ensureTmpDir('tmp')
    let i = 1
    while (fs.existsSync(`tmp/video${i}.mp4`)) i++
    const inputPath = `tmp/video${i}.mp4`
    const outputPath = `tmp/audio${i}.mp3`
    fs.writeFileSync(inputPath, buffer)

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-ab',
            '192k',
            outputPath,
        ])
        ffmpeg.on('close', (code) => {
            fs.unlink(inputPath, () => {})
            if (code === 0) resolve(outputPath)
            else reject(new Error(`ffmpeg exited with code ${code}`))
        })
        ffmpeg.on('error', reject)
    })
}

export const splitVideo = async (
    id: string,
    buffer: Buffer
): Promise<string[]> => {
    ensureTmpDir('tmp')
    ensureTmpDir('tmp/vs')
    let i = 1
    while (fs.existsSync(`tmp/video${i}.mp4`)) i++
    const inputPath = `tmp/video${i}.mp4`
    const outputPattern = `tmp/vs/${id}_output%02d.mp4`
    fs.writeFileSync(inputPath, buffer)

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i',
            inputPath,
            '-c',
            'copy',
            '-map',
            '0',
            '-segment_time',
            '27',
            '-f',
            'segment',
            '-reset_timestamps',
            '1',
            outputPattern,
        ])
        ffmpeg.on('close', (code) => {
            fs.unlink(inputPath, () => {})
            if (code === 0) {
                const files = fs
                    .readdirSync('tmp/vs')
                    .filter(
                        (f) =>
                            f.startsWith(`${id}_output`) && f.endsWith('.mp4')
                    )
                    .map((f) => path.join('tmp/vs', f))
                resolve(files)
            } else reject(new Error(`ffmpeg exited with code ${code}`))
        })
        ffmpeg.on('error', reject)
    })
}

export const mp3ToOpus = async (
    inputPath: string,
    target = ''
): Promise<string> => {
    ensureTmpDir('tmp')
    let _target = target
    if (!_target) {
        let i = 1
        while (fs.existsSync(`tmp/audio${i}.opus`)) i++
        _target = `tmp/audio${i}.opus`
    }

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i',
            inputPath,
            '-c:a',
            'libopus',
            _target,
        ])
        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(_target)
            else reject(new Error(`ffmpeg exited with code ${code}`))
        })
        ffmpeg.on('error', reject)
    })
}

export const gifToMp4 = async (buffer: Buffer): Promise<string> => {
    ensureTmpDir('tmp')
    let i = 1
    while (fs.existsSync(`tmp/sticker${i}.gif`)) i++
    const inputPath = `tmp/sticker${i}.gif`
    const outputPath = `tmp/sticker${i}.mp4`
    fs.writeFileSync(inputPath, buffer)

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-i',
            inputPath,
            '-movflags',
            'faststart',
            '-pix_fmt',
            'yuv420p',
            outputPath,
        ])
        ffmpeg.on('close', (code) => {
            fs.unlink(inputPath, () => {})
            if (code === 0) resolve(outputPath)
            else reject(new Error(`ffmpeg exited with code ${code}`))
        })
        ffmpeg.on('error', reject)
    })
}
