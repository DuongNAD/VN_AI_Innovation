/**
 * Item API endpoints for a single student, addressed by internal numeric id.
 *
 * - PATCH  /api/students/[id]  -> validate and update the student.
 * - DELETE /api/students/[id]  -> delete the student.
 *
 * The `[id]` path param is the Student model's autoincrement primary key.
 * Validation is delegated to the shared `validateStudent` helper so the API
 * and the client form enforce identical rules. The authoritative status
 * contract for this route is:
 *   - PATCH  200 (valid), 400 (invalid fields), 400 (invalid JSON),
 *            404 (non-numeric id or missing record), 409 (duplicate studentId),
 *            413 (oversized body), 415/403 (write guard), 500 (any other error)
 *   - DELETE 204, 404 (non-numeric id or missing record), 403 (write guard),
 *            500 (any other error)
 *
 * NOTE ON SCOPE: per the project design (design.md), this system deliberately
 * introduces NO authentication or authorization — it is a local, single-user
 * school dashboard over a SQLite file. Write requests (PATCH/DELETE) are
 * nonetheless guarded against CSRF / DNS-rebinding (origin + loopback-host
 * check, plus a Content-Type requirement for bodied writes) and request bodies
 * are read incrementally with a hard size cap, sharing the exact `guardWrite`
 * and `readLimitedJson` helpers the sibling collection route uses so both
 * routes behave identically. A non-existent or non-positive id is reported as a
 * non-enumerating 404 ("Not found") rather than leaking whether a given id maps
 * to a real record.
 */
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { guardWrite, readLimitedJson } from '@/lib/http';
import {
  parseGpa,
  validateStudent,
  type StudentInput,
} from '@/lib/validation';

// Never cache these handlers: student data is mutable and must always reflect
// the current database state.
export const dynamic = 'force-dynamic';

/**
 * A strict decimal-numeral pattern for the id path segment. Requiring the raw
 * string to be all digits closes the same coercion holes that parseGpa guards
 * against at the numeric boundary: '0x1', '1e1', '1.0', 'abc', '', and '-1'
 * all fail this test and are treated as "not found" rather than being silently
 * coerced by Number().
 */
const NUMERIC_ID_PATTERN = /^\d+$/;

/**
 * Upper bound on the number of digits accepted for an id. Autoincrement ids
 * are ordinary integers, so any string long enough to overflow the safe
 * integer range is rejected before it can reach Number()/Prisma and produce an
 * imprecise or Infinity value. 15 digits stays comfortably within
 * Number.MAX_SAFE_INTEGER (~9.0e15).
 */
const MAX_ID_DIGITS = 15;

/** A 404 "Not found" response, reused for both bad ids and missing records. */
function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

/**
 * Parse and validate the `[id]` path param.
 *
 * Returns the positive numeric id, or `null` when the raw string is not a
 * plain non-negative decimal numeral, is too long to be a safe integer, or
 * resolves to a non-positive value (guarding against '0'). Autoincrement ids
 * start at 1, so `id <= 0` can never name a real record. Requiring a finite
 * safe integer prevents an overlong digit string from reaching Prisma as
 * Infinity or an imprecise value.
 */
