/**
 * Student field validation — the single source of truth shared by the client
 * form and the API route handlers, so client-side and server-side rules can
 * never drift apart.
 *
 * Every validator returns `null` when the value is valid, or a stable English
 * error message when it is not. The messages are asserted verbatim in
 * validation.test.ts, so they must remain exact. No function throws for ANY
 * runtime input — totality at the trust boundary is a core contract.
 *
 * String semantics (per the project-wide decision): all length caps use the
 * JavaScript String.length (UTF-16 code units, ASCII-pragmatic — this is NOT a
 * grapheme-cluster or full-Unicode guarantee), and strings are trimmed before
 * being checked. Text fields additionally reject ASCII control characters
 * (C0, U+0000..U+001F) and DEL (U+007F) to prevent log injection / data
 * corruption at downstream sinks.
 */

/**
 * The raw shape of a student as it arrives from a form or request body.
 *
 * `gpa` is typed `unknown` on purpose: it is a runtime trust boundary. The API
 * routes forward raw parsed JSON, so `gpa` can actually be `null`, `undefined`,
 * a boolean, an array, or an object — TypeScript's compile-time types are
 * erased at runtime and give no guarantee here. {@link parseGpa} and
 * {@link validateGpa} accept `unknown` and stay total for every value.
 */
export type StudentInput = {
  studentId: string;
  fullName: string;
  email: string;
  major: string;
  gpa: unknown;
};

/** The name of any validated student field. */
export type FieldName = keyof StudentInput;

/**
 * A map from field name to error message. A field is present only when it
 * failed validation; an empty map means the whole input is valid.
 */
export type FieldErrors = Partial<Record<FieldName, string>>;

/** Maximum lengths (String.length) for the free-form text fields. */
const STUDENT_ID_MAX = 32;
const FULL_NAME_MAX = 100;
const MAJOR_MAX = 80;

/**
 * Pragmatic, HTML5-style email pattern (ASCII-pragmatic, NOT full RFC 5322):
 * a run of non-space/non-@ characters, an `@`, a domain, a dot, and a TLD.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A plain decimal numeral: an optional leading minus, one or more digits, and
 * an optional fractional part. This deliberately rejects alternate numeric
 * encodings and coercion tricks such as '0x3', '0b11', '1e0', and 'abc', as
 * well as strings with internal junk like ' 3 ' (once trimmed, an internal
 * space would still fail — but there is none here; interior junk fails).
 */
const PLAIN_DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * Matches any ASCII control character: the C0 controls (U+0000..U+001F, which
 * include NUL, TAB, LF, and CR) and DEL (U+007F). Defined ONCE at module scope
 * and deliberately WITHOUT the /g flag — a global-flagged regex advances its
 * `lastIndex` across `.test()` calls and would yield alternating results, a
 * stateful bug. A single non-global `.test()` is stateless and correct.
 */
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

/** GPA is constrained to the closed interval [0.0, 4.0]. */
const GPA_MIN = 0;
const GPA_MAX = 4;

/**
 * A fixed list of common majors used to populate the form's <datalist>. Major
 * is a free-text field, so this list is only a convenience, not an enum.
 */
export const COMMON_MAJORS: string[] = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Biology',
  'Business Administration',
  'Economics',
  'Psychology',
  'Mechanical Engineering',
  'Electrical Engineering',
  'English Literature',
];

/**
 * Return true when the value contains any ASCII control character (C0) or DEL.
 * Applied to the already-trimmed value, so leading/trailing whitespace-controls
 * (tab/newline) that trimming removes are silently stripped and accepted, while
 * interior controls and non-whitespace controls (NUL/DEL) anywhere are caught.
 */
function hasControlChars(value: string): boolean {
  return CONTROL_CHAR_PATTERN.test(value);
}

/**
 * Validate the Student ID. Required, must contain no control characters, and is
 * capped at {@link STUDENT_ID_MAX} characters (String.length) after trimming.
 */
export function validateStudentId(v: string): string | null {
  const value = v.trim();
  if (value.length === 0) {
    return 'Student ID is required';
  }
  if (hasControlChars(value)) {
    return 'Student ID contains invalid characters';
  }
  if (value.length > STUDENT_ID_MAX) {
    return 'Student ID must be 32 characters or fewer';
  }
  return null;
}

/**
 * Validate the full name. Required, must contain no control characters, and is
 * capped at {@link FULL_NAME_MAX} characters (String.length) after trimming.
 */
export function validateFullName(v: string): string | null {
  const value = v.trim();
  if (value.length === 0) {
    return 'Full name is required';
  }
  if (hasControlChars(value)) {
    return 'Full name contains invalid characters';
  }
  if (value.length > FULL_NAME_MAX) {
    return 'Full name must be 100 characters or fewer';
  }
  return null;
}

