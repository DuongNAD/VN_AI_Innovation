'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChecklistView from '@/components/ChecklistView';
import SpeechButton from '@/components/SpeechButton';
import FlowChrome from '@/components/FlowChrome';
import { randomUUID } from '@/lib/uuid';
import { buildChecklistSummary } from '@/lib/checklist-summary';

function ChecklistContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<any | null>(null);
  const [sessionState, setSessionState] = useState<'loading' | 'invalid' | 'valid'>('loading');
  const [token, setToken] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setSessionState('invalid');
      setLoading(false);
      return;
    }

    try {
      const storedSessionRaw = sessionStorage.getItem('psp_session');
      if (!storedSessionRaw) {
        setSessionState('invalid');
        setLoading(false);
        return;
      }
      const storedSession = JSON.parse(storedSessionRaw);
      if (storedSession.sessionId !== sessionId || !storedSession.token) {
        setSessionState('invalid');
        setLoading(false);
        return;
      }
      setToken(storedSession.token);
      setSessionState('valid');
    } catch (e) {
      setSessionState('invalid');
      setLoading(false);
      return;
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionState !== 'valid' || !sessionId || !token) {
      return;
    }

    async function fetchGuidance() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/guided-intake/${sessionId}/guidance`, {
          method: 'GET',
          headers: {
            'X-Session-Token': token,
          },
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Lỗi tải thông tin (Mã lỗi: ${res.status})`);
        }
        const data = await res.json();
        setGuidance(data);
      } catch (err: any) {
        setError(err.message || 'Đã xảy ra lỗi khi kết nối hệ thống.');
      } finally {
        setLoading(false);
      }
    }

    fetchGuidance();
  }, [sessionState, sessionId, token, retryKey]);

  const handleCreateApplication = async () => {
    if (submitting || !sessionId || !token) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await fetch('/api/v1/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token,
        },
        body: JSON.stringify({
          sessionId,
          messageId: randomUUID(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Lỗi khởi tạo hồ sơ (Mã lỗi: ${res.status})`);
      }

      const data = await res.json();
      router.push(`/user/form/${data.applicationId}`, { scroll: true });
    } catch (err: any) {
      setSubmitError(err.message || 'Không thể khởi tạo biểu mẫu hồ sơ trực tuyến.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionState === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center transition-all duration-300 hover:shadow-2xl">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-50 border border-amber-100 text-amber-500 mb-6 animate-bounce">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Không tìm thấy phiên làm việc
          </h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Mã phiên làm việc không hợp lệ hoặc đã hết hạn. Để bảo mật dữ liệu cá nhân, các tab mới hoặc trình duyệt mới không thể khôi phục mã truy cập này.
          </p>
          <a
            href="/user/chat"
            className="btn w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200 transition-all duration-200"
          >
            Quay lại trang trò chuyện
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
            <div className="h-8 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          </div>
          <div className="animate-pulse bg-white rounded-2xl p-8 shadow-sm border border-slate-100 space-y-6">
            <div className="h-6 bg-slate-200 rounded w-1/2"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-5/6"></div>
              <div className="h-4 bg-slate-200 rounded w-4/5"></div>
            </div>
            <div className="h-32 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 border border-red-100 text-red-500 mb-6">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">
            Đã xảy ra lỗi
          </h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="btn w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-200 transition-all duration-200"
            >
              Thử lại
            </button>
            <a
              href="/user/chat"
              className="btn w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-all duration-200"
            >
              Quay lại trang trò chuyện
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!guidance) return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <FlowChrome
        current="checklist"
        title="Danh sách chuẩn bị hồ sơ"
        backHref="/user/chat"
        backLabel="Trò chuyện"
      />
      <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Danh sách chuẩn bị hồ sơ
              </h2>
              <p className="mt-1 text-slate-600">
                Dựa trên câu trả lời của bạn, hệ thống đã tối ưu danh mục hồ sơ và quy trình thực hiện.
              </p>
            </div>
            <div className="flex-shrink-0">
              <SpeechButton text={buildChecklistSummary(guidance)} label="Đọc hướng dẫn" />
            </div>
          </div>

          <ChecklistView
            guidance={guidance}
            onFillForm={guidance.formAvailable ? handleCreateApplication : undefined}
            isSubmitting={submitting}
            submitError={submitError}
          />
        </div>
      </main>
    </div>
  );
}

export default function ChecklistPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ChecklistContent />
    </Suspense>
  );
}
