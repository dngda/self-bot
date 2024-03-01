import axios from 'axios'

export const apiCall = async (url: string) => {
    const response = await axios.get(url)
    return response.data
}
