import { handleRoute, jsonOk } from '@/lib/errors';
import { DOCUMENT_TYPES } from '@/lib/document-types';

/**
 * Public catalog of application document types for citizen dropdowns
 * and staff filter UI (no auth required).
 */
export const GET = handleRoute(async () => {
  return jsonOk({
    documentTypes: DOCUMENT_TYPES.map((t) => ({
      code: t.code,
      label: t.label,
      description: t.description,
      icon: t.icon,
      badgeClass: t.badgeClass,
      accentClass: t.accentClass,
    })),
  });
});
