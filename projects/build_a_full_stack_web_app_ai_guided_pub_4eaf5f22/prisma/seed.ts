import { PrismaClient } from '@prisma/client';
import { parseFieldDefs, parseRuleDefs, parseMigrationHints } from '../src/lib/schema-guards';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

async function upsertProcedure(
  code: string,
  name: string,
  sector: string,
  agency: string,
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
      sourceUrl,
      lastCheckedAt: new Date(),
    },
    create: {
      code,
      name,
      sector,
      agency,
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

export async function main() {
  try {
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
      'https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.000894',
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
      { id: "male_identity_number", type: "text", label: "Số định danh cá nhân/CCCD nam", required: true },
      { id: "female_full_name", type: "text", label: "Họ và tên nữ", required: true },
      { id: "female_birth_date", type: "date", label: "Ngày sinh nữ", required: true },
      { id: "female_identity_number", type: "text", label: "Số định danh cá nhân/CCCD nữ", required: true },
      { id: "residence", type: "text", label: "Nơi cư trú", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "previously_married", type: "radio", label: "Đã từng kết hôn chưa", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Chưa" }] },
      { id: "marriage_number", type: "number", label: "Số lần kết hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "divorce_document", type: "file", label: "Trích lục ly hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "submission_channel", type: "radio", label: "Kênh nộp hồ sơ", required: true, options: [{ value: "online", label: "Trực tuyến" }, { value: "offline", label: "Trực tiếp" }] }
    ];

    const marriageRulesV1Raw = [
      { id: "mr_v1_req_male_full_name", type: "required", fieldId: "male_full_name", params: {}, message: "Vui lòng nhập họ và tên nam.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "mr_v1_req_male_birth_date", type: "required", fieldId: "male_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nam.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "mr_v1_req_male_identity_number", type: "required", fieldId: "male_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD nam.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 3 },
      { id: "mr_v1_req_female_full_name", type: "required", fieldId: "female_full_name", params: {}, message: "Vui lòng nhập họ và tên nữ.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 4 },
      { id: "mr_v1_req_female_birth_date", type: "required", fieldId: "female_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nữ.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 5 },
      { id: "mr_v1_req_female_identity_number", type: "required", fieldId: "female_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD nữ.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "mr_v1_req_residence", type: "required", fieldId: "residence", params: {}, message: "Vui lòng nhập nơi cư trú.", suggestion: "Nhập địa chỉ thường trú hoặc tạm trú hiện tại.", severity: "error", orderNumber: 7 },
      { id: "mr_v1_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn trong danh sách hiển thị.", severity: "error", orderNumber: 8 },
      { id: "mr_v1_req_submission_channel", type: "required", fieldId: "submission_channel", params: {}, message: "Vui lòng chọn kênh nộp hồ sơ.", suggestion: "Chọn Trực tuyến hoặc Trực tiếp.", severity: "error", orderNumber: 9 },
      { id: "mr_v1_regex_male_id", type: "regex", fieldId: "male_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước", severity: "error", orderNumber: 10 },
      { id: "mr_v1_regex_female_id", type: "regex", fieldId: "female_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước", severity: "error", orderNumber: 11 },
      { id: "mr_v1_date_male_birth", type: "date_not_future", fieldId: "male_birth_date", params: {}, message: "Ngày sinh nam không được ở tương lai", suggestion: "Vui lòng kiểm tra lại ngày sinh của nam.", severity: "error", orderNumber: 12 },
      { id: "mr_v1_date_female_birth", type: "date_not_future", fieldId: "female_birth_date", params: {}, message: "Ngày sinh nữ không được ở tương lai", suggestion: "Vui lòng kiểm tra lại ngày sinh của nữ.", severity: "error", orderNumber: 13 },
      { id: "mr_v1_range_marriage_number", type: "number_range", fieldId: "marriage_number", params: { min: 1, max: 10 }, message: "Số lần kết hôn phải từ 1 đến 10", suggestion: "Vui lòng nhập số lần kết hôn hợp lệ.", severity: "error", orderNumber: 14 },
      { id: "mr_v1_conflict_marriage", type: "cross_field_conflict", fieldId: undefined, params: { conditions: [{ field: "previously_married", operator: "equals", value: false }, { field: "marriage_number", operator: "not_empty" }] }, message: "Thông tin mâu thuẫn: chưa từng kết hôn nhưng có số lần kết hôn", suggestion: "Kiểm tra lại lựa chọn Đã từng kết hôn chưa hoặc Số lần kết hôn", severity: "error", orderNumber: 15 },
      { id: "mr_v1_cond_doc_divorce", type: "conditional_document", fieldId: "divorce_document", params: { condition: { field: "previously_married", operator: "equals", value: true } }, message: "Vui lòng tải lên Trích lục ly hôn.", suggestion: "Bạn cần cung cấp giấy tờ ly hôn vì đã từng kết hôn.", severity: "error", orderNumber: 16 }
    ];

    const marriageFieldsV2Raw = [
      { id: "male_full_name", type: "text", label: "Họ và tên nam", required: true },
      { id: "male_birth_date", type: "date", label: "Ngày sinh nam", required: true },
      { id: "male_identity_number", type: "text", label: "Số định danh cá nhân/CCCD nam", required: true },
      { id: "female_full_name", type: "text", label: "Họ và tên nữ", required: true },
      { id: "female_birth_date", type: "date", label: "Ngày sinh nữ", required: true },
      { id: "female_identity_number", type: "text", label: "Số định danh cá nhân/CCCD nữ", required: true },
      { id: "permanent_address", type: "text", label: "Địa chỉ thường trú", required: true },
      { id: "temporary_address", type: "text", label: "Địa chỉ tạm trú", required: true },
      { id: "phone_number", type: "text", label: "Số điện thoại", required: true },
      { id: "province", type: "province", label: "Tỉnh/thành phố đăng ký", required: true },
      { id: "previously_married", type: "radio", label: "Đã từng kết hôn chưa", required: true, options: [{ value: true, label: "Có" }, { value: false, label: "Chưa" }] },
      { id: "marriage_number", type: "number", label: "Số lần kết hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "divorce_document", type: "file", label: "Trích lục ly hôn", required: false, visibleWhen: { field: "previously_married", operator: "equals", value: true } },
      { id: "submission_channel", type: "radio", label: "Kênh nộp hồ sơ", required: true, options: [{ value: "online", label: "Trực tuyến" }, { value: "offline", label: "Trực tiếp" }] }
    ];

    const marriageRulesV2Raw = [
      { id: "mr_v2_req_male_full_name", type: "required", fieldId: "male_full_name", params: {}, message: "Vui lòng nhập họ và tên nam.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 1 },
      { id: "mr_v2_req_male_birth_date", type: "required", fieldId: "male_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nam.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 2 },
      { id: "mr_v2_req_male_identity_number", type: "required", fieldId: "male_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD nam.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 3 },
      { id: "mr_v2_req_female_full_name", type: "required", fieldId: "female_full_name", params: {}, message: "Vui lòng nhập họ và tên nữ.", suggestion: "Nhập đầy đủ họ và tên theo giấy khai sinh.", severity: "error", orderNumber: 4 },
      { id: "mr_v2_req_female_birth_date", type: "required", fieldId: "female_birth_date", params: {}, message: "Vui lòng nhập ngày sinh nữ.", suggestion: "Nhập đúng ngày tháng năm sinh.", severity: "error", orderNumber: 5 },
      { id: "mr_v2_req_female_identity_number", type: "required", fieldId: "female_identity_number", params: {}, message: "Vui lòng nhập số định danh cá nhân/CCCD nữ.", suggestion: "Nhập đúng 12 số trên thẻ căn cước.", severity: "error", orderNumber: 6 },
      { id: "mr_v2_req_permanent_address", type: "required", fieldId: "permanent_address", params: {}, message: "Vui lòng nhập địa chỉ thường trú.", suggestion: "Nhập đầy đủ số nhà, tên đường, khu vực.", severity: "error", orderNumber: 7 },
      { id: "mr_v2_req_temporary_address", type: "required", fieldId: "temporary_address", params: {}, message: "Vui lòng nhập địa chỉ tạm trú.", suggestion: "Nhập nơi cư trú tạm thời hiện tại.", severity: "error", orderNumber: 8 },
      { id: "mr_v2_req_phone_number", type: "required", fieldId: "phone_number", params: {}, message: "Vui lòng nhập số điện thoại liên hệ.", suggestion: "Nhập số điện thoại di động chính xác.", severity: "error", orderNumber: 9 },
      { id: "mr_v2_req_province", type: "required", fieldId: "province", params: {}, message: "Vui lòng chọn tỉnh/thành phố đăng ký.", suggestion: "Chọn trong danh sách hiển thị.", severity: "error", orderNumber: 10 },
      { id: "mr_v2_req_submission_channel", type: "required", fieldId: "submission_channel", params: {}, message: "Vui lòng chọn kênh nộp hồ sơ.", suggestion: "Chọn Trực tuyến hoặc Trực tiếp.", severity: "error", orderNumber: 11 },
      { id: "mr_v2_regex_male_id", type: "regex", fieldId: "male_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước", severity: "error", orderNumber: 12 },
      { id: "mr_v2_regex_female_id", type: "regex", fieldId: "female_identity_number", params: { pattern: "^[0-9]{12}$" }, message: "Số CCCD phải gồm đúng 12 chữ số", suggestion: "Kiểm tra lại số CCCD trên thẻ căn cước", severity: "error", orderNumber: 13 },
      { id: "mr_v2_regex_phone", type: "regex", fieldId: "phone_number", params: { pattern: "^0[0-9]{9}$" }, message: "Số điện thoại không hợp lệ", suggestion: "Nhập số điện thoại gồm 10 chữ số bắt đầu bằng 0", severity: "error", orderNumber: 14 },
      { id: "mr_v2_date_male_birth", type: "date_not_future", fieldId: "male_birth_date", params: {}, message: "Ngày sinh nam không được ở tương lai", suggestion: "Vui lòng kiểm tra lại ngày sinh của nam.", severity: "error", orderNumber: 15 },
      { id: "mr_v2_date_female_birth", type: "date_not_future", fieldId: "female_birth_date", params: {}, message: "Ngày sinh nữ không được ở tương lai", suggestion: "Vui lòng kiểm tra lại ngày sinh của nữ.", severity: "error", orderNumber: 16 },
      { id: "mr_v2_range_marriage_number", type: "number_range", fieldId: "marriage_number", params: { min: 1, max: 10 }, message: "Số lần kết hôn phải từ 1 đến 10", suggestion: "Vui lòng nhập số lần kết hôn hợp lệ.", severity: "error", orderNumber: 17 },
      { id: "mr_v2_conflict_marriage", type: "cross_field_conflict", fieldId: undefined, params: { conditions: [{ field: "previously_married", operator: "equals", value: false }, { field: "marriage_number", operator: "not_empty" }] }, message: "Thông tin mâu thuẫn: chưa từng kết hôn nhưng có số lần kết hôn", suggestion: "Kiểm tra lại lựa chọn Đã từng kết hôn chưa hoặc Số lần kết hôn", severity: "error", orderNumber: 18 },
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
      'https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.000887',
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
      { id: "br_v1_date_child_birth", type: "date_not_future", fieldId: "birth_date", params: {}, message: "Ngày sinh của trẻ không được ở tương lai", suggestion: "Vui lòng kiểm tra lại ngày sinh của trẻ.", severity: "error", orderNumber: 6 }
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
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Tỉnh/thành phố nơi bạn đến đăng ký tạm trú?' }
    ];

    const tempResidenceDocuments = [
      { code: 'CT01', name: 'Tờ khai thay đổi thông tin cư trú', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'LEGAL_ACCOMMODATION_DOC', name: 'Giấy tờ chứng minh chỗ ở hợp pháp', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' }
    ];

    await upsertProcedure(
      'TEMP_RESIDENCE_REGISTRATION',
      'Đăng ký tạm trú',
      'Cư trú',
      'Công an cấp xã',
      'https://dichvucong.gov.vn/p/home/dvc-tra-cuu-thu-tuc-hanh-chinh.html',
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

    // 4. Seed CITIZEN_ID_ISSUANCE (Guidance-only, no Form/FormVersion)
    const citizenIdSteps = [
      { order: 1, title: 'Đăng ký lịch hẹn', description: 'Đặt lịch hẹn làm căn cước trực tuyến qua cổng dịch vụ công.', example: 'Bạn đặt lịch hẹn thu nhận thông tin căn cước tại Công an quận vào sáng thứ Ba.' },
      { order: 2, title: 'Thu nhận thông tin', description: 'Đến cơ quan Công an thu nhận vân tay, ảnh khuôn mặt và mống mắt.', example: 'Cán bộ hướng dẫn bạn thực hiện chụp ảnh chân dung và quét mống mắt.' },
      { order: 3, title: 'Nhận kết quả', description: 'Nhận thẻ căn cước trực tiếp hoặc qua đường bưu điện.', example: 'Nhân viên bưu chính giao thẻ căn cước mới đến địa chỉ nhà của bạn.' }
    ];

    const citizenIdQuestions = [
      { code: 'age_group', orderNumber: 1, fieldType: 'select', optionsJson: [{ value: 'under_6', label: 'Dưới 6 tuổi' }, { value: '6_to_14', label: 'Từ 6 đến dưới 14 tuổi' }, { value: 'over_14', label: 'Từ đủ 14 tuổi trở lên' }], conditionJson: null, questionText: 'Độ tuổi của người được cấp thẻ căn cước?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Tỉnh/thành phố nơi bạn muốn thực hiện cấp thẻ?' }
    ];

    const citizenIdDocuments = [
      { code: 'CC_INFO_RECEIPT', name: 'Phiếu thu nhận thông tin căn cước', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'PRESENT' },
      { code: 'CIVIL_INFO_DOC', name: 'Giấy tờ hộ tịch chứng minh thông tin', originals: 1, copies: 0, orderNumber: 2, conditionJson: { field: 'age_group', operator: 'equals', value: 'under_6' }, reasonText: 'Cần thiết đối với trẻ em dưới 6 tuổi nếu thông tin hộ tịch chưa được đồng bộ trên hệ thống.', submissionType: 'SUBMIT' }
    ];

    await upsertProcedure(
      'CITIZEN_ID_ISSUANCE',
      'Cấp thẻ căn cước',
      'Căn cước',
      'Công an cấp huyện',
      'https://dichvucong.gov.vn/p/home/dvc-tra-cuu-thu-tuc-hanh-chinh.html',
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

    // 5. Seed PASSPORT_ISSUANCE (Guidance-only, no Form/FormVersion)
    const passportSteps = [
      { order: 1, title: 'Khai tờ khai trực tuyến', description: 'Điền thông tin tờ khai đề nghị cấp hộ chiếu trên Cổng dịch vụ công.', example: 'Bạn chụp ảnh chân dung 4x6 nền trắng và tải lên tờ khai điện tử.' },
      { order: 2, title: 'Thanh toán lệ phí', description: 'Thanh toán lệ phí trực tuyến sau khi hồ sơ được kiểm duyệt.', example: 'Bạn thực hiện thanh toán lệ phí 200.000 đồng qua ứng dụng ngân hàng.' },
      { order: 3, title: 'Nhận hộ chiếu', description: 'Nhận hộ chiếu tại nhà qua dịch vụ bưu chính gửi về nhà.', example: 'Bạn ký nhận bưu phẩm chứa hộ chiếu mới gửi từ Cục Xuất nhập cảnh.' }
    ];

    const passportQuestions = [
      { code: 'passport_type', orderNumber: 1, fieldType: 'select', optionsJson: [{ value: 'chipped', label: 'Có gắn chíp điện tử' }, { value: 'non_chipped', label: 'Không gắn chíp điện tử' }], conditionJson: null, questionText: 'Bạn muốn cấp hộ chiếu loại gắn chíp điện tử hay không gắn chíp?' },
      { code: 'province', orderNumber: 2, fieldType: 'province', optionsJson: null, conditionJson: null, questionText: 'Tỉnh/thành phố nơi bạn nộp hồ sơ?' }
    ];

    const passportDocuments = [
      { code: 'PASSPORT_DECLARATION', name: 'Tờ khai đề nghị cấp hộ chiếu phổ thông', originals: 1, copies: 0, orderNumber: 1, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'PASSPORT_PHOTO', name: 'Ảnh chân dung 4x6 mới nhất', originals: 1, copies: 0, orderNumber: 2, conditionJson: null, reasonText: null, submissionType: 'SUBMIT' },
      { code: 'OLD_PASSPORT', name: 'Hộ chiếu phổ thông cũ gần nhất', originals: 1, copies: 0, orderNumber: 3, conditionJson: { field: 'passport_type', operator: 'equals', value: 'chipped' }, reasonText: 'Nộp lại hộ chiếu cũ để làm thủ tục hủy hoặc gia hạn.', submissionType: 'SUBMIT' }
    ];

    await upsertProcedure(
      'PASSPORT_ISSUANCE',
      'Cấp hộ chiếu phổ thông trong nước',
      'Xuất nhập cảnh',
      'Phòng Quản lý xuất nhập cảnh Công an cấp tỉnh',
      'https://dichvucong.gov.vn/p/home/dvc-tra-cuu-thu-tuc-hanh-chinh.html',
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

    // 6. Seed PENDING ChangeRequest for MARRIAGE_REGISTRATION v1.0 -> v2.0
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
        sourceUrl: 'https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.000894',
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
        sourceUrl: 'https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.000894',
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

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Seeding integrity error occurred:', error);
    process.exit(1);
  }
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
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}