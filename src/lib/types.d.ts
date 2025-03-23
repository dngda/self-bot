/* eslint-disable @typescript-eslint/no-explicit-any */
interface FaceEnhanceSettings {
    model?: string
    pre_blur?: number
}

interface BackgroundEnhanceSettings {
    model?: 'rhino-tensorrt' | 'remini-tensorrt'
}

interface BokehSettings {
    aperture_radius?: string
    highlights?: string
    vivid?: string
    group_picture?: string
    rescale_kernel_for_small_images?: string
    apply_front_bokeh?: string
}

type FaceLiftingModel =
    | 'movie-style'
    | 'glam-style'
    | 'stylegan-v1'
    | 'bendai-style'
    | 'pinko-style'
    | 'fa_charm_unset-style'
interface FaceLiftingSettings {
    model?: FaceLiftingModel
}

type ColorEnhanceModel =
    | 'prism-expert-c'
    | 'prism-blend'
    | 'prism-expert-a'
    | 'orange-teal'
    | 'silky'
    | 'muted'
    | 'orange-teal_v2'
    | 'lit_soft_warm'
interface ColorEnhanceSettings {
    model?: ColorEnhanceModel
}

export interface Settings {
    face_enhance: FaceEnhanceSettings
    background_enhance: BackgroundEnhanceSettings
    bokeh: BokehSettings
    jpeg_quality: number
    face_lifting: FaceLiftingSettings
    color_enhance: ColorEnhanceSettings
}

interface PinImage {
    width: number
    height: number
    url: string
}

interface PinVideo {
    url: string
    width: number
    height: number
    duration: number
    thumbnail: string
    captions_url: any
}

export interface PinSearchContainer {
    id: string
    title: string
    description: string
    pin_url: string
    media: {
        images: {
            orig: PinImage
            small: PinImage
            medium: PinImage
            large: PinImage
        }
        video: {
            video_list:
                | {
                      V_HLSV4?: PinVideo
                      V_HLSV3_MOBILE?: PinVideo
                  }
                | any
        } | null
    }
    uploader: {
        username: string
        full_name: string
        profile_url: string
    }
}

export interface PinSearchResponse {
    id: string
    title: string
    description: string
    images: {
        orig: PinImage
        '236x': PinImage
        '474x': PinImage
        '736x': PinImage
    }
    videos?: {
        video_list: any[]
    }
    pinner: {
        username: string
        full_name: string
    }
}
