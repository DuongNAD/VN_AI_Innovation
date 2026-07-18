import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import {
  _resetRateLimitForTests,
  rateLimitCheck,
  rateLimitConsume,
} from '@/lib/rate-limit';

// With trust-proxy off, getClientIp returns 'global' for any request, so a
// bare Request is enough to exercise the shared bucket.
const req = () => new Request('http://localhost/test');

/**
 * Regression guard for the check/consume window-mismatch bug: a
 * rateLimitCheck with a 15-minute window paired with a rateLimitConsume that
 * falls back to the 60s default shares ONE map entry, so each paced failure
 * reset the counter and the lockout never fired (found in the change-password,
 * login, and staff-auth paths).
 */
describe('fail-bucket lockout with matching 15-minute windows', () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    _resetRateLimitForTests();
  });

  const LIMIT = 10;
  const WINDOW = 900000;

  function attempt(bucket: string): 'allowed' | 'locked' {
    try {
      rateLimitCheck(bucket, req(), LIMIT, WINDOW);
    } catch (err) {
      if (err instanceof AppError && err.status === 429) return 'locked';
      throw err;
    }
    // simulate a failed credential check -> consume with the SAME window
    rateLimitConsume(bucket, req(), WINDOW);
    return 'allowed';
  }

  it('locks out a paced attacker (one wrong attempt every ~61s)', () => {
    // The buggy pairing (consume defaulting to 60s) let this run forever.
    for (let i = 0; i < LIMIT; i++) {
      expect(attempt('paced')).toBe('allowed');
      vi.advanceTimersByTime(61000);
    }
    expect(attempt('paced')).toBe('locked');
  });

  it('locks out a burst attacker within one window', () => {
    for (let i = 0; i < LIMIT; i++) {
      expect(attempt('burst')).toBe('allowed');
    }
    expect(attempt('burst')).toBe('locked');
  });

  it('unlocks after the 15-minute window elapses', () => {
    for (let i = 0; i < LIMIT; i++) attempt('recover');
    expect(attempt('recover')).toBe('locked');
    vi.advanceTimersByTime(WINDOW + 1000);
    expect(attempt('recover')).toBe('allowed');
  });

  it('documents the buggy pairing: mismatched consume window defeats the lockout', () => {
    // Same scenario as the paced test but consuming with the 60s default —
    // the counter resets every attempt and the lockout never fires. If this
    // expectation ever flips, the rate-limiter semantics changed; re-audit
    // every check/consume pair.
    for (let i = 0; i < LIMIT + 5; i++) {
      rateLimitCheck('mismatched', req(), LIMIT, WINDOW);
      rateLimitConsume('mismatched', req()); // default 60000ms window
      vi.advanceTimersByTime(61000);
    }
    // Still not locked after 15 attempts — this is exactly the vulnerability.
    expect(() => rateLimitCheck('mismatched', req(), LIMIT, WINDOW)).not.toThrow();
  });
});
