import { handleRoute, jsonOk } from '@/lib/errors';
import { getAuthUserFromRequest } from '@/lib/login-auth';

export const GET = handleRoute(async (req: Request) => {
  const user = await getAuthUserFromRequest(req);
  return jsonOk({
    authenticated: !!user,
    user,
  });
});
