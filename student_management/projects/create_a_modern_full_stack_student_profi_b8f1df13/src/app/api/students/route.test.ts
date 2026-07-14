/**
 * API route-handler contract tests for the students endpoints.
 *
 * These tests run under Vitest's default `node` environment and lock the full
 * status-code contract for BOTH the collection route (`GET`/`POST` from
 * '@/app/api/students/route') and the item route (`PATCH`/`DELETE` from
 * '@/app/api/students/[id]/route') WITHOUT a real database. The Prisma client
 * is replaced with a mock (`vi.mock('@/lib/prisma')`) whose per-method
 * behavior each test controls, so the 200/201/400/409/404/204 guarantees are
 * automated and cannot regress.
 *
 * The status contract asserted here is the authoritative one defined in the
 * route specs:
 *   - GET    200
 *   - POST   201 valid, 400 invalid fields, 400 invalid JSON,
 *            409 duplicate studentId, 500 other
 *   - PATCH  200 valid, 400 invalid fields/JSON, 404 non-numeric id or missing
 *            record, 409 duplicate studentId
 *   - DELETE 204 valid, 404 non-numeric id or missing record
 *
 * SCOPE NOTE (re: access control): per the project design (design.md), this
 * system deliberately introduces NO authentication or authorization — it is a
 * local, single-user school dashboard over a SQLite file, and access control is
 * expected to be enforced by the deployment / reverse-proxy layer rather than
 * by the handlers. These tests therefore lock only the status-code contract the
 * handlers themselves own; they intentionally do not assert 401/403 semantics,
 * which are out of scope for this codebase.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Replace the shared Prisma client with a fully mocked one BEFORE the route
// handlers (which import it) are loaded. Only the methods the handlers use are
// stubbed; each test drives their resolved/rejected values.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';
import { GET, POST } from '@/app/api/students/route';
import { PATCH, DELETE } from '@/app/api/students/[id]/route';

// Narrow, test-only view of the mocked methods so `.mockResolvedValue` etc. and
// call-argument assertions type-check.
const findMany = prisma.student.findMany as unknown as ReturnType<typeof vi.fn>;
const create = prisma.student.create as unknown as ReturnType<typeof vi.fn>;
const update = prisma.student.update as unknown as ReturnType<typeof vi.fn>;
const del = prisma.student.delete as unknown as ReturnType<typeof vi.fn>;

// The duplicate-studentId message the routes return for a P2002 violation.
const DUPLICATE_MESSAGE = 'A student with this Student ID already exists';

/**
 * A canonical valid request payload. GPA is a string (as the form submits it);
 * the route normalizes it to the numeric 3.5 via parseGpa. The text fields are
 * already trimmed here so the "trimmed fields" assertion is meaningful.
 */
const VALID = {
  studentId: 'S1',
  fullName: 'Ada',
  email: 'a@b.co',
  major: 'CS',
  gpa: '3.5',
} as const;

/**
 * Build a Request with a JSON body. When `body` is a string it is sent
 * verbatim (used to exercise the malformed-JSON branch); otherwise it is
 * serialized with JSON.stringify.
 */
function makeRequest(method: string, body: unknown): Request {
  return new Request('http://localhost/api/students', {
    method,
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Params helper matching the `[id]` route signature. */
function params(id: string): { params: { id: string } } {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/students', () => {
  it('returns 200 with the list from findMany', async () => {
    const rows = [
      { id: 1, studentId: 'S1', fullName: 'Ada' },
      { id: 2, studentId: 'S2', fullName: 'Grace' },
    ];
    findMany.mockResolvedValue(rows);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
  });
});

describe('POST /api/students', () => {
  it('returns 201 with the created student and calls create with trimmed fields and numeric gpa', async () => {
    const created = { id: 1, ...VALID, gpa: 3.5 };
    create.mockResolvedValue(created);

    const response = await POST(makeRequest('POST', VALID));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(create).toHaveBeenCalledWith({
      data: {
        studentId: 'S1',
        fullName: 'Ada',
        email: 'a@b.co',
        major: 'CS',
        gpa: 3.5,
      },
    });
  });

  it('returns 400 with field errors for invalid fields and does not call create', async () => {
    const response = await POST(
      makeRequest('POST', { ...VALID, studentId: '', email: 'nope' }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors).toHaveProperty('studentId');
    expect(body.errors).toHaveProperty('email');
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 400 { error: "Invalid JSON" } for a malformed body', async () => {
    const response = await POST(makeRequest('POST', '{not json'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON' });
    expect(create).not.toHaveBeenCalled();
  });

  it('returns 409 with a studentId error when create hits a P2002 unique violation', async () => {
    create.mockRejectedValue({ code: 'P2002' });

    const response = await POST(makeRequest('POST', VALID));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.errors.studentId).toBe(DUPLICATE_MESSAGE);
  });

  it('returns 500 for a non-P2002 Prisma error', async () => {
    create.mockRejectedValue({ code: 'PXXXX' });

    const response = await POST(makeRequest('POST', VALID));

    expect(response.status).toBe(500);
  });

  it('returns 500 for a generic error', async () => {
    create.mockRejectedValue(new Error('boom'));

    const response = await POST(makeRequest('POST', VALID));

    expect(response.status).toBe(500);
  });
});

describe('PATCH /api/students/[id]', () => {
  it('returns 200 for a valid update', async () => {
    const updated = { id: 1, ...VALID, gpa: 3.5 };
    update.mockResolvedValue(updated);

    const response = await PATCH(makeRequest('PATCH', VALID), params('1'));

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
  });

  // '0x1', '1e1', and '1.0' specifically prove the /^\d+$/ guard closes the
  // Number() coercion hole (each would coerce to a positive number without it).
  const invalidIds = ['abc', '0', '-1', '0x1', '1e1', '1.0'];
  for (const id of invalidIds) {
    it(`returns 404 for non-numeric/invalid id "${id}" and does not call update`, async () => {
      const response = await PATCH(makeRequest('PATCH', VALID), params(id));

      expect(response.status).toBe(404);
      expect(update).not.toHaveBeenCalled();
    });
  }

  it('returns 400 with errors for a valid id but invalid fields', async () => {
    const response = await PATCH(
      makeRequest('PATCH', { ...VALID, email: 'nope' }),
      params('1'),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors).toHaveProperty('email');
    expect(update).not.toHaveBeenCalled();
  });

  it('returns 404 { error: "Not found" } when the record is missing (P2025)', async () => {
    update.mockRejectedValue({ code: 'P2025' });

    const response = await PATCH(makeRequest('PATCH', VALID), params('1'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found' });
  });

  it('returns 409 with a studentId error on a P2002 duplicate', async () => {
    update.mockRejectedValue({ code: 'P2002' });

    const response = await PATCH(makeRequest('PATCH', VALID), params('1'));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.errors.studentId).toBe(DUPLICATE_MESSAGE);
  });
});

describe('DELETE /api/students/[id]', () => {
  it('returns 204 with a null body for a valid delete', async () => {
    del.mockResolvedValue({ id: 1 });

    const response = await DELETE(makeRequest('DELETE', {}), params('1'));

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when the record is missing (P2025)', async () => {
    del.mockRejectedValue({ code: 'P2025' });

    const response = await DELETE(makeRequest('DELETE', {}), params('1'));

    expect(response.status).toBe(404);
  });

  it('returns 404 for invalid ids and does not call delete', async () => {
    for (const id of ['abc', '0x1']) {
      const response = await DELETE(makeRequest('DELETE', {}), params(id));
      expect(response.status).toBe(404);
    }
    expect(del).not.toHaveBeenCalled();
  });
});