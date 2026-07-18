/**
 * Verify seed test accounts exist and passwords match.
 * Run: npx tsx scripts/verify-test-accounts.ts
 */
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../src/lib/password';

const prisma = new PrismaClient();

const GROUPS = [
  {
    label: 'User',
    password: 'UserDemo123!',
    emails: ['congdan@demo.vn', 'congdan2@demo.vn', 'user.test@demo.vn'],
  },
  {
    label: 'Manager',
    password: 'ManagerDemo123!',
    emails: ['quanly@demo.vn', 'quanly2@demo.vn', 'manager.test@demo.vn'],
  },
  {
    label: 'Admin',
    password: 'AdminDemo123!',
    emails: ['admin@demo.vn', 'admin2@demo.vn', 'admin.test@demo.vn'],
  },
] as const;

async function main() {
  console.log('=== Kiểm tra tài khoản seed ===\n');

  for (const group of GROUPS) {
    console.log(`## ${group.label} (mật khẩu kỳ vọng: ${group.password})`);
    for (const email of group.emails) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        console.log(`  ${email}: Exists=Missing | Password=n/a | role=n/a`);
        continue;
      }
      let passwordStatus = 'Invalid';
      if (!user.passwordHash) {
        passwordStatus = 'Invalid (no hash)';
      } else {
        const ok = await verifyPassword(group.password, user.passwordHash);
        passwordStatus = ok ? 'Valid' : 'Invalid';
      }
      console.log(
        `  ${email}: Exists=Exists | Password=${passwordStatus} | username=${user.username} | role=${user.role}`
      );
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
