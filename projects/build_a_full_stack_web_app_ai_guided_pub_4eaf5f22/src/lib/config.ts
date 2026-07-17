/**
 * Known residual design limitation:
 * Static validation passes for DNS names that resolve to internal IP addresses in non-production.
 * Production environment is protected by pinning the hostname to 'api.openai.com'.
 * Re-validation at connect time is the responsibility of the outbound HTTP client.
 */

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

export function getOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (getAiProvider() === 'openai') {
    if (key === undefined || key.trim() === '') {
      throw new Error('CONFIG_INVALID: OPENAI_API_KEY is required when AI_PROVIDER=openai');
    }
    return key;
  }
  return key || '';
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
    if (hostname !== 'api.openai.com') {
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

export function getAdminToken(): string {
  const token = process.env.ADMIN_TOKEN;
  if (token === undefined) {
    throw new Error('CONFIG_INVALID: ADMIN_TOKEN is required');
  }
  if (token === 'demo-admin-token') {
    throw new Error('CONFIG_INVALID: ADMIN_TOKEN must not be a placeholder value');
  }
  if (token.length < 24 || !/^[\x21-\x7E]+$/.test(token)) {
    throw new Error('CONFIG_INVALID: ADMIN_TOKEN must be at least 24 printable non-whitespace ASCII characters');
  }
  const distinctChars = new Set(token).size;
  if (distinctChars < 8) {
    throw new Error('CONFIG_INVALID: ADMIN_TOKEN must contain at least 8 distinct characters');
  }
  return token;
}

export function assertStartupConfig(): void {
  getAdminToken();
  getOpenAiBaseUrl();
  if (getAiProvider() === 'openai') {
    getOpenAiKey();
  }
}