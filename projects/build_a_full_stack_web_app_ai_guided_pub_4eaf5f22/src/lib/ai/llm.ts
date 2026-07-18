import { fetchUpstreamJson, UpstreamError } from './upstream';
import { logAiUsage } from './usage';
import { getAiProvider } from '@/lib/config';

export interface LlmProvider {
  readonly name: string;
  classifyIntent(
    message: string,
    catalog: { code: string; name: string }[]
  ): Promise<{ procedureCode: string | null; confidence: number }>;
  explainErrors(
    errors: { code: string; field?: string; fields?: string[] }[],
    formCode: string
  ): Promise<string>;
}

const MAX_MESSAGE = 2000;
const MAX_CATALOG = 50;
const MAX_NAME = 120;
const MAX_ERRORS = 20;
const MAX_FIELDS = 20;
const CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const FIELD_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const FORM_RE = /^[A-Za-z0-9_-]{1,64}$/;

const KEYWORD_TABLE: Record<string, string[]> = {
  MARRIAGE_REGISTRATION: ['dang ky ket hon', 'ket hon', 'dam cuoi', 'giay ket hon'],
  BIRTH_REGISTRATION: ['dang ky khai sinh', 'khai sinh', 'giay khai sinh'],
  TEMP_RESIDENCE_REGISTRATION: ['dang ky tam tru', 'tam tru'],
  CITIZEN_ID_ISSUANCE: ['cap the can cuoc', 'can cuoc', 'cccd', 'the can cuoc'],
  PASSPORT_ISSUANCE: ['cap ho chieu', 'ho chieu', 'passport'],
  HOUSEHOLD_BUSINESS_REGISTRATION: [
    'dang ky ho kinh doanh',
    'thanh lap ho kinh doanh',
    'ho kinh doanh',
    'dang ky kinh doanh',
    'mo cua hang',
    'mo tiem',
    'ban hang',
    'kinh doanh ca the',
  ],
};

const ERROR_EXPLANATIONS: Record<string, (err: { field?: string; fields?: string[] }) => string> = {
  MISSING_REQUIRED: (err) => `Thiếu thông tin bắt buộc tại ${err.field ? `trường ${err.field}` : 'trường yêu cầu'}.`,
  INVALID_FORMAT: (err) => `Thông tin tại ${err.field ? `trường ${err.field}` : 'trường yêu cầu'} không đúng định dạng.`,
  DATE_IN_FUTURE: (err) => `Ngày đã nhập tại ${err.field ? `trường ${err.field}` : 'trường yêu cầu'} không được ở tương lai.`,
  INVALID_DATE: (err) => `Ngày đã nhập tại ${err.field ? `trường ${err.field}` : 'trường yêu cầu'} không hợp lệ.`,
  DATE_ORDER_INVALID: (err) => `Thứ tự ngày không hợp lệ giữa ${err.fields && err.fields.length > 0 ? `các trường ${err.fields.join(', ')}` : 'các trường liên quan'}.`,
  OUT_OF_RANGE: (err) => `Giá trị tại ${err.field ? `trường ${err.field}` : 'trường yêu cầu'} vượt ngoài phạm vi cho phép.`,
  CONFLICT: (err) => `Thông tin mâu thuẫn giữa ${err.fields && err.fields.length > 0 ? `các trường ${err.fields.join(', ')}` : 'các trường liên quan'}.`,
  MISSING_DOCUMENT: (err) => `Thiếu tài liệu đính kèm bắt buộc: ${err.field || 'tài liệu yêu cầu'}.`,
  RULE_CONFIG_INVALID: () => `Lỗi cấu hình quy tắc hệ thống.`,
};

const EXPLAIN_ERRORS_FALLBACK = 'Giải thích: Biểu mẫu có lỗi, vui lòng kiểm tra lại các ô đã nhập.';

function foldString(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd');
}

