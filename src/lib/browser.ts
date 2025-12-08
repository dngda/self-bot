import type { Browser, BrowserContext, Page } from 'playwright'
import stealthPlugin from 'puppeteer-extra-plugin-stealth'
import { chromium } from 'playwright-extra'
import { getRandom } from 'random-useragent'
import chalk from 'chalk'

export class PlaywrightBrowser {
    private ctx!: BrowserContext
    private browser!: Browser
    private headless: boolean
    private initialized = false

    private constructor(headless: boolean) {
        this.headless = headless
    }

    static async create(headless = true): Promise<PlaywrightBrowser> {
        const instance = new PlaywrightBrowser(headless)
        await instance.init()
        return instance
    }

    private async init() {
        if (this.initialized) return

        chromium.use(stealthPlugin())
        this.browser = await chromium.launch({ headless: this.headless })
        this.ctx = await this.browser.newContext({
            userAgent: getRandom(),
        })
        this.initialized = true
        console.log(chalk.green('Browser initialized!'))
    }

    private ensureInitialized() {
        if (!this.initialized) {
            throw new Error(
                'Browser not initialized. Use PlaywrightBrowser.create() instead of constructor.'
            )
        }
    }

    async takeScreenshot(
        url: string,
        filePath: string,
        viewPort = { width: 1920, height: 1080 },
        delay = 0,
        extraStep?: (page: Page) => Promise<void>
    ): Promise<boolean> {
        this.ensureInitialized()
        const page = await this.ctx.newPage()
        await page.setViewportSize(viewPort)

        try {
            await page.goto(url)
            await page.waitForLoadState('domcontentloaded')
            if (delay > 0) {
                await page.waitForTimeout(delay)
            }
            if (extraStep) {
                await extraStep(page)
            }
            await page.screenshot({ path: filePath })
            return true
        } catch (e) {
            console.error(chalk.red('Screenshot error:'), e)
            return false
        } finally {
            await page.close()
        }
    }

    async takeElementScreenshot(
        url: string,
        selector: string,
        filePath: string,
        viewPort = { width: 1920, height: 1080 },
        extraStep?: (page: Page) => Promise<void>
    ): Promise<boolean> {
        this.ensureInitialized()
        const page = await this.ctx.newPage()
        await page.setViewportSize(viewPort)

        try {
            await page.goto(url)
            await page.waitForLoadState('domcontentloaded')
            if (extraStep) {
                await extraStep(page)
            }
            const element = await page.$(selector)
            if (!element) {
                console.warn(chalk.yellow(`Element not found: ${selector}`))
                return false
            }

            await element.screenshot({
                path: filePath,
                animations: 'disabled',
            })
            return true
        } catch (e) {
            console.error(chalk.red('Element screenshot error:'), e)
            return false
        } finally {
            await page.close()
        }
    }

    async openPage(url: string): Promise<Page> {
        this.ensureInitialized()
        const page = await this.ctx.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded' })
        return page
    }

    async refreshContext(): Promise<void> {
        this.ensureInitialized()

        if (!this.browser.isConnected()) {
            this.browser = await chromium.launch({ headless: this.headless })
        }

        await this.ctx.close()
        this.ctx = await this.browser.newContext({ userAgent: getRandom() })
        console.log(chalk.green('Browser context refreshed!'))
    }

    async exit(): Promise<void> {
        if (!this.initialized) return

        try {
            await this.ctx?.close()
            await this.browser?.close()
            this.initialized = false
            console.log(chalk.green('Browser closed!'))
        } catch (e) {
            console.error(chalk.red('Error closing browser:'), e)
        }
    }
}
