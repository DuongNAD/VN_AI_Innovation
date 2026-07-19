import { fetchUpstreamJson } from './upstream';
import { logAiUsage } from './usage';
import { getAiProvider } from '@/lib/config';
import type { FieldDef } from '@/lib/schema-guards';

/**
 * AI verification of a citizen's signed declaration (tờ khai đã ký) before it
 * reaches the reviewing officer. A vision model looks at the uploaded image and
 * assesses: is this the right kind of administrative declaration, does it carry
 * a signature, is it legible, and do the signer names printed on it match the
 * names declared in the application. The verdict is advisory — consistent with
 * the app's grounded design, the AI never makes the final legal decision — but
 * a confident "this is not a signed declaration" blocks the upload so
 * obviously-wrong files never enter the review queue. A name mismatch is never
 * an outright block (OCR of Vietnamese names is error-prone); it flags the file
 * for the officer instead.
 */

export type SignatureCheckStatus = 'PASSED' | 'REVIEW' | 'REJECTED' | 'SKIPPED';

export type SignatureCheck = {
  status: SignatureCheckStatus;
  isDeclaration: boolean | null;
  hasSignature: boolean | null;
  legible: boolean | null;
  /** Do the names on the declaration match the application data? Null = not assessed. */
  nameMatch: boolean | null;
  /** Signer names the model could read on the document (bounded, may be empty). */
  namesSeen: string[];
  /** Overall model confidence, 0..1. */
  confidence: number;
  /** Short Vietnamese explanation shown to the citizen and the officer. */
  reason: string;
  model: string;
  checkedAt: string;
};

// Vision models are addressed on the same /chat/completions path (billed as the
// llm service). DeepSeek-V4-Flash is text-only, so the vision model is named
// separately and defaults to a widely available multimodal model.
const VISION_MODEL = process.env.VISION_MODEL || 'gpt-4o-mini';

// Only raster images can be sent inline to a vision model. PDFs (typically a
// digital signature) are passed straight to the officer for manual review.
const VISION_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// A confident negative from the model is required to block a citizen's upload;
// below this we prefer a soft "needs review" over a false rejection.
const REJECT_CONFIDENCE = 0.6;

const SYSTEM_PROMPT_VERIFY = `Bạn là trợ lý kiểm tra hình ảnh tờ khai hành chính công của Việt Nam trước khi chuyển cho cán bộ một cửa.
Người dân tải lên ảnh chụp/scan bản tờ khai họ đã KÝ. Hãy quan sát ảnh và đánh giá khách quan.

Yêu cầu:
1. Chỉ đánh giá những gì NHÌN THẤY trên ảnh. Không suy diễn nội dung pháp lý, không đưa ra lời khuyên pháp lý, không quyết định hồ sơ được duyệt hay không.
2. is_declaration: ảnh có phải là một tờ khai/biểu mẫu hành chính (có tiêu đề quốc hiệu, bảng thông tin, mục người khai ký) hay không.
3. has_signature: có nhìn thấy chữ ký tay hoặc chữ ký ở khu vực người khai ký hay không.
4. is_legible: ảnh có đủ rõ, không quá mờ, không bị che khuất phần chữ ký hay không.
5. name_match: tin nhắn của người dùng có thể kèm danh sách "Tên người khai theo hồ sơ". Nếu có, hãy đọc tên in trên tờ khai (bảng thông tin và khu vực ký tên) rồi so sánh: coi là khớp khi trùng nhau sau khi bỏ dấu tiếng Việt, không phân biệt hoa thường và thứ tự. Trả về true nếu khớp, false nếu rõ ràng là tên KHÁC, null nếu không đọc được tên hoặc không có danh sách để so.
6. names_seen: các tên người khai bạn đọc được trên tờ khai (mảng chuỗi, tối đa 4, có thể rỗng).
7. confidence: mức độ tin cậy tổng thể của bạn cho các đánh giá trên, từ 0 đến 1.
8. reason: 1-2 câu tiếng Việt, phổ thông, giải thích ngắn gọn nhận định. Nếu từ chối hoặc tên không khớp, nêu rõ người dân cần làm gì.
9. Chỉ trả về JSON đúng cấu trúc:
{
  "is_declaration": boolean,
  "has_signature": boolean,
  "is_legible": boolean,
  "name_match": boolean | null,
  "names_seen": string[],
  "confidence": number,
  "reason": string
}`;

