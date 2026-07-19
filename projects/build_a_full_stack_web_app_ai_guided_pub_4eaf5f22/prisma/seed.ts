import { PrismaClient } from '@prisma/client';
import { parseFieldDefs, parseRuleDefs, parseMigrationHints } from '../src/lib/schema-guards';
import { OFFICIAL_PROCEDURE_SOURCE_URLS } from '../src/lib/official-procedures';
import { hashPassword } from '../src/lib/password';
import { seedDemoApplications } from './seed-demo-applications';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

const prisma = new PrismaClient();

export function assertSeedAllowed(
  env: Partial<Pick<NodeJS.ProcessEnv, 'NODE_ENV' | 'ALLOW_DEMO_SEED'>> = process.env
): void {
  if (env.NODE_ENV === 'production' && env.ALLOW_DEMO_SEED !== '1') {
    throw new Error(
      'DEMO_SEED_BLOCKED: refusing to reset demo workflow data in production; set ALLOW_DEMO_SEED=1 only for an intentional disposable environment'
    );
  }
}

async function seedUsers() {
  /** Local test accounts — password pattern: <Role>Demo123! */
  const accounts = [
    // user
    {
      username: 'congdan',
      email: 'congdan@demo.vn',
      displayName: 'Nguyễn Văn A',
      role: 'user',
      password: 'UserDemo123!',
    },
    {
      username: 'congdan2',
      email: 'congdan2@demo.vn',
      displayName: 'Trần Thị B',
      role: 'user',
      password: 'UserDemo123!',
    },
    {
      username: 'user.test',
      email: 'user.test@demo.vn',
      displayName: 'Lê Minh C',
      role: 'user',
      password: 'UserDemo123!',
    },
    // manager
    {
      username: 'quanly',
      email: 'quanly@demo.vn',
      displayName: 'Phạm Quản Lý',
      role: 'manager',
      password: 'ManagerDemo123!',
    },
    {
      username: 'quanly2',
      email: 'quanly2@demo.vn',
      displayName: 'Hoàng Giám Sát',
      role: 'manager',
      password: 'ManagerDemo123!',
    },
    {
      username: 'manager.test',
      email: 'manager.test@demo.vn',
      displayName: 'Vũ Điều Phối',
      role: 'manager',
      password: 'ManagerDemo123!',
    },
    // manager — thêm để test tay, mỗi tài khoản mật khẩu riêng
    {
      username: 'quanly.hanoi',
      email: 'quanly.hanoi@demo.vn',
      displayName: 'Đỗ Thị Hà',
      role: 'manager',
      password: 'HaNoi2026@ql',
    },
    {
      username: 'quanly.hcm',
      email: 'quanly.hcm@demo.vn',
      displayName: 'Bùi Văn Sơn',
      role: 'manager',
      password: 'SaiGon2026@ql',
    },
    {
      username: 'quanly.danang',
      email: 'quanly.danang@demo.vn',
      displayName: 'Ngô Thị Diễm',
      role: 'manager',
      password: 'DaNang2026@ql',
    },
    // admin
    {
      username: 'admin',
      email: 'admin@demo.vn',
      displayName: 'Admin Hệ Thống',
      role: 'admin',
      password: 'AdminDemo123!',
    },
    {
      username: 'admin2',
      email: 'admin2@demo.vn',
      displayName: 'Admin Phụ',
      role: 'admin',
      password: 'AdminDemo123!',
    },
    {
      username: 'admin.test',
      email: 'admin.test@demo.vn',
      displayName: 'Admin Kiểm Thử',
      role: 'admin',
      password: 'AdminDemo123!',
    },
    // admin — thêm để test tay, mỗi tài khoản mật khẩu riêng
    {
      username: 'admin.truong',
      email: 'admin.truong@demo.vn',
      displayName: 'Trần Quản Trị Trưởng',
      role: 'admin',
      password: 'Truong2026@ad',
    },
    {
      username: 'admin.kythuat',
      email: 'admin.kythuat@demo.vn',
      displayName: 'Lý Kỹ Thuật',
      role: 'admin',
      password: 'KyThuat2026@ad',
    },
    {
      username: 'admin.kiemtoan',
      email: 'admin.kiemtoan@demo.vn',
      displayName: 'Phan Kiểm Toán',
      role: 'admin',
      password: 'KiemToan2026@ad',
    },
  ] as const;

  for (const a of accounts) {
    const passwordHash = await hashPassword(a.password);
    await prisma.user.upsert({
      where: { username: a.username },
      update: {
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        passwordHash,
      },
      create: {
        username: a.username,
        email: a.email,
        displayName: a.displayName,
        role: a.role,
        passwordHash,
      },
    });
  }
  console.log(
    `Seeded ${accounts.length} test users (3 user / 6 manager / 6 admin).`
  );
}

async function upsertProcedure(
  code: string,
  name: string,
  sector: string,
  agency: string,
  audience: 'CITIZEN' | 'BUSINESS',
  sourceUrl: string,
  versions: Array<{
    version: string;
    status: string;
    effectiveFrom: Date | null;
    stepsJson: any;
    durationText: string;
    feesText: string;
    legalBasisText: string | null;
  }>,
  questions: Array<{
    code: string;
    orderNumber: number;
    fieldType: string;
    optionsJson: any;
    conditionJson: any;
    questionText: string;
  }>,
  documents: Array<{
    code: string;
    name: string;
    originals: number;
    copies: number;
    orderNumber: number;
    conditionJson: any;
    reasonText: string | null;
    submissionType: string;
  }>
) {
  const proc = await prisma.procedure.upsert({
    where: { code },
    update: {
      name,
      sector,
      agency,
      audience,
      sourceUrl,
      lastCheckedAt: new Date(),
    },
    create: {
      code,
      name,
      sector,
      agency,
      audience,
      sourceUrl,
      lastCheckedAt: new Date(),
    },
  });

  for (const v of versions) {
    await prisma.procedureVersion.upsert({
      where: {
        procedureId_version: {
          procedureId: proc.id,
          version: v.version,
        },
      },
      update: {
        status: v.status,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: null,
        stepsJson: v.stepsJson,
        durationText: v.durationText,
        feesText: v.feesText,
        legalBasisText: v.legalBasisText,
      },
      create: {
        procedureId: proc.id,
        version: v.version,
        status: v.status,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: null,
        stepsJson: v.stepsJson,
        durationText: v.durationText,
        feesText: v.feesText,
        legalBasisText: v.legalBasisText,
      },
    });
  }

  for (const q of questions) {
    await prisma.clarifyingQuestion.upsert({
      where: {
        procedureId_code: {
          procedureId: proc.id,
          code: q.code,
        },
      },
      update: {
        orderNumber: q.orderNumber,
        fieldType: q.fieldType,
        optionsJson: q.optionsJson,
        conditionJson: q.conditionJson,
        questionText: q.questionText,
      },
      create: {
        procedureId: proc.id,
        code: q.code,
        orderNumber: q.orderNumber,
        fieldType: q.fieldType,
        optionsJson: q.optionsJson,
        conditionJson: q.conditionJson,
        questionText: q.questionText,
      },
    });
  }

  for (const d of documents) {
    const docId = `${proc.code}_${d.code}`;
    await prisma.documentRequirement.upsert({
      where: { id: docId },
      update: {
        name: d.name,
        originals: d.originals,
        copies: d.copies,
        orderNumber: d.orderNumber,
        conditionJson: d.conditionJson,
        reasonText: d.reasonText,
        submissionType: d.submissionType,
      },
      create: {
        id: docId,
        procedureId: proc.id,
        code: d.code,
        name: d.name,
        originals: d.originals,
        copies: d.copies,
        orderNumber: d.orderNumber,
        conditionJson: d.conditionJson,
        reasonText: d.reasonText,
        submissionType: d.submissionType,
      },
    });
  }

  return proc;
}

async function upsertFormAndVersions(
  code: string,
  name: string,
  procedureId: string,
  versions: Array<{
    version: string;
    status: string;
    effectiveFrom: Date | null;
    fieldsRaw: any;
    hintsRaw: any;
    rulesRaw: any;
  }>
) {
  const form = await prisma.form.upsert({
    where: { code },
    update: {
      name,
      procedureId,
    },
    create: {
      code,
      name,
      procedureId,
    },
  });

  for (const v of versions) {
    // Run everything through the schema-guards parse functions BEFORE writing
    const fields = parseFieldDefs(v.fieldsRaw);
    const hints = parseMigrationHints(v.hintsRaw || []);
    const rules = parseRuleDefs(v.rulesRaw || [], fields);

    const schemaJson = {
      fields,
      migrationHints: hints,
    };

    const fv = await prisma.formVersion.upsert({
      where: {
        formId_version: {
          formId: form.id,
          version: v.version,
        },
      },
      update: {
        status: v.status,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: null,
        schemaJson: schemaJson as any,
      },
      create: {
        formId: form.id,
        version: v.version,
        status: v.status,
        effectiveFrom: v.effectiveFrom,
        effectiveTo: null,
        schemaJson: schemaJson as any,
      },
    });

    for (const r of rules) {
      await prisma.validationRule.upsert({
        where: { id: r.id },
        update: {
          type: r.type,
          fieldId: r.fieldId || null,
          paramsJson: r.params as any,
          message: r.message,
          suggestion: r.suggestion,
          severity: r.severity || 'error',
          orderNumber: r.orderNumber,
        },
        create: {
          id: r.id,
          formVersionId: fv.id,
          type: r.type,
          fieldId: r.fieldId || null,
          paramsJson: r.params as any,
          message: r.message,
          suggestion: r.suggestion,
          severity: r.severity || 'error',
          orderNumber: r.orderNumber,
        },
      });
    }
  }

  return form;
}