export function classifyByKeywords(message: string): { procedureCode: string; confidence: number } | null {
  if (typeof message !== 'string') return null;
  const folded = foldString(message);
  if (!folded.trim()) return null;

  let bestMatch: { procedureCode: string; keyword: string } | null = null;

  for (const [code, keywords] of Object.entries(KEYWORD_TABLE)) {
    for (const kw of keywords) {
      if (folded.includes(kw)) {
        if (!bestMatch || kw.length > bestMatch.keyword.length) {
          bestMatch = { procedureCode: code, keyword: kw };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      procedureCode: bestMatch.procedureCode,
      confidence: 0.95,
    };
  }

  return null;
}

function sanitizeCatalog(input: any): { code: string; name: string }[] {
  if (!Array.isArray(input)) return [];
  const result: { code: string; name: string }[] = [];
  const entries = input.slice(0, MAX_CATALOG);
  for (const entry of entries) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const code = entry.code;
      const name = entry.name;
      if (typeof code === 'string' && CODE_RE.test(code) && typeof name === 'string') {
        const trimmedName = name.trim();
        if (trimmedName !== '') {
          const cleanedName = trimmedName
            .replace(/[\u0000-\u001F\u007F]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          const truncatedName = cleanedName.slice(0, MAX_NAME);
          result.push({ code, name: truncatedName });
        }
      }
    }
  }
  return result;
}

function sanitizeErrors(input: any): { code: string; field?: string; fields?: string[] }[] {
  if (!Array.isArray(input)) return [];
  const result: { code: string; field?: string; fields?: string[] }[] = [];
  const entries = input.slice(0, MAX_ERRORS);
  for (const entry of entries) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const code = entry.code;
      if (typeof code === 'string' && CODE_RE.test(code) && (code in ERROR_EXPLANATIONS)) {
        const sanitizedEntry: { code: string; field?: string; fields?: string[] } = { code };
        if (typeof entry.field === 'string' && FIELD_RE.test(entry.field)) {
          sanitizedEntry.field = entry.field;
        }
        if (Array.isArray(entry.fields)) {
          const validFields: string[] = [];
          for (const f of entry.fields) {
            if (typeof f === 'string' && FIELD_RE.test(f)) {
              validFields.push(f);
              if (validFields.length >= MAX_FIELDS) {
                break;
              }
            }
          }
          sanitizedEntry.fields = validFields;
        }
        result.push(sanitizedEntry);
      }
    }
  }
  return result;
}

function sanitizeFormCode(input: any): string {
  if (typeof input === 'string' && FORM_RE.test(input)) {
    return input;
  }
  return 'UNKNOWN';
}

export const mockLlm: LlmProvider = {
  name: 'mock',
  async classifyIntent(message, catalog) {
    if (typeof message !== 'string' || message.trim() === '') {
      return { procedureCode: null, confidence: 0 };
    }
    const truncatedMessage = message.slice(0, MAX_MESSAGE);
    const sanitizedCatalog = sanitizeCatalog(catalog);
    if (sanitizedCatalog.length === 0) {
      return { procedureCode: null, confidence: 0 };
    }

    const hit = classifyByKeywords(truncatedMessage);
    if (hit && sanitizedCatalog.some(e => e.code === hit.procedureCode)) {
      return { procedureCode: hit.procedureCode, confidence: 0.95 };
    }
    return { procedureCode: null, confidence: 0 };
  },

  async explainErrors(errors, formCode) {
    const sanitizedErrors = sanitizeErrors(errors);
    if (sanitizedErrors.length === 0) {
      return EXPLAIN_ERRORS_FALLBACK;
    }
    const sentences = sanitizedErrors.map(err => {
      const explainer = ERROR_EXPLANATIONS[err.code];
      if (explainer) {
        return explainer(err);
      }
      const fieldStr = err.field ? `trường ${err.field}` : '';
      const fieldsStr = err.fields && err.fields.length > 0 ? `các trường ${err.fields.join(', ')}` : '';
      return `Phát hiện lỗi ${err.code}${fieldStr ? ` tại ${fieldStr}` : ''}${fieldsStr ? ` tại ${fieldsStr}` : ''}.`;
    });

    return 'Giải thích: ' + sentences.join(' ');
  },
};

const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';

/**
 * Builds the chat-completions request body. Reasoning models served via
 * vLLM-compatible marketplaces (e.g. DeepSeek-V4-Flash on FPT AI Marketplace)
 * put their answer in `reasoning_content` and leave `content` null unless
 * thinking is disabled through `chat_template_kwargs`. OpenAI rejects that
 * extra field, so it is only sent when LLM_DISABLE_THINKING=1.
 */
function buildChatCompletionBody(
  messages: { role: string; content: string }[]
): string {
  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages,
  };
  if (process.env.LLM_DISABLE_THINKING === '1') {
    body.chat_template_kwargs = { thinking: false };
  }
  return JSON.stringify(body);
}

const SYSTEM_PROMPT_CLASSIFY = `Bạn là một trợ lý phân loại ý định của người dân đối với các thủ tục hành chính công.
Hãy chọn mã thủ tục (procedureCode) PHÙ HỢP NHẤT từ danh mục được cung cấp trong tin nhắn của người dùng hoặc trả về null nếu không khớp với thủ tục nào.

Yêu cầu bắt buộc:
1. CHỈ chọn procedureCode từ danh mục được cung cấp hoặc trả về null. Không tự ý tạo hay sửa đổi mã thủ tục.
2. Trả về kết quả dưới định dạng JSON có cấu trúc chính xác như sau:
{
  "procedureCode": string | null,
  "confidence": number
}`;