const MAX_SIGNER_NAMES = 4;
const MAX_NAME_LENGTH = 120;

function foldVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/**
 * Pulls the declarant names out of the application data so the vision model can
 * cross-check them against what is printed on the signed declaration. A field
 * counts as a person-name field when its id or label says so (full_name,
 * "Họ, chữ đệm, tên", "Họ và tên", …). Pure and bounded for unit testing.
 */
export function extractSignerNames(
  fields: Pick<FieldDef, 'id' | 'type' | 'label'>[],
  data: Record<string, unknown>
): string[] {
  const names: string[] = [];
  for (const field of fields) {
    if (field.type !== 'text') continue;
    const idHit = /(^|_)(full_name|ho_ten)($|_)|_name$/.test(field.id);
    const foldedLabel = foldVietnamese(field.label);
    const labelHit = /ho,? (chu dem,? )?ten|ho va ten|ho ten/.test(foldedLabel);
    if (!idHit && !labelHit) continue;
    const value = data[field.id];
    if (typeof value !== 'string') continue;
    const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed.length === 0 || names.includes(trimmed)) continue;
    names.push(trimmed);
    if (names.length >= MAX_SIGNER_NAMES) break;
  }
  return names;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function parseNamesSeen(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const names: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const trimmed = item.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
    if (trimmed.length === 0 || names.includes(trimmed)) continue;
    names.push(trimmed);
    if (names.length >= MAX_SIGNER_NAMES) break;
  }
  return names;
}

