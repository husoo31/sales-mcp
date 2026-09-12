import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();
  
  const clinicUrl = 'https://www.medicana.com.tr/';
  console.log(`Navigating to ${clinicUrl}...`);
  await page.goto(clinicUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait a bit for animations
  await page.waitForTimeout(2000);
  
  const destPath = path.resolve(__dirname, '../../apps/web-panel/public/screenshots/real-audit.png');
  console.log(`Saving screenshot to ${destPath}`);
  await page.screenshot({ path: destPath, fullPage: false });
  await browser.close();

  const stats = fs.statSync(destPath);
  console.log(`Screenshot saved, size: ${stats.size} bytes`);
  if (stats.size === 0) {
    throw new Error("Screenshot size is 0 bytes!");
  }
  
  console.log("Seeding database...");

  // 1. New Lead + Draft for Approval
  const lead1 = await prisma.lead.create({
    data: {
      clinicName: "Medicana Health Group",
      phone: "+90 850 460 6334",
      city: "Istanbul",
      status: "WAITING_APPROVAL",
      problem: "Mobil arayüzde doğrudan WhatsApp randevu aksiyonu eksik, sayfa açılışında gecikme var",
      drafts: {
        create: {
          content: "Merhaba Medicana Yetkilisi,\n\nDijital varlığınızı inceledik. Mobil arayüzünüzde doğrudan WhatsApp randevu butonu olmaması hasta kaybına yol açabiliyor. Size özel hazırladığımız 2 dakikalık tedavi demo teklifimizi incelemek ister misiniz?",
          status: "WAITING_APPROVAL",
          screenshotUrl: "/screenshots/real-audit.png"
        }
      }
    }
  });
  console.log("Created Approval Lead:", lead1.id);

  // 2. Follow-ups
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const today = new Date();

  const lead2 = await prisma.lead.create({
    data: {
      clinicName: "Estetik International",
      phone: "+90 212 555 11 22",
      city: "Istanbul",
      status: "WAITING_FOLLOWUP",
      followUpStatus: "WAITING_REPLY",
      scheduledFollowUpAt: threeDaysAgo,
      followUpCount: 1
    }
  });
  console.log("Created Follow-up Lead 1:", lead2.id);

  const lead3 = await prisma.lead.create({
    data: {
      clinicName: "Dentevim Ağız ve Diş Sağlığı",
      phone: "+90 532 444 55 66",
      city: "Izmir",
      status: "WAITING_FOLLOWUP",
      followUpStatus: "PROMISED_CALL",
      scheduledFollowUpAt: today,
      followUpCount: 0
    }
  });
  console.log("Created Follow-up Lead 2:", lead3.id);

  console.log("Database seeded successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
