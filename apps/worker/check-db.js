import { PrismaClient } from '@spark/database';
const prisma = new PrismaClient();
prisma.messageDraft.findFirst({orderBy: {createdAt: 'desc'}}).then(d => {
  console.log("DB URL Length:", d.screenshotUrl ? d.screenshotUrl.length : 'NULL');
}).finally(() => prisma.$disconnect());
