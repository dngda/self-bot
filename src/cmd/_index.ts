import browser from './browser'
import general from './general'
import islam from './islam'
import owner from './owner'
import random from './random'
import downloader from './downloader'
import sticker from './sticker'
import tools from './tools'
import config from './config'

// Urutan pemanggilan akan menentukan urutan menu
export default () => {
    general()
    sticker()
    islam()
    downloader()
    random()
    browser()
    tools()

    config()
    owner()
}
