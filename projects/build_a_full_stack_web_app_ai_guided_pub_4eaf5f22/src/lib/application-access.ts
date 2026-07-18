import { prisma } from '@/lib/db';
import { getProvider, type FormVersionDto } from '@/lib/data-provider';
import { AppError } from '@/lib/errors';
import { requireSessionToken } from '@/lib/auth';
import type { Application, Session } from '@prisma/client';

// Application statuses a citizen is allowed to keep editing / re-submit from.
export const EDITABLE_STATUSES = ['DRAFT', 'RETURNED'] as const;

export type LoadedApplication = {
  application: Application;
  session: Session;
  pinned: FormVersionDto;
};

/**
 * Loads an application together with its pinned form version and verifies the
 * caller's X-Session-Token owns it. Every failure mode maps to the same 404 so
 * outsiders cannot probe which application ids exist.
 */
export async function loadOwnedApplication(id: string, req: Request): Promise<LoadedApplication> {
  const application = await prisma.application.findUnique({
    where: { id },
    include: { session: true },
  });

  if (!application || !application.session) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  const provider = getProvider();
  const pinned = await provider.getFormVersionById(application.formVersionId);
  if (!pinned) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  if (application.session.expiresAt.getTime() < Date.now()) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  try {
    requireSessionToken(req, application.session.accessTokenHash);
  } catch (err) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  return { application, session: application.session, pinned };
}
