'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ValidationReport from '@/components/ValidationReport';
import SourceFooter from '@/components/SourceFooter';

interface ApplicationData {
  formCode: string;
  formVersion: string;
  data: Record<string, any>;
  procedure?: {
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

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
        Kết quả kiểm tra hồ sơ
      </h1>

      {validationResult.valid && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-center font-bold text-lg mb-6 shadow-sm">
          Hồ sơ hợp lệ, sẵn sàng nộp
        </div>
      )}

      <ValidationReport
        valid={validationResult.valid}
        errors={validationResult.errors}
        aiExplanation={validationResult.aiExplanation}
        applicationId={applicationId!}
        formVersion={validationResult.formVersion || appData.formVersion}
        aiMode={validationResult.aiMode}
        degraded={validationResult.degraded}
      />

      <div className="pt-6 border-t border-slate-200">
        <SourceFooter
          showDisclaimer={true}
          sourceUrl={appData.procedure?.sourceUrl}
          version={validationResult.formVersion || appData.formVersion}
          lastCheckedAt={appData.procedure?.lastCheckedAt}
        />
      </div>
    </main>
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