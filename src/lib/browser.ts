import stealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BrowserContext, Browser, Page, Response } from 'playwright'
import { chromium } from 'playwright-extra'
import { getRandom } from 'random-useragent'
import chalk from 'chalk'

export interface VideoData {
    id: string
    url: {
        url: string
        name: string
        ext: string
        type: string
        quality: string
        no_audio: boolean
        audio: boolean
        attr: {
            title: string
            class: string
        }
    }[]
    meta: {
        title: string
        source: string
        duration: string
    }
    thumb: string
    video_quality: string[]
    timestamp: number
    message: string
}

export class PlaywrightBrowser {
    private ctx: BrowserContext
    private browser: Browser

    constructor(headless = true) {
        this.init(headless)
    }

    async init(headless: boolean) {
        chromium.use(stealthPlugin())
        const browser = await chromium.launch({ headless })
        const context = await browser.newContext({
            userAgent: getRandom(),
        })
        console.log(chalk.green('Browser initialized!'))
        this.browser = browser
        this.ctx = context
        return this
    }

    async takeScreenshot(
        url: string,
        filePath: string,
        viewPort = { width: 1920, height: 1080 },
        delay = 0,
        extraStep?: (page: Page) => Promise<void>
    ) {
        const page = await this.ctx.newPage()
        await page.setViewportSize(viewPort)

        try {
            await page.goto(url)
            await page.waitForLoadState('domcontentloaded')
            await page.waitForTimeout(delay)
            await extraStep?.(page)
            await page.screenshot({ path: filePath })
            await page.close()
            return true
        } catch (e) {
            console.log(e)
            await page.close()
            return false
        }
    }

    async takeElementScreenshot(
        url: string,
        selector: string,
        filePath: string,
        viewPort = { width: 1920, height: 1080 },
        extraStep?: (page: Page) => Promise<void>
    ) {
        const page = await this.ctx.newPage()
        await page.setViewportSize(viewPort)

        try {
            await page.goto(url)
            await page.waitForLoadState('domcontentloaded')
            await extraStep?.(page)
            const element = await page.$(selector)
            if (element) {
                await element.screenshot({
                    path: filePath,
                    animations: 'disabled',
                })

                await page.close()
                return true
            }

            await page.close()
            return false
        } catch (e) {
            console.log(e)
            await page.close()
            return false
        }
    }

    async openPage(url: string) {
        const page = await this.ctx.newPage()
        await page.goto(url)
        await page.waitForLoadState()
        return page
    }

    async getSocialVideo(url: string): Promise<VideoData> {
        const page = await this.openPage('https://ssyoutube.com/')

        const handleResponse = (page: Page): Promise<VideoData> => {
            return new Promise((resolve, reject) => {
                page.on('response', async (response: Response) => {
                    if (
                        response.request().resourceType() === 'xhr' &&
                        response.request().url().includes('convert')
                    ) {
                        try {
                            const data = await response.json()
                            resolve(data)
                        } catch (error: unknown) {
                            reject(error)
                        }
                    }
                })
            })
        }

        try {
            await page.fill('#id_url', url)
            await page.click('#search')

            const result = await handleResponse(page)
            await page.close()
            return result
        } catch (error) {
            await page.close()
            throw error
        }
    }

    async refreshContext() {
        await this.ctx.close()
        this.ctx = await this.browser.newContext({ userAgent: getRandom() })
        console.log(chalk.green('Browser context refreshed!'))
    }

    async exit() {
        await this.ctx.close()
        await this.browser.close()
    }
}
