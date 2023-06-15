import axios from 'axios'
import FormData from 'form-data'

export async function uploadImage(image: Buffer): Promise<string> {
  const form = new FormData()
  form.append('file', image, 'tmp.jpg')
  const res = await axios.post('https://telegra.ph/upload', form, {
    headers: {
      ...form.getHeaders(),
    },
  })
  const resJson = await res.data
  if (resJson.error) throw new Error(resJson.error)
  return `https://telegra.ph${resJson[0].src}`
}

export async function memegen(
  top: string,
  bottom: string,
  image: string
): Promise<Buffer> {
  let topText = top
    .trim()
    .replace(/\s/g, '_')
    .replace(/\?/g, '~q')
    .replace(/%/g, '~p')
    .replace(/#/g, '~h')
    .replace(/\//g, '~s')
  let bottomText = bottom
    .trim()
    .replace(/\s/g, '_')
    .replace(/\?/g, '~q')
    .replace(/%/g, '~p')
    .replace(/#/g, '~h')
    .replace(/\//g, '~s')
  let url = `https://api.memegen.link/images/custom/${topText}/${bottomText}.png?background=${image}`
  let res = await axios.get(url, { responseType: 'arraybuffer' })
  return Buffer.from(res.data)
}
