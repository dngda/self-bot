// support url youtube, facebook, instagram, tiktok, twitter
import axios from 'axios'
const API_URL = 'https://sh.xznsenpai.xyz/api/download?url='

export const tiktokScraper = async (url: string) => {
  const { data } = await axios.get(`${API_URL}${url}`)
  return data
}
