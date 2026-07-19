import crypto from 'crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
import { fileURLToPath } from 'url';
import { SIGNED_DECLARATION_FIELD_ID } from '../src/lib/application-attachments';

/**
 * Demo submitted applications so the signed-declaration name cross-check is
 * visible in the officer console straight after seeding: one application whose
 * signed tờ khai matches the declared names, and one where the AI read a
 * different name (as if the citizen uploaded someone else's signed form).
 *
 * Everything is keyed on fixed ids and upserted, so re-running the seed is safe.
 */

// A 1x1 PNG — a stand-in for the scanned/photographed signed declaration so the
// officer's "Xem tờ khai đã ký" preview has real, renderable bytes.
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const DEMO_SESSION_ID = 'demo-session-signed';

type DemoApplication = {
  id: string;
  data: Record<string, unknown>;
  signedFileName: string;
  check: Record<string, unknown>;
};

function buildDemoApplications(checkedAt: string): DemoApplication[] {
  return [
    {
      id: 'demo-app-namematch',
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
      id: 'demo-app-namemismatch',
      data: {
        male_full_name: 'Nguyễn Văn Dũng',
        male_birth_date: '1990-01-05',
        male_identity_number: '001090054321',
        female_full_name: 'Phạm Thị Em',
        female_birth_date: '1993-11-30',
        female_identity_number: '001093098765',
        residence: 'Số 45, phường Bến Nghé, TP. Hồ Chí Minh',
        province: 'TP. Hồ Chí Minh',
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

  // Session tokens are irrelevant for the officer view (cookie auth), so a fixed
  // opaque hash is fine — these demo sessions are never logged into.
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
  const demos = buildDemoApplications(now.toISOString());

  for (const demo of demos) {
    await prisma.application.upsert({
      where: { id: demo.id },
      update: {
        sessionId: DEMO_SESSION_ID,
        formVersionId: marriageV1.id,
        status: 'SUBMITTED',
        dataJson: demo.data as Prisma.InputJsonValue,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
      },
      create: {
        id: demo.id,
        sessionId: DEMO_SESSION_ID,
        formVersionId: marriageV1.id,
        status: 'SUBMITTED',
        dataJson: demo.data as Prisma.InputJsonValue,
        submittedAt: now,
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
    `✅ Đã seed ${demos.length} hồ sơ demo đã nộp kèm tờ khai đã ký (1 tên khớp, 1 tên lệch) để minh hoạ đối chiếu.`
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
