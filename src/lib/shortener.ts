import axios from 'axios'

const API_URL = 'https://tinyurl.com/api-create.php?url='

export const tinyUrl = async (url: string) => {
  const { data } = await axios.get(`${API_URL}${url}`)
  return data
}
