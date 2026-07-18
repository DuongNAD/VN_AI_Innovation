# public-admin-assistant (Trợ lý Thủ tục Hành chính)

Trợ lý AI hướng dẫn thủ tục hành chính công trực quan, thông minh và dễ tiếp cận cho người dân Việt Nam.

## Đường dẫn trực tuyến (LIVE URL)

**https://<service>.onrender.com**

> [!IMPORTANT]
> **LƯU Ý QUAN TRỌNG:** Vui lòng dán địa chỉ URL thực tế của dịch vụ Render sau khi triển khai hoàn tất vào vị trí này để phục vụ quá trình chấm điểm.

---

## Kịch bản Demo 3 phút (3-Minute Demo Script)

Thực hiện theo kịch bản đường dẫn trải nghiệm mẫu dưới đây để kiểm tra các tính năng chính của hệ thống:

1. **Trang chủ (`/`):** Khởi đầu từ trang chủ với giao diện tìm kiếm đơn giản và thân thiện với mọi đối tượng người dùng.
2. **Giao diện trò chuyện (`/chat`):** Nhập yêu cầu bằng văn bản hoặc giọng nói: *"Tôi muốn đăng ký kết hôn"* (hoặc bấm biểu tượng mic để nói trực tiếp).
3. **Câu hỏi làm rõ:** Trả lời các câu hỏi động từ cơ sở dữ liệu (ví dụ: yếu tố nước ngoài, tình trạng hôn nhân trước đây) để hệ thống xác định hồ sơ phù hợp.
4. **Danh sách hồ sơ cần chuẩn bị (`/checklist`):** 
   - Xem danh sách các tài liệu cần chuẩn bị cụ thể kèm theo **cơ sở pháp lý** chi tiết cho từng loại giấy tờ.
   - Chú ý nhãn **`SYSTEM_LOOKUP`** (Cơ quan tự tra cứu CSDL dân cư) hiển thị trên các giấy tờ như thông tin cư trú (người dân không cần nộp các giấy tờ này).
5. **Điền biểu mẫu động (`/form/{id}`):** Chuyển sang điền biểu mẫu trực tuyến với dữ liệu đã được tự động điền sẵn dựa trên các câu trả lời từ phần trò chuyện trước đó.
6. **Chặn lỗi ngay tại biểu mẫu:**
   - Bấm **"Lưu và kiểm tra hồ sơ"** khi dữ liệu còn sai: hệ thống **giữ người dân ở lại trang biểu mẫu**, lưu bản nháp và hiển thị **3 lỗi logic chuẩn (canonical errors)**: thiếu ngày sinh của bên nữ, định dạng thẻ CCCD nam không hợp lệ, và mâu thuẫn thông tin (chưa kết hôn lần nào nhưng số lần kết hôn bằng 2).
   - Banner đỏ liệt kê từng lỗi — **bấm vào lỗi là nhảy thẳng tới trường cần sửa**, con trỏ tự đứng ở lỗi đầu tiên; dưới mỗi trường có hướng dẫn **"Cách khắc phục"** lấy từ quy định, kèm hộp **Trợ lý AI giải thích lỗi** (AI chỉ nhận mã lỗi, có nút nghe bằng giọng nói).
7. **Kiểm tra và nộp hồ sơ (`/result`):**
   - Khi đã sửa hết lỗi, hệ thống mới cho chuyển sang trang kết quả: thẻ xanh **"Hồ sơ hợp lệ"** cùng **tờ khai điền sẵn theo đúng thể thức văn bản hành chính** (quốc hiệu, bảng bên nam/bên nữ, chữ ký) và nút **"Xuất PDF"** để in/tải tờ khai khổ A4.
   - Bấm **"Nộp hồ sơ để cán bộ duyệt"** — hồ sơ chuyển trạng thái **"Đã nộp — chờ cán bộ xét duyệt"** và bị khóa chỉnh sửa trong thời gian chờ.
8. **Cán bộ xét duyệt hồ sơ (`/admin`):**
   - Mục **"Hồ sơ công dân chờ xét duyệt"** hiển thị hồ sơ vừa nộp với đầy đủ dữ liệu đã khai theo nhãn trường.
   - Cán bộ **"Phê duyệt hồ sơ"** hoặc **"Trả lại để bổ sung"** (bắt buộc ghi lý do). Hệ thống không cho phê duyệt hồ sơ còn lỗi theo quy định.
   - Người dân bấm **"Cập nhật trạng thái"** trên trang kết quả để nhận kết quả ngay: thẻ xanh **"Hồ sơ đã được phê duyệt"** (kèm tên cán bộ, thời điểm) hoặc thẻ vàng kèm **lý do trả lại** — sửa xong nộp lại được ngay.
