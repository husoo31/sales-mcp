const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const drafts = await prisma.messageDraft.findMany({
    where: { status: 'WAITING_APPROVAL' }
  });

  const webPanelPublicDir = path.resolve(__dirname, '../../apps/web-panel/public/screenshots');
  if (!fs.existsSync(webPanelPublicDir)) {
    fs.mkdirSync(webPanelPublicDir, { recursive: true });
  }

  let index = 1;
  for (const draft of drafts) {
    const filename = `lead-${index}.png`;
    const imagePath = `/screenshots/${filename}`;
    const absoluteFilePath = path.join(webPanelPublicDir, filename);

    // Mock image content if it doesn't exist
    if (!fs.existsSync(absoluteFilePath)) {
      // 1x1 transparent PNG base64
      const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
      fs.writeFileSync(absoluteFilePath, Buffer.from(pngBase64, 'base64'));
    }

    await prisma.messageDraft.update({
      where: { id: draft.id },
      data: { screenshotUrl: imagePath }
    });
    
    console.log(`Updated draft ${draft.id} with ${imagePath}`);
    index++;
  }

  console.log('Update complete.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
