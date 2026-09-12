import { chromium } from 'playwright';
import { PrismaClient } from '@spark/database';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("Launching browser to capture REAL website...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();
  
  const targetUrl = 'https://www.dentram.com';
  console.log(`Navigating to ${targetUrl}...`);
  
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait a little extra to ensure dynamic elements (like popups or lazy loaded images) settle
  await page.waitForTimeout(3000);
  
  // Dismiss cookie banner or popups if they obscure too much (optional, clicking center often helps or just leave it)
  // We just want a real screenshot
  
  const destPath = path.resolve(__dirname, '../../apps/web-panel/public/screenshots/real-dentram.png');
  console.log(`Saving REAL screenshot to ${destPath}`);
  await page.screenshot({ path: destPath, fullPage: false });
  
  await browser.close();

  console.log("Updating database...");

  // Update Dentram Lead
  const dentramLeads = await prisma.lead.findMany({
    where: {
      clinicName: {
        contains: "Dentram"
      }
    }
  });

  if (dentramLeads.length > 0) {
    const leadId = dentramLeads[0].id;
    await prisma.messageDraft.updateMany({
      where: { leadId },
      data: { screenshotUrl: "/screenshots/real-dentram.png" }
    });
    console.log(`Updated Dentram Lead (${leadId}) with new screenshot.`);
  }

  // Delete all other WAITING_APPROVAL drafts that might have the fake html mockup
  // Specifically those using real-audit.png or live-clinic.png
  await prisma.messageDraft.deleteMany({
    where: {
      screenshotUrl: {
        in: ["/screenshots/real-audit.png", "/screenshots/live-clinic.png"]
      },
      leadId: {
        not: dentramLeads.length > 0 ? dentramLeads[0].id : undefined
      }
    }
  });
  
  // Also clean up Leads without drafts if they are WAITING_APPROVAL to avoid blank cards
  const leadsWithoutDrafts = await prisma.lead.findMany({
    where: {
      status: "WAITING_APPROVAL",
      drafts: {
        none: {}
      }
    }
  });
  
  for (const l of leadsWithoutDrafts) {
    await prisma.lead.delete({ where: { id: l.id }});
  }

  console.log("Real capture process completed successfully!");
}

main()
  .catch(e => {
    console.error("Real Capture Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