const SYSTEM_PROMPT_EXPLAIN = `Bạn là trợ lý giải thích mã lỗi biểu mẫu hành chính cho người dân, đặc biệt là những người lớn tuổi.
Hãy giải thích các lỗi được cung cấp một cách đơn giản, dễ hiểu bằng tiếng Việt và không quá 3 câu.

Yêu cầu bắt buộc:
1. CHỈ giải thích các mã lỗi được cung cấp.
2. Không đưa ra bất kỳ lời khuyên pháp lý nào.
3. Trả về kết quả dưới định dạng JSON có cấu trúc chính xác như sau:
{
  "explanation": string
}`;

export const openaiLlm: LlmProvider = {
  name: 'openai',
  async classifyIntent(message, catalog) {
    if (typeof message !== 'string' || message.trim() === '') {
      return { procedureCode: null, confidence: 0 };
    }
    const truncatedMessage = message.slice(0, MAX_MESSAGE);
    const sanitizedCatalog = sanitizeCatalog(catalog);
    if (sanitizedCatalog.length === 0) {
      return { procedureCode: null, confidence: 0 };
    }

    const startTime = Date.now();

    const response = await fetchUpstreamJson('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: buildChatCompletionBody([
        { role: 'system', content: SYSTEM_PROMPT_CLASSIFY },
        { role: 'user', content: JSON.stringify({ message: truncatedMessage, catalog: sanitizedCatalog }) },
      ]),
    }) as any;

    const usage = response?.usage;
    const promptTokens = usage?.prompt_tokens;
    const completionTokens = usage?.completion_tokens;
    const logData: any = {
      serviceType: 'llm',
      model: LLM_MODEL,
      latencyMs: Date.now() - startTime,
    };
    if (typeof promptTokens === 'number' && Number.isFinite(promptTokens)) {
      logData.promptTokens = promptTokens;
    }
    if (typeof completionTokens === 'number' && Number.isFinite(completionTokens)) {
      logData.completionTokens = completionTokens;
    }
    logAiUsage(logData);

    const reply = response?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      throw new UpstreamError('Empty completion response from OpenAI');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(reply);
    } catch {
      throw new UpstreamError('Failed to parse chat completion response as JSON');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new UpstreamError('Response content is not a non-null object');
    }

    let procedureCode: string | null = null;
    if (parsed.procedureCode === null) {
      procedureCode = null;
    } else if (typeof parsed.procedureCode === 'string') {
      const matched = sanitizedCatalog.find(item => item.code === parsed.procedureCode);
      if (matched) {
        procedureCode = matched.code;
      }
    }

    const rawConfidence = parsed.confidence;
    if (typeof rawConfidence !== 'number' || !Number.isFinite(rawConfidence)) {
      throw new UpstreamError('Invalid confidence type or value');
    }

    let confidence = Math.max(0, Math.min(1, rawConfidence));

    if (procedureCode === null) {
      confidence = 0;
    }

    return { procedureCode, confidence };
  },

  async explainErrors(errors, formCode) {
    const sanitizedErrors = sanitizeErrors(errors);
    if (sanitizedErrors.length === 0) {
      return EXPLAIN_ERRORS_FALLBACK;
    }

    const startTime = Date.now();

    const response = await fetchUpstreamJson('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: buildChatCompletionBody([
        { role: 'system', content: SYSTEM_PROMPT_EXPLAIN },
        { role: 'user', content: JSON.stringify({ formCode: sanitizeFormCode(formCode), errors: sanitizedErrors }) },
      ]),
    }) as any;

    const usage = response?.usage;
    const promptTokens = usage?.prompt_tokens;
    const completionTokens = usage?.completion_tokens;
    const logData: any = {
      serviceType: 'llm',
      model: LLM_MODEL,
      latencyMs: Date.now() - startTime,
    };
    if (typeof promptTokens === 'number' && Number.isFinite(promptTokens)) {
      logData.promptTokens = promptTokens;
    }
    if (typeof completionTokens === 'number' && Number.isFinite(completionTokens)) {
      logData.completionTokens = completionTokens;
    }
    logAiUsage(logData);

    const reply = response?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      throw new UpstreamError('Empty completion response from OpenAI');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(reply);
    } catch {
      throw new UpstreamError('Failed to parse chat completion response as JSON');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new UpstreamError('Response content is not a non-null object');
    }

    const explanation = parsed.explanation;
    if (typeof explanation !== 'string' || explanation.trim() === '' || explanation.length > 2000) {
      throw new UpstreamError('Invalid explanation field in OpenAI response');
    }

    return explanation.trim();
  },
};

export function getLlmProvider(): LlmProvider {
  const provider = getAiProvider();
  return provider === 'openai' ? openaiLlm : mockLlm;
}