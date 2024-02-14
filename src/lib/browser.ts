import stealthPlugin from 'puppeteer-extra-plugin-stealth'
import { BrowserContext, Browser, Page, Response } from 'playwright'
import { chromium } from 'playwright-extra'
import { getRandom } from 'random-useragent'
import chalk from 'chalk'

export class PlaywrightBrowser {
  private ctx: BrowserContext
  private browser: Browser

  constructor() {
    this.ctx = {} as any
  }

  async init(headless = true) {
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
    delay = 0
  ) {
    const page = await this.ctx.newPage()
    await page.setViewportSize(viewPort)

    try {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(delay)
      await page.screenshot({ path: filePath })
      await page.close()
      return true
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

  async getSocialVideo(url: string) {
    const page = await this.openPage('https://ssyoutube.com/')

    // Handle the response separately
    const handleResponse = (page: Page): Promise<any> => {
      return new Promise((resolve, reject) => {
        page.on('response', async (response: Response) => {
          if (
            response.request().resourceType() === 'xhr' &&
            response.request().url().includes('convert')
          ) {
            try {
              const data = await response.json()
              resolve(data)
            } catch (error) {
              reject(error)
            }
          }
        })
      })
    }

    try {
      await page.type('#id_url', url)
      await page.click('#search')

      // Wait for the response
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
