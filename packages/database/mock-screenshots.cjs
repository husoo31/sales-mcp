const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const http = require('http');

const prisma = new PrismaClient();

async function main() {
  const dir = path.join(__dirname, '../../apps/web-panel/public/screenshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const leads = await prisma.lead.findMany({ take: 3 });

  for (const lead of leads) {
    const filePath = path.join(dir, `${lead.id}.png`);
    // Create a very simple 1x1 png or use a placeholder URL
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="; // 1x1 black pixel
    fs.writeFileSync(filePath, Buffer.from(pngBase64, 'base64'));
    console.log(`Created placeholder for ${lead.id}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
