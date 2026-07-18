import { requireStaffAuth } from '@/lib/login-auth';
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody } from '@/lib/http';
import { sanitizeFormData, runRules } from '@/lib/rule-engine';

const MAX_NOTE_LENGTH = 1000;

/**
 * Officer decision on a submitted application: APPROVE finalizes it, RETURN
 * hands it back to the citizen with a mandatory note explaining what to fix.
 * Approval re-runs the rule engine so an invalid application can never be
 * approved, even if the queue data changed since it was listed.
 */
export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaffAuth(req, 'admin');

  const { id } = await params;
  const body = await readJsonBody(req);

  const decision = body.decision;
  if (decision !== 'APPROVE' && decision !== 'RETURN') {
    throw new AppError(400, 'INVALID_INPUT', 'Quyết định không hợp lệ.', { field: 'decision' });
  }

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string' || body.note.length > MAX_NOTE_LENGTH) {
      throw new AppError(400, 'INVALID_INPUT', 'Ghi chú không hợp lệ.', { field: 'note' });
    }
    note = body.note.trim() === '' ? null : body.note.trim();
  }
  if (decision === 'RETURN' && !note) {
    throw new AppError(400, 'NOTE_REQUIRED', 'Vui lòng ghi rõ lý do trả lại để người dân biết cần bổ sung gì.', {
      field: 'note',
    });
  }

  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }
  if (application.status !== 'SUBMITTED') {
    throw new AppError(409, 'ALREADY_PROCESSED', 'Hồ sơ này đã được xử lý trước đó.');
  }

  if (decision === 'APPROVE') {
    const provider = getProvider();
    const pinned = await provider.getFormVersionById(application.formVersionId);
    if (!pinned) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
    }
    const storedData =
      application.dataJson && typeof application.dataJson === 'object' && !Array.isArray(application.dataJson)
        ? (application.dataJson as Record<string, unknown>)
        : {};
    const sanitizeResult = sanitizeFormData(pinned.fields, storedData);
    if (!sanitizeResult.ok) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Hồ sơ còn dữ liệu không hợp lệ, không thể phê duyệt.', {
        issues: sanitizeResult.issues,
      });
    }
    const rules = await provider.getValidationRules(pinned.id);
    const blocking = runRules(pinned.fields, rules, sanitizeResult.sanitized).filter(
      (e) => e.severity === 'error'
    );
    if (blocking.length > 0) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Hồ sơ còn lỗi theo quy định, không thể phê duyệt.', {
        errors: blocking,
      });
    }
  }

  const now = new Date();
  const nextStatus = decision === 'APPROVE' ? 'APPROVED' : 'RETURNED';
  const reviewedBy = 'Cán bộ một cửa (demo)';

  const updateResult = await prisma.application.updateMany({
    where: { id, status: 'SUBMITTED' },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedBy,
      reviewNote: note,
    },
  });

  if (updateResult.count === 0) {
    throw new AppError(409, 'ALREADY_PROCESSED', 'Hồ sơ này đã được xử lý trước đó.');
  }

  return jsonOk({
    applicationId: id,
    status: nextStatus,
    reviewedAt: now,
    reviewedBy,
    reviewNote: note,
  });
});
