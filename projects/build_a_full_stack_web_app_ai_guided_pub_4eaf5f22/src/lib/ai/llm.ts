import { fetchUpstreamJson, UpstreamError } from './upstream';
import { logAiUsage } from './usage';
import { getAiProvider } from '@/lib/config';

export type QuestionRewriteInput = {
  procedureCode: string;
  procedureName: string;
  questionCode: string;
  questionText: string;
  fieldType: 'radio' | 'select' | 'text' | 'province';
  optionLabels: string[];
};

export type QuestionRewrite = {
  questionText: string;
  helpText: string;
  examples: string[];
};

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
  rewriteQuestion(input: QuestionRewriteInput): Promise<QuestionRewrite>;
}

const MAX_MESSAGE = 2000;
const MAX_CATALOG = 100;
const MAX_NAME = 120;
const MAX_ERRORS = 20;
const MAX_FIELDS = 20;
const MAX_QUESTION_TEXT = 500;
const MAX_QUESTION_HELP = 800;
const MAX_QUESTION_EXAMPLES = 3;
// Procedure codes come in two shapes: hand-authored (MARRIAGE_REGISTRATION) and
// imported from the DVCQG portal (numeric-dotted, e.g. "1.000656", "3.000333").
const CODE_RE = /^(?:[A-Z][A-Z0-9_]{0,63}|\d{1,3}(?:\.\d{1,9}){1,4})$/;
const FIELD_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const FORM_RE = /^[A-Za-z0-9_-]{1,64}$/;

const KEYWORD_TABLE: Record<string, string[]> = {
  DIVORCE_RESOLUTION: ['thu tuc ly hon', 'xin ly hon', 'don ly hon', 'ly hon', 'li hon'],
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
  MARRIAGE_MALE_UNDERAGE: () => 'Người nam chưa đủ 20 tuổi theo điều kiện đăng ký kết hôn.',
  MARRIAGE_FEMALE_UNDERAGE: () => 'Người nữ chưa đủ 18 tuổi theo điều kiện đăng ký kết hôn.',
  IMPLAUSIBLE_AGE: (err) => `Ngày sinh tại ${err.field ? `trường ${err.field}` : 'biểu mẫu'} tạo ra độ tuổi bất thường và cần được kiểm tra lại.`,
  DUPLICATE_PARTY_IDENTITY: () => 'Hai bên đăng ký đang sử dụng cùng một số CCCD, trong khi mỗi người phải có số định danh riêng.',
  RULE_CONFIG_INVALID: () => `Lỗi cấu hình quy tắc hệ thống.`,
};

const EXPLAIN_ERRORS_FALLBACK = 'Giải thích: Biểu mẫu có lỗi, vui lòng kiểm tra lại các ô đã nhập.';

const QUESTION_PRESENTATIONS: Record<string, QuestionRewrite> = {
  'MARRIAGE_REGISTRATION:has_foreign_element': {
    questionText: 'Một trong hai người có phải là người nước ngoài hoặc đang cư trú ở nước ngoài không?',
    helpText:
      'Chọn “Có” nếu ít nhất một người không có quốc tịch Việt Nam hoặc hiện đang cư trú ở nước ngoài. Nếu cả hai là công dân Việt Nam và đang cư trú trong nước, thường chọn “Không”.',
    examples: [
      'Chọn Có: một người mang quốc tịch khác.',
      'Chọn Không: cả hai là công dân Việt Nam đang sống trong nước.',
    ],
  },
  'MARRIAGE_REGISTRATION:previously_married': {
    questionText: 'Trước đây bạn đã từng đăng ký kết hôn chưa?',
    helpText:
      'Chọn “Có” nếu bạn đã từng đăng ký kết hôn, kể cả khi đã ly hôn hoặc vợ/chồng trước của bạn đã mất. Nếu chưa từng đăng ký kết hôn, hãy chọn “Không”.',
    examples: [
      'Chọn “Không”: bạn chưa từng đăng ký kết hôn.',
      'Chọn “Có”: bạn đã ly hôn.',
      'Chọn “Có”: vợ/chồng trước của bạn đã mất.',
    ],
  },
  'MARRIAGE_REGISTRATION:province': {
    questionText: 'Bạn muốn làm thủ tục đăng ký kết hôn tại tỉnh hoặc thành phố nào?',
    helpText: 'Hãy chọn địa phương nơi cơ quan có thẩm quyền sẽ tiếp nhận hồ sơ.',
    examples: [],
  },
  'MARRIAGE_REGISTRATION:submission_channel': {
    questionText: 'Bạn muốn gửi hồ sơ qua mạng hay đến nộp trực tiếp?',
    helpText:
      'Chọn “Trực tuyến” nếu muốn khai và gửi hồ sơ trên cổng dịch vụ công; chọn “Trực tiếp” nếu muốn đến cơ quan tiếp nhận.',
    examples: [],
  },
};

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
  const folded = foldString(message)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!folded) return null;

  const paddedMessage = ` ${folded} `;
  const matches: { procedureCode: string; keyword: string }[] = [];

  for (const [code, keywords] of Object.entries(KEYWORD_TABLE)) {
    for (const kw of keywords) {
      if (paddedMessage.includes(` ${kw} `)) {
        matches.push({ procedureCode: code, keyword: kw });
      }
    }
  }

  if (matches.length === 0) return null;

  const bestMatch = matches.reduce((best, current) =>
    current.keyword.length > best.keyword.length ? current : best
  );
  const keywordWords = bestMatch.keyword.split(' ').length;
  const messageWords = folded.split(' ').length;
  const supportingMatches = matches.filter(
    (match) => match.procedureCode === bestMatch.procedureCode
  ).length;

  // This is a deterministic match score, not a fixed probability. Exact and
  // specific phrases score higher; short/ambiguous keywords score lower.
  let confidence: number;
  if (folded === bestMatch.keyword) {
    confidence = 0.98;
  } else {
    const specificity = Math.min(keywordWords / 3, 1);
    const coverage = Math.min(keywordWords / messageWords, 1);
    const supportBonus = Math.min(Math.max(supportingMatches - 1, 0), 2) * 0.02;
    confidence = 0.68 + specificity * 0.14 + coverage * 0.1 + supportBonus;
    confidence = Math.min(confidence, 0.94);
  }

  return {
    procedureCode: bestMatch.procedureCode,
    confidence: Math.round(confidence * 100) / 100,
  };
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

