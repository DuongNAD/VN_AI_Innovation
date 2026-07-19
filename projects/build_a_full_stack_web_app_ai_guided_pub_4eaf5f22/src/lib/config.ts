/**
 * Known residual design limitation:
 * Static validation passes for DNS names that resolve to internal IP addresses in non-production.
 * Production environment is protected by pinning the hostname to an allowlist of
 * known AI upstream hosts (OpenAI, FPT AI Marketplace).
 * Re-validation at connect time is the responsibility of the outbound HTTP client.
 */

const PROD_ALLOWED_AI_HOSTS: ReadonlySet<string> = new Set([
  'api.openai.com',
  'mkp-api.fptcloud.com',
]);

function getBoundedInteger(
  varName: string,
  min: number,
  max: number,
  fallback: number
): number {
  const value = process.env[varName];
  if (value === undefined) {
    return fallback;
  }
  if (!/^[0-9]+$/.test(value)) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isSafeInteger(num)) {
    return fallback;
  }
  if (num < min || num > max) {
    return fallback;
  }
  return num;
}

function isIPv4DottedQuad(hostname: string): boolean {
  let dots = 0;
  for (let i = 0; i < hostname.length; i++) {
    const char = hostname[i];
    if (char === '.') {
      dots++;
    } else if (char < '0' || char > '9') {
      return false;
    }
  }
  return dots === 3;
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getTrustProxy(): boolean {
  return process.env.TRUST_PROXY === '1';
}

export function getRateLimitPerMinute(): number {
  return getBoundedInteger('RATE_LIMIT_PER_MINUTE', 1, 1000, 10);
}

export function getSessionTtlHours(): number {
  return getBoundedInteger('SESSION_TTL_HOURS', 1, 24, 24);
}

export function getAiProvider(): 'mock' | 'openai' {
  return process.env.AI_PROVIDER === 'openai' ? 'openai' : 'mock';
}

export type AiService = 'llm' | 'stt' | 'tts' | 'vision';

const SERVICE_KEY_VARS: Record<AiService, string> = {
  llm: 'LLM_API_KEY',
  stt: 'STT_API_KEY',
  tts: 'TTS_API_KEY',
  // Marketplaces issue one key per model, so the vision model (used for the
  // signed-declaration check) carries its own key. Deliberately NOT validated
  // in validateConfig: vision is optional and degrades to a SKIPPED verdict.
  vision: 'VISION_API_KEY',
};

/**
 * Resolves the API key for one AI service. Per-service keys (LLM_API_KEY /
 * STT_API_KEY / TTS_API_KEY) take precedence — marketplaces like FPT AI issue
 * keys scoped to a single model — with OPENAI_API_KEY as the shared fallback.
 */
export function getServiceApiKey(service: AiService): string {
  const varName = SERVICE_KEY_VARS[service];
  const specific = process.env[varName];
  if (specific !== undefined && specific.trim() !== '') {
    return specific;
  }
  const shared = process.env.OPENAI_API_KEY;
  if (shared !== undefined && shared.trim() !== '') {
    return shared;
  }
  if (getAiProvider() === 'openai') {
    throw new Error(`CONFIG_INVALID: ${varName} or OPENAI_API_KEY is required when AI_PROVIDER=openai`);
  }
  return '';
}

export function getOpenAiBaseUrl(): string {
  const rawValue = process.env.OPENAI_BASE_URL;
  if (rawValue === undefined || rawValue.trim() === '') {
    return 'https://api.openai.com/v1';
  }

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error('CONFIG_INVALID: OPENAI_BASE_URL is not a valid URL');
  }

  if (url.username || url.password) {
    throw new Error('CONFIG_INVALID: OPENAI_BASE_URL must not contain credentials');
  }

  const hostname = url.hostname;
  const isIPv6 = hostname.startsWith('[');
  const isIPv4 = isIPv4DottedQuad(hostname);
  const isIpLiteral = isIPv6 || isIPv4;
  const protocol = url.protocol;

  if (isProd()) {
    if (protocol !== 'https:') {
      throw new Error('CONFIG_INVALID: OPENAI_BASE_URL must use https (http is allowed only for localhost outside production)');
    }
    if (!PROD_ALLOWED_AI_HOSTS.has(hostname)) {
      throw new Error('CONFIG_INVALID: OPENAI_BASE_URL host is not allowed in production');
    }
  } else {
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('CONFIG_INVALID: OPENAI_BASE_URL must use https (http is allowed only for localhost outside production)');
    }
    if (protocol === 'http:') {
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        throw new Error('CONFIG_INVALID: OPENAI_BASE_URL must use https (http is allowed only for localhost outside production)');
      }
    }
    if (isIpLiteral && hostname !== '127.0.0.1') {
      throw new Error('CONFIG_INVALID: OPENAI_BASE_URL must not use an IP address host');
    }
  }

  let href = url.href;
  if (href.endsWith('/')) {
    href = href.slice(0, -1);
  }
  return href;
}

function validateStaffToken(varName: string, token: string | undefined, forbiddenPlaceholder: string): string {
  if (token === undefined || token === '') {
    throw new Error(`CONFIG_INVALID: ${varName} is required`);
  }
  // Strength requirements are enforced in production only, as documented in
  // README/.env.example — local demos may run with the shipped example values.
  if (isProd()) {
    if (token === forbiddenPlaceholder) {
      throw new Error(`CONFIG_INVALID: ${varName} must not be a placeholder value`);
    }
    if (token.length < 24 || !/^[\x21-\x7E]+$/.test(token)) {
      throw new Error(
        `CONFIG_INVALID: ${varName} must be at least 24 printable non-whitespace ASCII characters`
      );
    }
    const distinctChars = new Set(token).size;
    if (distinctChars < 8) {
      throw new Error(`CONFIG_INVALID: ${varName} must contain at least 8 distinct characters`);
    }
  }
  return token;
}

export function getAdminToken(): string {
  return validateStaffToken('ADMIN_TOKEN', process.env.ADMIN_TOKEN, 'demo-admin-token');
}

/**
 * OPTIONAL legacy shared token for the X-Manager-Token header path.
 * Managers sign in with accounts (cookie sessions) since the login system, so
 * nothing requires this anymore: unset ⇒ returns null and the header path is
 * simply disabled. When set, production still enforces a real, strong value.
 */
export function getManagerToken(): string | null {
  const raw = process.env.MANAGER_TOKEN;
  if (raw === undefined || raw === '') {
    return null;
  }
  return validateStaffToken('MANAGER_TOKEN', raw, 'demo-manager-token');
}

export function assertStartupConfig(): void {
  const admin = getAdminToken();
  const manager = getManagerToken();
  if (manager !== null && admin === manager) {
    throw new Error('CONFIG_INVALID: ADMIN_TOKEN and MANAGER_TOKEN must be different');
  }
  getOpenAiBaseUrl();
  if (getAiProvider() === 'openai') {
    getServiceApiKey('llm');
    getServiceApiKey('stt');
    getServiceApiKey('tts');
  }
}