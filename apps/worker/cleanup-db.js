import { PrismaClient } from '@spark/database';

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up fake leads...");
  
  const leads = await prisma.lead.findMany();
  
  let dentramCount = 0;
  for (const lead of leads) {
    if (!lead.clinicName.toLowerCase().includes('dentram')) {
      await prisma.lead.delete({ where: { id: lead.id } });
      console.log(`Deleted fake lead: ${lead.clinicName}`);
    } else {
      dentramCount++;
    }
  }

  // Just to be absolutely sure the screenshotUrl is perfect
  await prisma.messageDraft.updateMany({
    data: {
      screenshotUrl: "/screenshots/real-dentram.png"
    }
  });

  console.log(`Cleanup complete. Kept ${dentramCount} Dentram lead(s).`);
}

main()
  .catch(e => {
    console.error("Cleanup Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
