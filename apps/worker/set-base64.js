import { PrismaClient } from '@spark/database';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const imagePath = path.resolve(__dirname, '../../apps/web-panel/public/screenshots/real-dentram.png');
  
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  console.log("Reading image and converting to base64...");
  const buffer = fs.readFileSync(imagePath);
  const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
  
  console.log("Updating database with base64 Data-URI...");
  // Update Dentram leads
  const dentramLeads = await prisma.lead.findMany({
    where: {
      clinicName: {
        contains: "Dentram"
      }
    }
  });

  let updatedCount = 0;
  for (const lead of dentramLeads) {
    const res = await prisma.messageDraft.updateMany({
      where: { leadId: lead.id },
      data: { screenshotUrl: base64Image }
    });
    updatedCount += res.count;
  }
  
  // Actually, we could just update ALL WAITING_APPROVAL drafts if there's only 1 left
  const allWaiting = await prisma.messageDraft.updateMany({
    where: { status: "WAITING_APPROVAL" },
    data: { screenshotUrl: base64Image }
  });

  console.log(`Successfully updated ${updatedCount} Dentram drafts and ${allWaiting.count} total WAITING_APPROVAL drafts to Base64.`);
}

main()
  .catch(e => {
    console.error("Base64 Script Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
