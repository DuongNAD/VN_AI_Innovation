/**
 * Application role model and route prefixes.
 * - user: citizen self-service flow (public + session token)
 * - manager: business domain — citizen queue (review/approve/return
 *   applications) AND forms/documents (approve & activate form versions)
 * - admin: accounts + technical config (settings, monitoring) — does NOT
 *   review citizen applications, does NOT approve form versions
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

/**
 * Staff permission matrix (enforced on API; UI only mirrors it).
 *
 * From main (v1): manager owns citizen queue + form versions;
 * admin owns accounts + settings. Document-type classification
 * is an orthogonal feature used by the manager queue UI.
 */
export const STAFF_PERMISSIONS = {
  viewOverview: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  viewChangeRequests: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  /** Forms & documents are the manager's domain. */
  approveChangeRequests: ['manager'] as const satisfies readonly StaffRole[],
  /** Citizen queue is the manager's job. */
  reviewCitizenApplications: ['manager'] as const satisfies readonly StaffRole[],
  /** Alias used by UI helpers (same as reviewCitizenApplications). */
  reviewApplications: ['manager'] as const satisfies readonly StaffRole[],
  manageAccounts: ['admin'] as const satisfies readonly StaffRole[],
  manageSettings: ['admin'] as const satisfies readonly StaffRole[],
} as const;

export function roleHasPermission(
  role: StaffRole,
  permission: keyof typeof STAFF_PERMISSIONS
): boolean {
  return (STAFF_PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

/** Manager may approve/return citizen applications. */
export function canReviewApplications(role: StaffRole): boolean {
  return roleHasPermission(role, 'reviewApplications');
}

/** Manager may approve form-version change requests. */
export function canApproveChangeRequests(role: StaffRole): boolean {
  return roleHasPermission(role, 'approveChangeRequests');
}

/**
 * @deprecated Prefer canApproveChangeRequests — name was ambiguous with
 * citizen-application review. Kept so older call sites keep compiling.
 */
export function canApprove(role: StaffRole): boolean {
  return canApproveChangeRequests(role);
}
