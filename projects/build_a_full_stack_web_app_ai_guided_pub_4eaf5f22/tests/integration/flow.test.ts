import { describe, it, expect } from 'vitest';

// End-to-end integration against a live, seeded PostgreSQL database.
// It is skipped by default so `npx vitest run` is green on a machine without a
// database. To exercise it, bring the stack up and run:
//   docker compose up -d db && npm run db:push && npm run db:seed
//   npm run test:integration
const RUN = process.env.RUN_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!RUN)('integration · citizen flow (needs seeded DB)', () => {
  it('classifies a marriage intent to MARRIAGE_REGISTRATION', async () => {
    const { getProvider } = await import('@/lib/data-provider');
    const proc = await getProvider().getProcedure('MARRIAGE_REGISTRATION');
    expect(proc?.code).toBe('MARRIAGE_REGISTRATION');
  });

  it('serves form version 1.0 as active before any approval', async () => {
    const { getProvider } = await import('@/lib/data-provider');
    const active = await getProvider().getActiveFormVersion('MARRIAGE_REGISTRATION');
    expect(active?.version).toBe('1.0');
  });

  it('replays the same idempotent request and rejects messageId reuse with a new payload', async () => {
    const { prisma } = await import('@/lib/db');
    const { buildIdempotencyKey, withIdempotency } = await import('@/lib/idempotency');
    const principalId = `integration-${crypto.randomUUID()}`;
    const identity = {
      operation: 'integration-test',
      resourceId: 'resource-1',
      sessionId: principalId,
      messageId: 'message-1',
    };
    const firstDescriptor = buildIdempotencyKey({
      ...identity,
      body: { answer: 'A' },
    });
    let executions = 0;

    try {
      const first = await withIdempotency(principalId, firstDescriptor, async () => {
        executions++;
        return { status: 201, body: { result: 'created' } };
      });
      const replay = await withIdempotency(principalId, firstDescriptor, async () => {
        executions++;
        return { status: 201, body: { result: 'should-not-run' } };
      });

      expect(first.replayed).toBe(false);
      expect(replay).toMatchObject({
        status: 201,
        body: { result: 'created' },
        replayed: true,
      });
      expect(executions).toBe(1);

      const changedDescriptor = buildIdempotencyKey({
        ...identity,
        body: { answer: 'B' },
      });
      await expect(
        withIdempotency(principalId, changedDescriptor, async () => {
          executions++;
          return { status: 201, body: { result: 'must-not-run' } };
        })
      ).rejects.toMatchObject({
        status: 409,
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
      expect(executions).toBe(1);
    } finally {
      await prisma.idempotencyRecord.deleteMany({ where: { principalId } });
    }
  });

  it('returns the OpenAPI usage.services envelope from the admin overview', async () => {
    const { GET } = await import('@/app/api/v1/admin/overview/route');
    const response = await GET(
      new Request('http://localhost/api/v1/admin/overview', {
        headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN ?? '' },
      }),
      undefined as never
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.usage).toHaveProperty('services');
    expect(body.usage.services).toEqual(
      expect.objectContaining({
        llm: expect.any(Object),
        stt: expect.any(Object),
        tts: expect.any(Object),
      })
    );
  });

  it('refuses the admin credential on the citizen review queue (manager-only)', async () => {
    const { GET } = await import('@/app/api/v1/admin/applications/route');
    const response = await GET(
      new Request('http://localhost/api/v1/admin/applications', {
        headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN ?? '' },
      }),
      undefined as never
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('serves the account list to the admin credential', async () => {
    const { GET } = await import('@/app/api/v1/admin/users/route');
    const response = await GET(
      new Request('http://localhost/api/v1/admin/users', {
        headers: { 'X-Admin-Token': process.env.ADMIN_TOKEN ?? '' },
      }),
      undefined as never
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);
    expect(body.users[0]).not.toHaveProperty('passwordHash');
  });

  it('refuses public self-registration for staff portals', async () => {
    const { POST } = await import('@/app/api/v1/auth/register/route');
    const response = await POST(
      new Request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `intru${Date.now() % 100000}`,
          password: 'Password123',
          displayName: 'Intruder Test',
          portal: 'admin',
        }),
      }),
      undefined as never
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('STAFF_REGISTRATION_CLOSED');
  });

  it('builds guidance for a new session before conditional questions are answered', async () => {
    const { prisma } = await import('@/lib/db');
    const { generateAccessToken, hashToken } = await import('@/lib/auth');
    const { GET } = await import('@/app/api/v1/guided-intake/[sessionId]/guidance/route');
    const token = generateAccessToken();
    const session = await prisma.session.create({
      data: {
        accessTokenHash: hashToken(token),
        procedureCode: 'MARRIAGE_REGISTRATION',
        answersJson: {},
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    try {
      const response = await GET(
        new Request(`http://localhost/api/v1/guided-intake/${session.id}/guidance`, {
          headers: { 'X-Session-Token': token },
        }),
        { params: Promise.resolve({ sessionId: session.id }) }
      );
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store, private');
      const body = await response.json();
      expect(body.procedure.code).toBe('MARRIAGE_REGISTRATION');
      expect(Array.isArray(body.checklist)).toBe(true);
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
    }
  });

  it('returns exactly the three canonical validation errors', async () => {
    const { prisma } = await import('@/lib/db');
    const { generateAccessToken, hashToken } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/v1/forms/[formCode]/validate/route');
    const token = generateAccessToken();
    const session = await prisma.session.create({
      data: {
        accessTokenHash: hashToken(token),
        procedureCode: 'MARRIAGE_REGISTRATION',
        answersJson: {},
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    try {
      const response = await POST(
        new Request('http://localhost/api/v1/forms/MARRIAGE_REGISTRATION/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
          },
          body: JSON.stringify({
            formVersion: '1.0',
            data: {
              female_birth_date: '',
              male_identity_number: '123',
              previously_married: false,
              marriage_number: 2,
            },
          }),
        }),
        { params: Promise.resolve({ formCode: 'MARRIAGE_REGISTRATION' }) }
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.errors).toHaveLength(3);
      expect(body.errors.map((error: { code: string }) => error.code).sort()).toEqual([
        'CONFLICT',
        'INVALID_FORMAT',
        'MISSING_REQUIRED',
      ]);

      const activeVersion = await prisma.formVersion.findFirstOrThrow({
        where: { form: { code: 'MARRIAGE_REGISTRATION' }, version: '1.0' },
      });
      const application = await prisma.application.create({
        data: {
          sessionId: session.id,
          formVersionId: activeVersion.id,
          dataJson: {},
        },
      });
      const fullResponse = await POST(
        new Request('http://localhost/api/v1/forms/MARRIAGE_REGISTRATION/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
          },
          body: JSON.stringify({
            formVersion: '1.0',
            applicationId: application.id,
            data: {},
          }),
        }),
        { params: Promise.resolve({ formCode: 'MARRIAGE_REGISTRATION' }) }
      );
      expect(fullResponse.status).toBe(200);
      const fullBody = await fullResponse.json();
      expect(
        fullBody.errors.filter((error: { code: string }) => error.code === 'MISSING_REQUIRED')
      ).toHaveLength(9);
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
    }
  });

  it('rejects migration when the application is no longer a draft', async () => {
    const { prisma } = await import('@/lib/db');
    const { generateAccessToken, hashToken } = await import('@/lib/auth');
    const { POST } = await import('@/app/api/v1/applications/[id]/migrate/route');
    const formVersion = await prisma.formVersion.findFirstOrThrow({
      where: { form: { code: 'MARRIAGE_REGISTRATION' }, version: '1.0' },
    });
    const token = generateAccessToken();
    const session = await prisma.session.create({
      data: {
        accessTokenHash: hashToken(token),
        procedureCode: 'MARRIAGE_REGISTRATION',
        answersJson: {},
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const application = await prisma.application.create({
      data: {
        sessionId: session.id,
        formVersionId: formVersion.id,
        status: 'SUBMITTED',
        dataJson: {},
      },
    });

    try {
      const response = await POST(
        new Request(`http://localhost/api/v1/applications/${application.id}/migrate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
          },
          body: '{}',
        }),
        { params: Promise.resolve({ id: application.id }) }
      );
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe('APPLICATION_NOT_DRAFT');
    } finally {
      await prisma.session.delete({ where: { id: session.id } });
    }
  });
});

// A tiny always-on assertion keeps this file from being an empty suite when the
// integration block is skipped.
describe('integration · harness', () => {
  it('is wired and ready (set RUN_INTEGRATION=1 to exercise the DB flow)', () => {
    expect(typeof RUN).toBe('boolean');
  });

  it('rejects unauthenticated speech and validation before processing payloads', async () => {
    const [{ POST: synthesize }, { POST: validate }] = await Promise.all([
      import('@/app/api/v1/speech/synthesize/route'),
      import('@/app/api/v1/forms/[formCode]/validate/route'),
    ]);

    const speechResponse = await synthesize(
      new Request('http://localhost/api/v1/speech/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Xin chào' }),
      }),
      undefined as never
    );
    expect(speechResponse.status).toBe(401);
    expect(speechResponse.headers.get('cache-control')).toBe('no-store, private');

    const validationResponse = await validate(
      new Request('http://localhost/api/v1/forms/MARRIAGE_REGISTRATION/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formVersion: '1.0', data: {} }),
      }),
      { params: Promise.resolve({ formCode: 'MARRIAGE_REGISTRATION' }) }
    );
    expect(validationResponse.status).toBe(401);
  });
});
