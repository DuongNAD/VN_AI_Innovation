'use client';

import Breadcrumb, { ProgressIndicator } from '@/components/Breadcrumb';

const STEPS = ['chat', 'checklist', 'form', 'result', 'approval'] as const;

const LABELS: Record<(typeof STEPS)[number], string> = {
  chat: 'Trò chuyện',
  checklist: 'Giấy tờ',
  form: 'Biểu mẫu',
  result: 'Kiểm tra',
  approval: 'Nộp & duyệt',
};

/**
 * Shared header strip for the citizen flow: breadcrumb + 5-step progress
 * (the last step covers submission and the officer's decision).
 * Keeps checklist/form/result visually coherent with the chat header.
 */
export default function FlowProgress({ current }: { current: (typeof STEPS)[number] }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="no-print bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4 space-y-4">
      <Breadcrumb items={[{ label: LABELS[current] }]} />
      <ProgressIndicator
        className="max-w-2xl mx-auto"
        steps={STEPS.map((step, i) => ({
          label: LABELS[step],
          status: i < idx ? 'completed' : i === idx ? 'current' : 'upcoming',
        }))}
      />
    </div>
  );
}