/**
 * Validate the email address. Required and must match the pragmatic
 * {@link EMAIL_PATTERN} after trimming. The control-character check is
 * required because non-whitespace controls (NUL, DEL) satisfy the pattern's
 * `[^\s@]` class and would otherwise pass as a valid email.
 */
export function validateEmail(v: string): string | null {
  const value = v.trim();
  if (value.length === 0) {
    return 'Email is required';
  }
  if (hasControlChars(value) || !EMAIL_PATTERN.test(value)) {
    return 'Enter a valid email address';
  }
  return null;
}

/**
 * Validate the major. Required, must contain no control characters, and is
 * capped at {@link MAJOR_MAX} characters (String.length) after trimming.
 */
export function validateMajor(v: string): string | null {
  const value = v.trim();
  if (value.length === 0) {
    return 'Major is required';
  }
  if (hasControlChars(value)) {
    return 'Major contains invalid characters';
  }
  if (value.length > MAJOR_MAX) {
    return 'Major must be 80 characters or fewer';
  }
  return null;
}

/**
 * Parse a GPA value into a finite number, or `null` when it cannot be
 * interpreted as one. Total for EVERY runtime value — never throws.
 *
 * The typeof branch is taken BEFORE any `.trim()` or `Number()` call:
 * - Number argument: used directly, then rejected (null) if not finite, which
 *   catches NaN and ±Infinity.
 * - String argument: trimmed; empty/whitespace yields null; any string that is
 *   not a plain decimal numeral (per {@link PLAIN_DECIMAL_PATTERN}) yields null
 *   BEFORE coercion, deliberately rejecting '0x3', '0b11', '1e0', 'abc', etc.;
 *   otherwise it is coerced with Number() and passed through the finiteness
 *   guard.
 * - Any other type (null, undefined, boolean, object, array, symbol, bigint,
 *   function): returns null immediately. This keeps non-strings away from
 *   `.trim()` (removing the TypeError) and keeps arrays/objects away from
 *   `Number()` (preventing coercions such as [] -> 0 and [3.5] -> 3.5).
 */
export function parseGpa(v: unknown): number | null {
  let n: number;

  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed.length === 0) {
      return null;
    }
    if (!PLAIN_DECIMAL_PATTERN.test(trimmed)) {
      return null;
    }
    n = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

/**
 * Validate the GPA, distinguishing three failure modes with distinct messages
 * so a user who typed a number is never told they "didn't type a number":
 * - empty input -> required message;
 * - non-empty but unparsable input (e.g. '1e0', '0x3', 'abc') -> format message;
 * - a valid number outside [0.0, 4.0] -> range message.
 *
 * Total for EVERY runtime value — never throws. Each required-detection branch
 * is typeof-guarded, so hostile types (null/undefined/boolean/array/object)
 * skip both branches, get `parseGpa(v) === null`, and return the format
 * message rather than being mislabeled empty.
 */
export function validateGpa(v: unknown): string | null {
  // Detect the "empty" case first, independent of parsing, so an empty field
  // is reported as required rather than as a bad format.
  if (typeof v === 'string') {
    if (v.trim().length === 0) {
      return 'GPA is required';
    }
  } else if (typeof v === 'number' && Number.isNaN(v)) {
    return 'GPA is required';
  }

  const n = parseGpa(v);
  if (n === null) {
    // Non-empty input that is not a plain decimal numeral (including any
    // non-string/non-number type).
    return 'GPA must be a plain decimal number (e.g. 3.75)';
  }
  if (n < GPA_MIN || n > GPA_MAX) {
    return 'GPA must be between 0.0 and 4.0';
  }
  return null;
}

/**
 * Validate a full student input, returning a {@link FieldErrors} map that
 * contains only the fields whose validator produced a message. An empty map
 * means the input is valid. Total — never throws, even when `input.gpa` is a
 * hostile runtime value, because {@link validateGpa} accepts `unknown`.
 */
export function validateStudent(input: StudentInput): FieldErrors {
  const errors: FieldErrors = {};

  const studentId = validateStudentId(input.studentId);
  if (studentId !== null) {
    errors.studentId = studentId;
  }

  const fullName = validateFullName(input.fullName);
  if (fullName !== null) {
    errors.fullName = fullName;
  }

  const email = validateEmail(input.email);
  if (email !== null) {
    errors.email = email;
  }

  const major = validateMajor(input.major);
  if (major !== null) {
    errors.major = major;
  }

  const gpa = validateGpa(input.gpa);
  if (gpa !== null) {
    errors.gpa = gpa;
  }

  return errors;
}