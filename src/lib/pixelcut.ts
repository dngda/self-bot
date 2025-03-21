import axios from 'axios'
import FormData from 'form-data'

export async function upscaleImage(
    imageBuffer: Buffer
): Promise<{ result_url: string }> {
    const formData = new FormData()
    formData.append('image', imageBuffer, 'image.jpg')
    formData.append('scale', '2')

    const response = await axios.post(
        'https://api2.pixelcut.app/image/upscale/v1',
        formData,
        {
            headers: {
                ...formData.getHeaders(),
                accept: 'application/json',
                'accept-language': 'en-US,en;q=0.9',
                authorization: '',
                priority: 'u=1, i',
                'sec-ch-ua': '"Not:A-Brand";v="24", "Chromium";v="134"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'x-client-version': 'web',
                Referer: 'https://www.pixelcut.ai/',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
            },
        }
    )
    return response.data
}
