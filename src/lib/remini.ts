/* eslint-disable @typescript-eslint/no-explicit-any */
// 🎁 REMINI & REMOVE WATERMARK
// 💻 Base URL 1 : https://remini.ai
// 💻 Base URL 2 : https://www.watermarkremover.io
// 👨‍💻 Author : Fahmi
// 📥 Request: fahmixd404@gmail.com
// 🍀 Request from: leooxzydekuuu@gmail.com
// ☕ Code : https://gist.github.com/Fahmi-XD/796dbb77597d082c8b8f13fd249e9ef4
// Thanks For : Fahmi-XD
// Coverted to TypeScript by: dngda

import crypto from 'crypto'
import axios, { AxiosRequestConfig } from 'axios'
import FormData from 'form-data'
import { BokehSettings, ColorEnhanceModel, FaceLiftingModel, Settings } from './types'

const BASE_URL = 'https://app.remini.ai'
const URL_USER = '/api/v1/web/users'
const URL_BULK = '/api/v1/web/tasks/bulk-upload'
const URL_APPROVAL = '/api/v1/web/tasks/bulk-upload/BULK_UPLOAD_ID/process'
const URL_TASK = '/api/v1/web/tasks/bulk-upload/'

const BASE_URL_WM = 'https://api.watermarkremover.io'
const URL_REMOVE_WM =
    '/service/public/transformation/v1.0/predictions/wm/remove'
const URL_SECRET =
    'https://api.pixelbin.io/service/public/transformation/v1.0/predictions/wm/remove'
const SIGN_KEY = 'A4nzUYcDOZ'

const headersListWm: Record<string, string> = {
    authority: 'api.watermarkremover.io',
    accept: 'application/json, text/plain, */*',
    origin: 'https://www.watermarkremover.io',
    referer: 'https://www.watermarkremover.io/',
    'user-agent': 'Mozilla/5.0',
}

const headersList: Record<string, string> = {
    authority: 'app.remini.ai',
    accept: '*/*',
    'content-type': 'application/json',
    origin: 'https://app.remini.ai',
    referer: 'https://app.remini.ai/',
    'user-agent': 'Mozilla/5.0',
}

export const BACKGROUND_BLUR: { [index: string]: BokehSettings } = {
    LOW: {
        aperture_radius: '0.30',
        highlights: '0.25',
        vivid: '0.75',
        group_picture: 'true',
        rescale_kernel_for_small_images: 'true',
        apply_front_bokeh: 'false',
    },
    MED: {
        aperture_radius: '0.65',
        highlights: '0.50',
        vivid: '0.40',
        group_picture: 'true',
        rescale_kernel_for_small_images: 'true',
        apply_front_bokeh: 'false',
    },
    HIGH: {
        aperture_radius: '0.80',
        highlights: '0.60',
        vivid: '0.60',
        group_picture: 'true',
        rescale_kernel_for_small_images: 'true',
        apply_front_bokeh: 'false',
    },
}

export const FACE_LIFTING: { [index: string]: FaceLiftingModel } = {
    MOVIE: 'movie-style',
    GLAM: 'glam-style',
    CUTE: 'stylegan-v1',
    NATURAL: 'bendai-style',
    SILK: 'pinko-style',
    CHARM: 'fa_charm_unset-style',
}

export const COLOR_ENHANCE: { [index: string]: ColorEnhanceModel } = {
    GOLDEN: 'prism-expert-c',
    STEADY: 'prism-blend',
    BALANCED: 'prism-expert-a',
    ORANGE: 'orange-teal',
    SILKY: 'silky',
    MUTED: 'muted',
    TEAL: 'orange-teal_v2',
    SOFTWARM: 'lit_soft_warm',
}

const BULK_PAYLOAD = (settings: Partial<Settings>) => ({
    input_task_list: [
        {
            image_content_type: 'image/jpeg',
            output_content_type: 'image/jpeg',
            ai_pipeline: settings,
        },
    ],
})

function delay(msec: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, msec))
}

async function req(
    url: string,
    method: string = 'GET',
    data: any = null,
    headers: Record<string, string> = headersList
): Promise<any> {
    try {
        const config: AxiosRequestConfig = {
            url,
            method,
            headers,
            ...(data ? { data } : {}),
        }
        const response = await axios(config)
        return response
    } catch (error) {
        console.error(error)
        return null
    }
}

async function init(): Promise<boolean> {
    const response = await req(BASE_URL + URL_USER, 'POST')
    const json = response?.data
    headersList['Authorization'] = `Bearer ${json.access_token}`
    return true
}

async function upload(settings: Partial<Settings>): Promise<any> {
    const response = await req(
        BASE_URL + URL_BULK,
        'POST',
        JSON.stringify(BULK_PAYLOAD(settings))
    )
    return response?.data
}

async function approval(
    data: any,
    settings: Partial<Settings>
): Promise<number> {
    const response = await req(
        BASE_URL + URL_APPROVAL.replace('BULK_UPLOAD_ID', data.bulk_upload_id),
        'POST',
        JSON.stringify(BULK_PAYLOAD(settings))
    )
    return response?.status
}

async function send(data: any, buffer: Buffer): Promise<number> {
    headersList['content-type'] = 'image/jpeg'
    headersList['x-goog-custom-time'] =
        data.task_list[0].upload_headers['x-goog-custom-time']
    const response = await req(data.task_list[0].upload_url, 'PUT', buffer)
    return response?.status
}

