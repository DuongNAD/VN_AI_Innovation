'use client';

import { useEffect, useState } from 'react';
import type {
  StaffConsoleProps,
  OverviewResponse,
  ChangeRequest,
  ApprovalResult,
} from '@/components/admin/types';
import {
  safeHttpsUrl,
  isSafeId,
  isBoundedString,
  parseOverview,
  parseChangeRequests,
  errorMessageFor,
  getErrorFromResponse,
} from '@/components/admin/parse';

export type { StaffConsoleRole, StaffConsoleProps } from '@/components/admin/types';

export default function AdminConsole({ role = 'admin' }: StaffConsoleProps): JSX.Element {
  const canApproveActions = role === 'admin';
  const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Người quản lý';

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actorName, setActorName] = useState<string | null>(null);
  
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [approvalResults, setApprovalResults] = useState<Record<string, ApprovalResult>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleFetchData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [overviewRes, crRes] = await Promise.all([
        fetch('/api/v1/admin/overview', {
          credentials: 'include',
        }),
        fetch('/api/v1/admin/change-requests', {
          credentials: 'include',
        }),
      ]);

      if (!overviewRes.ok) {
        const { status, code } = await getErrorFromResponse(overviewRes);
        throw new Error(errorMessageFor(status, code));
      }
      if (!crRes.ok) {
        const { status, code } = await getErrorFromResponse(crRes);
        throw new Error(errorMessageFor(status, code));
      }

      let rawOverview: unknown;
      let rawCRs: unknown;
      try {
        rawOverview = await overviewRes.json();
        rawCRs = await crRes.json();
      } catch (_) {
        throw new Error(errorMessageFor(500, 'JSON_PARSE_FAILURE'));
      }

      const parsedOverview = parseOverview(rawOverview);
      const parsedCRs = parseChangeRequests(rawCRs);

      if (parsedOverview === null || parsedCRs === null) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      setOverview(parsedOverview);
      setChangeRequests(parsedCRs);

      if (rawOverview && typeof rawOverview === 'object') {
        const actor = (rawOverview as Record<string, unknown>).actor;
        if (actor && typeof actor === 'object') {
          const dn = (actor as Record<string, unknown>).displayName;
          if (typeof dn === 'string') setActorName(dn);
        }
      }

      setSuccess(
        role === 'admin'
          ? 'Tải dữ liệu quản trị thành công.'
          : 'Tải dữ liệu người quản lý thành công (chế độ chỉ đọc).'
      );
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleApprove = async (id: string) => {
    if (!isSafeId(id)) {
      setError('Mã yêu cầu không hợp lệ.');
      return;
    }

    setApprovingId(id);
    setError(null);
    setSuccess(null);

    try {
      if (!canApproveActions) {
        setError('Chỉ quản trị viên mới được phê duyệt yêu cầu thay đổi.');
        setApprovingId(null);
        return;
      }

      const res = await fetch(`/api/v1/admin/change-requests/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const { status, code } = await getErrorFromResponse(res);
        throw new Error(errorMessageFor(status, code));
      }

      let rawResult: unknown;
      try {
        rawResult = await res.json();
      } catch (_) {
        throw new Error(errorMessageFor(500, 'JSON_PARSE_FAILURE'));
      }

      if (!rawResult || typeof rawResult !== 'object') {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      const resultObj = rawResult as Record<string, unknown>;
      const changeRequestId = resultObj.changeRequestId;
      const status = resultObj.status;
      const formCode = resultObj.formCode;
      const activatedVersion = resultObj.activatedVersion;
      const closedVersion = resultObj.closedVersion;
      const effectiveFrom = resultObj.effectiveFrom;

      if (!isBoundedString(changeRequestId, 500) || !isBoundedString(status, 500) || !isBoundedString(formCode, 500) || !isBoundedString(effectiveFrom, 500)) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      if (typeof activatedVersion !== 'string' || (closedVersion !== null && closedVersion !== undefined && typeof closedVersion !== 'string')) {
        throw new Error(errorMessageFor(500, 'PARSER_FAILURE'));
      }

      const approvalResult: ApprovalResult = {
        changeRequestId,
        status,
        formCode,
        activatedVersion,
        closedVersion: (closedVersion as string | null) ?? null,
        effectiveFrom,
      };

      setApprovalResults(prev => ({ ...prev, [id]: approvalResult }));

      const versionRegex = /^[A-Za-z0-9._ -]{1,32}$/;
      const isActivatedVersionValid = versionRegex.test(activatedVersion);
      const isClosedVersionValid = closedVersion === null || closedVersion === undefined || versionRegex.test(closedVersion as string);

      if (isActivatedVersionValid && isClosedVersionValid) {
        if (closedVersion) {
          setSuccess(`Kích hoạt thành công phiên bản ${activatedVersion} (đóng phiên bản ${closedVersion}).`);
        } else {
          setSuccess(`Kích hoạt thành công phiên bản ${activatedVersion}.`);
        }
      } else {
        setSuccess('Đã phê duyệt & kích hoạt thành công');
      }

      await handleFetchData();
    } catch (err: any) {
      setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setApprovingId(null);
    }
  };

  const formatDate = (dateStr: string | Date | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return '—';
    }
  };

  const versionRegex = /^[A-Za-z0-9._ -]{1,32}$/;

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-800">
      <div className="card border border-slate-100 bg-slate-900 text-white shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-amber-400">
              Bảng điều khiển {roleLabel}
            </h2>
            <p className="text-sm text-slate-300">
              {canApproveActions
                ? 'Phiên đăng nhập cookie — xem dữ liệu hệ thống, quan trắc AI và phê duyệt thay đổi biểu mẫu.'
                : 'Phiên đăng nhập cookie — xem danh mục thủ tục, quan trắc AI và yêu cầu thay đổi (chỉ đọc).'}
            </p>
            <p className="text-xs text-slate-400">
              Vai trò: <span className="font-semibold text-amber-300">{role}</span>
              {actorName ? (
                <>
                  {' '}
                  · Phiên: <span className="text-slate-200">{actorName}</span>
                </>
              ) : null}
              {!canApproveActions && ' · không có quyền phê duyệt'}
            </p>
          </div>
          <button
            onClick={() => handleFetchData()}
            disabled={loading}
            className="btn bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 font-semibold"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                Đang tải...
              </div>
            ) : (
              'Làm mới dữ liệu'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <h4 className="font-semibold">Đã xảy ra lỗi</h4>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3">
          <span className="text-lg">✅</span>
          <div>
            <h4 className="font-semibold">Thông báo</h4>
            <p className="text-sm">{success}</p>
          </div>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card space-y-4 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Danh mục Thủ tục & Biểu mẫu</h3>
              <p className="text-sm text-slate-500">
                Trạng thái hoạt động của các phiên bản biểu mẫu số hóa được cấu hình trong hệ thống.
              </p>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Thủ tục (Mã)</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Phiên bản</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Trạng thái</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Hiệu lực từ</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Hết hiệu lực</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {overview.procedures.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">
                        Không có thủ tục nào được tìm thấy.
                      </td>
                    </tr>
                  ) : (
                    overview.procedures.flatMap((proc) => {
                      const versions = proc.formVersions;
                      if (versions.length === 0) {
                        return [
                          <tr key={proc.code} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-950 border-r border-slate-100">
                              <div>{proc.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{proc.code}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-500" colSpan={4}>
                              Hướng dẫn (Chỉ tra cứu thông tin)
                            </td>
                          </tr>
                        ];
                      }
                      return versions.map((ver, idx) => (
                        <tr key={`${proc.code}-${ver.version}`} className="hover:bg-slate-50">
                          {idx === 0 ? (
                            <td
                              className="px-4 py-3 font-medium text-slate-950 border-r border-slate-100"
                              rowSpan={versions.length}
                            >
                              <div>{proc.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{proc.code}</div>
                            </td>
                          ) : null}
                          <td className="px-4 py-3 font-semibold font-mono text-slate-700">{ver.version}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                                ver.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : ver.status === 'DRAFT'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-800 border-slate-200'
                              }`}
                            >
                              {ver.status === 'ACTIVE' ? 'ĐANG HOẠT ĐỘNG' : ver.status === 'DRAFT' ? 'BẢN NHÁP' : 'ĐÃ ĐÓNG'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatDate(ver.effectiveFrom)}</td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs">{formatDate(ver.effectiveTo)}</td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card space-y-4 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Quan trắc Sử dụng Trí tuệ Nhân tạo (AI)</h3>
              <p className="text-sm text-slate-500">
                Thống kê hiệu năng, lưu lượng, tỷ lệ cache và ước tính chi phí tích lũy theo từng phân hệ.
              </p>
            </div>
            
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-slate-600">Phân hệ</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Cuộc gọi</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Đơn vị AI</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Trễ TB</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Cache Hit</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Mất kết nối</th>
                    <th className="px-3 py-3 text-right font-semibold text-slate-600">Chi phí (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {!overview.usage || (['llm', 'stt', 'tts'] as const).every(key => !overview.usage[key]) ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400 italic">
                        Không có dữ liệu sử dụng AI.
                      </td>
                    </tr>
                  ) : (
                    (['llm', 'stt', 'tts'] as const).map((service) => {
                      const usageData = overview.usage[service];
                      if (!usageData) return null;
                      let serviceName = '';
                      let aiUnit = '—';

                      if (service === 'llm') {
                        serviceName = 'Trợ lý (LLM)';
                        aiUnit = usageData.tokens ? `${usageData.tokens.toLocaleString()} tkn` : '—';
                      } else if (service === 'stt') {
                        serviceName = 'Nhận dạng giọng nói (STT)';
                        aiUnit = usageData.audioSeconds ? `${usageData.audioSeconds.toFixed(1)} giây` : '—';
                      } else if (service === 'tts') {
                        serviceName = 'Chuyển đổi âm thanh (TTS)';
                        aiUnit = '—';
                      }

                      return (
                        <tr key={service} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-900">{serviceName}</td>
                          <td className="px-3 py-3 text-right font-mono font-medium">{usageData.calls}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">{aiUnit}</td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">
                            {usageData.avgLatencyMs ? `${usageData.avgLatencyMs.toLocaleString()}ms` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-slate-600">{usageData.cacheHits}</td>
                          <td className="px-3 py-3 text-right font-mono text-rose-600 font-semibold">{usageData.degradedCount}</td>
                          <td className="px-3 py-3 text-right font-mono text-emerald-700 font-bold">
                            ${usageData.estimatedCostUsd ? usageData.estimatedCostUsd.toFixed(4) : '0.0000'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {overview && (
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h3 className="text-xl font-bold text-slate-900">Yêu cầu Thay đổi quy định & Biểu mẫu (Change Requests)</h3>
            <p className="text-sm text-slate-500">
              Danh sách các đề xuất thay đổi nội dung pháp lý hoặc giao diện thu nhận cần phê duyệt để áp dụng ngay lập tức.
            </p>
          </div>

          {changeRequests.length === 0 ? (
            <div className="card text-center py-12 text-slate-400 border border-dashed border-slate-200">
              Không có yêu cầu thay đổi nào trong hệ thống.
            </div>
          ) : (
            <div className="space-y-6">
              {changeRequests.map((cr) => {
                const isPending = cr.status === 'PENDING';
                const result = approvalResults[cr.id];
                
                return (
                  <div key={cr.id} className="card border border-slate-100 shadow-sm space-y-6 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">
                            Yêu cầu cập nhật: {cr.oldVersion.formCode}
                          </span>
                          <span
                            className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                              cr.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : cr.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}
                          >
                            {cr.status === 'PENDING' ? 'CHỜ PHÊ DUYỆT' : cr.status === 'APPROVED' ? 'ĐÃ ÁP DỤNG' : 'ĐÃ TỪ CHỐI'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Tạo ngày: {formatDate(cr.createdAt)} · Phiên bản cũ: {cr.oldVersion.version} → Đích đề xuất: {cr.proposedTargetVersion}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {(() => {
                          const verifiedUrl = safeHttpsUrl(cr.sourceUrl);
                          if (verifiedUrl) {
                            return (
                              <a
                                href={verifiedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-amber-600 hover:text-amber-700 underline"
                              >
                                Quyết định đính kèm ↗
                              </a>
                            );
                          } else {
                            const displayUrl = typeof cr.sourceUrl === 'string'
                              ? (cr.sourceUrl.length > 50 ? cr.sourceUrl.slice(0, 47) + '...' : cr.sourceUrl)
                              : '';
                            return (
                              <span className="text-xs font-semibold text-slate-400">
                                {displayUrl}
                              </span>
                            );
                          }
                        })()}

                        {isPending && canApproveActions && (
                          <button
                            onClick={() => handleApprove(cr.id)}
                            disabled={approvingId !== null}
                            className="btn bg-amber-600 hover:bg-amber-500 text-white text-sm py-2 px-4 disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {approvingId === cr.id ? (
                              <div className="flex items-center gap-2">
                                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Đang kích hoạt...
                              </div>
                            ) : (
                              'Phê duyệt & kích hoạt'
                            )}
                          </button>
                        )}
                        {isPending && !canApproveActions && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                            Chỉ xem — cần quyền admin để phê duyệt
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <h4 className="text-sm font-bold text-slate-700 mb-1">Tóm tắt thay đổi:</h4>
                        <p className="text-sm text-slate-600 italic">“{cr.diff.summary}”</p>
                      </div>

                      <div className="border border-slate-100 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200 text-xs">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left font-semibold text-slate-500">Mã trường (ID)</th>
                              <th className="px-4 py-2 text-left font-semibold text-slate-500">Tên nhãn trường (Label)</th>
                              <th className="px-4 py-2 text-center font-semibold text-slate-500">Phân loại thay đổi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {cr.diff.added.map((item) => (
                              <tr key={`add-${item.id}`} className="bg-emerald-50/40 text-emerald-900">
                                <td className="px-4 py-2 font-mono font-medium">{item.id}</td>
                                <td className="px-4 py-2">{item.label}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Thêm mới
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.removed.map((item) => (
                              <tr key={`remove-${item.id}`} className="bg-rose-50/40 text-rose-900 line-through decoration-rose-400">
                                <td className="px-4 py-2 font-mono">{item.id}</td>
                                <td className="px-4 py-2">{item.label}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    Xóa bỏ
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.changed.map((item) => (
                              <tr key={`change-${item.id}`} className="bg-amber-50/40 text-amber-900">
                                <td className="px-4 py-2 font-mono font-medium">{item.id}</td>
                                <td className="px-4 py-2">
                                  {item.oldLabel && item.newLabel ? (
                                    <span>
                                      {item.oldLabel} <span className="text-slate-400 font-mono mx-1">→</span>{' '}
                                      <strong className="text-amber-800">{item.newLabel}</strong>
                                    </span>
                                  ) : (
                                    item.label
                                  )}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Thay đổi cấu hình
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {cr.diff.added.length === 0 &&
                              cr.diff.removed.length === 0 &&
                              cr.diff.changed.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-4 text-center text-slate-400 italic">
                                    Cập nhật các thuộc tính quy trình nội bộ, cấu trúc trường không đổi.
                                  </td>
                                </tr>
                              )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {(() => {
                      if (!result) return null;

                      const isActivatedVersionValid = typeof result.activatedVersion === 'string' && versionRegex.test(result.activatedVersion);
                      const isClosedVersionValid = result.closedVersion === null || (typeof result.closedVersion === 'string' && versionRegex.test(result.closedVersion));

                      return (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <span>🎉</span> Đã duyệt áp dụng thay đổi thành công!
                          </div>
                          {isActivatedVersionValid && isClosedVersionValid ? (
                            <>
                              <div>
                                • Phiên bản mới hoạt động: <strong className="font-mono">{result.activatedVersion}</strong>
                              </div>
                              {result.closedVersion && (
                                <div>
                                  • Phiên bản cũ đóng lại: <strong className="font-mono">{result.closedVersion}</strong>
                                </div>
                              )}
                            </>
                          ) : (
                            <div>• Đã phê duyệt & kích hoạt thành công</div>
                          )}
                          <div className="text-xs text-emerald-600 mt-1">
                            Hiệu lực từ: {formatDate(result.effectiveFrom)}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
