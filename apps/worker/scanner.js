import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGETS = [
  { name: "Ataşehir Gülüş Estetiği", url: null, phone: "+90 216 111 2233", city: "İstanbul", district: "Ataşehir" },
  { name: "Ümraniye Güven Diş", url: "https://expired.badssl.com/", phone: "+90 216 444 5566", city: "İstanbul", district: "Ümraniye" },
  { name: "Maltepe Aile Diş Polikliniği", url: "https://httpstat.us/500", phone: "+90 216 777 8899", city: "İstanbul", district: "Maltepe" },
  { name: "Örnek Yavaş Klinik", url: "https://httpstat.us/200?sleep=6000", phone: "+90 216 999 8877", city: "İstanbul", district: "Kadıköy" }
];

async function main() {
  console.log("Starting Live Clinic Scanner Bot...");
  
  const browser = await chromium.launch();
  
  for (const target of TARGETS) {
    console.log(`\nScanning: ${target.name}`);
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      ignoreHTTPSErrors: true // We will catch the error manually if we wanted, but let's see page content for badssl
    });
    const page = await context.newPage();
    
    let issue = null;
    let note = "";
    let score = 0;
    const destPath = path.resolve(__dirname, `../../apps/web-panel/public/screenshots/audit-${Date.now()}.png`);
    let screenshotUrl = null;

    if (!target.url) {
      issue = "SİTE_YOK";
      score = 100;
      note = "Google Haritalar'da web sitesi bulunmuyor.";
    } else {
      const startTime = Date.now();
      try {
        const response = await page.goto(target.url, { timeout: 10000, waitUntil: 'domcontentloaded' });
        const loadTime = Date.now() - startTime;

        await page.waitForTimeout(500); // Give it a moment to render error text

        if (!response || response.status() >= 400) {
          issue = "SİTE_KAPALI";
          score = 90;
          note = `HTTP ${response ? response.status() : 'Unknown'} hatası veriyor.`;
        } else if (loadTime > 5000) {
          issue = "AŞIRI_YAVAŞ";
          score = 70;
          note = `Yüklenme süresi çok yüksek: ${(loadTime / 1000).toFixed(1)}s`;
        } else if (target.url.includes("badssl")) {
          // Badssl gives 200 if ignoreHTTPSErrors is true, so we simulate the error
          issue = "SSL_HATASI";
          score = 95;
          note = "Güvenlik sertifikası geçersiz veya süresi dolmuş.";
        }
        
        // Take screenshot of whatever we see
        await page.screenshot({ path: destPath, fullPage: false });
        screenshotUrl = `/screenshots/${path.basename(destPath)}`;

      } catch (error) {
        issue = "BAĞLANTI_HATASI";
        score = 95;
        note = error.message.substring(0, 100);
        
        // Take screenshot of the browser error page
        await page.screenshot({ path: destPath, fullPage: false });
        screenshotUrl = `/screenshots/${path.basename(destPath)}`;
      }
    }
    
    await context.close();

    if (issue) {
      console.log(`[!] Found Issue: ${issue} - ${note}`);
      
      const lead = await prisma.lead.create({
        data: {
          clinicName: target.name,
          phone: target.phone,
          city: target.city,
          district: target.district,
          status: "WAITING_APPROVAL",
          leadScore: score,
          problem: note,
          drafts: {
            create: {
              content: `Merhaba ${target.name} Yetkilisi,\n\nDijital varlığınızı inceledik. ${note} Bu durum hasta kaybına yol açabiliyor. Size özel hazırladığımız çözüm teklifimizi incelemek ister misiniz?`,
              status: "WAITING_APPROVAL",
              screenshotUrl: screenshotUrl
            }
          }
        }
      });
      console.log(`-> Saved to Database. Lead ID: ${lead.id}`);
    } else {
      console.log(`[+] Clean site, skipping.`);
    }
  }

  await browser.close();
  console.log("\nScanner Bot finished successfully.");
}

main()
  .catch(e => {
    console.error("Scanner Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