export function normalizeGeneratedVietnameseText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:đã\s+)?(?:g[oó]a|goá)\s+bụa\b/giu, 'có vợ hoặc chồng đã mất')
    .trim();
}

function cleanQuestionText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = normalizeGeneratedVietnameseText(value);
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function sanitizeQuestionInput(input: QuestionRewriteInput): QuestionRewriteInput {
  const procedureCode =
    typeof input?.procedureCode === 'string' && CODE_RE.test(input.procedureCode)
      ? input.procedureCode
      : 'UNKNOWN';
  const questionCode =
    typeof input?.questionCode === 'string' && FIELD_RE.test(input.questionCode)
      ? input.questionCode
      : 'unknown_question';
  const procedureName =
    cleanQuestionText(input?.procedureName, MAX_NAME) ?? 'Thủ tục hành chính';
  const questionText =
    cleanQuestionText(input?.questionText, MAX_QUESTION_TEXT) ?? 'Vui lòng chọn câu trả lời phù hợp.';
  const fieldTypes = new Set(['radio', 'select', 'text', 'province']);
  const fieldType = fieldTypes.has(input?.fieldType) ? input.fieldType : 'text';
  const optionLabels = Array.isArray(input?.optionLabels)
    ? input.optionLabels
        .slice(0, 20)
        .map((label) => cleanQuestionText(label, 100))
        .filter((label): label is string => !!label)
    : [];
  return {
    procedureCode,
    procedureName,
    questionCode,
    questionText,
    fieldType,
    optionLabels,
  };
}

function fallbackQuestionRewrite(input: QuestionRewriteInput): QuestionRewrite {
  const sanitized = sanitizeQuestionInput(input);
  const curated = QUESTION_PRESENTATIONS[`${sanitized.procedureCode}:${sanitized.questionCode}`];
  if (curated) {
    return curated;
  }
  return {
    questionText: sanitized.questionText,
    helpText:
      sanitized.fieldType === 'province'
        ? 'Hãy chọn tỉnh hoặc thành phố đúng với nơi bạn muốn thực hiện thủ tục.'
        : 'Hãy chọn phương án đúng với tình huống thực tế của bạn. Nội dung này chỉ giúp diễn giải câu hỏi chính thức.',
    examples: [],
  };
}

