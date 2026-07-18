'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import SourceFooter from '@/components/SourceFooter';
import { ApplicationFormRunner } from '@/components/DynamicForm';
import FlowChrome from '@/components/FlowChrome';

interface ApplicationData {
  applicationId: string;
  formCode: string;
  formVersion: string;
  status: string;
  data: Record<string, unknown>;
  revision: number;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  fields: any[];
  rules: any[];
  updateAvailable: boolean;
  newVersion?: string;
  procedure: {
    name: string;
    sourceUrl: string;
    lastCheckedAt: string | Date;
  };
}

export default function ApplicationFormPage() {
  const params = useParams();
  const applicationId = params?.applicationId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'session_missing' | 'access_denied' | string | null>(null);
  const [data, setData] = useState<ApplicationData | null>(null);
  const [token, setToken] = useState<string>('');

  useEffect(() => {
    if (!applicationId) return;

    let sessionToken = '';
    try {
      const sessionStr = sessionStorage.getItem('psp_session');
      if (sessionStr) {
        const sessionObj = JSON.parse(sessionStr);
        sessionToken = sessionObj.token || '';
      }
    } catch (e) {
      console.error('Error reading session token:', e);
    }

    if (!sessionToken) {
      setError('session_missing');
      setLoading(false);
      return;
    }

    setToken(sessionToken);

    fetch(`/api/v1/applications/${applicationId}`, {
      headers: {
        'X-Session-Token': sessionToken,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            throw new Error('access_denied');
          }
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error?.message || 'Không thể tải thông tin hồ sơ.');
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error(err);
        if (err.message === 'access_denied') {
          setError('access_denied');
        } else {
          setError(err.message || 'Lỗi kết nối hệ thống.');
        }
        setLoading(false);
      });
  }, [applicationId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="text-lg font-medium text-slate-600 animate-pulse">Đang tải thông tin biểu mẫu...</p>
        </div>
      </div>
    );
  }

  if (error === 'session_missing' || error === 'access_denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-100 text-center space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-950">Không thể truy cập hồ sơ</h2>
          <p className="text-slate-600 text-[16px] leading-relaxed">
            Phiên làm việc của bạn không hợp lệ hoặc đã hết hạn. Vui lòng quay lại trang trợ lý để bắt đầu lại.
          </p>
          <div>
            <a
              href="/user/chat"
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg w-full text-center py-3 rounded-lg font-semibold inline-flex items-center justify-center transition-all duration-200"
            >
              Bắt đầu lại tại Trang trò chuyện
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-slate-100 text-center space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 text-amber-600">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-950">Đã xảy ra lỗi</h2>
          <p className="text-slate-600 text-[16px] leading-relaxed">
            {error || 'Không thể tải thông tin hồ sơ.'}
          </p>
          <div>
            <a
              href="/user/chat"
              className="btn bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg w-full text-center py-3 rounded-lg font-semibold inline-flex items-center justify-center transition-all duration-200"
            >
              Quay lại Trang trò chuyện
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <FlowChrome current="form" title="Điền biểu mẫu" />
      <main id="main-content" className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="border-b border-slate-200 pb-6">
            <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              {data.procedure.name} — Phiên bản {data.formVersion}
            </h1>
            <SourceFooter
              sourceUrl={data.procedure.sourceUrl}
              version={data.formVersion}
              lastCheckedAt={data.procedure.lastCheckedAt}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <ApplicationFormRunner
              applicationId={data.applicationId}
              formCode={data.formCode}
              fields={data.fields}
              rules={data.rules}
              initialData={data.data}
              revision={data.revision}
              formVersion={data.formVersion}
              status={data.status}
              reviewNote={data.reviewNote}
              reviewedBy={data.reviewedBy}
              reviewedAt={data.reviewedAt}
              updateAvailable={data.updateAvailable}
              newVersion={data.newVersion}
              token={token}
              onVersionChange={(version) =>
                setData((prev) => (prev ? { ...prev, formVersion: version } : prev))
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}