import React from 'react';
import Script from 'next/script';
import Link from 'next/link';

export default function WidgetDemoPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Banner */}
      <div className="bg-amber-500 text-white text-center py-2.5 px-4 font-semibold text-sm shadow-inner flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 animate-pulse flex-shrink-0"
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
        <span>Trang mô phỏng phục vụ demo — không phải website chính thức</span>
      </div>

      {/* Main Header */}
      <header className="bg-[#1e3a8a] text-white shadow-md border-b-4 border-red-600">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center md:text-left">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center font-bold text-white shadow-md border border-yellow-400 flex-shrink-0">
              ★
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wide uppercase">
                Cổng Dịch vụ công (Mô phỏng)
              </h1>
              <p className="text-xs text-blue-200 mt-0.5">
                HỆ THỐNG THÔNG TIN GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/" className="hover:underline hover:text-blue-200 transition">
              Trang chủ
            </Link>
            <Link href="/sources" className="hover:underline hover:text-blue-200 transition">
              Tra cứu thủ tục
            </Link>
            <Link href="/admin" className="hover:underline hover:text-blue-200 transition">
              Quản trị viên
            </Link>
          </nav>
        </div>
      </header>

      {/* Navigation Sub-bar */}
      <div className="bg-[#2563eb] text-white text-sm py-2 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap gap-6 items-center justify-between">
          <div className="flex gap-4">
            <span className="font-semibold">Hotline: 1900.xxxx</span>
            <span className="hidden sm:inline text-blue-200">|</span>
            <span className="hidden sm:inline">Hỗ trợ: support@dichvucong.demo.gov.vn</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping"></span>
            <span className="text-xs">Hệ thống hoạt động bình thường</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12 space-y-10">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-2xl p-6 md:p-10 shadow-lg text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.08),transparent)] pointer-events-none"></div>
          <div className="relative z-10 max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Tìm kiếm dịch vụ công trực tuyến nhanh chóng
            </h2>
            <p className="text-blue-100 text-sm md:text-base">
              Hỗ trợ công dân tìm hiểu thông tin pháp lý, thủ tục hành chính, nộp hồ sơ dịch vụ công mức độ 3 và 4 hoàn toàn trực tuyến.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto pt-2">
              <input
                type="text"
                placeholder="Nhập từ khóa tìm kiếm thủ tục (ví dụ: đăng ký kết hôn, khai sinh...)"
                className="flex-1 px-4 py-3 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-md text-sm md:text-base"
                disabled
              />
              <button
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-lg shadow-md transition whitespace-nowrap text-sm md:text-base flex items-center justify-center gap-2"
                disabled
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Tìm kiếm
              </button>
            </div>
            <p className="text-xs text-blue-200">
              * Mẹo: Bạn cũng có thể nhấn vào biểu tượng Trợ lý AI ở góc dưới bên phải màn hình để được hướng dẫn trực tiếp bằng ngôn ngữ tự nhiên.
            </p>
          </div>
        </section>

        {/* Static Portal Cards (Grid Layout) */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-6 bg-blue-700 rounded-sm"></span>
              Dịch vụ nổi bật dành cho công dân
            </h3>
            <span className="text-xs text-slate-500 italic">Tổng số: 5 lĩnh vực</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Block 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2">Đăng ký kết hôn & Hộ tịch</h4>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                  Thực hiện đăng ký kết hôn trong nước hoặc có yếu tố nước ngoài, đăng ký nhận cha mẹ con, đăng ký khai tử.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 pt-2 border-t border-slate-100">
                <span>Mức độ 4</span>
                <span className="hover:underline cursor-pointer">Chi tiết &rarr;</span>
              </div>
            </div>

            {/* Block 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2">Đăng ký khai sinh</h4>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                  Đăng ký khai sinh trực tuyến cho trẻ em mới sinh trong nước. Tích hợp cấp thẻ bảo hiểm y tế và đăng ký thường trú.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 pt-2 border-t border-slate-100">
                <span>Mức độ 4</span>
                <span className="hover:underline cursor-pointer">Chi tiết &rarr;</span>
              </div>
            </div>

            {/* Block 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2">Đăng ký cư trú</h4>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                  Khai báo đăng ký tạm trú, đăng ký thường trú hoặc thông báo lưu trú tạm thời khi có người đến gia đình.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 pt-2 border-t border-slate-100">
                <span>Mức độ 3</span>
                <span className="hover:underline cursor-pointer">Chi tiết &rarr;</span>
              </div>
            </div>

            {/* Block 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2">Thẻ căn cước công dân</h4>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                  Đăng ký lịch hẹn cấp căn cước công dân trực tuyến, khai báo thông tin trực tiếp để giảm thiểu thời gian chờ đợi.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 pt-2 border-t border-slate-100">
                <span>Mức độ 3</span>
                <span className="hover:underline cursor-pointer">Chi tiết &rarr;</span>
              </div>
            </div>

            {/* Block 5 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <h4 className="font-bold text-slate-900 text-base mb-2">Cấp hộ chiếu phổ thông</h4>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">
                  Nộp hồ sơ xin cấp mới hoặc đổi hộ chiếu phổ thông tại công an tỉnh hoặc Cục Quản lý Xuất nhập cảnh trực tuyến.
                </p>
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-blue-700 pt-2 border-t border-slate-100">
                <span>Mức độ 4</span>
                <span className="hover:underline cursor-pointer">Chi tiết &rarr;</span>
              </div>
            </div>

            {/* Block 6 - Placeholder for demo explanation */}
            <div className="bg-[#eff6ff] rounded-xl border-2 border-dashed border-blue-200 p-5 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="font-bold text-blue-900 text-base flex items-center gap-1.5">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Thông tin Trải nghiệm
                </h4>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Ở góc dưới bên phải của màn hình, có một nút nổi bong bóng trò chuyện. Hãy bấm vào đó để bắt đầu trao đổi với trợ lý ảo trực tuyến.
                </p>
                <p className="text-slate-600 text-xs leading-relaxed font-semibold">
                  Luồng demo gợi ý:
                </p>
                <ol className="text-slate-600 text-xs list-decimal pl-4 space-y-1">
                  <li>Tìm kiếm thủ tục đăng ký kết hôn.</li>
                  <li>Trả lời các câu hỏi làm rõ.</li>
                  <li>Kiểm tra danh sách tài liệu cần chuẩn bị.</li>
                  <li>Điền thử biểu mẫu và nộp hồ sơ ảo.</li>
                </ol>
              </div>
              <div className="text-xs font-medium text-blue-700 pt-2 text-right">
                <span>AI Assistant Widget Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics section for realistic look */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider mb-6 text-center">
            TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ TRỰC TUYẾN
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-extrabold text-blue-700">12,504</div>
              <div className="text-xs text-slate-500 font-medium">Hồ sơ đã tiếp nhận</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-extrabold text-green-600">11,980</div>
              <div className="text-xs text-slate-500 font-medium">Hồ sơ đã giải quyết</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-extrabold text-amber-500">452</div>
              <div className="text-xs text-slate-500 font-medium">Hồ sơ đang xử lý</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl md:text-3xl font-extrabold text-slate-700">99.2%</div>
              <div className="text-xs text-slate-500 font-medium">Hài lòng của người dân</div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-10 mt-12 text-sm border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-between">
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base uppercase">
                HỆ THỐNG DỊCH VỤ CÔNG MÔ PHỎNG
              </h4>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                Được phát triển trong khuôn khổ dự án &quot;Trợ lý Thủ tục Hành chính&quot; AI-Native. Hệ thống giúp tối ưu hóa và đơn giản hóa thủ tục hành chính công bằng công nghệ trí tuệ nhân tạo.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="text-white font-bold text-base uppercase">Bản quyền thông tin</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nội dung quy trình và thủ tục được mô phỏng dựa trên dữ liệu công khai trên Cổng Dịch vụ công quốc gia Việt Nam (dichvucong.gov.vn).
              </p>
              <p className="text-xs text-amber-500 font-medium">
                * Lưu ý: Mọi giao dịch, hồ sơ phát sinh trên website này chỉ có tính chất thử nghiệm phục vụ demo kỹ thuật.
              </p>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>&copy; {new Date().getFullYear()} AI Public Service Assistant Team. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/" className="hover:underline hover:text-slate-300">
                Giao diện chính
              </Link>
              <span>·</span>
              <Link href="/sources" className="hover:underline hover:text-slate-300">
                Nguồn dữ liệu
              </Link>
              <span>·</span>
              <Link href="/admin" className="hover:underline hover:text-slate-300">
                Trang quản trị
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Widget Embedding Script */}
      <Script
        src="/widget.js"
        strategy="afterInteractive"
        data-api-key="demo-key"
        data-theme="light"
        data-position="bottom-right"
      />
    </div>
  );
}