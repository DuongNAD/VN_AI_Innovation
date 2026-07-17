import { PrismaClient } from '@prisma/client';
import { disconnectSeedDatabase, main as seedDemoData } from './seed';

const prisma = new PrismaClient();

export async function bootstrapEmptyDatabase(): Promise<'seeded' | 'skipped'> {
  const procedureCount = await prisma.procedure.count();
  if (procedureCount > 0) {
    console.log('Demo bootstrap skipped: database already contains procedure data.');
    return 'skipped';
  }

  console.log('Empty database detected: loading initial demo data.');
  await seedDemoData({ allowProductionBootstrap: true });
  return 'seeded';
}

bootstrapEmptyDatabase()
  .catch((error) => {
    console.error('Demo bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      prisma.$disconnect(),
      disconnectSeedDatabase(),
    ]);
  });
