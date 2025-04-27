import axios from 'axios'

export type LyricsApiResponse = {
    status: boolean
    message: string
    data: LyricsApiData | null
}

export type LyricsApiData = {
    artist_name: string
    track_name: string
    track_id: number
    search_engine: string
    artwork_url: string
    lyrics: string
}

interface ILyricsApi {
    musixmatchWithTitle(title: string): Promise<LyricsApiResponse>
    musixmatchWithArtist(
        title: string,
        artist: string
    ): Promise<LyricsApiResponse>
}

export const LyricsApi: ILyricsApi = (() => {
    const BASE_URL = 'https://lyrics.lewdhutao.my.eu.org/'

    return {
        async musixmatchWithTitle(title: string): Promise<LyricsApiResponse> {
            const res = await axios.get(
                `${BASE_URL}/musixmatch/lyrics?title=${encodeURIComponent(
                    title
                )}`
            )

            if (res.data.status === 'error') {
                return {
                    status: false,
                    message: res.data.message,
                    data: null,
                }
            }

            return {
                status: true,
                message: res.data.message,
                data: res.data.data as LyricsApiData,
            }
        },

        async musixmatchWithArtist(
            title: string,
            artist: string
        ): Promise<LyricsApiResponse> {
            const res = await axios.get(
                `${BASE_URL}/musixmatch/lyrics-search?title=${encodeURIComponent(
                    title
                )}&artist=${encodeURIComponent(artist)}`
            )

            if (res.data.status === 'error') {
                return {
                    status: false,
                    message: res.data.message,
                    data: null,
                }
            }

            return {
                status: true,
                message: res.data.message,
                data: res.data.data as LyricsApiData,
            }
        },
    }
})()
