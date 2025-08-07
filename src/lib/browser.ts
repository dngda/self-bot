import stealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BrowserContext, Browser, Page } from 'playwright'
import { chromium } from 'playwright-extra'
import { getRandom } from 'random-useragent'
import chalk from 'chalk'

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
