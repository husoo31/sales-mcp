import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

export async function takeScreenshot(url: string, leadId: string): Promise<string> {
  // Ensure the directory exists
  const publicDir = path.resolve(__dirname, '../../../web-panel/public/screenshots');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const screenshotPath = path.join(publicDir, `${leadId}.png`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: screenshotPath });
  } catch (err) {
    console.error(`Failed to take screenshot for ${url}:`, err);
    // Even if it fails, maybe take a partial screenshot if possible
    try {
      await page.screenshot({ path: screenshotPath });
    } catch (e) {
      // Ignore
    }
  } finally {
    await browser.close();
  }

  return `/screenshots/${leadId}.png`;
}
