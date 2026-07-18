import { handleRoute, jsonOk } from '@/lib/errors';
import {
  buildClearLoginCookie,
  getLoginTokenFromRequest,
  revokeLoginSessionByToken,
} from '@/lib/login-auth';

export const POST = handleRoute(async (req: Request) => {
  const token = getLoginTokenFromRequest(req);
  await revokeLoginSessionByToken(token);
  return jsonOk(
    { ok: true },
    {
      headers: {
        'Set-Cookie': buildClearLoginCookie(),
      },
    }
  );
});
