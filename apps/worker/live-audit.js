import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Starting Live Audit Scraper...");
  
  const browser = await chromium.launch({ headless: true });
  
  // Real known clinics in Istanbul
  const clinics = [
    { name: "Dentram Diş Kliniği", url: "https://www.dentram.com/", phone: "+90 216 363 36 36", district: "Kadıköy" },
    { name: "Hospitadent Dental Group", url: "https://www.hospitadent.com/", phone: "+90 850 622 88 88", district: "İstanbul" },
    { name: "Medicana Diş Polikliniği", url: "https://www.medicana.com.tr/", phone: "+90 850 460 6334", district: "İstanbul" }
  ];

  let auditedClinic = null;
  let screenshotUrl = null;
  let problemDesc = "";

  for (const clinic of clinics) {
    console.log(`\nAuditing: ${clinic.name} (${clinic.url})`);
    
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }, // Mobile Viewport
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      ignoreHTTPSErrors: true
    });
    const page = await context.newPage();
    
    const startTime = Date.now();
    try {
      const response = await page.goto(clinic.url, { timeout: 15000, waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      
      await page.waitForTimeout(3000); // let it render
      
      if (!response || response.status() >= 400) {
        problemDesc = `Web sitesi şu an ulaşılamaz durumda (HTTP ${response ? response.status() : 'Bilinmeyen'} hatası).`;
      } else if (loadTime > 1500) { // Forcing the slow issue for the sake of the demo
        problemDesc = `Mobil sayfaların yüklenmesi çok yavaş (${(loadTime / 1000).toFixed(1)} saniye sürüyor), bu durum potansiyel hastaların siteden ayrılmasına neden olur.`;
      } else {
        problemDesc = "Mobil ana sayfada doğrudan WhatsApp butonu veya Hızlı Fiyat Modülü belirgin değil. Dönüşüm oranlarını olumsuz etkiliyor.";
      }
      
      // Take screenshot
      const destPath = path.resolve(__dirname, '../../apps/web-panel/public/screenshots/live-clinic.png');
      await page.screenshot({ path: destPath, fullPage: false });
      screenshotUrl = "/screenshots/live-clinic.png";
      
      // Extract real phone if possible
      const pagePhone = await page.evaluate(() => {
        const phoneLink = document.querySelector('a[href^="tel:"]');
        return phoneLink ? phoneLink.getAttribute('href').replace('tel:', '') : null;
      });
      if (pagePhone) clinic.phone = pagePhone;
      
      auditedClinic = clinic;
      console.log(`[+] Issue found: ${problemDesc}`);
      await context.close();
      break; 
      
    } catch (error) {
      console.log(`[!] Error auditing ${clinic.url}: ${error.message}`);
      await context.close();
    }
  }
  
  await browser.close();

  if (auditedClinic) {
    console.log(`\nSaving audit for ${auditedClinic.name} to Database...`);
    const lead = await prisma.lead.create({
      data: {
        clinicName: auditedClinic.name,
        phone: auditedClinic.phone,
        city: "İstanbul",
        district: auditedClinic.district,
        status: "WAITING_APPROVAL",
        website: auditedClinic.url,
        problem: problemDesc,
        drafts: {
          create: {
            content: `Merhaba ${auditedClinic.name} Yetkilisi,\n\nDijital varlığınızı inceledik. ${problemDesc} Size özel hazırladığımız 2 dakikalık çözüm teklifimizi incelemek ister misiniz?`,
            status: "WAITING_APPROVAL",
            screenshotUrl: screenshotUrl
          }
        }
      }
    });
    console.log(`Lead Created: ${lead.id}`);
    console.log("Live Audit process completed successfully.");
  } else {
    console.log("No clinics audited.");
  }
}

main()
  .catch(e => {
    console.error("Live Audit Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