function parseQuestionRewrite(value: unknown): QuestionRewrite {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UpstreamError('Question rewrite is not an object');
  }
  const raw = value as Record<string, unknown>;
  const questionText = cleanQuestionText(raw.questionText, MAX_QUESTION_TEXT);
  const helpText = cleanQuestionText(raw.helpText, MAX_QUESTION_HELP);
  const examples = Array.isArray(raw.examples)
    ? raw.examples
        .slice(0, MAX_QUESTION_EXAMPLES)
        .map((item) => cleanQuestionText(item, 240))
        .filter((item): item is string => !!item)
    : [];
  if (!questionText || !helpText) {
    throw new UpstreamError('Question rewrite fields are invalid');
  }
  return { questionText, helpText, examples };
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
      return hit;
    }
    return { procedureCode: null, confidence: 0 };
  },

  async rewriteQuestion(input) {
    return fallbackQuestionRewrite(input);
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
2. Chấm confidence theo mức độ khớp thực tế: 0.95-1.0 chỉ khi người dùng nói trực tiếp, gần như chính xác tên thủ tục; 0.80-0.94 khi ý định rõ ràng và duy nhất; 0.60-0.79 khi còn một phần mơ hồ; dưới 0.60 hoặc null khi không đủ thông tin.
3. Trả về kết quả dưới định dạng JSON có cấu trúc chính xác như sau:
{
  "procedureCode": string | null,
  "confidence": number
}`;

const SYSTEM_PROMPT_EXPLAIN = `Bạn là trợ lý giải thích mã lỗi biểu mẫu hành chính cho người dân, đặc biệt là những người lớn tuổi.
Hãy giải thích các lỗi được cung cấp một cách đơn giản, dễ hiểu bằng tiếng Việt và không quá 3 câu.

Yêu cầu bắt buộc:
1. CHỈ giải thích các mã lỗi được cung cấp.
2. Không đưa ra bất kỳ lời khuyên pháp lý nào.
3. Dùng từ phổ thông, hiện đại; tránh từ cổ, từ địa phương và từ dễ gây hiểu nhầm.
4. Kiểm tra chính tả và dấu câu tiếng Việt trước khi trả kết quả.
5. Trả về kết quả dưới định dạng JSON có cấu trúc chính xác như sau:
{
  "explanation": string
}`;

const SYSTEM_PROMPT_REWRITE_QUESTION = `Bạn là biên tập viên ngôn ngữ cho cổng dịch vụ công.
Hãy viết lại câu hỏi hành chính được cung cấp thành tiếng Việt đơn giản, dễ hiểu với người dân và người lớn tuổi.

Yêu cầu bắt buộc:
1. Giữ nguyên ý nghĩa pháp lý của câu hỏi gốc; không thêm điều kiện, quyền lợi hoặc kết luận pháp lý mới.
2. Không thay đổi các phương án trả lời.
3. questionText là một câu hỏi ngắn, trực tiếp.
4. helpText giải thích cách hiểu bằng ngôn ngữ đời thường.
5. examples có tối đa 3 ví dụ ngắn; có thể là mảng rỗng.
6. Dùng từ phổ thông, hiện đại; tránh từ cổ, từ địa phương hoặc từ dễ gây hiểu nhầm. Không dùng “góa bụa”; hãy viết rõ “vợ/chồng đã mất”.
7. Kiểm tra chính tả và dấu câu tiếng Việt trước khi trả kết quả.
8. Chỉ trả về JSON:
{
  "questionText": string,
  "helpText": string,
  "examples": string[]
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

  async rewriteQuestion(input) {
    const sanitized = sanitizeQuestionInput(input);
    const curated = QUESTION_PRESENTATIONS[`${sanitized.procedureCode}:${sanitized.questionCode}`];
    if (curated) {
      return curated;
    }
    const startTime = Date.now();
    const response = await fetchUpstreamJson('/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: buildChatCompletionBody([
        { role: 'system', content: SYSTEM_PROMPT_REWRITE_QUESTION },
        { role: 'user', content: JSON.stringify(sanitized) },
      ]),
    }) as any;

    const usage = response?.usage;
    logAiUsage({
      serviceType: 'llm',
      model: LLM_MODEL,
      latencyMs: Date.now() - startTime,
      ...(typeof usage?.prompt_tokens === 'number'
        ? { promptTokens: usage.prompt_tokens }
        : {}),
      ...(typeof usage?.completion_tokens === 'number'
        ? { completionTokens: usage.completion_tokens }
        : {}),
    });

    const reply = response?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      throw new UpstreamError('Empty question rewrite response');
    }
    try {
      return parseQuestionRewrite(JSON.parse(reply));
    } catch (error) {
      if (error instanceof UpstreamError) {
        throw error;
      }
      throw new UpstreamError('Failed to parse question rewrite response');
    }
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

    const rawExplanation = parsed.explanation;
    if (typeof rawExplanation !== 'string' || rawExplanation.trim() === '' || rawExplanation.length > 2000) {
      throw new UpstreamError('Invalid explanation field in OpenAI response');
    }

    return normalizeGeneratedVietnameseText(rawExplanation);
  },
};

export function getLlmProvider(): LlmProvider {
  const provider = getAiProvider();
  return provider === 'openai' ? openaiLlm : mockLlm;
}
