const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.upsert({
    where: { email: 'demo@disparazap.com' },
    update: {},
    create: {
      id: 'demo-user-001',
      name: 'Usuário Demo',
      email: 'demo@disparazap.com',
    },
  });
  console.log('Usuário demo criado:', user);
  await prisma.$disconnect();
}

seed().catch(console.error);
