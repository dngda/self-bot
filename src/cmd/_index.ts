import browser from './browser.js'
import general from './general.js'
import islam from './islam.js'
import owner from './owner.js'
import random from './random.js'
import downloader from './downloader.js'
import sticker from './sticker.js'
import tools from './tools.js'
import config from './config.js'
import script from './script.js'
import image from './image.js'

// Urutan pemanggilan akan menentukan urutan menu
export default () => {
    general()
    sticker()
    islam()
    downloader()
    random()
    browser()
    image()
    tools()
    script()

    config()
    owner()
}
