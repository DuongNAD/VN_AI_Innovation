/**
 * Application role model and route prefixes.
 * - user: citizen self-service flow (public + session token)
 * - manager: works the citizen queue (review/approve/return applications)
 * - admin: accounts + technical config (form-version approval, settings) —
 *   does NOT review citizen applications
 */

export type AppRole = 'user' | 'manager' | 'admin';

export type StaffRole = 'manager' | 'admin';

export const ROLE_RANK: Record<StaffRole, number> = {
  manager: 1,
  admin: 2,
};

export function staffSatisfies(actual: StaffRole, minRole: StaffRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[minRole];
}

/** Canonical route prefixes for each portal. */
export const ROUTES = {
  portal: '/',
  user: {
    home: '/user',
    procedures: '/user/procedures',
    chat: '/user/chat',
    checklist: '/user/checklist',
    form: (applicationId: string) => `/user/form/${encodeURIComponent(applicationId)}`,
    result: '/user/result',
  },
  manager: {
    home: '/manager',
  },
  admin: {
    home: '/admin',
  },
  sources: '/sources',
  widgetDemo: '/widget-demo',
  architecture: '/architecture',
} as const;

/** Staff permission matrix (enforced on API; UI only mirrors it). */
export const STAFF_PERMISSIONS = {
  viewOverview: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  viewChangeRequests: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  approveChangeRequests: ['admin'] as const satisfies readonly StaffRole[],
  /** Citizen queue is the manager's job — admins run accounts & technical config only. */
  reviewCitizenApplications: ['manager'] as const satisfies readonly StaffRole[],
  manageAccounts: ['admin'] as const satisfies readonly StaffRole[],
} as const;

export function canApprove(role: StaffRole): boolean {
  return role === 'admin';
}