/**
 * Guidance-only procedures imported from the National Public Service Portal
 * (DVCQG) dump. The committed file is produced by scripts/build-dvc-catalog.mjs.
 * These broaden search/checklist coverage; they carry no dynamic Form/Rule engine
 * (that stays hand-authored for the showcase procedures).
 */
interface ImportedProcedure {
  code: string;
  name: string;
  sector: string;
  agency: string;
  audience: 'CITIZEN' | 'BUSINESS';
  sourceUrl: string;
  version: {
    version: string;
    status: string;
    effectiveFrom: string | null;
    stepsJson: any;
    durationText: string;
    feesText: string;
    legalBasisText: string | null;
  };
  questions: any[];
  documents: any[];
}

function loadImportedCatalog(): ImportedProcedure[] {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'data', 'dvc-catalog.generated.json');
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as ImportedProcedure[];
  } catch (err) {
    console.warn(`[seed] DVCQG catalog not found (${file}); skipping breadth import. Run "node scripts/build-dvc-catalog.mjs" to generate it.`);
    return [];
  }
}

async function seedImportedCatalog() {
  const catalog = loadImportedCatalog();
  for (const p of catalog) {
    await upsertProcedure(
      p.code,
      p.name,
      p.sector,
      p.agency,
      p.audience,
      p.sourceUrl,
      [{
        version: p.version.version,
        status: p.version.status,
        effectiveFrom: p.version.effectiveFrom ? new Date(p.version.effectiveFrom) : null,
        stepsJson: p.version.stepsJson,
        durationText: p.version.durationText,
        feesText: p.version.feesText,
        legalBasisText: p.version.legalBasisText,
      }],
      p.questions,
      p.documents,
    );
  }
  if (catalog.length) {
    console.log(`Imported ${catalog.length} DVCQG guidance procedures.`);
  }
}

export async function seedDivorceProcedure(): Promise<void> {
  const steps = [
    {
      order: 1,
      title: 'Xác định hình thức ly hôn',
      description: 'Xác định thuận tình ly hôn hay ly hôn theo yêu cầu của một bên để dùng đúng loại đơn.',
      example: 'Hai vợ chồng cùng đồng ý ly hôn và đã thống nhất việc nuôi con.',
    },
    {
      order: 2,
      title: 'Chuẩn bị hồ sơ',
      description: 'Chuẩn bị đơn và tài liệu, chứng cứ phù hợp với con chung, tài sản, nợ chung và yếu tố nước ngoài.',
      example: 'Bạn sao hợp lệ giấy khai sinh của con và giấy tờ về tài sản đang yêu cầu chia.',
    },
    {
      order: 3,
      title: 'Nộp hồ sơ',
      description: 'Nộp trực tiếp, qua dịch vụ bưu chính hoặc gửi trực tuyến nếu Tòa án có hỗ trợ.',
      example: 'Bạn nộp đơn cùng tài liệu kèm theo tại Tòa án có thẩm quyền.',
    },
    {
      order: 4,
      title: 'Thực hiện yêu cầu của Tòa án',
      description: 'Theo dõi thông báo sửa đổi, bổ sung hồ sơ và thông báo nộp tạm ứng án phí hoặc lệ phí.',
      example: 'Bạn bổ sung tài liệu về nơi cư trú theo thông báo của Tòa án.',
    },
    {
      order: 5,
      title: 'Tham gia giải quyết vụ việc',
      description: 'Tham gia hòa giải, phiên họp hoặc phiên tòa theo giấy triệu tập của Tòa án.',
      example: 'Bạn có mặt đúng thời gian ghi trên giấy triệu tập.',
    },
  ];

  const questions = [
    {
      code: 'divorce_type',
      orderNumber: 1,
      fieldType: 'radio',
      optionsJson: [
        { value: 'mutual', label: 'Thuận tình ly hôn' },
        { value: 'unilateral', label: 'Ly hôn theo yêu cầu của một bên' },
      ],
      conditionJson: null,
      questionText: 'Hai vợ chồng cùng yêu cầu ly hôn hay chỉ một bên yêu cầu?',
    },
    {
      code: 'has_children',
      orderNumber: 2,
      fieldType: 'radio',
      optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }],
      conditionJson: null,
      questionText: 'Hai vợ chồng có con chung không?',
    },
    {
      code: 'has_property_or_debt_request',
      orderNumber: 3,
      fieldType: 'radio',
      optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }],
      conditionJson: null,
      questionText: 'Bạn có yêu cầu Tòa án giải quyết tài sản chung hoặc nợ chung không?',
    },
    {
      code: 'has_foreign_element',
      orderNumber: 4,
      fieldType: 'radio',
      optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }],
      conditionJson: null,
      questionText: 'Vụ việc có người, tài sản ở nước ngoài hoặc cần ủy thác tư pháp không?',
    },
    {
      code: 'province',
      orderNumber: 5,
      fieldType: 'province',
      optionsJson: null,
      conditionJson: null,
      questionText: 'Tỉnh/thành phố nơi người còn lại cư trú hoặc làm việc?',
    },
  ];

  const documents = [
    {
      code: 'MUTUAL_DIVORCE_REQUEST',
      name: 'Đơn yêu cầu công nhận thuận tình ly hôn',
      originals: 1,
      copies: 0,
      orderNumber: 1,
      conditionJson: { field: 'divorce_type', operator: 'equals', value: 'mutual' },
      reasonText: 'Áp dụng vì hai vợ chồng cùng yêu cầu ly hôn.',
      submissionType: 'SUBMIT',
    },
    {
      code: 'UNILATERAL_DIVORCE_PETITION',
      name: 'Đơn khởi kiện ly hôn',
      originals: 1,
      copies: 0,
      orderNumber: 2,
      conditionJson: { field: 'divorce_type', operator: 'equals', value: 'unilateral' },
      reasonText: 'Áp dụng vì ly hôn theo yêu cầu của một bên.',
      submissionType: 'SUBMIT',
    },
    {
      code: 'MARRIAGE_CERTIFICATE',
      name: 'Giấy chứng nhận đăng ký kết hôn (bản chính hoặc bản sao hợp lệ)',
      originals: 0,
      copies: 1,
      orderNumber: 3,
      conditionJson: null,
      reasonText: null,
      submissionType: 'SUBMIT',
    },
    {
      code: 'SPOUSES_ID_DOCUMENTS',
      name: 'Căn cước hoặc giấy tờ tùy thân của hai vợ chồng (bản sao hợp lệ)',
      originals: 0,
      copies: 2,
      orderNumber: 4,
      conditionJson: null,
      reasonText: null,
      submissionType: 'SUBMIT',
    },
    {
      code: 'RESIDENCE_EVIDENCE',
      name: 'Tài liệu, chứng cứ về nơi cư trú hoặc nơi làm việc của vợ chồng',
      originals: 0,
      copies: 1,
      orderNumber: 5,
      conditionJson: null,
      reasonText: 'Dùng để xác định Tòa án có thẩm quyền.',
      submissionType: 'SUBMIT',
    },
    {
      code: 'CHILD_BIRTH_CERTIFICATES',
      name: 'Giấy khai sinh của con chung (bản sao hợp lệ)',
      originals: 0,
      copies: 1,
      orderNumber: 6,
      conditionJson: { field: 'has_children', operator: 'equals', value: true },
      reasonText: 'Áp dụng vì hai vợ chồng có con chung.',
      submissionType: 'SUBMIT',
    },
    {
      code: 'PROPERTY_DEBT_EVIDENCE',
      name: 'Tài liệu, chứng cứ về tài sản chung và nợ chung',
      originals: 0,
      copies: 1,
      orderNumber: 7,
      conditionJson: { field: 'has_property_or_debt_request', operator: 'equals', value: true },
      reasonText: 'Áp dụng khi yêu cầu Tòa án giải quyết tài sản hoặc nợ chung.',
      submissionType: 'SUBMIT',
    },
    {
      code: 'FOREIGN_DOCUMENTS',
      name: 'Giấy tờ do cơ quan nước ngoài cấp đã được hợp pháp hóa lãnh sự, nếu thuộc trường hợp phải hợp pháp hóa',
      originals: 0,
      copies: 1,
      orderNumber: 8,
      conditionJson: { field: 'has_foreign_element', operator: 'equals', value: true },
      reasonText: 'Áp dụng vì vụ việc có yếu tố nước ngoài.',
      submissionType: 'SUBMIT',
    },
  ];

  await upsertProcedure(
    'DIVORCE_RESOLUTION',
    'Giải quyết ly hôn',
    'Hôn nhân và gia đình',
    'Tòa án có thẩm quyền',
    'CITIZEN',
    OFFICIAL_PROCEDURE_SOURCE_URLS.DIVORCE_RESOLUTION,
    [{
      version: '1.0',
      status: 'ACTIVE',
      effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
      stepsJson: steps,
      durationText: 'Phụ thuộc loại việc, nội dung tranh chấp và quá trình tố tụng theo thông báo của Tòa án',
      feesText: 'Án phí hoặc lệ phí và tạm ứng thực hiện theo thông báo của Tòa án',
      legalBasisText: 'Luật Hôn nhân và gia đình 2014; Bộ luật Tố tụng dân sự 2015; Nghị quyết 01/2017/NQ-HĐTP',
    }],
    questions,
    documents,
  );
}

