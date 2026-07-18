import React from 'react';
import Link from 'next/link';

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider">
            Tài liệu kỹ thuật
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
            Kiến trúc Hệ thống (System Architecture)
          </h1>
          <p className="max-w-3xl mx-auto text-lg text-slate-500 leading-relaxed">
            Mô tả chi tiết luồng xử lý dữ liệu, tích hợp AI độc lập, cơ chế bảo mật và giao diện API của hệ thống Trợ lý Thủ tục Hành chính.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 transition-colors"
            >
              ← Quay lại Trang chủ
            </Link>
          </div>
        </div>

        {/* 1. System Flow Diagram */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              1. Sơ đồ luồng hệ thống (System Flow Diagram)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sơ đồ minh họa ba luồng chính xử lý dữ liệu từ giao diện người dùng đến tầng dịch vụ AI và Cơ sở dữ liệu.
            </p>
          </div>

          {/* 3-lane Diagram Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
            {/* Lane 1: User & Business Flow */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/80 flex flex-col space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                <h3 className="font-bold text-slate-800 text-base">Luồng Nghiệp vụ & Người dùng</h3>
              </div>
              
              <div className="flex flex-col items-center space-y-3">
                {/* Node: Citizen / Widget */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:border-blue-400 transition-all">
                  <div className="text-xs font-semibold text-blue-600 uppercase">Khởi đầu</div>
                  <div className="font-bold text-slate-800 text-sm">Citizen / Widget nhúng</div>
                </div>

                <div className="text-slate-450 font-bold">↓</div>

                {/* Node: Next.js Pages */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:border-blue-400 transition-all">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Routing & View</div>
                  <div className="font-bold text-slate-800 text-sm">Next.js App Router Pages</div>
                </div>

                <div className="text-slate-450 font-bold">↓</div>

                {/* Node: Middleware */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:border-blue-400 transition-all">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Kiểm soát truy cập</div>
                  <div className="font-bold text-slate-800 text-sm">Cache / Rate Limit / Idempotency</div>
                </div>

                <div className="text-slate-450 font-bold">↓</div>

                {/* Node: api/v1 Route Handlers */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:border-blue-400 transition-all">
                  <div className="text-xs font-semibold text-slate-500 uppercase">API Endpoints</div>
                  <div className="font-bold text-slate-800 text-sm">/api/v1 Route Handlers</div>
                </div>

                <div className="text-slate-450 font-bold">↓</div>

                {/* Node: Process Pipelines */}
                <div className="w-full bg-slate-150/80 border border-slate-300 rounded-lg p-4 space-y-2 shadow-inner">
                  <div className="text-xs font-bold text-slate-600 uppercase text-center">Pipelines xử lý chính</div>
                  
                  <div className="bg-white border border-slate-200 rounded p-2 text-xs font-medium text-slate-700">
                    <span className="font-bold text-blue-600">Stage 1:</span> Intent Matcher ➜ LLM
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded p-2 text-xs font-medium text-slate-700">
                    <span className="font-bold text-amber-600">Stage 2:</span> Intake State Machine
                  </div>
                  
                  <div className="bg-white border border-slate-200 rounded p-2 text-xs font-medium text-slate-700">
                    <span className="font-bold text-emerald-600">Stage 3:</span> Rule Engine
                  </div>
                </div>

                <div className="text-slate-450 font-bold">↓</div>

                {/* Node: Prisma Client */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm hover:border-blue-400 transition-all">
                  <div className="text-xs font-semibold text-slate-500 uppercase">ORM</div>
                  <div className="font-bold text-slate-800 text-sm">Prisma Client</div>
                </div>
              </div>
            </div>

            {/* Lane 2: AI Seams with Fallbacks */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/80 flex flex-col space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-slate-950 text-xs font-bold">2</span>
                <h3 className="font-bold text-slate-800 text-base">Tích hợp AI & Fallback</h3>
              </div>
              
              <div className="flex flex-col space-y-6 flex-1 justify-center">
                {/* AI Seam 1: LLM */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-amber-400 transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">LLM</span>
                    <span className="text-xs font-semibold text-slate-500">llm.ts</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Kết nối <span className="font-semibold">DeepSeek-V4-Flash</span> qua FPT AI Marketplace (API tương thích OpenAI).
                  </div>
                  <div className="border-t border-dashed border-slate-200 pt-2 text-[11px] text-amber-605 italic">
                    Fallback: Chuyển sang mockLlm (degraded=true) nếu có lỗi.
                  </div>
                </div>

                {/* AI Seam 2: STT */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-amber-400 transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">STT</span>
                    <span className="text-xs font-semibold text-slate-500">stt.ts</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Kết nối <span className="font-semibold">FPT.AI-whisper-large-v3-turbo</span> (Whisper tinh chỉnh cho tiếng Việt) để chuyển giọng nói sang văn bản.
                  </div>
                  <div className="border-t border-dashed border-slate-200 pt-2 text-[11px] text-amber-605 italic">
                    Fallback: Chuyển sang mockStt (degraded=true) nếu có lỗi.
                  </div>
                </div>

                {/* AI Seam 3: TTS */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-amber-400 transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">TTS</span>
                    <span className="text-xs font-semibold text-slate-500">tts.ts</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Kết nối <span className="font-semibold">FPT.AI-VITs</span> chuyển văn bản thành giọng Việt (vi-female ➜ banmai, vi-male ➜ leminh).
                  </div>
                  <div className="border-t border-dashed border-slate-200 pt-2 text-[11px] text-amber-605 italic">
                    Fallback: Chuyển sang mockTts (degraded=true) nếu có lỗi.
                  </div>
                </div>
              </div>
            </div>

            {/* Lane 3: Data Layer */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/80 flex flex-col space-y-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">3</span>
                <h3 className="font-bold text-slate-800 text-base">Lớp dữ liệu (Data Layer)</h3>
              </div>
              
              <div className="flex flex-col items-center justify-center flex-1 space-y-4">
                {/* Database Container Card */}
                <div className="w-full bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:border-emerald-400 transition-all space-y-3">
                  <div className="text-center font-bold text-slate-800 text-sm pb-2 border-b border-slate-105 flex items-center justify-center gap-2">
                    <span>🗄️</span> Database PostgreSQL
                  </div>
                  
                  <div className="space-y-1.5 text-xs text-slate-650 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>Procedure & Versions</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>ClarifyingQuestion</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>DocumentRequirement</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>Form & FormVersion</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>ValidationRule</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>Session & Application</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>ChangeRequest</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-emerald-500">•</span>
                      <span>AiUsageLog & IdempotencyRecord</span>
                    </div>
                  </div>
                </div>

                {/* Connection description */}
                <div className="text-center p-3 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed shadow-sm w-full">
                  ⚡ <span className="font-semibold">Mối liên kết liên làn:</span> ORM Prisma đọc/ghi trực tiếp vào DB PostgreSQL. Các cấu hình thủ tục pháp lý được đối chiếu tĩnh thay vì sinh ra bởi LLM.
                </div>
              </div>
            </div>
          </div>
          
          {/* Note section inside system diagram card */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <span className="text-amber-500 text-xl flex-shrink-0">⚠️</span>
            <div className="text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">Ghi chú về bảo mật và dự phòng (Mock & Fallback Policy):</span> Toàn bộ tích hợp AI có cơ chế mock tự động (<code className="bg-amber-100 px-1 py-0.5 rounded">AI_PROVIDER=mock</code>) và cơ chế phát hiện lỗi thời gian chạy (runtime failure) để tự động hạ cấp xuống chế độ mock với cờ <code className="bg-amber-100 px-1 py-0.5 rounded">degraded=true</code>. Không bao giờ gây lỗi 5xx trên toàn hệ thống khi dịch vụ AI bên ngoài gặp sự cố hoặc khi chưa thiết lập API Key.
            </div>
          </div>
        </section>

        {/* 2. AI Models Table */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              2. Đặc tả các mô hình AI (AI Models)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Danh sách chi tiết các mô hình AI và vai trò cụ thể trong hệ thống.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Mô hình (Model)</th>
                  <th className="px-4 py-3 font-semibold">Thành phần code</th>
                  <th className="px-4 py-3 font-semibold">Vai trò chức năng (Role)</th>
                  <th className="px-4 py-3 font-semibold">Cấu hình & Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900">DeepSeek-V4-Flash</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-550">llm.ts</td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed">
                    Phân loại ý định khi từ khóa không khớp + Giải thích mã lỗi nghiệp vụ (mô hình bị giới hạn đầu ra định dạng JSON).
                  </td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed text-xs">
                    Chạy qua endpoint tương thích <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">OPENAI_BASE_URL</code>. Nếu lỗi, tự động hạ cấp xuống <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">mockLlm</code> với cờ <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">degraded=true</code>.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900">FPT.AI-whisper-large-v3-turbo</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-550">stt.ts</td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed">
                    Speech-to-Text (STT) - Chuyển đổi giọng nói tiếng Việt từ micro thành văn bản.
                  </td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed text-xs">
                    Nhận file âm thanh đã qua kiểm tra định dạng và thời lượng. Fallback tự động xuống <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">mockStt</code> với kết quả mặc định.
                  </td>
                </tr>
                <tr className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-4 font-bold text-slate-900">FPT.AI-VITs</td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-550">tts.ts</td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed">
                    Text-to-Speech (TTS) - Chuyển đổi văn bản hướng dẫn hành chính thành giọng nói tiếng Việt.
                  </td>
                  <td className="px-4 py-4 text-slate-600 leading-relaxed text-xs">
                    Bản đồ giọng nói (Voice Map): <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">vi-female</code> ➜ <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">banmai</code>, <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">vi-male</code> ➜ <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">leminh</code>. Fallback xuống <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">mockTts</code> sinh mã WAV sine-wave.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. API Surface List */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-bold text-slate-900">
              3. Giao diện lập trình ứng dụng (API Surface)
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Danh mục 13 API nghiệp vụ chính phục vụ tương tác trên các phân hệ của Trợ lý hành chính công.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl border border-slate-150 p-4">
            <div className="divide-y divide-slate-200/60 font-mono text-xs">
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/procedures/search</span>
                <span className="text-slate-605 text-[11px] font-sans">Tìm kiếm thủ tục hành chính bằng từ khóa hoặc mô tả.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/guided-intake/start</span>
                <span className="text-slate-605 text-[11px] font-sans">Khởi tạo phiên hướng dẫn và cấp mã access token.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/guided-intake/{"{sessionId}"}/answer</span>
                <span className="text-slate-605 text-[11px] font-sans">Ghi nhận câu trả lời cho câu hỏi hiện tại.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-emerald-600">GET /api/v1/guided-intake/{"{sessionId}"}/guidance</span>
                <span className="text-slate-605 text-[11px] font-sans">Lấy danh mục hồ sơ và quy trình chi tiết.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-emerald-600">GET /api/v1/forms/{"{formCode}"}/active</span>
                <span className="text-slate-605 text-[11px] font-sans">Lấy cấu trúc biểu mẫu đang có hiệu lực.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/forms/{"{formCode}"}/validate</span>
                <span className="text-slate-605 text-[11px] font-sans">Kiểm tra tính hợp lệ của dữ liệu biểu mẫu và giải thích lỗi.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/applications</span>
                <span className="text-slate-605 text-[11px] font-sans">Tạo hồ sơ nháp mới liên kết với phiên làm việc.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-emerald-600">GET /api/v1/applications/{"{id}"}</span>
                <span className="text-slate-605 text-[11px] font-sans">Truy xuất thông tin chi tiết của một hồ sơ nháp.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-amber-600">PUT /api/v1/applications/{"{id}"}</span>
                <span className="text-slate-605 text-[11px] font-sans">Cập nhật dữ liệu tờ khai của hồ sơ nháp.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/applications/{"{id}"}/migrate</span>
                <span className="text-slate-605 text-[11px] font-sans">Nâng cấp hồ sơ sang phiên bản biểu mẫu mới hơn.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/speech/transcribe</span>
                <span className="text-slate-605 text-[11px] font-sans">Chuyển đổi giọng nói tiếng Việt thành văn bản.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-blue-600">POST /api/v1/speech/synthesize</span>
                <span className="text-slate-605 text-[11px] font-sans">Chuyển đổi văn bản tiếng Việt thành giọng nói.</span>
              </div>
              <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-emerald-600">GET /api/v1/admin/overview</span>
                <span className="text-slate-605 text-[11px] font-sans">Xem tổng quan danh mục thủ tục và thống kê sử dụng AI.</span>
              </div>
            </div>
          </div>

          {/* Banner to openapi spec */}
          <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-base">Xem Đặc tả OpenAPI đầy đủ</h4>
              <p className="text-xs text-slate-400 mt-1">
                Tài liệu kỹ thuật OpenAPI 3.0 chi tiết định nghĩa cấu trúc của toàn bộ API.
              </p>
            </div>
            <Link
              href="/api/openapi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm px-5 py-3 transition-colors shadow-md"
            >
              Mở đặc tả API (/api/openapi) ↗
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}