9. **Phê duyệt thay đổi cấu hình (`/admin`):** 
   - Đăng nhập bằng mã `ADMIN_TOKEN` bạn đã tự cấu hình trong tệp `.env` hoặc trên Render dashboard (không bao giờ sử dụng hoặc công khai giá trị mặc định của nhà phát triển).
   - Tìm yêu cầu thay đổi (Change Request) đang chờ xử lý và nhấn phê duyệt để kích hoạt biểu mẫu phiên bản `v2.0` ngay lập tức.
10. **Thông báo cập nhật:** 
   - Quay lại biểu mẫu đang điền của người dùng. Hệ thống hiển thị banner thông báo biểu mẫu đã có phiên bản cập nhật mới (`v2.0`).
   - Người dân có thể thực hiện đối chiếu và di chuyển dữ liệu (data migration) an toàn mà không sợ mất thông tin đã điền.
11. **Trải nghiệm widget nhúng (`/widget-demo`):** Thử nghiệm toàn bộ luồng xử lý trên thông qua một widget bong bóng nổi được nhúng tích hợp ở góc dưới màn hình.

---

## Khởi động nhanh (QUICKSTART)

Chạy các lệnh sau để khởi động dự án trên môi trường cục bộ:

```bash
cp .env.example .env   # tạo cấu hình cục bộ (DB, token demo) — chỉnh sửa nếu cần
npm install
docker compose up -d db
npx prisma db push
npm run seed
npm run dev
```

Lệnh `npm run seed` chỉ dành cho dữ liệu demo. Khi `NODE_ENV=production`, hệ thống sẽ
từ chối chạy lệnh này để tránh ghi đè dữ liệu vận hành. Chỉ đặt
`ALLOW_DEMO_SEED=1` trong một môi trường production dùng thử, có chủ đích và có thể
xóa bỏ hoàn toàn.

Container production sử dụng `npm run db:bootstrap`: dữ liệu demo chỉ được nạp khi
cơ sở dữ liệu chưa có thủ tục nào. Khi đã có dữ liệu, bước bootstrap sẽ tự động bỏ
qua và không ghi đè cấu hình đang vận hành.

---

## Cấu hình môi trường (Environment Variables)

Mô tả các biến cấu hình trong tệp `.env.example`:

| Biến môi trường | Giá trị ví dụ / Mặc định | Ý nghĩa & Cơ chế hoạt động |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/psp` | Chuỗi kết nối tới cơ sở dữ liệu PostgreSQL. |
| `AI_PROVIDER` | `mock` | Trình cung cấp dịch vụ AI: `mock` (phản hồi mô phỏng cục bộ, không cần khóa API) hoặc `openai` (endpoint tương thích OpenAI — hiện dùng FPT AI Marketplace, yêu cầu khóa API). |
| `OPENAI_API_KEY` | `(Trống)` | Khóa API dùng chung cho cả 3 dịch vụ (fallback khi không đặt khóa riêng từng dịch vụ). |
| `LLM_API_KEY` / `STT_API_KEY` / `TTS_API_KEY` | `(Trống)` | Khóa API riêng từng dịch vụ, ưu tiên hơn `OPENAI_API_KEY` — phù hợp với FPT AI Marketplace vốn cấp khóa theo từng model. |
| `OPENAI_BASE_URL` | `https://mkp-api.fptcloud.com/v1` | URL gốc của endpoint tương thích OpenAI (HTTPS bắt buộc trong production; production chỉ cho phép `api.openai.com` hoặc `mkp-api.fptcloud.com`). |
| `LLM_MODEL` | `DeepSeek-V4-Flash` | Mô hình ngôn ngữ dùng cho phân loại ý định và giải thích lỗi logic. |
| `STT_MODEL` | `FPT.AI-whisper-large-v3-turbo` | Mô hình nhận dạng giọng nói thành văn bản (Whisper tinh chỉnh cho tiếng Việt). |
| `TTS_MODEL` | `FPT.AI-VITs` | Mô hình tổng hợp văn bản thành giọng nói tiếng Việt. |
| `LLM_DISABLE_THINKING` | `1` | Đặt `1` với các mô hình reasoning (DeepSeek-V4-Flash) để câu trả lời JSON nằm trong `message.content`; giữ `0` khi dùng OpenAI. |
| `TTS_VOICE_FEMALE` / `TTS_VOICE_MALE` | `banmai` / `leminh` | Tên giọng của nhà cung cấp TTS ứng với `vi-female` / `vi-male` (OpenAI: `nova`/`onyx`; FPT.AI-VITs: `banmai`, `thuminh`, `leminh`, `giahuy`…). |
| `ADMIN_TOKEN` | `<your-random-token>` | Mã token quản trị dùng để bảo vệ các đường dẫn `/admin`. Mỗi môi trường phải sử dụng một giá trị ngẫu nhiên, an toàn của riêng mình (tạo bằng lệnh `openssl rand -hex 32`). Hệ thống sẽ từ chối khởi động ở môi trường production nếu sử dụng giá trị mặc định của nhà phát triển hoặc độ dài ngắn hơn 24 ký tự. Vui lòng nhận mã này ngoài luồng (out-of-band) từ người vận hành và tuyệt đối không bao giờ được commit hoặc công bố công khai mã này. |
| `RATE_LIMIT_PER_MINUTE` | `10` | Số lượng yêu cầu tối đa được phép mỗi phút trên mỗi địa chỉ IP. |
| `TRUST_PROXY` | `0` | Cho phép tin tưởng các header từ proxy phía trước (`1` khi triển khai sau proxy đáng tin cậy như Render, `0` để tắt). |
| `SESSION_TTL_HOURS` | `24` | Thời gian hết hạn của phiên làm việc (tính bằng giờ). |
| `ALLOW_DEMO_SEED` | `0` | Chốt an toàn cho dữ liệu demo. Giữ `0` trên production; chỉ đặt `1` khi chủ động seed lại một môi trường production dùng thử và có thể xóa bỏ. |