export async function main(options: { allowProductionBootstrap?: boolean } = {}) {
  if (!options.allowProductionBootstrap) {
    assertSeedAllowed();
  }

  try {
    await seedDivorceProcedure();

    // 1. Seed MARRIAGE_REGISTRATION
    const marriageSteps = [
      { order: 1, title: 'Chuẩn bị hồ sơ', description: 'Chuẩn bị các giấy tờ theo danh sách hướng dẫn.', example: 'Bạn chụp ảnh giấy xác nhận tình trạng độc thân và căn cước công dân.' },
      { order: 2, title: 'Nộp hồ sơ', description: 'Nộp hồ sơ trực tuyến hoặc nộp trực tiếp tại UBND cấp xã.', example: 'Bạn đăng nhập VNeID và nộp hồ sơ qua cổng dịch vụ công.' },
      { order: 3, title: 'Tiếp nhận hồ sơ', description: 'Cán bộ hộ tịch tiếp nhận và kiểm tra tính hợp lệ của hồ sơ.', example: 'Cán bộ hộ tịch gửi tin nhắn xác nhận đã nhận hồ sơ đăng ký.' },
      { order: 4, title: 'Thẩm tra điều kiện', description: 'UBND cấp xã tiến hành thẩm tra điều kiện kết hôn của hai bên.', example: 'Công an kiểm tra dữ liệu tình trạng cư trú và hôn nhân trên hệ thống.' },
      { order: 5, title: 'Ký Sổ hộ tịch', description: 'Hai bên nam, nữ có mặt ký tên vào Sổ hộ tịch.', example: 'Cả hai bạn cùng ký tên vào sổ đăng ký kết hôn tại UBND xã.' },
      { order: 6, title: 'Ký Giấy chứng nhận', description: 'Chủ tịch UBND cấp xã ký Giấy chứng nhận kết hôn.', example: 'Lãnh đạo UBND xã ký duyệt bản gốc Giấy chứng nhận kết hôn.' },
      { order: 7, title: 'Nhận kết quả', description: 'Nhận Giấy chứng nhận kết hôn.', example: 'Vợ chồng bạn nhận hai bản chính Giấy chứng nhận kết hôn.' }
    ];

    const marriageQuestions = [
      { code: 'has_foreign_element', orderNumber: 1, fieldType: 'radio', optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }], conditionJson: null, questionText: 'Đăng ký kết hôn có yếu tố nước ngoài không?' },
      { code: 'previously_married', orderNumber: 2, fieldType: 'radio', optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }], conditionJson: null, questionText: 'Bạn đã từng đăng ký kết hôn lần nào trước đây chưa?' },
      { code: 'province', orderNumber: 3, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Bạn muốn đăng ký kết hôn tại tỉnh/thành phố nào?' },
      { code: 'submission_channel', orderNumber: 4, fieldType: 'radio', optionsJson: [{ value: 'online', label: 'Trực tuyến' }, { value: 'offline', label: 'Trực tiếp' }], conditionJson: null, questionText: 'Bạn muốn nộp hồ sơ trực tuyến hay trực tiếp?' }
    ];

    const marriageDocuments = [
      { code: 'MARRIAGE_DECLARATION', name: 'Tờ khai đăng ký kết hôn', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'SINGLE_STATUS_CERT', name: 'Giấy xác nhận tình trạng hôn nhân', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'IDENTITY_DOCS', name: 'CCCD/hộ chiếu của hai bên', originals: 1, copies: 0, orderNumber: 3, conditionJson: null, reasonText: null, submissionType: 'PRESENT' },
      { code: 'RESIDENCE_PROOF', name: 'Giấy tờ chứng minh cư trú', originals: 0, copies: 0, orderNumber: 4, conditionJson: null, reasonText: 'Cơ quan giải quyết tự tra cứu thông tin cư trú từ CSDL quốc gia về dân cư kể từ 01/01/2023 (công dân không phải nộp).', submissionType: 'SYSTEM_LOOKUP' },
      { code: 'DIVORCE_DOCUMENT', name: 'Trích lục ly hôn', originals: 1, copies: 0, orderNumber: 5, conditionJson: { field: 'previously_married', operator: 'equals', value: true }, reasonText: 'Áp dụng vì bạn đã từng đăng ký kết hôn', submissionType: 'SUBMIT' }
    ];

    const marriageProc = await upsertProcedure(
      'MARRIAGE_REGISTRATION',
      'Đăng ký kết hôn',
      'Hộ tịch',
      'UBND cấp xã',
      'CITIZEN',
      OFFICIAL_PROCEDURE_SOURCE_URLS.MARRIAGE_REGISTRATION,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: marriageSteps,
          durationText: 'Trong ngày làm việc nếu hồ sơ hợp lệ',
          feesText: 'Miễn phí (đăng ký trong nước)',
          legalBasisText: 'Luật Hộ tịch 2014; Nghị định 123/2015/NĐ-CP; Thông tư 04/2020/TT-BTP; Nghị định 104/2022/NĐ-CP'
        }
      ],
      marriageQuestions,
      marriageDocuments
    );

    // Seed MARRIAGE_REGISTRATION Forms (v1.0 ACTIVE + v2.0 DRAFT)
    const marriageFieldsV1Raw = [
      { id: "male_full_name", type: "text", label: "Họ và tên nam", required: true },
      { id: "male_birth_date", type: "date", label: "Ngày sinh nam", required: true },
      { id: "male_identity_number", type: "text", label: "Số định danh cá nhân/CCCD của bên nam", required: true },
      { id: "female_full_name", type: "text", label: "Họ và tên nữ", required: true },
      { id: "female_birth_date", type: "date", label: "Ngày sinh nữ", required: true },
      { id: "female_identity_number", type: "text", label: "Số định danh cá nhân/CCCD của bên nữ", required: true },
      { id: "residence", type: "text", label: "Nơi cư trú", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "previously_married", type: "radio", label: "Bạn đã từng đăng ký kết hôn trước đây chưa?", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Không" }] },
      { id: "marriage_number", type: "number", label: "Số lần kết hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "divorce_document", type: "file", label: "Trích lục ly hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "submission_channel", type: "radio", label: "Kênh nộp hồ sơ", required: true, options: [{ value: "online", label: "Trực tuyến" }, { value: "offline", label: "Trực tiếp" }] }
    ];

    const marriageRulesV1Raw = [
      { id: "mr_v1_req_male_full_name", type: "required", fieldId: "male_full_name", params: {}, message: "Vui lòng nhập họ và tên nam.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "mr_v1_req_male_birth_date", type: "required", fieldId: "male_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nam.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "mr_v1_req_male_identity_number", type: "required", fieldId: "male_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD của bên nam.", suggestion: "Nhập đúng 12 chữ số trên thẻ căn cước.", severity: "error", orderNumber: 3 },
      { id: "mr_v1_req_female_full_name", type: "required", fieldId: "female_full_name", params: {}, message: "Vui lòng nhập họ và tên nữ.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 4 },
      { id: "mr_v1_req_female_birth_date", type: "required", fieldId: "female_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nữ.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 5 },
      { id: "mr_v1_req_female_identity_number", type: "required", fieldId: "female_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD của bên nữ.", suggestion: "Nhập đúng 12 chữ số trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "mr_v1_req_residence", type: "required", fieldId: "residence", params: {}, message: "Vui lòng nhập nơi cư trú.", suggestion: "Nhập địa chỉ thường trú hoặc tạm trú hiện tại.", severity: "error", orderNumber: 7 },
      { id: "mr_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn trong danh sách hiển thị.", severity: "error", orderNumber: 8 },
      { id: "mr_v1_req_submission_channel", type: "required", fieldId: "submission_channel", params: {}, message: "Vui lòng chọn kênh nộp hồ sơ.", suggestion: "Chọn Trực tuyến hoặc Trực tiếp.", severity: "error", orderNumber: 9 },
      { id: "mr_v1_regex_male_id", type: "regex", fieldId: "male_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số.", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước.", severity: "error", orderNumber: 10 },
      { id: "mr_v1_regex_female_id", type: "regex", fieldId: "female_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số.", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước.", severity: "error", orderNumber: 11 },
      { id: "mr_v1_date_male_birth", type: "date_not_future", fieldId: "male_birth_date", params: {}, message: "Ngày sinh của bên nam không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh của bên nam.", severity: "error", orderNumber: 12 },
      { id: "mr_v1_date_female_birth", type: "date_not_future", fieldId: "female_birth_date", params: {}, message: "Ngày sinh của bên nữ không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh của bên nữ.", severity: "error", orderNumber: 13 },
      { id: "mr_v1_range_marriage_number", type: "number_range", fieldId: "marriage_number", params: { min: 1, max: 10 }, message: "Số lần kết hôn phải từ 1 đến 10.", suggestion: "Vui lòng nhập số lần kết hôn hợp lệ.", severity: "error", orderNumber: 14 },
      { id: "mr_v1_conflict_marriage", type: "cross_field_conflict", fieldId: undefined, params: { conditions: [{ field: "previously_married", operator: "equals", value: false }, { field: "marriage_number", operator: "not_empty" }] }, message: "Thông tin mâu thuẫn: bạn chọn chưa từng đăng ký kết hôn nhưng lại nhập số lần kết hôn.", suggestion: "Kiểm tra lại câu trả lời về việc đã từng đăng ký kết hôn hoặc xóa số lần kết hôn.", severity: "error", orderNumber: 15 },
      { id: "mr_v1_cond_doc_divorce", type: "conditional_document", fieldId: "divorce_document", params: { condition: { field: "previously_married", operator: "equals", value: true } }, message: "Vui lòng tải lên Trích lục ly hôn.", suggestion: "Bạn cần cung cấp giấy tờ ly hôn vì đã từng kết hôn.", severity: "error", orderNumber: 16 }
    ];

    const marriageFieldsV2Raw = [
      { id: "male_full_name", type: "text", label: "Họ và tên nam", required: true },
      { id: "male_birth_date", type: "date", label: "Ngày sinh nam", required: true },
      { id: "male_identity_number", type: "text", label: "Số định danh cá nhân/CCCD của bên nam", required: true },
      { id: "female_full_name", type: "text", label: "Họ và tên nữ", required: true },
      { id: "female_birth_date", type: "date", label: "Ngày sinh nữ", required: true },
      { id: "female_identity_number", type: "text", label: "Số định danh cá nhân/CCCD của bên nữ", required: true },
      { id: "permanent_address", type: "text", label: "Địa chỉ thường trú", required: true },
      { id: "temporary_address", type: "text", label: "Địa chỉ tạm trú", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "previously_married", type: "radio", label: "Bạn đã từng đăng ký kết hôn trước đây chưa?", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Không" }] },
      { id: "marriage_number", type: "number", label: "Số lần kết hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "divorce_document", type: "file", label: "Trích lục ly hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "submission_channel", type: "radio", label: "Kênh nộp hồ sơ", required: true, options: [{ value: "online", label: "Trực tuyến" }, { value: "offline", label: "Trực tiếp" }] }
    ];

    const marriageRulesV2Raw = [
      { id: "mr_v2_req_male_full_name", type: "required", fieldId: "male_full_name", params: {}, message: "Vui lòng nhập họ và tên nam.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "mr_v2_req_male_birth_date", type: "required", fieldId: "male_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nam.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "mr_v2_req_male_identity_number", type: "required", fieldId: "male_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD của bên nam.", suggestion: "Nhập đúng 12 chữ số trên thẻ căn cước.", severity: "error", orderNumber: 3 },
      { id: "mr_v2_req_female_full_name", type: "required", fieldId: "female_full_name", params: {}, message: "Vui lòng nhập họ và tên nữ.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 4 },
      { id: "mr_v2_req_female_birth_date", type: "required", fieldId: "female_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nữ.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 5 },
      { id: "mr_v2_req_female_identity_number", type: "required", fieldId: "female_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD của bên nữ.", suggestion: "Nhập đúng 12 chữ số trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "mr_v2_req_permanent_address", type: "required", fieldId: "permanent_address", params: {}, message: "Vui lòng nhập địa chỉ thường trú.", suggestion: "Nhập đầy đủ số nhà, tên đường, khu vực.", severity: "error", orderNumber: 7 },
      { id: "mr_v2_req_temporary_address", type: "required", fieldId: "temporary_address", params: {}, message: "Vui lòng nhập địa chỉ tạm trú.", suggestion: "Nhập nơi cư trú tạm thời hiện tại.", severity: "error", orderNumber: 8 },
      { id: "mr_v2_req_phone_number", type: "required", fieldId: "phone_number", params: {}, message: "Vui lòng nhập số điện thoại liên hệ.", suggestion: "Nhập số điện thoại di động chính xác.", severity: "error", orderNumber: 9 },
      { id: "mr_v2_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn trong danh sách hiển thị.", severity: "error", orderNumber: 10 },
      { id: "mr_v2_req_submission_channel", type: "required", fieldId: "submission_channel", params: {}, message: "Vui lòng chọn kênh nộp hồ sơ.", suggestion: "Chọn Trực tuyến hoặc Trực tiếp.", severity: "error", orderNumber: 11 },
      { id: "mr_v2_regex_male_id", type: "regex", fieldId: "male_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số.", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước.", severity: "error", orderNumber: 12 },
      { id: "mr_v2_regex_female_id", type: "regex", fieldId: "female_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số.", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước.", severity: "error", orderNumber: 13 },
      { id: "mr_v2_regex_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0[0-9]{9}$" }, message: "Số điện thoại không hợp lệ.", suggestion: "Nhập số điện thoại gồm 10 chữ số, bắt đầu bằng 0.", severity: "error", orderNumber: 14 },
      { id: "mr_v2_date_male_birth", type: "date_not_future", fieldId: "male_birth_date", params: {}, message: "Ngày sinh của bên nam không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh của bên nam.", severity: "error", orderNumber: 15 },
      { id: "mr_v2_date_female_birth", type: "date_not_future", fieldId: "female_birth_date", params: {}, message: "Ngày sinh của bên nữ không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh của bên nữ.", severity: "error", orderNumber: 16 },
      { id: "mr_v2_range_marriage_number", type: "number_range", fieldId: "marriage_number", params: { min: 1, max: 10 }, message: "Số lần kết hôn phải từ 1 đến 10.", suggestion: "Vui lòng nhập số lần kết hôn hợp lệ.", severity: "error", orderNumber: 17 },
      { id: "mr_v2_conflict_marriage", type: "cross_field_conflict", fieldId: undefined, params: { conditions: [{ field: "previously_married", operator: "equals", value: false }, { field: "marriage_number", operator: "not_empty" }] }, message: "Thông tin mâu thuẫn: bạn chọn chưa từng đăng ký kết hôn nhưng lại nhập số lần kết hôn.", suggestion: "Kiểm tra lại câu trả lời về việc đã từng đăng ký kết hôn hoặc xóa số lần kết hôn.", severity: "error", orderNumber: 18 },
      { id: "mr_v2_cond_doc_divorce", type: "conditional_document", fieldId: "divorce_document", params: { condition: { field: "previously_married", operator: "equals", value: true } }, message: "Vui lòng tải lên Trích lục ly hôn.", suggestion: "Bạn cần cung cấp giấy tờ ly hôn vì đã từng kết hôn.", severity: "error", orderNumber: 19 }
    ];

    const marriageForm = await upsertFormAndVersions(
      'MARRIAGE_REGISTRATION',
      'Đăng ký kết hôn',
      marriageProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: marriageFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: marriageRulesV1Raw
        },
        {
          version: '2.0',
          status: 'DRAFT',
          effectiveFrom: null,
          fieldsRaw: marriageFieldsV2Raw,
          hintsRaw: [{ from: 'residence', candidates: ['permanent_address', 'temporary_address'] }],
          rulesRaw: marriageRulesV2Raw
        }
      ]
    );

    // 2. Seed BIRTH_REGISTRATION
    const birthSteps = [
      { order: 1, title: 'Chuẩn bị hồ sơ', description: 'Chuẩn bị tờ khai đăng ký khai sinh và giấy chứng sinh.', example: 'Người cha chuẩn bị sẵn giấy chứng sinh bản gốc do bệnh viện cấp.' },
      { order: 2, title: 'Nộp hồ sơ', description: 'Nộp hồ sơ trực tiếp tại UBND cấp xã hoặc nộp trực tuyến.', example: 'Bạn đăng nhập VNeID và nộp tờ khai khai sinh trực tuyến.' },
      { order: 3, title: 'Nhận kết quả', description: 'Nhận Giấy khai sinh bản chính và bản sao trích lục.', example: 'Bạn nhận Giấy khai sinh của con tại bộ phận một cửa UBND cấp xã.' }
    ];

    const birthQuestions = [
      { code: 'has_foreign_element', orderNumber: 1, fieldType: 'radio', optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }], conditionJson: null, questionText: 'Đăng ký khai sinh có yếu tố nước ngoài không?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Bạn muốn đăng ký khai sinh tại tỉnh/thành phố nào?' },
      { code: 'birth_location', orderNumber: 3, fieldType: 'select', optionsJson: [{ value: 'facility', label: 'Cơ sở y tế' }, { value: 'home', label: 'Tại nhà' }, { value: 'other', label: 'Nơi khác' }], conditionJson: null, questionText: 'Trẻ được sinh ra ở đâu?' }
    ];

    const birthDocuments = [
      { code: 'BIRTH_DECLARATION', name: 'Tờ khai đăng ký khai sinh', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'BIRTH_CERTIFICATE', name: 'Giấy chứng sinh', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'SUBMITTER_IDENTITY', name: 'CCCD/hộ chiếu của người đi đăng ký', originals: 1, copies: 0, orderNumber: 3, conditionJson: null, reasonText: null, submissionType: 'PRESENT' }
    ];

    const birthProc = await upsertProcedure(
      'BIRTH_REGISTRATION',
      'Đăng ký khai sinh',
      'Hộ tịch',
      'UBND cấp xã',
      'CITIZEN',
      OFFICIAL_PROCEDURE_SOURCE_URLS.BIRTH_REGISTRATION,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: birthSteps,
          durationText: 'Trong ngày làm việc nếu hồ sơ hợp lệ',
          feesText: 'Miễn phí',
          legalBasisText: 'Luật Hộ tịch 2014; Nghị định 123/2015/NĐ-CP; Thông tư 04/2020/TT-BTP'
        }
      ],
      birthQuestions,
      birthDocuments
    );

    // Seed BIRTH_REGISTRATION Forms
    const birthFieldsV1Raw = [
      { id: "child_name", type: "text", label: "Họ và tên trẻ", required: true },
      { id: "birth_date", type: "date", label: "Ngày sinh của trẻ", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "requester_name", type: "text", label: "Họ và tên người đi khai sinh", required: true },
      { id: "relationship", type: "select", label: "Quan hệ với trẻ", required: true, options: [{ value: "father", label: "Cha" }, { value: "mother", label: "Mẹ" }, { value: "other", label: "Khác" }] }
    ];

    const birthRulesV1Raw = [
      { id: "br_v1_req_child_name", type: "required", fieldId: "child_name", params: {}, message: "Họ và tên trẻ là bắt buộc.", suggestion: "Nhập đầy đủ họ tên khai sinh của trẻ.", severity: "error", orderNumber: 1 },
      { id: "br_v1_req_birth_date", type: "required", fieldId: "birth_date", params: {}, message: "Ngày sinh của trẻ là bắt buộc.", suggestion: "Nhập ngày sinh ghi trên Giấy chứng sinh.", severity: "error", orderNumber: 2 },
      { id: "br_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Tỉnh/thành phố đăng ký là bắt buộc.", suggestion: "Chọn tỉnh/thành phố đăng ký khai sinh.", severity: "error", orderNumber: 3 },
      { id: "br_v1_req_requester_name", type: "required", fieldId: "requester_name", params: {}, message: "Họ và tên người đi khai sinh là bắt buộc.", suggestion: "Nhập họ tên đầy đủ của người đi đăng ký.", severity: "error", orderNumber: 4 },
      { id: "br_v1_req_relationship", type: "required", fieldId: "relationship", params: {}, message: "Quan hệ với trẻ là bắt buộc.", suggestion: "Chọn Cha, Mẹ hoặc Khác.", severity: "error", orderNumber: 5 },
      { id: "br_v1_date_child_birth", type: "date_not_future", fieldId: "birth_date", params: {}, message: "Ngày sinh của trẻ không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh của trẻ.", severity: "error", orderNumber: 6 }
    ];

    await upsertFormAndVersions(
      'BIRTH_REGISTRATION',
      'Đăng ký khai sinh',
      birthProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: birthFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: birthRulesV1Raw
        }
      ]
    );

    // 3. Seed TEMP_RESIDENCE_REGISTRATION (Guidance-only, no Form/FormVersion)
    const tempResidenceSteps = [
      { order: 1, title: 'Chuẩn bị hồ sơ', description: 'Chuẩn bị tờ khai thay đổi thông tin cư trú và giấy tờ chỗ ở hợp pháp.', example: 'Bạn chuẩn bị hợp đồng thuê nhà có chữ ký của chủ nhà trọ.' },
      { order: 2, title: 'Nộp hồ sơ', description: 'Nộp hồ sơ trực tuyến qua Cổng dịch vụ công Bộ Công an hoặc nộp trực tiếp.', example: 'Bạn tải ảnh quét của hợp đồng thuê nhà lên cổng dịch vụ công.' },
      { order: 3, title: 'Nhận kết quả', description: 'Nhận thông báo kết quả giải quyết tạm trú.', example: 'Bạn kiểm tra thông báo kết quả đăng ký tạm trú được gửi về điện thoại.' }
    ];

    const tempResidenceQuestions = [
      { code: 'has_consent', orderNumber: 1, fieldType: 'radio', optionsJson: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }], conditionJson: null, questionText: 'Bạn có sự đồng ý của chủ hộ/chủ sở hữu chỗ ở hợp pháp không?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Bạn muốn đăng ký tạm trú tại tỉnh/thành phố nào?' }
    ];

    const tempResidenceDocuments = [
      { code: 'CT01', name: 'Tờ khai thay đổi thông tin cư trú', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'LEGAL_ACCOMMODATION_DOC', name: 'Giấy tờ chứng minh chỗ ở hợp pháp', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' }
    ];

    // Tờ khai CT01 (thay đổi thông tin cư trú) — dynamic form fields + rules.
    const tempResidenceFieldsV1Raw = [
      { id: "full_name", type: "text", label: "Họ và tên", required: true },
      { id: "birth_date", type: "date", label: "Ngày sinh", required: true },
      { id: "gender", type: "radio", label: "Giới tính", required: true, options: [{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }] },
      { id: "identity_number", type: "text", label: "Số định danh cá nhân/CCCD", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại", required: true },
      { id: "permanent_address", type: "text", label: "Nơi thường trú", required: true },
      { id: "temporary_address", type: "text", label: "Nơi đề nghị đăng ký tạm trú", required: true },
      { id: "temp_from_date", type: "date", label: "Tạm trú từ ngày", required: true },
      { id: "temp_to_date", type: "date", label: "Tạm trú đến ngày", required: true },
      { id: "relationship_to_owner", type: "text", label: "Quan hệ với chủ hộ/chủ sở hữu chỗ ở", required: true },
      { id: "host_consent", type: "radio", label: "Chủ hộ/chủ sở hữu chỗ ở đồng ý", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Không" }] },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "legal_accommodation_doc", type: "file", label: "Giấy tờ chứng minh chỗ ở hợp pháp", required: false, visibleWhen: { field: "host_consent", operator: "equals", value: true } }
    ];

    const tempResidenceRulesV1Raw = [
      { id: "tr_v1_req_full_name", type: "required", fieldId: "full_name", params: {}, message: "Vui lòng nhập họ và tên.", suggestion: "Nhập đầy đủ họ tên theo giấy tờ tùy thân.", severity: "error", orderNumber: 1 },
      { id: "tr_v1_req_birth_date", type: "required", fieldId: "birth_date", params: {}, message: "Vui lòng nhập ngày sinh.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "tr_v1_date_birth", type: "date_not_future", fieldId: "birth_date", params: {}, message: "Ngày sinh không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh.", severity: "error", orderNumber: 3 },
      { id: "tr_v1_req_gender", type: "required", fieldId: "gender", params: {}, message: "Vui lòng chọn giới tính.", suggestion: "Chọn Nam hoặc Nữ.", severity: "error", orderNumber: 4 },
      { id: "tr_v1_req_identity", type: "required", fieldId: "identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 5 },
      { id: "tr_v1_fmt_identity", type: "regex", fieldId: "identity_number", params: { pattern: "^\\d{12}$" }, message: "Số định danh/CCCD phải gồm đúng 12 chữ số.", suggestion: "Ví dụ: 001099012345.", severity: "error", orderNumber: 6 },
      { id: "tr_v1_req_phone", type: "required", fieldId: "phone_number", params: {}, message: "Vui lòng nhập số điện thoại.", suggestion: "Nhập số điện thoại liên hệ.", severity: "error", orderNumber: 7 },
      { id: "tr_v1_fmt_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0\\d{9}$" }, message: "Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.", suggestion: "Ví dụ: 0912345678.", severity: "error", orderNumber: 8 },
      { id: "tr_v1_req_permanent", type: "required", fieldId: "permanent_address", params: {}, message: "Vui lòng nhập nơi thường trú.", suggestion: "Nhập địa chỉ thường trú theo CSDL quốc gia về dân cư.", severity: "error", orderNumber: 9 },
      { id: "tr_v1_req_temporary", type: "required", fieldId: "temporary_address", params: {}, message: "Vui lòng nhập nơi đề nghị đăng ký tạm trú.", suggestion: "Nhập địa chỉ chỗ ở hiện tại.", severity: "error", orderNumber: 10 },
      { id: "tr_v1_req_from", type: "required", fieldId: "temp_from_date", params: {}, message: "Vui lòng nhập ngày bắt đầu tạm trú.", suggestion: "Chọn ngày bắt đầu tạm trú.", severity: "error", orderNumber: 11 },
      { id: "tr_v1_req_to", type: "required", fieldId: "temp_to_date", params: {}, message: "Vui lòng nhập ngày kết thúc tạm trú.", suggestion: "Chọn ngày kết thúc tạm trú.", severity: "error", orderNumber: 12 },
      { id: "tr_v1_date_order", type: "date_after", fieldId: "temp_to_date", params: { afterFieldId: "temp_from_date" }, message: "Ngày kết thúc tạm trú phải sau ngày bắt đầu.", suggestion: "Kiểm tra lại khoảng thời gian tạm trú.", severity: "error", orderNumber: 13 },
      { id: "tr_v1_req_relationship", type: "required", fieldId: "relationship_to_owner", params: {}, message: "Vui lòng nhập quan hệ với chủ hộ/chủ sở hữu chỗ ở.", suggestion: "Ví dụ: người thuê nhà, con, cháu…", severity: "error", orderNumber: 14 },
      { id: "tr_v1_req_consent", type: "required", fieldId: "host_consent", params: {}, message: "Vui lòng cho biết chủ hộ/chủ sở hữu có đồng ý không.", suggestion: "Chọn Có nếu đã được chủ hộ đồng ý.", severity: "error", orderNumber: 15 },
      { id: "tr_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn địa phương nơi đăng ký tạm trú.", severity: "error", orderNumber: 16 },
      { id: "tr_v1_cond_doc", type: "conditional_document", fieldId: "legal_accommodation_doc", params: { condition: { field: "host_consent", operator: "equals", value: true } }, message: "Vui lòng tải lên giấy tờ chứng minh chỗ ở hợp pháp.", suggestion: "Đính kèm hợp đồng thuê nhà hoặc giấy tờ nhà đất.", severity: "error", orderNumber: 17 }
    ];

    const tempResidenceProc = await upsertProcedure(
      'TEMP_RESIDENCE_REGISTRATION',
      'Đăng ký tạm trú',
      'Cư trú',
      'Công an cấp xã',
      'CITIZEN',
      OFFICIAL_PROCEDURE_SOURCE_URLS.TEMP_RESIDENCE_REGISTRATION,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: tempResidenceSteps,
          durationText: 'Trong thời hạn 03 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ',
          feesText: '15.000 đồng (nộp trực tuyến) hoặc 20.000 đồng (nộp trực tiếp)',
          legalBasisText: 'Luật Cư trú 2020'
        }
      ],
      tempResidenceQuestions,
      tempResidenceDocuments
    );

    await upsertFormAndVersions(
      'TEMP_RESIDENCE_REGISTRATION',
      'Tờ khai đăng ký tạm trú (CT01)',
      tempResidenceProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: tempResidenceFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: tempResidenceRulesV1Raw
        }
      ]
    );

    // 4. Seed CITIZEN_ID_ISSUANCE (Guidance-only, no Form/FormVersion)
    const citizenIdSteps = [
      { order: 1, title: 'Đăng ký lịch hẹn', description: 'Đặt lịch hẹn làm căn cước trực tuyến qua cổng dịch vụ công.', example: 'Bạn đặt lịch hẹn thu nhận thông tin căn cước tại Công an quận vào sáng thứ Ba.' },
      { order: 2, title: 'Thu nhận thông tin', description: 'Đến cơ quan Công an thu nhận vân tay, ảnh khuôn mặt và mống mắt.', example: 'Cán bộ hướng dẫn bạn thực hiện chụp ảnh chân dung và quét mống mắt.' },
      { order: 3, title: 'Nhận kết quả', description: 'Nhận thẻ căn cước trực tiếp hoặc qua đường bưu điện.', example: 'Nhân viên bưu chính giao thẻ căn cước mới đến địa chỉ nhà của bạn.' }
    ];

    const citizenIdQuestions = [
      { code: 'age_group', orderNumber: 1, fieldType: 'select', optionsJson: [{ value: 'under_6', label: 'Dưới 6 tuổi' }, { value: '6_to_14', label: 'Từ 6 đến dưới 14 tuổi' }, { value: 'over_14', label: 'Từ đủ 14 tuổi trở lên' }], conditionJson: null, questionText: 'Người làm thẻ căn cước thuộc nhóm tuổi nào?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Bạn muốn làm thẻ căn cước tại tỉnh/thành phố nào?' }
    ];

    const citizenIdDocuments = [
      { code: 'CC_INFO_RECEIPT', name: 'Phiếu thu nhận thông tin căn cước', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'PRESENT' },
      { code: 'CIVIL_INFO_DOC', name: 'Giấy tờ hộ tịch chứng minh thông tin', originals: 1, copies: 0, orderNumber: 2, conditionJson: { field: 'age_group', operator: 'equals', value: 'under_6' }, reasonText: 'Cần thiết đối với trẻ em dưới 6 tuổi nếu thông tin hộ tịch chưa được đồng bộ trên hệ thống.', submissionType: 'SUBMIT' }
    ];

    // Tờ khai căn cước — dynamic form fields + rules.
    const citizenIdFieldsV1Raw = [
      { id: "full_name", type: "text", label: "Họ và tên", required: true },
      { id: "birth_date", type: "date", label: "Ngày sinh", required: true },
      { id: "gender", type: "radio", label: "Giới tính", required: true, options: [{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }] },
      { id: "issue_reason", type: "select", label: "Lý do đề nghị cấp", required: true, options: [{ value: "cap_moi", label: "Cấp mới (lần đầu)" }, { value: "cap_doi", label: "Cấp đổi" }, { value: "cap_lai", label: "Cấp lại" }] },
      { id: "old_id_number", type: "text", label: "Số CCCD/CMND đã được cấp", required: false, visibleWhen: { field: "issue_reason", operator: "not_equals", value: "cap_moi" } },
      { id: "permanent_address", type: "text", label: "Nơi thường trú", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố thực hiện", required: true },
      { id: "appointment_confirmed", type: "radio", label: "Đã đặt lịch hẹn thu nhận thông tin", required: true, options: [{ value: true, label: "Rồi" }, { value: false, label: "Chưa" }] }
    ];

    const citizenIdRulesV1Raw = [
      { id: "cc_v1_req_full_name", type: "required", fieldId: "full_name", params: {}, message: "Vui lòng nhập họ và tên.", suggestion: "Nhập đầy đủ họ tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "cc_v1_req_birth_date", type: "required", fieldId: "birth_date", params: {}, message: "Vui lòng nhập ngày sinh.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "cc_v1_date_birth", type: "date_not_future", fieldId: "birth_date", params: {}, message: "Ngày sinh không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh.", severity: "error", orderNumber: 3 },
      { id: "cc_v1_req_gender", type: "required", fieldId: "gender", params: {}, message: "Vui lòng chọn giới tính.", suggestion: "Chọn Nam hoặc Nữ.", severity: "error", orderNumber: 4 },
      { id: "cc_v1_req_reason", type: "required", fieldId: "issue_reason", params: {}, message: "Vui lòng chọn lý do đề nghị cấp.", suggestion: "Chọn Cấp mới, Cấp đổi hoặc Cấp lại.", severity: "error", orderNumber: 5 },
      { id: "cc_v1_cond_old_id", type: "conditional_required", fieldId: "old_id_number", params: { condition: { field: "issue_reason", operator: "not_equals", value: "cap_moi" } }, message: "Vui lòng nhập số CCCD/CMND đã được cấp.", suggestion: "Cần thiết khi cấp đổi hoặc cấp lại.", severity: "error", orderNumber: 6 },
      { id: "cc_v1_fmt_old_id", type: "regex", fieldId: "old_id_number", params: { pattern: "^\\d{9,12}$" }, message: "Số CCCD/CMND phải gồm 9 đến 12 chữ số.", suggestion: "CMND có 9 số, CCCD/định danh có 12 số.", severity: "error", orderNumber: 7 },
      { id: "cc_v1_req_permanent", type: "required", fieldId: "permanent_address", params: {}, message: "Vui lòng nhập nơi thường trú.", suggestion: "Nhập địa chỉ thường trú theo CSDL quốc gia về dân cư.", severity: "error", orderNumber: 8 },
      { id: "cc_v1_req_phone", type: "required", fieldId: "phone_number", params: {}, message: "Vui lòng nhập số điện thoại.", suggestion: "Nhập số điện thoại liên hệ.", severity: "error", orderNumber: 9 },
      { id: "cc_v1_fmt_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0\\d{9}$" }, message: "Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.", suggestion: "Ví dụ: 0912345678.", severity: "error", orderNumber: 10 },
      { id: "cc_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố thực hiện.", suggestion: "Chọn địa phương nơi làm thẻ căn cước.", severity: "error", orderNumber: 11 },
      { id: "cc_v1_req_appointment", type: "required", fieldId: "appointment_confirmed", params: {}, message: "Vui lòng cho biết đã đặt lịch hẹn chưa.", suggestion: "Chọn Rồi nếu đã đặt lịch hẹn thu nhận thông tin.", severity: "error", orderNumber: 12 }
    ];

    const citizenIdProc = await upsertProcedure(
      'CITIZEN_ID_ISSUANCE',
      'Cấp thẻ căn cước',
      'Căn cước',
      'Công an cấp huyện',
      'CITIZEN',
      OFFICIAL_PROCEDURE_SOURCE_URLS.CITIZEN_ID_ISSUANCE,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: citizenIdSteps,
          durationText: 'Không quá 07 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ',
          feesText: 'Miễn phí cho lần cấp thẻ căn cước đầu tiên',
          legalBasisText: 'Luật Căn cước 2023'
        }
      ],
      citizenIdQuestions,
      citizenIdDocuments
    );

    await upsertFormAndVersions(
      'CITIZEN_ID_ISSUANCE',
      'Tờ khai cấp thẻ căn cước',
      citizenIdProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: citizenIdFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: citizenIdRulesV1Raw
        }
      ]
    );

    // 5. Seed PASSPORT_ISSUANCE (Guidance-only, no Form/FormVersion)
    const passportSteps = [
      { order: 1, title: 'Khai tờ khai trực tuyến', description: 'Điền thông tin tờ khai đề nghị cấp hộ chiếu trên Cổng dịch vụ công.', example: 'Bạn chụp ảnh chân dung 4x6 nền trắng và tải lên tờ khai điện tử.' },
      { order: 2, title: 'Thanh toán lệ phí', description: 'Thanh toán lệ phí trực tuyến sau khi hồ sơ được kiểm duyệt.', example: 'Bạn thực hiện thanh toán lệ phí 200.000 đồng qua ứng dụng ngân hàng.' },
      { order: 3, title: 'Nhận hộ chiếu', description: 'Nhận hộ chiếu tại nhà qua dịch vụ bưu chính gửi về nhà.', example: 'Bạn ký nhận bưu phẩm chứa hộ chiếu mới gửi từ Cục Xuất nhập cảnh.' }
    ];

    const passportQuestions = [
      { code: 'passport_type', orderNumber: 1, fieldType: 'select', optionsJson: [{ value: 'chipped', label: 'Có gắn chíp điện tử' }, { value: 'non_chipped', label: 'Không gắn chíp điện tử' }], conditionJson: null, questionText: 'Bạn muốn cấp hộ chiếu loại gắn chíp điện tử hay không gắn chíp?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Bạn muốn nộp hồ sơ tại tỉnh/thành phố nào?' }
    ];

    const passportDocuments = [
      { code: 'PASSPORT_DECLARATION', name: 'Tờ khai đề nghị cấp hộ chiếu phổ thông', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'PASSPORT_PHOTO', name: 'Ảnh chân dung 4x6 mới nhất', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'OLD_PASSPORT', name: 'Hộ chiếu phổ thông cũ gần nhất', originals: 1, copies: 0, orderNumber: 3, conditionJson: { field: 'passport_type', operator: 'equals', value: 'chipped' }, reasonText: 'Nộp lại hộ chiếu cũ để làm thủ tục hủy hoặc gia hạn.', submissionType: 'SUBMIT' }
    ];

    // Tờ khai đề nghị cấp hộ chiếu (mẫu X01) — dynamic form fields + rules.
    const passportFieldsV1Raw = [
      { id: "full_name", type: "text", label: "Họ và tên", required: true },
      { id: "birth_date", type: "date", label: "Ngày sinh", required: true },
      { id: "gender", type: "radio", label: "Giới tính", required: true, options: [{ value: "male", label: "Nam" }, { value: "female", label: "Nữ" }] },
      { id: "birth_place", type: "text", label: "Nơi sinh", required: true },
      { id: "identity_number", type: "text", label: "Số định danh cá nhân/CCCD", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại", required: true },
      { id: "permanent_address", type: "text", label: "Nơi thường trú", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố nộp hồ sơ", required: true },
      { id: "has_old_passport", type: "radio", label: "Đã từng được cấp hộ chiếu chưa", required: true, options: [{ value: true, label: "Rồi" }, { value: false, label: "Chưa" }] },
      { id: "old_passport_number", type: "text", label: "Số hộ chiếu đã cấp gần nhất", required: false, visibleWhen: { field: "has_old_passport", operator: "equals", value: true } },
      { id: "old_passport_file", type: "file", label: "Hộ chiếu cũ (bản chụp)", required: false, visibleWhen: { field: "has_old_passport", operator: "equals", value: true } }
    ];

    const passportRulesV1Raw = [
      { id: "pp_v1_req_full_name", type: "required", fieldId: "full_name", params: {}, message: "Vui lòng nhập họ và tên.", suggestion: "Nhập đầy đủ họ tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "pp_v1_req_birth_date", type: "required", fieldId: "birth_date", params: {}, message: "Vui lòng nhập ngày sinh.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "pp_v1_date_birth", type: "date_not_future", fieldId: "birth_date", params: {}, message: "Ngày sinh không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh.", severity: "error", orderNumber: 3 },
      { id: "pp_v1_req_gender", type: "required", fieldId: "gender", params: {}, message: "Vui lòng chọn giới tính.", suggestion: "Chọn Nam hoặc Nữ.", severity: "error", orderNumber: 4 },
      { id: "pp_v1_req_birth_place", type: "required", fieldId: "birth_place", params: {}, message: "Vui lòng nhập nơi sinh.", suggestion: "Nhập nơi sinh theo giấy khai sinh.", severity: "error", orderNumber: 5 },
      { id: "pp_v1_req_identity", type: "required", fieldId: "identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "pp_v1_fmt_identity", type: "regex", fieldId: "identity_number", params: { pattern: "^\\d{12}$" }, message: "Số định danh/CCCD phải gồm đúng 12 chữ số.", suggestion: "Ví dụ: 001099012345.", severity: "error", orderNumber: 7 },
      { id: "pp_v1_req_phone", type: "required", fieldId: "phone_number", params: {}, message: "Vui lòng nhập số điện thoại.", suggestion: "Nhập số điện thoại liên hệ.", severity: "error", orderNumber: 8 },
      { id: "pp_v1_fmt_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0\\d{9}$" }, message: "Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.", suggestion: "Ví dụ: 0912345678.", severity: "error", orderNumber: 9 },
      { id: "pp_v1_req_permanent", type: "required", fieldId: "permanent_address", params: {}, message: "Vui lòng nhập nơi thường trú.", suggestion: "Nhập địa chỉ thường trú theo CSDL quốc gia về dân cư.", severity: "error", orderNumber: 10 },
      { id: "pp_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố nộp hồ sơ.", suggestion: "Chọn địa phương nơi nộp hồ sơ.", severity: "error", orderNumber: 11 },
      { id: "pp_v1_req_has_old", type: "required", fieldId: "has_old_passport", params: {}, message: "Vui lòng cho biết đã từng được cấp hộ chiếu chưa.", suggestion: "Chọn Rồi hoặc Chưa.", severity: "error", orderNumber: 12 },
      { id: "pp_v1_cond_old_number", type: "conditional_required", fieldId: "old_passport_number", params: { condition: { field: "has_old_passport", operator: "equals", value: true } }, message: "Vui lòng nhập số hộ chiếu đã cấp gần nhất.", suggestion: "Xem số hộ chiếu ở trang thông tin của hộ chiếu cũ.", severity: "error", orderNumber: 13 },
      { id: "pp_v1_fmt_old_number", type: "regex", fieldId: "old_passport_number", params: { pattern: "^[A-Za-z]\\d{7}$" }, message: "Số hộ chiếu gồm 1 chữ cái và 7 chữ số.", suggestion: "Ví dụ: C1234567.", severity: "error", orderNumber: 14 },
      { id: "pp_v1_cond_old_file", type: "conditional_document", fieldId: "old_passport_file", params: { condition: { field: "has_old_passport", operator: "equals", value: true } }, message: "Vui lòng tải lên bản chụp hộ chiếu cũ.", suggestion: "Đính kèm ảnh chụp trang thông tin của hộ chiếu cũ.", severity: "error", orderNumber: 15 }
    ];

    const passportProc = await upsertProcedure(
      'PASSPORT_ISSUANCE',
      'Cấp hộ chiếu phổ thông trong nước',
      'Xuất nhập cảnh',
      'Phòng Quản lý xuất nhập cảnh Công an cấp tỉnh',
      'CITIZEN',
      OFFICIAL_PROCEDURE_SOURCE_URLS.PASSPORT_ISSUANCE,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: passportSteps,
          durationText: 'Trong thời hạn 08 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ',
          feesText: '200.000 đồng',
          legalBasisText: 'Luật Xuất cảnh, nhập cảnh của công dân Việt Nam 2019'
        }
      ],
      passportQuestions,
      passportDocuments
    );

    await upsertFormAndVersions(
      'PASSPORT_ISSUANCE',
      'Tờ khai đề nghị cấp hộ chiếu phổ thông',
      passportProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: passportFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: passportRulesV1Raw
        }
      ]
    );

    // 6. Seed HOUSEHOLD_BUSINESS_REGISTRATION (audience: BUSINESS, full form flow)
    const householdBusinessSteps = [
      { order: 1, title: 'Chuẩn bị hồ sơ', description: 'Điền Giấy đề nghị đăng ký hộ kinh doanh; nếu hộ do các thành viên hộ gia đình đăng ký, chuẩn bị thêm văn bản ủy quyền cho một thành viên làm đại diện (công chứng/chứng thực).', example: 'Bạn điền tên hộ kinh doanh, ngành nghề và vốn kinh doanh vào giấy đề nghị.' },
      { order: 2, title: 'Nộp hồ sơ', description: 'Nộp trực tuyến qua cổng dịch vụ công hoặc trực tiếp tại cơ quan đăng ký kinh doanh cấp xã bất kỳ trong tỉnh nơi đặt trụ sở.', example: 'Bạn đăng nhập VNeID và nộp hồ sơ đăng ký hộ kinh doanh trực tuyến.' },
      { order: 3, title: 'Tiếp nhận hồ sơ', description: 'Cơ quan đăng ký kinh doanh cấp xã tiếp nhận và trao Giấy biên nhận.', example: 'Bạn nhận Giấy biên nhận có ghi ngày hẹn trả kết quả.' },
      { order: 4, title: 'Thẩm định hồ sơ', description: 'Trường hợp hồ sơ chưa hợp lệ, cơ quan thông báo bằng văn bản trong 03 ngày làm việc để bổ sung, sửa đổi.', example: 'Bạn nhận được yêu cầu bổ sung làm rõ ngành nghề kinh doanh qua email.' },
      { order: 5, title: 'Nhận kết quả', description: 'Nhận Giấy chứng nhận đăng ký hộ kinh doanh trong 03 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ.', example: 'Bạn nhận Giấy chứng nhận đăng ký hộ kinh doanh bản điện tử qua cổng dịch vụ công.' }
    ];

    const householdBusinessQuestions = [
      { code: 'registered_by_family', orderNumber: 1, fieldType: 'radio', optionsJson: [{ value: false, label: 'Một cá nhân' }, { value: true, label: 'Các thành viên hộ gia đình' }], conditionJson: null, questionText: 'Hộ kinh doanh do một cá nhân hay các thành viên hộ gia đình cùng đăng ký?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Trụ sở hộ kinh doanh đặt tại tỉnh/thành phố nào?' },
      { code: 'submission_channel', orderNumber: 3, fieldType: 'radio', optionsJson: [{ value: 'online', label: 'Trực tuyến' }, { value: 'offline', label: 'Trực tiếp' }], conditionJson: null, questionText: 'Bạn muốn nộp hồ sơ trực tuyến hay trực tiếp?' }
    ];

    const householdBusinessDocuments = [
      { code: 'HKD_REQUEST_FORM', name: 'Giấy đề nghị đăng ký hộ kinh doanh', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'FAMILY_AUTHORIZATION', name: 'Văn bản ủy quyền của thành viên hộ gia đình cho người đại diện', originals: 0, copies: 1, orderNumber: 2, conditionJson: { field: 'registered_by_family', operator: 'equals', value: true }, reasonText: 'Áp dụng vì hộ kinh doanh do các thành viên hộ gia đình cùng đăng ký (bản sao có công chứng/chứng thực).', submissionType: 'SUBMIT' },
      { code: 'OWNER_IDENTITY_LOOKUP', name: 'Giấy tờ pháp lý cá nhân của chủ hộ/người đại diện', originals: 0, copies: 0, orderNumber: 3, conditionJson: null, reasonText: 'Cơ quan đăng ký kinh doanh tra cứu thông tin công dân qua CSDL quốc gia về dân cư theo số định danh cá nhân (không phải nộp).', submissionType: 'SYSTEM_LOOKUP' }
    ];

    const householdBusinessProc = await upsertProcedure(
      'HOUSEHOLD_BUSINESS_REGISTRATION',
      'Đăng ký thành lập hộ kinh doanh',
      'Đăng ký kinh doanh',
      'Cơ quan đăng ký kinh doanh cấp xã',
      'BUSINESS',
      OFFICIAL_PROCEDURE_SOURCE_URLS.HOUSEHOLD_BUSINESS_REGISTRATION,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          stepsJson: householdBusinessSteps,
          durationText: '03 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ',
          feesText: 'Theo nghị quyết của HĐND cấp tỉnh (nhiều địa phương miễn lệ phí khi đăng ký trực tuyến)',
          legalBasisText: 'Luật Doanh nghiệp 2020; Nghị định 168/2025/NĐ-CP'
        }
      ],
      householdBusinessQuestions,
      householdBusinessDocuments
    );

    const householdBusinessFieldsV1Raw = [
      { id: "business_name", type: "text", label: "Tên hộ kinh doanh", required: true },
      { id: "owner_full_name", type: "text", label: "Họ và tên chủ hộ kinh doanh", required: true },
      { id: "owner_birth_date", type: "date", label: "Ngày sinh chủ hộ", required: true },
      { id: "owner_identity_number", type: "text", label: "Số định danh cá nhân/CCCD của chủ hộ", required: true },
      { id: "business_address", type: "text", label: "Địa chỉ trụ sở hộ kinh doanh", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "business_lines", type: "text", label: "Ngành, nghề kinh doanh", required: true },
      { id: "capital_amount", type: "number", label: "Vốn kinh doanh (đồng)", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại liên hệ", required: false },
      { id: "registered_by_family", type: "radio", label: "Đăng ký bởi các thành viên hộ gia đình", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Không" }] },
      { id: "family_authorization", type: "file", label: "Văn bản ủy quyền của thành viên hộ gia đình", required: false, visibleWhen: { field: "registered_by_family", operator: "equals", value: true } },
      { id: "submission_channel", type: "radio", label: "Kênh nộp hồ sơ", required: true, options: [{ value: "online", label: "Trực tuyến" }, { value: "offline", label: "Trực tiếp" }] }
    ];

    const householdBusinessRulesV1Raw = [
      { id: "hkd_v1_req_business_name", type: "required", fieldId: "business_name", params: {}, message: "Vui lòng nhập tên hộ kinh doanh.", suggestion: "Nhập tên đầy đủ, ví dụ: Hộ kinh doanh Tạp hóa Minh Anh.", severity: "error", orderNumber: 1 },
      { id: "hkd_v1_req_owner_name", type: "required", fieldId: "owner_full_name", params: {}, message: "Vui lòng nhập họ tên chủ hộ kinh doanh.", suggestion: "Nhập đầy đủ họ tên theo CCCD.", severity: "error", orderNumber: 2 },
      { id: "hkd_v1_req_owner_birth", type: "required", fieldId: "owner_birth_date", params: {}, message: "Vui lòng nhập ngày sinh chủ hộ.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 3 },
      { id: "hkd_v1_date_owner_birth", type: "date_not_future", fieldId: "owner_birth_date", params: {}, message: "Ngày sinh của chủ hộ không được ở tương lai.", suggestion: "Vui lòng kiểm tra lại ngày sinh.", severity: "error", orderNumber: 4 },
      { id: "hkd_v1_req_owner_id", type: "required", fieldId: "owner_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD của chủ hộ.", suggestion: "Nhập đủ 12 chữ số trên thẻ căn cước.", severity: "error", orderNumber: 5 },
      { id: "hkd_v1_fmt_owner_id", type: "regex", fieldId: "owner_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số.", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "hkd_v1_req_address", type: "required", fieldId: "business_address", params: {}, message: "Vui lòng nhập địa chỉ trụ sở hộ kinh doanh.", suggestion: "Nhập số nhà, đường/phố, phường/xã nơi đặt trụ sở.", severity: "error", orderNumber: 7 },
      { id: "hkd_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn nơi đặt trụ sở hộ kinh doanh.", severity: "error", orderNumber: 8 },
      { id: "hkd_v1_req_lines", type: "required", fieldId: "business_lines", params: {}, message: "Vui lòng nhập ngành, nghề kinh doanh.", suggestion: "Ví dụ: bán lẻ tạp hóa, dịch vụ ăn uống.", severity: "error", orderNumber: 9 },
      { id: "hkd_v1_req_capital", type: "required", fieldId: "capital_amount", params: {}, message: "Vui lòng nhập vốn kinh doanh.", suggestion: "Nhập số vốn bằng đồng Việt Nam.", severity: "error", orderNumber: 10 },
      { id: "hkd_v1_range_capital", type: "number_range", fieldId: "capital_amount", params: { min: 1 }, message: "Vốn kinh doanh phải lớn hơn 0 đồng.", suggestion: "Kiểm tra lại số vốn đã kê khai.", severity: "error", orderNumber: 11 },
      { id: "hkd_v1_fmt_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0[0-9]{9}$" }, message: "Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0.", suggestion: "Ví dụ: 0912345678.", severity: "error", orderNumber: 12 },
      { id: "hkd_v1_req_family_flag", type: "required", fieldId: "registered_by_family", params: {}, message: "Vui lòng chọn hình thức đăng ký.", suggestion: "Chọn Có nếu các thành viên hộ gia đình cùng đăng ký.", severity: "error", orderNumber: 13 },
      { id: "hkd_v1_cond_doc_authorization", type: "conditional_document", fieldId: "family_authorization", params: { condition: { field: "registered_by_family", operator: "equals", value: true } }, message: "Vui lòng tải lên văn bản ủy quyền của thành viên hộ gia đình.", suggestion: "Cần bản sao văn bản ủy quyền có công chứng/chứng thực vì hộ do các thành viên hộ gia đình đăng ký.", severity: "error", orderNumber: 14 },
      { id: "hkd_v1_conflict_authorization", type: "cross_field_conflict", fieldId: undefined, params: { conditions: [{ field: "registered_by_family", operator: "equals", value: false }, { field: "family_authorization", operator: "not_empty" }] }, message: "Thông tin mâu thuẫn: bạn chọn đăng ký cá nhân nhưng lại tải lên văn bản ủy quyền của thành viên hộ gia đình.", suggestion: "Kiểm tra lại hình thức đăng ký hoặc gỡ tệp ủy quyền.", severity: "error", orderNumber: 15 },
      { id: "hkd_v1_req_channel", type: "required", fieldId: "submission_channel", params: {}, message: "Vui lòng chọn kênh nộp hồ sơ.", suggestion: "Chọn Trực tuyến hoặc Trực tiếp.", severity: "error", orderNumber: 16 }
    ];

    await upsertFormAndVersions(
      'HOUSEHOLD_BUSINESS_REGISTRATION',
      'Đăng ký thành lập hộ kinh doanh',
      householdBusinessProc.id,
      [
        {
          version: '1.0',
          status: 'ACTIVE',
          effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
          fieldsRaw: householdBusinessFieldsV1Raw,
          hintsRaw: [],
          rulesRaw: householdBusinessRulesV1Raw
        }
      ]
    );

    // 7. Seed PENDING ChangeRequest for MARRIAGE_REGISTRATION v1.0 -> v2.0
    const mActiveFormV1 = await prisma.formVersion.findFirst({
      where: {
        form: { code: 'MARRIAGE_REGISTRATION' },
        version: '1.0',
      },
    });

    if (!mActiveFormV1) {
      throw new Error("Active FormVersion 1.0 for MARRIAGE_REGISTRATION not found to attach ChangeRequest.");
    }

    await prisma.changeRequest.upsert({
      where: { id: 'cr_marriage_v2' },
      update: {
        oldVersionId: mActiveFormV1.id,
        status: 'PENDING',
        reviewedBy: null,
        reviewedAt: null,
        sourceUrl: OFFICIAL_PROCEDURE_SOURCE_URLS.MARRIAGE_REGISTRATION,
        diffJson: {
          summary: 'Cập nhật biểu mẫu theo quy định mới về cư trú',
          added: ['permanent_address', 'temporary_address', 'phone_number'],
          removed: ['residence'],
          changed: [],
        },
        proposedDataJson: {
          targetVersion: '2.0',
        },
      },
      create: {
        id: 'cr_marriage_v2',
        oldVersionId: mActiveFormV1.id,
        status: 'PENDING',
        sourceUrl: OFFICIAL_PROCEDURE_SOURCE_URLS.MARRIAGE_REGISTRATION,
        diffJson: {
          summary: 'Cập nhật biểu mẫu theo quy định mới về cư trú',
          added: ['permanent_address', 'temporary_address', 'phone_number'],
          removed: ['residence'],
          changed: [],
        },
        proposedDataJson: {
          targetVersion: '2.0',
        },
      },
    });

    await seedImportedCatalog();

    await seedUsers();

    await seedDemoApplications(prisma);

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Seeding integrity error occurred:', error);
    throw error;
  }
}

export async function disconnectSeedDatabase(): Promise<void> {
  await prisma.$disconnect();
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('seed.ts') ||
  process.argv[1].endsWith('seed.js') ||
  fileURLToPath(import.meta.url) === process.argv[1]
);

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await disconnectSeedDatabase();
    });
}
