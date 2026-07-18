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
    switch (type) {
      case 'SUBMIT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            Nộp
          </span>
        );
      case 'PRESENT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            Xuất trình (không nộp)
          </span>
        );
      case 'SYSTEM_LOOKUP':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
            Cơ quan tự tra cứu CSDL dân cư — bạn không cần nộp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-100">
            {type}
          </span>
        );
    }
  };

  return (
    <div className="print-area card max-w-4xl mx-auto my-6 p-6 sm:p-8 space-y-8 bg-white border border-slate-100 shadow-sm">
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pb-4 border-b border-slate-100">
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
      <div className="border-b border-slate-100 pb-6 space-y-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Cơ quan thực hiện: {guidance.procedure.agency}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
          {guidance.procedure.name}
        </h1>
      </div>

      {/* Duration and Fees */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
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
              className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-shadow flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="space-y-1.5">
                <p className="font-bold text-slate-800">{item.name}</p>
                <p className="text-sm text-slate-500">
                  Bản chính: {item.originals} · Bản sao: {item.copies}
                </p>
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
              <span className="absolute -left-10 top-0.5 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm">
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
