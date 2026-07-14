/**
 * Collection API endpoints for students.
 *
 * - GET  /api/students  -> list all students, newest first.
 * - POST /api/students  -> validate and create a new student.
 *
 * Validation is delegated to the shared `validateStudent` helper so the API
 * and the client form enforce identical rules. The authoritative status
 * contract for this route is:
 *   - GET  200
 *   - POST 201 (valid), 400 (invalid fields / invalid JSON),
 *          403 (non-loopback host or cross-origin Origin),
 *          413 (body larger than MAX_BODY_BYTES),
 *          415 (missing / non-JSON Content-Type),
 *          409 (duplicate studentId), 500 (any other error)
 *
 * SECURITY (write hardening): this is a local, single-user school dashboard
 * over a SQLite file with NO authentication, authorization, or pagination by
 * design. The WRITE endpoint is nonetheless guarded against CSRF and
 * DNS-rebinding: `guardWrite` enforces a loopback request host, a same-origin
 * (or entirely absent) Origin header, and — for a bodied write — a JSON
 * Content-Type, returning its own 403/415 response verbatim when any check
 * fails. Only after the guard passes is the body consumed, and it is read
 * through `readLimitedJson`, which caps the payload at MAX_BODY_BYTES
 * (reporting an over-limit outcome regardless of any declared Content-Length)
 * so an oversized body can never exhaust memory. GET is a read and is
 * intentionally NOT guarded; its lack of auth/pagination is accepted for the
 * loopback-bound deployment.
 */
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { guardWrite } from '@/lib/http';
import { readLimitedJson } from '@/lib/http';
import {
  parseGpa,
  validateStudent,
  type StudentInput,
} from '@/lib/validation';

// Never cache these handlers: student data is mutable and must always reflect
// the current database state.
export const dynamic = 'force-dynamic';

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
 * List all students, ordered by creation time (newest first).
 */
export async function GET(): Promise<NextResponse> {
  const students = await prisma.student.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(students, { status: 200 });
}

/**
 * Create a new student from the JSON request body.
 *
 * The write guard runs FIRST (before the body is touched): a non-loopback
 * host, a cross-origin Origin, or a non-JSON Content-Type is rejected with the
 * guard's own response. The body is then read through the size-capped reader:
 * an over-limit body yields 413 and a malformed/empty body yields 400. Valid
 * input is validated with the shared field validators; on any validation
 * failure the field-error map is returned with status 400. A unique-constraint
 * violation on `studentId` (Prisma error code P2002) maps to 409.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Write guard first — CSRF/DNS-rebinding protection. Reject non-loopback
  // hosts, cross-origin requests, and non-JSON content types before reading
  // (or even touching) the request body. Its response is returned verbatim.
  const blocked = guardWrite(request, { requireJsonBody: true });
  if (blocked) {
    return blocked;
  }

  // Read the body through the size-capped, streaming JSON reader. An oversized
  // payload is rejected before it can be buffered; a malformed or empty body
  // is a client error.
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
  // is passed through as-is when it is a string or number so parseGpa can
  // normalize it; anything else defaults to '' for a "required" message.
  const rawGpa = body.gpa;
  const input: StudentInput = {
    studentId: readString(body, 'studentId'),
    fullName: readString(body, 'fullName'),
    email: readString(body, 'email'),
    major: readString(body, 'major'),
    gpa: typeof rawGpa === 'string' || typeof rawGpa === 'number' ? rawGpa : '',
  };

  const errors = validateStudent(input);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  try {
    // Validation guarantees parseGpa returns a finite number here.
    const student = await prisma.student.create({
      data: {
        studentId: input.studentId.trim(),
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        major: input.major.trim(),
        gpa: parseGpa(input.gpa) as number,
      },
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    // Prisma reports a unique-constraint violation with code P2002; here that
    // can only be the studentId @unique constraint.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    ) {
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