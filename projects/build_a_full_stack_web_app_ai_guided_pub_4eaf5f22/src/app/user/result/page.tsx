'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ValidationReport from '@/components/ValidationReport';
import SourceFooter from '@/components/SourceFooter';
import DocumentPreview from '@/components/DocumentPreview';
import FlowChrome from '@/components/FlowChrome';
import SubmissionPanel from '@/components/SubmissionPanel';

interface ApplicationData {
  formCode: string;
  formVersion: string;
  status?: string;
  submittedAt?: string | Date | null;
  reviewedAt?: string | Date | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  data: Record<string, any>;
  fields?: any[];
  procedure?: {
    name?: string;
    sourceUrl?: string;
    lastCheckedAt?: string | Date;
  };
}

interface ValidationError {
  code: string;
  field?: string;
  fields?: string[];
  message: string;
  suggestion: string;
  severity: 'error' | 'warning';
  orderNumber: number;
}

interface ValidationResponse {
  valid: boolean;
  errors: ValidationError[];
  aiExplanation?: string;
  aiMode: string;
  degraded: boolean;
  formCode: string;
  formVersion: string;
}

function ResultPageContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get('applicationId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appData, setAppData] = useState<ApplicationData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [sessionToken, setSessionToken] = useState<string>('');

  useEffect(() => {
    if (!applicationId) {
      setError('Mã hồ sơ không hợp lệ.');
      setLoading(false);
      return;
    }

    const sessionDataStr = sessionStorage.getItem('psp_session');
    let token = '';
    if (sessionDataStr) {
      try {
        const parsed = JSON.parse(sessionDataStr);
        token = parsed.token || '';
      } catch (e) {
        // Safe fallback
      }
    }

    if (!token) {
      setError('Phiên làm việc đã hết hạn hoặc không tồn tại. Vui lòng quay lại trang hướng dẫn.');
      setLoading(false);
      return;
    }
    setSessionToken(token);

    async function performValidation() {
      try {
        const appRes = await fetch(`/api/v1/applications/${applicationId}`, {
          headers: {
            'X-Session-Token': token,
          },
        });
        const appJson = await appRes.json();
        if (!appRes.ok) {
          throw new Error(appJson?.error?.message || 'Không thể tải thông tin hồ sơ.');
        }

        const data = appJson.data;
        const formCode = appJson.formCode;
        const formVersion = appJson.formVersion;
        setAppData(appJson);

        const valRes = await fetch(`/api/v1/forms/${formCode}/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': token,
          },
          body: JSON.stringify({
            formVersion,
            data,
            applicationId,
          }),
        });
        const valJson = await valRes.json();
        if (!valRes.ok) {
          throw new Error(valJson?.error?.message || 'Không thể kiểm tra hợp lệ của hồ sơ.');
        }

        setValidationResult(valJson);
      } catch (err: any) {
        setError(err.message || 'Đã xảy ra lỗi kết nối hệ thống.');
      } finally {
        setLoading(false);
      }
    }

    performValidation();
  }, [applicationId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4"></div>
        <p className="text-slate-600 font-medium">Đang chạy kiểm tra hồ sơ, vui lòng đợi...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-800">
          <h2 className="text-lg font-bold mb-2">Lỗi xử lý</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!validationResult || !appData) {
    return null;
  }

  const appStatus = appData.status ?? 'DRAFT';
  const lifecycleActive = appStatus === 'SUBMITTED' || appStatus === 'APPROVED' || appStatus === 'RETURNED';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <FlowChrome
        current={lifecycleActive ? 'approval' : 'result'}
        title={lifecycleActive ? 'Trạng thái hồ sơ' : 'Kết quả kiểm tra'}
      />
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8"
      >
        {validationResult.valid && (
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            {lifecycleActive ? 'Trạng thái hồ sơ' : 'Kết quả kiểm tra hồ sơ'}
          </h1>
        )}

        {/* Officer decision / submission — the headline once the citizen has handed the file over. */}
        {lifecycleActive && (
          <SubmissionPanel
            applicationId={applicationId!}
            token={sessionToken}
            status={appStatus}
            valid={validationResult.valid}
            submittedAt={appData.submittedAt}
            reviewedAt={appData.reviewedAt}
            reviewedBy={appData.reviewedBy}
            reviewNote={appData.reviewNote}
            onStatusChange={(next) =>
              setAppData((prev) => (prev ? { ...prev, ...next } : prev))
            }
          />
        )}

        {/* Once submitted, the status panel is the headline; repeating the green
            "ready to submit" card underneath would contradict it. */}
        {!(lifecycleActive && validationResult.valid) && (
          <ValidationReport
            valid={validationResult.valid}
            errors={validationResult.errors}
            aiExplanation={validationResult.aiExplanation}
            applicationId={applicationId!}
            formVersion={validationResult.formVersion || appData.formVersion}
            aiMode={validationResult.aiMode}
            degraded={validationResult.degraded}
          />
        )}

        {!lifecycleActive && (
          <SubmissionPanel
            applicationId={applicationId!}
            token={sessionToken}
            status={appStatus}
            valid={validationResult.valid}
            submittedAt={appData.submittedAt}
            reviewedAt={appData.reviewedAt}
            reviewedBy={appData.reviewedBy}
            reviewNote={appData.reviewNote}
            onStatusChange={(next) =>
              setAppData((prev) => (prev ? { ...prev, ...next } : prev))
            }
          />
        )}

        {validationResult.valid && Array.isArray(appData.fields) && appData.fields.length > 0 && (
          <DocumentPreview
            procedureName={appData.procedure?.name || 'thủ tục hành chính'}
            formCode={appData.formCode}
            formVersion={validationResult.formVersion || appData.formVersion}
            fields={appData.fields}
            data={appData.data}
          />
        )}

        <div className="no-print pt-6 border-t border-slate-200">
          <SourceFooter
            showDisclaimer={true}
            sourceUrl={appData.procedure?.sourceUrl}
            version={validationResult.formVersion || appData.formVersion}
            lastCheckedAt={appData.procedure?.lastCheckedAt}
          />
        </div>
      </main>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mb-4"></div>
        <p className="text-slate-600 font-medium">Đang tải...</p>
      </div>
    }>
      <ResultPageContent />
    </Suspense>
  );
}
