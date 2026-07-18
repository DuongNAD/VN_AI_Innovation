/**
 * Application role model and route prefixes.
 * - user: citizen self-service flow (public + session token)
 * - manager: staff console — xét duyệt hồ sơ công dân (APPROVE/RETURN),
 *            xem overview + change requests (không phê duyệt phiên bản biểu mẫu)
 * - admin: full staff console including approve/activate form versions + settings
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
 * - reviewApplications: manager + admin — day-to-day officer work (duyệt đơn)
 * - approveChangeRequests / manageSettings: admin only
 */
export const STAFF_PERMISSIONS = {
  viewOverview: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  viewChangeRequests: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  /** Xét duyệt hồ sơ công dân (APPROVE / RETURN). */
  reviewApplications: ['manager', 'admin'] as const satisfies readonly StaffRole[],
  /** Phê duyệt & kích hoạt phiên bản biểu mẫu (change request). */
  approveChangeRequests: ['admin'] as const satisfies readonly StaffRole[],
  manageSettings: ['admin'] as const satisfies readonly StaffRole[],
} as const;

export function roleHasPermission(
  role: StaffRole,
  permission: keyof typeof STAFF_PERMISSIONS
): boolean {
  return (STAFF_PERMISSIONS[permission] as readonly StaffRole[]).includes(role);
}

/** Manager + admin may approve/return citizen applications. */
export function canReviewApplications(role: StaffRole): boolean {
  return roleHasPermission(role, 'reviewApplications');
}

/** Only admin may approve form-version change requests. */
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
