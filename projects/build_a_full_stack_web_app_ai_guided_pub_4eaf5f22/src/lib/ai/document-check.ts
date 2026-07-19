import { fetchUpstreamJson } from './upstream';
import { logAiUsage } from './usage';
import { getAiProvider } from '@/lib/config';

/**
 * AI verification of a citizen's signed declaration (tờ khai đã ký) before it
 * reaches the reviewing officer. A vision model looks at the uploaded image and
 * assesses three things: is this the right kind of administrative declaration,
 * does it carry a signature, and is it legible. The verdict is advisory —
 * consistent with the app's grounded design, the AI never makes the final legal
 * decision — but a confident "this is not a signed declaration" blocks the
 * upload so obviously-wrong files never enter the review queue.
 */

export type SignatureCheckStatus = 'PASSED' | 'REVIEW' | 'REJECTED' | 'SKIPPED';

export type SignatureCheck = {
  status: SignatureCheckStatus;
  isDeclaration: boolean | null;
  hasSignature: boolean | null;
  legible: boolean | null;
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
5. confidence: mức độ tin cậy tổng thể của bạn cho các đánh giá trên, từ 0 đến 1.
6. reason: 1-2 câu tiếng Việt, phổ thông, giải thích ngắn gọn nhận định. Nếu từ chối, nêu rõ người dân cần làm gì (ví dụ: ký vào mục người khai rồi chụp lại rõ nét).
7. Chỉ trả về JSON đúng cấu trúc:
{
  "is_declaration": boolean,
  "has_signature": boolean,
  "is_legible": boolean,
  "confidence": number,
  "reason": string
}`;

function clampConfidence(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
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
  } else if (isDeclaration === true && hasSignature === true) {
    status = 'PASSED';
    defaultReason = 'Đã nhận diện tờ khai có chữ ký.';
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
}): Promise<SignatureCheck> {
  const checkedAt = new Date().toISOString();

  if (getAiProvider() !== 'openai') {
    return skipped('Bản demo không bật AI nên tờ khai chưa được kiểm tra tự động; cán bộ sẽ xem trực tiếp.', checkedAt);
  }
  if (!VISION_IMAGE_MIME.has(input.mimeType)) {
    return skipped('Tệp PDF không kiểm tra tự động bằng ảnh; cán bộ sẽ xem trực tiếp bản đã ký.', checkedAt);
  }

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
          { type: 'text', text: 'Đây là ảnh tờ khai người dân đã ký. Hãy kiểm tra theo yêu cầu.' },
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
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
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
