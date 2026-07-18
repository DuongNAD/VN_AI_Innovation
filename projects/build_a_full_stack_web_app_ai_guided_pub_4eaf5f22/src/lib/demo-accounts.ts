/**
 * Seeded demo accounts (prisma/seed.ts) whose passwords are published to the
 * competition judges — the submitted demo login must keep working, so no flow
 * may change or reset these passwords. Self-registered accounts are unaffected.
 */
const DEMO_ACCOUNT_USERNAMES = new Set([
  'congdan',
  'congdan2',
  'user.test',
  'quanly',
  'quanly2',
  'manager.test',
  'quanly.hanoi',
  'quanly.hcm',
  'quanly.danang',
  'admin',
  'admin2',
  'admin.test',
]);

export function isDemoAccount(username: string): boolean {
  return DEMO_ACCOUNT_USERNAMES.has(username);
}
