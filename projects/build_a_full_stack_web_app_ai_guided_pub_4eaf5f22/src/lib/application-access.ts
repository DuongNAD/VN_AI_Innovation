import { prisma } from '@/lib/db';
import { getProvider, type FormVersionDto } from '@/lib/data-provider';
import { AppError } from '@/lib/errors';
import { verifyToken } from '@/lib/auth';
import { getAuthUserFromRequest } from '@/lib/login-auth';
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
 * caller owns it — either by presenting the guided-intake X-Session-Token, or,
 * for an application created while logged in, by being that logged-in citizen
 * (login cookie whose user id matches Application.userId). The latter lets a
 * citizen reopen their own applications from "Hồ sơ của tôi" without the
 * tab-scoped session token. Every failure mode maps to the same 404 so
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

  // Path 1 — guided-intake session token. Only valid while the session is live.
  const token = req.headers.get('x-session-token');
  if (
    token &&
    application.session.expiresAt.getTime() >= Date.now() &&
    verifyToken(token, application.session.accessTokenHash)
  ) {
    return { application, session: application.session, pinned };
  }

  // Path 2 — the logged-in citizen who owns this application (login cookie).
  if (application.userId) {
    const user = await getAuthUserFromRequest(req);
    if (user && user.id === application.userId) {
      return { application, session: application.session, pinned };
    }
  }

  throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
}
