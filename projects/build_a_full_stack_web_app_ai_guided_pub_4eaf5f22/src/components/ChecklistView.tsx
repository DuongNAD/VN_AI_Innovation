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
}

export default function ChecklistView({ guidance, onFillForm }: ChecklistViewProps) {
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
    <div className="print-area card mx-auto my-6 max-w-4xl space-y-8 border border-surface-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-4 border-b border-surface-border">
        <button
          type="button"
          onClick={handlePrintGuide}
          className="btn bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Lưu hướng dẫn PDF
        </button>
        {officialSourceUrl && (
          <a
            href={officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
          >
            Mở Cổng DVC để nộp
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 3h7m0 0v7m0-7L10 14M5 5h5M5 5v14h14v-5"
              />
            </svg>
          </a>
        )}
        <p className="text-xs text-slate-500 sm:basis-full sm:text-right">
          Trong hộp thoại in, chọn “Lưu dưới dạng PDF”.
        </p>
      </div>

      {/* Header Section */}
      <div className="space-y-2 border-b border-surface-border pb-6">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            Cơ quan thực hiện: {guidance.procedure.agency}
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {guidance.procedure.name}
        </h1>
      </div>

      {/* Duration and Fees */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-surface-border bg-surface-muted p-4 sm:grid-cols-2">
        <div className="flex items-center space-x-3 text-slate-700">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Thời hạn giải quyết</span>
            <span className="font-semibold text-sm">{guidance.durationText}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-700">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Lệ phí</span>
            <span className="font-semibold text-sm">{guidance.feesText}</span>
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
              className="flex flex-col justify-between gap-4 rounded-lg border border-surface-border bg-surface p-4 shadow-sm transition-shadow hover:shadow md:flex-row md:items-start"
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
      <div className="no-print pt-4 border-t border-slate-100">
        {guidance.formAvailable ? (
          onFillForm && (
            <div className="flex justify-end">
              <button
                onClick={() => onFillForm?.()}
                className="btn bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                Điền biểu mẫu
              </button>
            </div>
          )
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm font-medium">
            Thủ tục này hiện hỗ trợ tra cứu và hướng dẫn; biểu mẫu điện tử sẽ được bổ sung.
          </div>
        )}
      </div>

      {/* Footer area with legal basis text and SourceFooter */}
      <div className="mt-8 pt-6 border-t border-slate-100 text-xs text-slate-500 space-y-2">
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