function parseId(raw: string): number | null {
  if (!NUMERIC_ID_PATTERN.test(raw)) {
    return null;
  }
  if (raw.length > MAX_ID_DIGITS) {
    return null;
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * Narrow an unknown caught value to a Prisma-style error carrying the given
 * `code` (e.g. 'P2025' for a missing record, 'P2002' for a unique violation).
 */
function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

/**
 * Read a string field from an arbitrary record, defaulting to '' when the
 * value is missing or not a string. Coercing to '' lets the validators emit
 * the appropriate "required" message instead of throwing on undefined.
 */
function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Update an existing student from the JSON request body.
 *
 * The write guard runs first (before the id is parsed and before any body is
 * read), so a cross-origin, non-loopback, or non-JSON PATCH is rejected up
 * front and never enumerates ids or reaches Prisma. A non-numeric or
 * non-positive id then yields 404 before the body is read. The body is read
 * with a hard size cap (413 when oversized) and rejected with 400 on malformed
 * JSON. It is validated with the shared field validators; on any validation
 * failure the field-error map is returned with status 400. A missing record
 * (Prisma P2025) maps to 404 and a unique-constraint violation on `studentId`
 * (Prisma P2002) maps to 409.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  // Write guard first: reject cross-origin / non-loopback / non-JSON writes
  // before touching the id or reading the body. A truthy return is the
  // guard's own (403/415) Response.
  const blocked = guardWrite(request, { requireJsonBody: true });
  if (blocked) {
    return blocked;
  }

  const id = parseId(params.id);
  if (id === null) {
    return notFound();
  }

  // Read the body incrementally with a hard size cap so an oversized payload
  // cannot exhaust memory. The reader returns a discriminated result: an
  // oversized body is a 413 (distinct from a 400 malformed-JSON body).
  const parsed = await readLimitedJson(request);
  if (parsed.kind === 'too_large') {
    return NextResponse.json(
      { error: 'Request body too large' },
      { status: 413 },
    );
  }
  if (parsed.kind === 'invalid') {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Valid JSON that is not a plain object (e.g. `null`, an array, a string, or
  // a number) has no student fields. Rather than accessing properties on such
  // a value — which would throw for `null` — treat it as an empty record so
  // the validators produce the standard "required" messages and the request
  // is rejected with a 400 field-error response below.
  const body: Record<string, unknown> =
    typeof parsed.data === 'object' &&
    parsed.data !== null &&
    !Array.isArray(parsed.data)
      ? (parsed.data as Record<string, unknown>)
      : {};

  // Coerce every text field to a string (defaulting missing values to ''). GPA
  // is forwarded RAW (its original JSON type) so validateStudent can reject a
  // non-string GPA before parseGpa is ever called — matching the collection
  // route's input builder.
  const input: StudentInput = {
    studentId: readString(body, 'studentId'),
    fullName: readString(body, 'fullName'),
    email: readString(body, 'email'),
    major: readString(body, 'major'),
    gpa: body.gpa,
  };

  const errors = validateStudent(input);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    // Validation guarantees parseGpa returns a finite number here.
    const student = await prisma.student.update({
      where: { id },
      data: {
        studentId: input.studentId.trim(),
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        major: input.major.trim(),
        gpa: parseGpa(input.gpa) as number,
      },
    });

    return NextResponse.json(student, { status: 200 });
  } catch (error) {
    // The record named by the id no longer exists.
    if (hasErrorCode(error, 'P2025')) {
      return notFound();
    }
    // A unique-constraint violation: here that can only be the studentId
    // @unique constraint colliding with another student.
    if (hasErrorCode(error, 'P2002')) {
      return NextResponse.json(
        {
          errors: {
            studentId: 'A student with this Student ID already exists',
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Delete a student by id.
 *
 * The write guard runs first (before the id is parsed), so a cross-origin or
 * non-loopback DELETE is rejected up front and never reaches Prisma. A
 * non-numeric or non-positive id then yields 404 before any work is done. A
 * missing record (Prisma P2025) also maps to 404; a successful delete returns
 * an empty 204 response.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  // Write guard first: DELETE carries no body, so no Content-Type is required,
  // but the origin / loopback-host check still applies. A truthy return is the
  // guard's own (403) Response.
  const blocked = guardWrite(request, { requireJsonBody: false });
  if (blocked) {
    return blocked;
  }

  const id = parseId(params.id);
  if (id === null) {
    return notFound();
  }

  try {
    await prisma.student.delete({ where: { id } });
    return new Response(null, { status: 204 });
  } catch (error) {
    // The record named by the id no longer exists.
    if (hasErrorCode(error, 'P2025')) {
      return notFound();
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}