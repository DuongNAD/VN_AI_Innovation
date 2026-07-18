import { describe, it, expect } from 'vitest';
import { compareVersions, selectActiveVersion, activateVersion } from '@/lib/form-migration';
import type { VersionLike } from '@/lib/form-migration';

function v(version: string, status: string, from: string | null, to: string | null): VersionLike {
  return {
    id: `id_${version}`,
    version,
    status,
    effectiveFrom: from ? new Date(from) : null,
    effectiveTo: to ? new Date(to) : null,
  };
}

describe('form-migration · compareVersions', () => {
  it('orders semantic version strings numerically', () => {
    expect(compareVersions('2.0', '1.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0', '2.0')).toBeLessThan(0);
    expect(compareVersions('1.0', '1.0')).toBe(0);
    expect(compareVersions('1.10', '1.9')).toBeGreaterThan(0);
  });
});

describe('form-migration · selectActiveVersion', () => {
  const v1 = v('1.0', 'ACTIVE', '2025-01-01', '2026-08-01');
  const v2 = v('2.0', 'ACTIVE', '2026-08-01', null);
  const draft = v('3.0', 'DRAFT', null, null);
  const all = [v1, v2, draft];

  it('selects the version effective at the given instant', () => {
    expect(selectActiveVersion(all, new Date('2025-06-01'))?.version).toBe('1.0');
    expect(selectActiveVersion(all, new Date('2026-09-01'))?.version).toBe('2.0');
  });

  it('never selects a DRAFT version', () => {
    const onlyDraft = [v('1.0', 'DRAFT', '2000-01-01', null)];
    expect(selectActiveVersion(onlyDraft, new Date('2026-01-01'))).toBeNull();
  });

  it('rejects unknown status values even when their dates look active', () => {
    const malformed = [v('9.0', 'PUBLISHED', '2000-01-01', null)];
    expect(selectActiveVersion(malformed, new Date('2026-01-01'))).toBeNull();
  });

  it('returns null before any version is effective', () => {
    expect(selectActiveVersion(all, new Date('2000-01-01'))).toBeNull();
  });
});

describe('form-migration · activateVersion', () => {
  const now = new Date('2026-08-01T00:00:00Z');

  it('activates a DRAFT and closes the current ACTIVE version', () => {
    const versions = [
      v('1.0', 'ACTIVE', '2025-01-01', null),
      v('2.0', 'DRAFT', null, null),
    ];
    const { target, closed, changed } = activateVersion(versions, '2.0', now);

    expect(target.version).toBe('2.0');
    expect(target.status).toBe('ACTIVE');
    expect(target.effectiveFrom?.getTime()).toBe(now.getTime());

    expect(closed?.version).toBe('1.0');
    expect(closed?.effectiveTo?.getTime()).toBe(now.getTime());

    // After the change set is applied there is exactly one ACTIVE version.
    const activeCount = changed.filter((c) => c.status === 'ACTIVE').length;
    expect(activeCount).toBe(1);
  });

  it('activates the first version when none is active yet', () => {
    const versions = [v('1.0', 'DRAFT', null, null)];
    const { target, closed } = activateVersion(versions, '1.0', now);
    expect(target.status).toBe('ACTIVE');
    expect(closed).toBeNull();
  });

  it('rejects activating a non-DRAFT target', () => {
    const versions = [v('1.0', 'ACTIVE', '2025-01-01', null)];
    expect(() => activateVersion(versions, '1.0', now)).toThrow();
  });

  it('rejects a target that is not newer than the current active', () => {
    const versions = [
      v('2.0', 'ACTIVE', '2025-01-01', null),
      v('1.0', 'DRAFT', null, null),
    ];
    expect(() => activateVersion(versions, '1.0', now)).toThrow();
  });

  it('rejects an unknown target version', () => {
    const versions = [v('1.0', 'ACTIVE', '2025-01-01', null)];
    expect(() => activateVersion(versions, '9.9', now)).toThrow();
  });
});
