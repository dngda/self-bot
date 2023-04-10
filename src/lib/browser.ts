import chalk from 'chalk'
import { BrowserContext, chromium } from 'playwright'

export class PlaywrightBrowser {
  private browser: BrowserContext

  constructor() {
    this.initBrowser()
  }

  async initBrowser() {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    console.log(chalk.green('Browser initialized!'))
    this.browser = context
  }

  async takeScreenshot(
    url: string,
    filePath: string,
    viewPort = { width: 1920, height: 1080 }
  ) {
    const page = await this.browser.newPage()
    await page.setViewportSize(viewPort)

    try {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ path: filePath })
      return true
    } catch (e) {
      console.log(e)
      return false
    }

    await page.close()
  }
}