async function task(data: any): Promise<any> {
    headersList['content-type'] = 'application/json'
    const response = await req(BASE_URL + URL_TASK + data.bulk_upload_id)
    return response?.data
}

async function initSignature(): Promise<void> {
    const iso = new Date().toISOString()
    const params = Buffer.from(iso).toString('base64')
    const uri = new URL(URL_SECRET)
    const vis = crypto.randomUUID()
    const hm = `POST${encodeURI(uri.pathname + uri.search)}${iso}${vis}`
    const sig = crypto.createHmac('sha256', SIGN_KEY).update(hm).digest('hex')
    headersListWm['x-ebg-param'] = params
    headersListWm['x-ebg-signature'] = sig
    headersListWm['pixb-cl-id'] = vis
}

async function approvalWm(): Promise<number> {
    const response = await req(
        BASE_URL_WM + URL_REMOVE_WM,
        'OPTIONS',
        null,
        headersListWm
    )
    return response?.status
}

export async function remove(image: string | Buffer): Promise<any> {
    try {
        let buffer: Buffer

        if (typeof image === 'string' && /https?:\/\//i.test(image)) {
            const response = await axios.get(image, {
                responseType: 'arraybuffer',
            })
            buffer = Buffer.from(response.data)
        } else {
            buffer = image as Buffer
        }

        const status = await approvalWm()
        if (status !== 204) {
            throw new Error('[WARN] Request denied.')
        }

        await initSignature()

        const form = new FormData()
        form.append('input.image', buffer, {
            filename: `${crypto.randomUUID()}.jpg`,
            contentType: 'image/jpeg',
        })
        form.append('input.rem_text', 'false')
        form.append('input.rem_logo', 'false')
        form.append('retention', '1d')

        const response = await req(BASE_URL_WM + URL_REMOVE_WM, 'POST', form, {
            ...headersListWm,
            ...form.getHeaders(),
        })
        const json = response?.data

        if (json.status === 'ACCEPTED') {
            while (true) {
                const resultResponse = await req(json.urls.get, 'GET')
                const resultJson = resultResponse?.data
                if (resultJson.status === 'SUCCESS') {
                    return resultJson
                }
                await delay(5000)
            }
        }

        return null
    } catch (error) {
        console.error(error)
        return null
    }
}

const DEFAULT_SETTINGS: Partial<Settings> = {
    face_enhance: {
        model: 'remini',
    },
    background_enhance: {
        model: 'rhino-tensorrt',
    },
    bokeh: BACKGROUND_BLUR.LOW,
    jpeg_quality: 90,
}

export async function Remini(
    img: string | Buffer,
    settings: Partial<Settings> = {}
): Promise<{ no_wm: string; wm: string } | null> {
    const SETTINGS: Partial<Settings> = {
        face_enhance: {
            model: DEFAULT_SETTINGS.face_enhance?.model || settings.face_enhance?.model,
            pre_blur: settings.face_enhance?.pre_blur,
        },
        background_enhance: {
            model:
                settings.background_enhance?.model ||
                DEFAULT_SETTINGS.background_enhance?.model,
        },
        bokeh: {
            aperture_radius:
                settings.bokeh?.aperture_radius ||
                DEFAULT_SETTINGS.bokeh?.aperture_radius,
            highlights:
                settings.bokeh?.highlights ||
                DEFAULT_SETTINGS.bokeh?.highlights,
            vivid: settings.bokeh?.vivid || DEFAULT_SETTINGS.bokeh?.vivid,
            group_picture:
                settings.bokeh?.group_picture ||
                DEFAULT_SETTINGS.bokeh?.group_picture,
            rescale_kernel_for_small_images:
                settings.bokeh?.rescale_kernel_for_small_images ||
                DEFAULT_SETTINGS.bokeh?.rescale_kernel_for_small_images,
            apply_front_bokeh:
                settings.bokeh?.apply_front_bokeh ||
                DEFAULT_SETTINGS.bokeh?.apply_front_bokeh,
        },
        jpeg_quality: settings.jpeg_quality || DEFAULT_SETTINGS.jpeg_quality,
    }

    console.log(SETTINGS)

    try {
        let buffer: Buffer

        if (Buffer.isBuffer(img)) {
            buffer = img
        } else {
            const response = await axios.get(img, {
                responseType: 'arraybuffer',
            })
            buffer = Buffer.from(response.data)
        }

        await init()
        const data = await upload(SETTINGS)
        const sendStatus = await send(data, buffer)

        if (sendStatus !== 200) {
            throw new Error('[WARN] Image failed to send.')
        }

        const approvalStatus = await approval(data, SETTINGS)
        if (approvalStatus !== 202) {
            throw new Error('[WARN] Request denied.')
        }

        let wm: any
        while (true) {
            const taskData = await task(data)
            if (taskData.task_list[0].status === 'completed') {
                wm = taskData
                break
            }
            await delay(2000)
        }

        let no_wm: string
        if (wm.task_list[0].result.outputs[0].has_watermark) {
            const removed = await remove(wm.task_list[0].result.outputs[0].url)
            no_wm = removed
                ? removed.output[0]
                : wm.task_list[0].result.outputs[0].url
        } else {
            no_wm = wm.task_list[0].result.outputs[0].url
        }

        return { no_wm, wm: wm.task_list[0].result.outputs[0].url }
    } catch (error) {
        throw new Error(error as string)
    }
}
