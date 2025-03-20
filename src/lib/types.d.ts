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
    model: FaceLiftingModel
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
    model: ColorEnhanceModel
}

export interface Settings {
    face_enhance: FaceEnhanceSettings
    background_enhance: BackgroundEnhanceSettings
    bokeh: BokehSettings
    jpeg_quality: number
    face_lifting: FaceLiftingSettings
    color_enhance: ColorEnhanceSettings
}
