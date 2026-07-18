import { describe, expect, it } from 'vitest';
import {
  canApprove,
  canApproveChangeRequests,
  canReviewApplications,
  roleHasPermission,
  staffSatisfies,
} from '@/lib/roles';

describe('staff role permissions', () => {
  it('lets manager review citizen applications (duyệt đơn)', () => {
    expect(canReviewApplications('manager')).toBe(true);
    expect(canReviewApplications('admin')).toBe(true);
    expect(roleHasPermission('manager', 'reviewApplications')).toBe(true);
  });

  it('blocks manager from form-version change-request approval', () => {
    expect(canApproveChangeRequests('manager')).toBe(false);
    expect(canApproveChangeRequests('admin')).toBe(true);
    // Deprecated alias still means change-request approval
    expect(canApprove('manager')).toBe(false);
    expect(canApprove('admin')).toBe(true);
  });

  it('ranks admin above manager for minRole checks', () => {
    expect(staffSatisfies('manager', 'manager')).toBe(true);
    expect(staffSatisfies('admin', 'manager')).toBe(true);
    expect(staffSatisfies('manager', 'admin')).toBe(false);
    expect(staffSatisfies('admin', 'admin')).toBe(true);
  });
});
