'use client';

import React from 'react';
import SourceFooter from './SourceFooter';
import { safeHttpsUrl } from '@/lib/schema-guards';

export interface ProcedureInfo {
  code: string;
  name: string;
  agency: string;
  sourceUrl: string;
  version: string;
  lastCheckedAt: string | Date;
  legalBasisText: string | null;
}

export interface DocumentItem {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  reason: string | null;
}

export interface StepItem {
  order: number;
  title: string;
  description: string;
  example: string;
}

export interface GuidancePayload {
  procedure: ProcedureInfo;
  checklist: DocumentItem[];
  steps: StepItem[];
  durationText: string;
  feesText: string;
  disclaimer: string;
  formAvailable: boolean;
}

interface ChecklistViewProps {
  guidance: GuidancePayload;
  onFillForm?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export default function ChecklistView({
  guidance,
  onFillForm,
  isSubmitting = false,
  submitError = null,
}: ChecklistViewProps) {
  if (!guidance) {
    return null;
  }

  const officialSourceUrl = safeHttpsUrl(guidance.procedure.sourceUrl);
  const handlePrintGuide = () => {
    window.print();
  };

  const getSubmissionTypeBadge = (type: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP') => {
    const BADGE: Record<
      'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP',
      { short: string; full: string; className: string }
    > = {
      SUBMIT: {
        short: 'Nộp',
        full: 'Cần nộp bản giấy hoặc bản điện tử cho cơ quan',
        className: 'bg-brand-50 text-brand-800 border-brand-200',
      },
      PRESENT: {
        short: 'Xuất trình',
        full: 'Mang theo để đối chiếu, không cần nộp bản cứng',
        className: 'bg-accent-50 text-accent-900 border-accent-200',
      },
      SYSTEM_LOOKUP: {
        short: 'Hệ thống tra cứu',
        full: 'Cơ quan tự tra cứu CSDL dân cư — bạn không cần nộp',
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      },
    };

    const meta = BADGE[type];
    if (!meta) {
      return (
        <span className="inline-flex items-center rounded-md border border-surface-border bg-surface-muted px-2.5 py-1 text-xs font-semibold text-slate-700">
          {type}
        </span>
      );
    }

    return (
      <span
        className={`inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${meta.className}`}
        title={meta.full}
        aria-label={meta.full}
      >
        {meta.short}
        <span className="sr-only">. {meta.full}</span>
      </span>
    );
  };

  const getDocumentQuantityLabel = (item: DocumentItem): string => {
    if (item.submissionType === 'SYSTEM_LOOKUP') {
      return 'Cơ quan tự tra cứu — công dân không cần nộp giấy tờ';
    }

    const parts: string[] = [];
    if (item.originals > 0) {
      parts.push(`Bản chính: ${item.originals}`);
    }
    if (item.copies > 0) {
      parts.push(`Bản sao: ${item.copies}`);
    }

    if (parts.length === 0) {
      return item.submissionType === 'PRESENT'
        ? 'Chỉ xuất trình khi được yêu cầu'
        : 'Không yêu cầu bản giấy';
    }

    return parts.join(' · ');
  };

  return (
    <div className="print-area card mx-auto max-w-4xl space-y-7 rounded-2xl border border-surface-border bg-surface p-5 shadow-sm sm:p-8">
      {/* Procedure summary + compact utility actions */}
      <div className="flex flex-col gap-5 border-b border-surface-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Cơ quan thực hiện: {guidance.procedure.agency}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {guidance.procedure.name}
          </h1>
        </div>

        <div className="no-print flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={handlePrintGuide}
            title="Trong hộp thoại in, chọn “Lưu dưới dạng PDF”"
            className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M12 10v6m0 0-3-3m3 3 3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414A1 1 0 0 1 19 9.414V19a2 2 0 0 1-2 2Z"
              />
            </svg>
            Lưu PDF
          </button>

          {officialSourceUrl && (
            <a
              href={officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100"
            >
              Mở Cổng DVC
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M14 3h7m0 0v7m0-7L10 14M5 5h5M5 5v14h14v-5"
                />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Duration and Fees */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-surface-border bg-surface-muted px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-0">
        <div className="flex items-center gap-3 py-4 text-slate-700 sm:px-5">
          <svg className="h-5 w-5 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Thời hạn giải quyết</span>
            <span className="text-sm font-semibold">{guidance.durationText}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 py-4 text-slate-700 sm:px-5">
          <svg className="h-5 w-5 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lệ phí</span>
            <span className="text-sm font-semibold">{guidance.feesText}</span>
          </div>
        </div>
      </div>

      {/* Document Checklist */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Danh sách giấy tờ cần chuẩn bị</h2>
        <div className="space-y-3">
          {guidance.checklist.map((item, idx) => (
            <div
              key={item.code || idx}
              className="flex flex-col justify-between gap-4 rounded-xl border border-surface-border bg-surface p-4 transition-colors hover:border-slate-300 md:flex-row md:items-start"
            >
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="text-sm text-slate-500">{getDocumentQuantityLabel(item)}</p>
                {item.reason && (
                  <div className="mt-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-2.5 py-1 inline-flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{item.reason}</span>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 self-start md:self-center">
                {getSubmissionTypeBadge(item.submissionType)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps Timeline */}
      <div className="space-y-6">
        <h2 className="text-lg font-bold text-slate-900">Trình tự thực hiện</h2>
        <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-8">
          {guidance.steps.map((step, idx) => (
            <div key={step.order || idx} className="relative">
              <span className="absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
                {idx + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
                {step.example && (
                  <p className="text-xs text-slate-400 italic mt-1 font-medium">
                    Ví dụ: {step.example}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action / Form availability notification */}
      <div className="no-print border-t border-slate-100 pt-6">
        {guidance.formAvailable ? (
          onFillForm && (
            <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
              <div>
                <h3 className="font-bold text-slate-900">Tiếp tục điền hồ sơ trực tuyến</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Câu trả lời trước đó sẽ được dùng để điền sẵn những thông tin phù hợp.
                </p>
              </div>
              <button
                type="button"
                onClick={onFillForm}
                disabled={isSubmitting}
                className="btn-primary mt-4 min-w-44 gap-2 px-6 sm:mt-0"
              >
                {isSubmitting && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                )}
                {isSubmitting ? 'Đang mở biểu mẫu…' : 'Điền biểu mẫu'}
              </button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
            Thủ tục này hiện hỗ trợ tra cứu và hướng dẫn; biểu mẫu điện tử sẽ được bổ sung.
          </div>
        )}
        {submitError && (
          <div role="alert" className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}
      </div>

      {/* Footer area with legal basis text and SourceFooter (footer tự kẻ đường phân cách) */}
      <div className="mt-8 text-xs text-slate-500 space-y-2">
        {guidance.procedure.legalBasisText && (
          <p className="font-medium">
            Căn cứ pháp lý: {guidance.procedure.legalBasisText}
          </p>
        )}
        <SourceFooter
          sourceUrl={guidance.procedure.sourceUrl}
          version={guidance.procedure.version}
          lastCheckedAt={guidance.procedure.lastCheckedAt}
          showDisclaimer={true}
        />
      </div>
    </div>
  );
}
