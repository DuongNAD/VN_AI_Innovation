'use client';

import Link from 'next/link';
import SpeechButton from '@/components/SpeechButton';

interface ValidationErrorItem {
  code: string;
  field?: string;
  fields?: string[];
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
}

interface ValidationReportProps {
  valid: boolean;
  errors: ValidationErrorItem[];
  aiExplanation?: string;
  applicationId: string;
  formVersion: string;
  aiMode?: string;
  degraded?: boolean;
}

export default function ValidationReport({
  valid,
  errors,
  aiExplanation,
  applicationId,
  formVersion,
  aiMode,
  degraded,
}: ValidationReportProps) {
  // Construct plain text of all errors and the AI explanation for TTS
  const errorsText = errors
    .map((e) => `${e.message}. Cách khắc phục: ${e.suggestion}`)
    .join(' ');
  const speechText = `${errorsText}${aiExplanation ? ` ${aiExplanation}` : ''}`;

  if (valid) {
    return (
      <div className="w-full max-w-3xl mx-auto p-4 space-y-6">
        <div className="card border border-emerald-200 bg-emerald-50 p-6 rounded-xl shadow-sm text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-emerald-950">
            Hồ sơ hợp lệ, sẵn sàng nộp
          </h2>
          <p className="text-sm text-emerald-800">
            Không phát hiện lỗi nào. Tất cả dữ liệu của bạn đã vượt qua các bước
            kiểm tra.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 space-y-6">
      {/* Header and Saving mode Badge */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Kết quả kiểm tra hồ sơ
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Phiên bản biểu mẫu: <span className="font-semibold text-slate-700">{formVersion}</span>
          </p>
        </div>
        {(aiMode === 'mock' || degraded) && (
          <span className="badge-eco" aria-label="Chế độ tiết kiệm" />
        )}
      </div>

      {/* Red Summary Box */}
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start space-x-3">
        <div className="text-red-500 mt-0.5">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-red-900">
            Phát hiện {errors.length} lỗi cần sửa trước khi nộp
          </h2>
          <p className="text-xs text-red-700 mt-1">
            Vui lòng sửa các trường thông tin bên dưới và thử lại.
          </p>
        </div>
      </div>

      {/* Errors and Warnings List */}
      <div className="space-y-3">
        {errors.map((error, index) => {
          const isWarning = error.severity === 'warning';

          // Format field names showing either 'field' or both if multiple fields
          const fieldIds = error.fields && error.fields.length > 0
            ? error.fields
            : error.field
              ? [error.field]
              : [];

          return (
            <div
              key={index}
              className={`p-4 rounded-xl border-l-4 shadow-sm transition duration-150 ${
                isWarning
                  ? 'bg-amber-50/70 border-amber-500 text-amber-950 hover:bg-amber-50'
                  : 'bg-red-50/70 border-red-500 text-red-950 hover:bg-red-50'
              }`}
            >
              <div className="flex flex-col space-y-2">
                <div className="flex items-center flex-wrap gap-2">
                  <span
                    className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                      isWarning
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}
                  >
                    {isWarning ? 'Cảnh báo' : 'Lỗi bắt buộc'}
                  </span>
                  {fieldIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[11px] text-slate-500 font-medium">Mã trường:</span>
                      {fieldIds.map((fid) => (
                        <code
                          key={fid}
                          className="text-[11px] font-mono font-bold bg-white/80 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded"
                        >
                          {fid}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 text-sm leading-snug">
                    {error.message}
                  </p>
                  <p className="text-xs text-slate-700">
                    <span className="font-bold text-slate-900">Cách khắc phục: </span>
                    {error.suggestion}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visually Distinct AI Explanation Box */}
      {aiExplanation && (
        <div className="card relative overflow-hidden bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-100 p-5 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping" />
            <h3 className="text-sm font-bold text-indigo-950 uppercase tracking-wider">
              Trợ lý AI giải thích
            </h3>
          </div>
          <p className="text-indigo-900 text-sm leading-relaxed whitespace-pre-line">
            {aiExplanation}
          </p>
          <div className="pt-2 border-t border-indigo-100/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 font-medium">
              AI chỉ giải thích mã lỗi — nội dung pháp lý lấy từ cơ sở dữ liệu
            </span>
            <SpeechButton text={speechText} label="Nghe giải thích từ AI" />
          </div>
        </div>
      )}

      {/* Action Button Panel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Link
          href={`/form/${applicationId}`}
          className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md transition-all duration-200 text-center w-full sm:w-auto"
        >
          Quay lại sửa biểu mẫu
        </Link>
        {!aiExplanation && (
          <div className="w-full sm:w-auto flex justify-end">
            <SpeechButton text={speechText} />
          </div>
        )}
      </div>
    </div>
  );
}