> [!WARNING]
> **Lưu ý bảo mật:** Tệp `.env` được đưa vào `.gitignore` để tránh bị lộ lọt thông tin cấu hình nhạy cảm. Các giá trị ví dụ hoặc mặc định trong tài liệu không phải là thông tin đăng nhập thực tế và bắt buộc phải được thay thế bằng thông tin an toàn trước khi vận hành. Tuyệt đối không công bố các token bí mật trên tài liệu hướng dẫn, commit, ảnh chụp màn hình hay nhật ký hệ thống.

---

## Triển khai (DEPLOYMENT)

Dự án được cấu hình sẵn sàng để triển khai lên Render qua tệp `render.yaml`:

1. **Cấu hình trên Dashboard của Render:**
   - Liên kết cơ sở dữ liệu PostgreSQL tự động thông qua Render Blueprint.
   - Các biến cấu hình nhạy cảm như `OPENAI_API_KEY` và `ADMIN_TOKEN` chỉ được thiết lập trực tiếp thông qua Render Dashboard để đảm bảo tính bảo mật (không bao giờ đưa vào tệp `render.yaml` hay commit vào mã nguồn).
   - Mỗi lượt triển khai (deployment) phải có một token ngẫu nhiên riêng biệt. Bất kỳ token nào từng bị lộ hoặc vô tình cấu hình theo các giá trị ví dụ trong tài liệu phải được thay đổi (rotate) ngay lập tức.
   - Thiết lập `AI_PROVIDER` thành `openai` để sử dụng các mô hình OpenAI thực tế khi đánh giá.
   - Đặt `RATE_LIMIT_PER_MINUTE` thành `120` để tránh lỗi nghẽn (429) khi nhiều giám khảo cùng truy cập từ một địa chỉ IP NAT tại khu vực thi đấu.

2. **Lưu ý về Gói miễn phí (Free Plan) và hiện tượng ngủ đông (Spin-down):**
   - Các dịch vụ trên Render gói Free sẽ tự động ngủ đông sau 15 phút không hoạt động. Lần gọi đầu tiên sau đó sẽ gặp hiện tượng khởi động lạnh (cold start) mất khoảng 40 - 60 giây.
   - **Giải pháp giảm thiểu:**
     * Nâng cấp lên gói Starter $7/tháng của Render trong tuần chấm giải để ứng dụng luôn hoạt động.
     * Hoặc sử dụng dịch vụ giám sát miễn phí (như UptimeRobot) để tự động gửi yêu cầu ping đến đường dẫn `/` mỗi 5 phút một lần để giữ ứng dụng luôn chạy.
   - **QUAN TRỌNG:** Luôn thực hiện truy cập và tải trước URL ứng dụng (warm-up) ngay trước khi đến phiên chấm điểm của mình để đảm bảo trải nghiệm mượt mà nhất cho giám khảo.

---

## Tài liệu liên quan (Links)

- Sơ đồ & Tài liệu Kiến trúc chi tiết: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Bản tóm tắt dự án một trang: [docs/ONE_PAGER.md](docs/ONE_PAGER.md)
- Đặc tả API chuẩn: [openapi.yaml](openapi.yaml)
- Sơ đồ tương tác trực quan: [Trang Kiến Trúc](/architecture)

---

## Tuyên bố miễn trừ trách nhiệm (Disclaimer)

Dữ liệu thủ tục hành chính trong hệ thống demo này được số hóa và chuẩn hóa từ các nguồn thông tin công cộng. Ứng dụng này là phiên bản thử nghiệm phục vụ mục đích trình diễn công nghệ và **HOÀN TOÀN KHÔNG** có kết nối trực tiếp hay liên kết nghiệp vụ với hệ thống Cơ sở dữ liệu quốc gia hay các Cổng Dịch vụ công chính thức của Chính phủ.

---

## Cách chạy thử nghiệm (HOW TO TEST)

n/a (Dành cho tài liệu hướng dẫn)
