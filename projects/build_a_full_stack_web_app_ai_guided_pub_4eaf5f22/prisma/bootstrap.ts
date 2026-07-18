import { PrismaClient } from '@prisma/client';
import { disconnectSeedDatabase, main as seedDemoData } from './seed';
import { OFFICIAL_PROCEDURE_SOURCE_URLS } from '../src/lib/official-procedures';

const prisma = new PrismaClient();

async function refreshOfficialSourceUrls(): Promise<number> {
  const checkedAt = new Date();
  const updates = await prisma.$transaction(
    Object.entries(OFFICIAL_PROCEDURE_SOURCE_URLS).map(([code, sourceUrl]) =>
      prisma.procedure.updateMany({
        where: {
          code,
          NOT: { sourceUrl },
        },
        data: {
          sourceUrl,
          lastCheckedAt: checkedAt,
        },
      })
    )
  );
  return updates.reduce((total, result) => total + result.count, 0);
}

export async function bootstrapEmptyDatabase(): Promise<'seeded' | 'skipped'> {
  const procedureCount = await prisma.procedure.count();
  if (procedureCount > 0) {
    const refreshedCount = await refreshOfficialSourceUrls();
    if (refreshedCount > 0) {
      console.log(`Refreshed ${refreshedCount} official procedure source URL(s).`);
    }
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
