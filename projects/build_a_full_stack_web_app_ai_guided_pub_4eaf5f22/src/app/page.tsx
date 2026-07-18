import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/roles';

/**
 * Root page — redirect straight to the citizen portal.
 * Staff portals (/manager, /admin) are only reachable via direct URL.
 */
export default function RootPage() {
  redirect(ROUTES.user.home);
}
