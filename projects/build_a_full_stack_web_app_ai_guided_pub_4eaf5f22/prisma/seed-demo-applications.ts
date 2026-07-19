import crypto from 'crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { fileURLToPath } from 'url';
import { hashPassword } from '../src/lib/password';
import { SIGNED_DECLARATION_FIELD_ID } from '../src/lib/application-attachments';

/**
 * Full demo data for the citizen account the organizing committee logs in with
 * (congdan / UserDemo123!): a complete personal profile plus a set of the
 * account's own applications so "Hồ sơ của tôi" and the officer queue are
 * populated straight after seeding. It also showcases the signed-declaration AI
 * check — one application whose signed tờ khai matches the declared names, and
 * one where the AI read a different name (as if the wrong file was uploaded).
 *
 * Everything is keyed on fixed ids and upserted, so re-running the seed is safe.
 */

// A 1x1 PNG — a stand-in for the scanned/photographed signed declaration so the
// "Xem tờ khai đã ký" preview has real, renderable bytes.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const DEMO_SESSION_ID = 'demo-session-signed';
const CONGDAN_USERNAME = 'congdan';

/** Full personal profile for the committee's demo citizen account. */
const CONGDAN_PROFILE = {
  displayName: 'Nguyễn Văn An',
  email: 'congdan@demo.vn',
  phone: '0912345678',
  address: 'Số 12, phường Cửa Nam, Hà Nội',
  citizenId: '001095012345',
  gender: 'Nam',
  placeOfBirth: 'Hà Nội',
  dateOfBirth: new Date('1995-03-12T00:00:00.000Z'),
  idIssuedAt: new Date('2021-05-10T00:00:00.000Z'),
  idExpiresAt: new Date('2035-03-12T00:00:00.000Z'),
};

type DemoApplication = {
  id: string;
  status: 'SUBMITTED' | 'APPROVED';
  reviewedBy?: string;
  reviewNote?: string | null;
  data: Record<string, unknown>;
  signedFileName: string;
  check: Record<string, unknown>;
};

function buildDemoApplications(checkedAt: string): DemoApplication[] {
  return [
    {
      // congdan's approved marriage application — signed names match the record.
      id: 'demo-app-namematch',
      status: 'APPROVED',
      reviewedBy: 'Phạm Quản Lý',
      reviewNote: null,
      data: {
        male_full_name: 'Nguyễn Văn An',
        male_birth_date: '1995-03-12',
        male_identity_number: '001095012345',
        female_full_name: 'Trần Thị Bình',
        female_birth_date: '1997-08-25',
        female_identity_number: '001097067890',
        residence: 'Số 12, phường Cửa Nam, Hà Nội',
        province: 'Hà Nội',
        previously_married: false,
        submission_channel: 'online',
      },
      signedFileName: 'to-khai-ket-hon-da-ky.png',
      check: {
        status: 'PASSED',
        isDeclaration: true,
        hasSignature: true,
        legible: true,
        nameMatch: true,
        namesSeen: ['Nguyễn Văn An', 'Trần Thị Bình'],
        confidence: 0.93,
        reason: 'Đã nhận diện tờ khai có chữ ký, tên người khai khớp với hồ sơ.',
        model: 'demo-seed',
        checkedAt,
      },
    },
    {
      // congdan's pending application where the uploaded signed file carries a
      // different name — the AI flags it for the officer to double-check.
      id: 'demo-app-namemismatch',
      status: 'SUBMITTED',
      data: {
        male_full_name: 'Nguyễn Văn An',
        male_birth_date: '1995-03-12',
        male_identity_number: '001095012345',
        female_full_name: 'Trần Thị Bình',
        female_birth_date: '1997-08-25',
        female_identity_number: '001097067890',
        residence: 'Số 12, phường Cửa Nam, Hà Nội',
        province: 'Hà Nội',
        previously_married: false,
        submission_channel: 'offline',
      },
      signedFileName: 'to-khai-da-ky.png',
      check: {
        status: 'REVIEW',
        isDeclaration: true,
        hasSignature: true,
        legible: true,
        nameMatch: false,
        namesSeen: ['Lê Văn Cường'],
        confidence: 0.88,
        reason:
          'Tên trên tờ khai có vẻ chưa khớp với thông tin đã khai trong hồ sơ; cán bộ sẽ đối chiếu khi tiếp nhận.',
        model: 'demo-seed',
        checkedAt,
      },
    },
  ];
}

