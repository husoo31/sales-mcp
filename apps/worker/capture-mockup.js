import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Launching browser for mockup screenshot...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  
  const htmlPath = path.resolve(__dirname, 'audit-mockup.html');
  const fileUrl = 'file://' + htmlPath.replace(/\\/g, '/');
  console.log(`Navigating to ${fileUrl}...`);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  
  // Wait a bit to ensure rendering
  await page.waitForTimeout(500);
  
  const destPath = path.resolve(__dirname, '../../apps/web-panel/public/screenshots/real-audit.png');
  console.log(`Saving screenshot to ${destPath}`);
  await page.screenshot({ path: destPath, fullPage: true });
  await browser.close();

  console.log("Updating database with matched problem text...");

  // Find the WAITING_APPROVAL lead(s) and update the problem text
  await prisma.lead.updateMany({
    where: {
      status: "WAITING_APPROVAL"
    },
    data: {
      problem: "Mobil sitede doğrudan WhatsApp randevu aksiyonu eksik; ziyaretçi fiyat veya randevu bilgisi alamadan sayfayı terk ediyor."
    }
  });
  
  // Make sure the MessageDraft has the correct screenshotUrl
  await prisma.messageDraft.updateMany({
    where: {
      status: "WAITING_APPROVAL"
    },
    data: {
      screenshotUrl: "/screenshots/real-audit.png"
    }
  });

  console.log("Mockup generation and DB update completed successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