function cleanReason(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.replace(/\s+/g, ' ').trim().slice(0, 400);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Maps the raw vision-model JSON to a decision. Pure and side-effect free so the
 * accept/reject policy can be unit-tested without a live model.
 */
export function decideSignatureCheck(raw: unknown, model: string, checkedAt: string): SignatureCheck {
  const obj = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const isDeclaration = typeof obj.is_declaration === 'boolean' ? obj.is_declaration : null;
  const hasSignature = typeof obj.has_signature === 'boolean' ? obj.has_signature : null;
  const legible = typeof obj.is_legible === 'boolean' ? obj.is_legible : null;
  const nameMatch = typeof obj.name_match === 'boolean' ? obj.name_match : null;
  const namesSeen = parseNamesSeen(obj.names_seen);
  const confidence = clampConfidence(obj.confidence);

  let status: SignatureCheckStatus;
  let defaultReason: string;

  if (isDeclaration === false && confidence >= REJECT_CONFIDENCE) {
    status = 'REJECTED';
    defaultReason = 'Tệp tải lên không giống tờ khai của thủ tục này. Vui lòng tải đúng bản tờ khai đã ký.';
  } else if (hasSignature === false && confidence >= REJECT_CONFIDENCE) {
    status = 'REJECTED';
    defaultReason = 'Không phát hiện chữ ký trên tờ khai. Vui lòng ký vào mục người khai rồi chụp/scan lại.';
  } else if (legible === false) {
    status = 'REVIEW';
    defaultReason = 'Ảnh tờ khai hơi mờ hoặc khó đọc; cán bộ sẽ kiểm tra kỹ khi tiếp nhận.';
  } else if (nameMatch === false) {
    // Reading Vietnamese names from a photo is error-prone, so a mismatch is
    // never an outright block — it goes to the officer with the names the model
    // read, for a human comparison.
    status = 'REVIEW';
    defaultReason =
      'Tên trên tờ khai có vẻ chưa khớp với thông tin đã khai trong hồ sơ; cán bộ sẽ đối chiếu khi tiếp nhận. Nếu bạn tải nhầm tờ khai của người khác, hãy thay bằng đúng bản của mình.';
  } else if (isDeclaration === true && hasSignature === true) {
    status = 'PASSED';
    defaultReason =
      nameMatch === true
        ? 'Đã nhận diện tờ khai có chữ ký, tên người khai khớp với hồ sơ.'
        : 'Đã nhận diện tờ khai có chữ ký.';
  } else {
    // Model was unsure (nulls or low confidence): let it through but flag it.
    status = 'REVIEW';
    defaultReason = 'Chưa thể khẳng định chắc chắn; cán bộ sẽ kiểm tra lại tờ khai đã ký.';
  }

  return {
    status,
    isDeclaration,
    hasSignature,
    legible,
    nameMatch,
    namesSeen,
    confidence,
    reason: cleanReason(obj.reason, defaultReason),
    model,
    checkedAt,
  };
}

function skipped(reason: string, checkedAt: string): SignatureCheck {
  return {
    status: 'SKIPPED',
    isDeclaration: null,
    hasSignature: null,
    legible: null,
    nameMatch: null,
    namesSeen: [],
    confidence: 0,
    reason,
    model: 'none',
    checkedAt,
  };
}

/**
 * Runs the vision check on an uploaded signed declaration. Never throws: any
 * configuration or upstream problem degrades to a SKIPPED verdict so a signed
 * file still reaches manual review rather than blocking the citizen on an
 * infrastructure issue.
 */
export async function verifySignedDeclaration(input: {
  bytes: Uint8Array;
  mimeType: string;
  /** Declarant names from the application data, for the name cross-check. */
  expectedNames?: string[];
}): Promise<SignatureCheck> {
  const checkedAt = new Date().toISOString();

  if (getAiProvider() !== 'openai') {
    return skipped('Bản demo không bật AI nên tờ khai chưa được kiểm tra tự động; cán bộ sẽ xem trực tiếp.', checkedAt);
  }
  if (!VISION_IMAGE_MIME.has(input.mimeType)) {
    return skipped('Tệp PDF không kiểm tra tự động bằng ảnh; cán bộ sẽ xem trực tiếp bản đã ký.', checkedAt);
  }

  const expectedNames = (input.expectedNames ?? []).slice(0, MAX_SIGNER_NAMES);
  const userText =
    expectedNames.length > 0
      ? `Đây là ảnh tờ khai người dân đã ký. Tên người khai theo hồ sơ: ${expectedNames.join('; ')}. Hãy kiểm tra theo yêu cầu, bao gồm đối chiếu tên.`
      : 'Đây là ảnh tờ khai người dân đã ký. Không có danh sách tên để đối chiếu (name_match: null). Hãy kiểm tra các mục còn lại theo yêu cầu.';

  const dataUri = `data:${input.mimeType};base64,${Buffer.from(input.bytes).toString('base64')}`;
  const body = JSON.stringify({
    model: VISION_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT_VERIFY },
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
  });

  const startTime = Date.now();
  let response: any;
  try {
    response = await fetchUpstreamJson(
      '/chat/completions',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
      // Marketplace keys are scoped per model: the vision model bills on its
      // own VISION_API_KEY (OPENAI_API_KEY fallback), not the text LLM's key.
      { service: 'vision' }
    );
  } catch {
    // Any config/network/timeout problem degrades to manual review rather than
    // blocking the citizen on infrastructure.
    return skipped('Chưa kiểm tra được tự động lúc này; cán bộ sẽ xem trực tiếp bản đã ký.', checkedAt);
  }

  const usage = response?.usage;
  logAiUsage({
    serviceType: 'llm',
    model: VISION_MODEL,
    latencyMs: Date.now() - startTime,
    ...(typeof usage?.prompt_tokens === 'number' ? { promptTokens: usage.prompt_tokens } : {}),
    ...(typeof usage?.completion_tokens === 'number' ? { completionTokens: usage.completion_tokens } : {}),
  });

  const reply = response?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string') {
    return skipped('Chưa đọc được kết quả kiểm tra tự động; cán bộ sẽ xem trực tiếp bản đã ký.', checkedAt);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return skipped('Chưa đọc được kết quả kiểm tra tự động; cán bộ sẽ xem trực tiếp bản đã ký.', checkedAt);
  }

  return decideSignatureCheck(parsed, VISION_MODEL, checkedAt);
}
