import axios from 'axios'

const API = {
    TINYURL: 'https://tinyurl.com/api-create.php?url=',
    ISGD: 'https://is.gd/create.php?format=simple&url=',
}

export const shorten = async (url: string) => {
    const { data } = await axios.get(`${API.ISGD}${url}`)
    return data
}
