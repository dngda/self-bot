import axios from 'axios'
import { PinSearchContainer, PinSearchResponse } from './types.js'

export const pinterest = {
    api: {
        base: 'https://www.pinterest.com',
        endpoints: {
            search: '/resource/BaseSearchResource/get/',
            pin: '/resource/PinResource/get/',
            user: '/resource/UserResource/get/',
        },
    },

    headers: {
        accept: 'application/json, text/javascript, */*, q=0.01',
        referer: 'https://www.pinterest.com/',
        'user-agent': 'Postify/1.0.0',
        'x-app-version': 'a9522f',
        'x-pinterest-appstate': 'active',
        'x-pinterest-pws-handler': 'www/[username]/[slug].js',
        'x-pinterest-source-url': '/search/pins/?rs=typed&q=sullyoon/',
        'x-requested-with': 'XMLHttpRequest',
    },

    isUrl: (str: string) => {
        try {
            new URL(str)
            return true
        } catch (_) {
            return false
        }
    },

    isPin: (url: string) => {
        if (!url) return false
        const patterns = [
            /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/[\w.-]+/,
            /^https?:\/\/(?:www\.)?pinterest\.[\w.]+\/pin\/[\w.-]+/,
            /^https?:\/\/(?:www\.)?pinterest\.(?:ca|co\.uk|com\.au|de|fr|id|es|mx|br|pt|jp|kr|nz|ru|at|be|ch|cl|dk|fi|gr|ie|nl|no|pl|pt|se|th|tr)\/pin\/[\w.-]+/,
            /^https?:\/\/pin\.it\/[\w.-]+/,
            /^https?:\/\/(?:www\.)?pinterest\.com\/amp\/pin\/[\w.-]+/,
            /^https?:\/\/(?:[a-z]{2}|www)\.pinterest\.com\/pin\/[\w.-]+/,
            /^https?:\/\/(?:www\.)?pinterest\.com\/pin\/[\d]+(?:\/)?$/,
            /^https?:\/\/(?:www\.)?pinterest\.[\w.]+\/pin\/[\d]+(?:\/)?$/,
            /^https?:\/\/(?:www\.)?pinterestcn\.com\/pin\/[\w.-]+/,
            /^https?:\/\/(?:www\.)?pinterest\.com\.[\w.]+\/pin\/[\w.-]+/,
        ]

        const clean = url.trim().toLowerCase()
        return patterns.some((pattern) => pattern.test(clean))
    },

    getCookies: async () => {
        try {
            const response = await axios.get(pinterest.api.base)
            const setHeaders = response.headers['set-cookie']
            if (setHeaders) {
                const cookies = setHeaders.map((cookieString) => {
                    const cp = cookieString.split(';')
                    const cv = cp[0].trim()
                    return cv
                })
                return cookies.join('; ')
            }
            return null
        } catch (error) {
            console.error(error)
            return null
        }
    },

    search: async (query: string, limit = 10) => {
        if (!query) {
            return {
                status: false,
                code: 400,
                result: {
                    message:
                        'Query nya mana nih? Gua kagak bisa searching tanpa query 😂',
                },
            }
        }

        try {
            const cookies = await pinterest.getCookies()
            if (!cookies) {
                return {
                    status: false,
                    code: 400,
                    result: {
                        message:
                            'Gua kagak bisa dapetin cookies buat searching nih 😂',
                    },
                }
            }

            const params = {
                source_url: `/search/pins/?q=${query}`,
                data: JSON.stringify({
                    options: {
                        isPrefetch: false,
                        query: query,
                        scope: 'pins',
                        bookmarks: [''],
                        no_fetch_context_on_resource: false,
                        page_size: limit,
                    },
                    context: {},
                }),
                _: Date.now(),
            }

            const { data } = await axios.get(
                `${pinterest.api.base}${pinterest.api.endpoints.search}`,
                {
                    headers: { ...pinterest.headers, cookie: cookies },
                    params: params,
                }
            )

            const container: PinSearchContainer[] = []
            const results = data.resource_response.data.results.filter(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (v: any) => v.images?.orig
            )

            results.forEach((result: PinSearchResponse) => {
                container.push({
                    id: result.id,
                    title: result.title || '',
                    description: result.description,
                    pin_url: `https://pinterest.com/pin/${result.id}`,
                    media: {
                        images: {
                            orig: result.images.orig,
                            small: result.images['236x'],
                            medium: result.images['474x'],
                            large: result.images['736x'],
                        },
                        video: result.videos
                            ? {
                                  video_list: result.videos.video_list,
                              }
                            : null,
                    },
                    uploader: {
                        username: result.pinner.username,
                        full_name: result.pinner.full_name,
                        profile_url: `https://pinterest.com/${result.pinner.username}`,
                    },
                })
            })

            if (container.length === 0) {
                return {
                    status: false,
                    code: 404,
                    result: {
                        message: `Gua gak nemu hasilnya nih 😂`,
                    },
                }
            }

            return {
                status: true,
                code: 200,
                result: {
                    query: query,
                    total: container.length,
                    pins: container,
                },
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            return {
                status: false,
                code: error.response?.status || 500,
                result: {
                    message:
                        'Gua kagak bisa searching nih, coba lagi lain waktu 😂',
                },
            }
        }
    },
}