export async function seedDemoApplications(prisma: PrismaClient): Promise<void> {
  const marriageV1 = await prisma.formVersion.findFirst({
    where: { version: '1.0', form: { code: 'MARRIAGE_REGISTRATION' } },
    select: { id: true },
  });
  if (!marriageV1) {
    console.warn('⚠️  Bỏ qua seed hồ sơ demo: chưa có biểu mẫu MARRIAGE_REGISTRATION v1.0.');
    return;
  }

  // The committee's citizen account, with a full personal profile. Upsert keeps
  // the existing password when the account was already created by seedUsers.
  const passwordHash = await hashPassword('UserDemo123!');
  const congdan = await prisma.user.upsert({
    where: { username: CONGDAN_USERNAME },
    update: { ...CONGDAN_PROFILE },
    create: {
      username: CONGDAN_USERNAME,
      role: 'user',
      passwordHash,
      ...CONGDAN_PROFILE,
    },
    select: { id: true },
  });

  // Session tokens are irrelevant here (the account reaches these via its login
  // cookie), so a fixed opaque hash is fine — this demo session is never logged into.
  const accessTokenHash = crypto
    .createHash('sha256')
    .update('psp-session:demo-signed-session')
    .digest('hex');
  const farFuture = new Date('2100-01-01T00:00:00Z');

  await prisma.session.upsert({
    where: { id: DEMO_SESSION_ID },
    update: { procedureCode: 'MARRIAGE_REGISTRATION', expiresAt: farFuture },
    create: {
      id: DEMO_SESSION_ID,
      accessTokenHash,
      procedureCode: 'MARRIAGE_REGISTRATION',
      answersJson: {},
      expiresAt: farFuture,
    },
  });

  const now = new Date();
  const submittedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const reviewedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
  const demos = buildDemoApplications(submittedAt.toISOString());

  for (const demo of demos) {
    const isApproved = demo.status === 'APPROVED';
    await prisma.application.upsert({
      where: { id: demo.id },
      update: {
        sessionId: DEMO_SESSION_ID,
        userId: congdan.id,
        formVersionId: marriageV1.id,
        status: demo.status,
        dataJson: demo.data as Prisma.InputJsonValue,
        submittedAt,
        reviewedAt: isApproved ? reviewedAt : null,
        reviewedBy: isApproved ? demo.reviewedBy ?? null : null,
        reviewNote: isApproved ? demo.reviewNote ?? null : null,
      },
      create: {
        id: demo.id,
        sessionId: DEMO_SESSION_ID,
        userId: congdan.id,
        formVersionId: marriageV1.id,
        status: demo.status,
        dataJson: demo.data as Prisma.InputJsonValue,
        submittedAt,
        reviewedAt: isApproved ? reviewedAt : null,
        reviewedBy: isApproved ? demo.reviewedBy ?? null : null,
        reviewNote: isApproved ? demo.reviewNote ?? null : null,
      },
    });

    await prisma.applicationAttachment.upsert({
      where: { applicationId_fieldId: { applicationId: demo.id, fieldId: SIGNED_DECLARATION_FIELD_ID } },
      update: {
        fileName: demo.signedFileName,
        mimeType: 'image/png',
        byteSize: PLACEHOLDER_PNG.byteLength,
        content: PLACEHOLDER_PNG,
        checkJson: demo.check as Prisma.InputJsonValue,
      },
      create: {
        applicationId: demo.id,
        fieldId: SIGNED_DECLARATION_FIELD_ID,
        fileName: demo.signedFileName,
        mimeType: 'image/png',
        byteSize: PLACEHOLDER_PNG.byteLength,
        content: PLACEHOLDER_PNG,
        checkJson: demo.check as Prisma.InputJsonValue,
      },
    });
  }

  console.log(
    `✅ Đã seed hồ sơ đầy đủ cho tài khoản '${CONGDAN_USERNAME}': profile cá nhân + ${demos.length} hồ sơ (1 đã duyệt tên khớp, 1 chờ duyệt tên lệch).`
  );
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('seed-demo-applications.ts') ||
    process.argv[1].endsWith('seed-demo-applications.js') ||
    fileURLToPath(import.meta.url) === process.argv[1]);

if (isDirectRun) {
  const prisma = new PrismaClient();
  seedDemoApplications(prisma)
    .catch((e) => {
      console.error('Lỗi khi seed hồ sơ demo:', e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
