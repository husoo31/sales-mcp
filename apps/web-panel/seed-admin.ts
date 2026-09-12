import { PrismaClient } from '@spark/database';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);
  
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'admin@spark.com',
        name: 'Admin',
        passwordHash: hash
      }
    });
    console.log("Created new admin user with admin123");
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash }
    });
    console.log("Updated existing admin user with admin123");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
