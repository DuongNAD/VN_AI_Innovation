/**
 * Builds the spoken checklist summary from an assembled guidance object. Shared
 * by the checklist page (what the citizen hears) and the TTS pre-generation CLI
 * (what it warms) so both produce byte-identical text — a prerequisite for the
 * pre-generated audio to actually match the cache key looked up at runtime.
 */
export function buildChecklistSummary(guidance: any): string {
  if (!guidance || !guidance.procedure) return '';
  const procName = guidance.procedure.name;
  const agency = guidance.procedure.agency;
  let text = `Hướng dẫn chuẩn bị hồ sơ cho thủ tục: ${procName}. Cơ quan giải quyết: ${agency}. `;

  if (guidance.checklist && guidance.checklist.length > 0) {
    text += 'Danh sách các giấy tờ cần thiết bao gồm: ';
    guidance.checklist.forEach((doc: any, index: number) => {
      text += `Giấy tờ thứ ${index + 1}: ${doc.name}. `;
      const subTypeMap: Record<string, string> = {
        SUBMIT: 'Yêu cầu nộp bản giấy hoặc bản điện tử.',
        PRESENT: 'Yêu cầu xuất trình để đối chiếu và không cần nộp bản cứng.',
        SYSTEM_LOOKUP: 'Cơ quan tự tra cứu thông qua cơ sở dữ liệu quốc gia về dân cư, công dân không cần nộp giấy tờ này.',
      };
      text += subTypeMap[doc.submissionType] || '';
      if (doc.originals > 0 || doc.copies > 0) {
        const parts = [];
        if (doc.originals > 0) parts.push(`${doc.originals} bản chính`);
        if (doc.copies > 0) parts.push(`${doc.copies} bản sao`);
        text += ` Cần chuẩn bị ${parts.join(' và ')}.`;
      }
      if (doc.reason) {
        text += ` Áp dụng vì lý do: ${doc.reason}.`;
      }
      text += ' ';
    });
  }

  if (guidance.steps && guidance.steps.length > 0) {
    text += 'Quy trình thực hiện bao gồm các bước sau: ';
    guidance.steps.forEach((step: any, index: number) => {
      text += `Bước ${index + 1}: ${step.title}. Hướng dẫn chi tiết: ${step.description}. `;
      if (step.example) {
        text += `Ví dụ cụ thể: ${step.example}. `;
      }
    });
  }

  if (guidance.durationText) {
    text += `Thời gian giải quyết dự kiến: ${guidance.durationText}. `;
  }
  if (guidance.feesText) {
    text += `Lệ phí: ${guidance.feesText}. `;
  }

  return text.trim();
}
