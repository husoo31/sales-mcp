import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      const mockSvg = `<svg width="375" height="812" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1a1b26"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#ffffff" text-anchor="middle">Mock Kanit ${index}</text>
      </svg>`;
      
      const buffer = Buffer.from(mockSvg);
      // Let's create an actual PNG or just fake it with SVG masquerading as PNG?
      // Since it's an img src, we can just save it as .png and browsers might still render SVG content? No, save as SVG or write a base64 encoded tiny 1x1 png and save it.
      // Better to save it as actual PNG or create an SVG and name it .svg. But instructions say lead-1.png. Let's just create a dummy PNG.
      // Standard 1x1 pixel transparent PNG in base64
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
