import chalk from 'chalk'
import { BrowserContext, chromium, Browser } from 'playwright'

export class PlaywrightBrowser {
  private ctx: BrowserContext
  private browser: Browser

  constructor() {
    this.ctx = {} as any
  }

  async initBrowser() {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    console.log(chalk.green('Browser initialized!'))
    this.browser = browser
    this.ctx = context
    return this
  }

  async takeScreenshot(
    url: string,
    filePath: string,
    viewPort = { width: 1920, height: 1080 }
  ) {
    const page = await this.ctx.newPage()
    await page.setViewportSize(viewPort)

    try {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
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
    await page.waitForLoadState('networkidle')
    return page
  }

  async scrapeSSyoutube(url: string) {
    return new Promise<any>(async (resolve, reject) => {
      const page = await this.openPage('https://ssyoutube.com/en598/')
      try {
        await page.type('#id_url', url)
        await page.on('response', async (response) => {
          if (
            response.request().resourceType() === 'xhr' &&
            response.request().url().includes('convert')
          ) {
            resolve(await response.json())
            await page.close()
          }
        })
        await page.click('#search')
      } catch (error: any) {
        page.close()
        reject(error)
      }
    })
  }

  async refreshContext() {
    await this.ctx.close()
    this.ctx = await this.browser.newContext()
    console.log(chalk.green('Browser context refreshed!'))
  }

  async exit() {
    await this.ctx.close()
    await this.browser.close()
  }
}
