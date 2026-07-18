# VN AI Innovation — Trợ lý Thủ tục Hành chính (AI Public Service Assistant)

Trợ lý AI hướng dẫn người dân và doanh nghiệp thực hiện thủ tục hành chính công: hỏi đáp bằng văn bản hoặc **giọng nói tiếng Việt**, sinh danh sách giấy tờ kèm cơ sở pháp lý, điền biểu mẫu động, **chặn lỗi logic ngay tại biểu mẫu trước khi nộp**, xuất tờ khai PDF đúng thể thức và chuyển hồ sơ cho cán bộ một cửa xét duyệt.

> 📂 **Toàn bộ mã nguồn ứng dụng nằm tại [`projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/`](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/)** — xem [README của ứng dụng](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/README.md) để biết hướng dẫn chạy chi tiết, biến môi trường và kịch bản demo đầy đủ.

---

## Điểm nổi bật

- **AI 3 giai đoạn được kiểm soát chặt (grounded):** nhận diện ý định → khảo sát bằng câu hỏi động lấy từ CSDL quy định → xác thực bằng Rule Engine thuần định tính. AI chỉ dịch mã lỗi thành giải thích tiếng Việt thân thiện, **không bao giờ tự đưa ra quyết định pháp lý**.
- **Chặn lỗi trước khi nộp:** người dân bị giữ lại ở trang biểu mẫu khi dữ liệu còn sai — banner liệt kê lỗi, bấm vào lỗi nhảy thẳng tới trường cần sửa, kèm hướng dẫn khắc phục theo quy định và nút nghe giải thích bằng giọng nói.
- **Giọng nói hai chiều:** nhập bằng mic (STT Whisper tiếng Việt, ghi âm WAV 16 kHz) và nghe hướng dẫn (TTS VITs, có cache bền vững + pre-generation).
- **Luồng nghiệp vụ đầy đủ:** nộp hồ sơ → cán bộ phê duyệt / trả lại kèm lý do → người dân sửa và nộp lại; quản trị phiên bản biểu mẫu (v1.0 → v2.0) với di chuyển dữ liệu an toàn.
- **Danh mục theo đối tượng:** Công dân / Doanh nghiệp (bao gồm luồng hộ kinh doanh), cùng widget nhúng cho cổng Dịch vụ công.

## Công nghệ

Next.js 16 (App Router) · Prisma 5 + PostgreSQL · Docker · FPT AI Marketplace (LLM `DeepSeek-V4-Flash`, STT `FPT.AI-whisper-large-v3-turbo`, TTS `FPT.AI-VITs`) qua endpoint tương thích OpenAI · Vitest.

Không có khóa API vẫn chạy được đầy đủ luồng demo với `AI_PROVIDER=mock`.

## Chạy nhanh (local)

```bash
cd projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22
cp .env.example .env      # chỉnh DATABASE_URL / ADMIN_TOKEN nếu cần
npm install
docker compose up -d db
npx prisma db push
npm run seed              # dữ liệu demo (form v1.0 + change request chờ duyệt)
npm run dev               # http://localhost:3000
```

Chạy kiểm thử: `npm test` (trong thư mục ứng dụng).

## Cấu trúc repo

| Đường dẫn | Nội dung |
| --- | --- |
| [`projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/`](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/) | **Ứng dụng chính** (Next.js + Prisma + tests + Dockerfile) |
| [`render.yaml`](render.yaml) | Blueprint triển khai Render (phải nằm ở gốc repo, trỏ `rootDir` vào ứng dụng) |
| [`design.md`](design.md), [`research.md`](research.md) | Tài liệu thiết kế & nghiên cứu trong quá trình xây dựng |
| [`_HUONG_DAN.md`](_HUONG_DAN.md), [`_KE_HOACH_72_FILE.md`](_KE_HOACH_72_FILE.md), [`_PROMPT_BUILD_AI_PUBLIC_SERVICE.md`](_PROMPT_BUILD_AI_PUBLIC_SERVICE.md) | Hồ sơ kế hoạch / prompt phục vụ cuộc thi |
| `.github/workflows/ci.yml` | CI chạy kiểm thử tự động |

## Tài liệu

- [Kịch bản demo 3 phút](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/docs/DEMO_SCRIPT.md)
- [Kiến trúc hệ thống](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/docs/ARCHITECTURE.md)
- [Tóm tắt dự án một trang](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/docs/ONE_PAGER.md)
- [Đặc tả API (OpenAPI)](projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22/openapi.yaml)

## Triển khai

Repo được cấu hình sẵn để deploy lên **Render** bằng Blueprint: kết nối repo trên Render Dashboard, Render đọc `render.yaml` ở gốc, tự tạo PostgreSQL và web service Docker. Các biến nhạy cảm (`OPENAI_API_KEY` / khóa theo từng dịch vụ, `ADMIN_TOKEN`) chỉ đặt trên Dashboard — không commit vào mã nguồn.

## Miễn trừ trách nhiệm

Dữ liệu thủ tục trong hệ thống được số hóa từ nguồn thông tin công khai, chỉ phục vụ trình diễn công nghệ; ứng dụng **không** kết nối với CSDL quốc gia hay các Cổng Dịch vụ công chính thức.
