# Kịch bản Demo 3 phút — AI-Guided Public Service Procedures

> Mục tiêu: trong 3 phút chạm đủ 5 điểm chấm — **chính xác so với quy định**,
> **phát hiện lỗi trước khi nộp**, **tích hợp**, **UX cho người dân + giọng nói**,
> **kiến trúc AI-native**. Mỗi mốc dưới đây ghi rõ nó "ăn" tiêu chí nào.

---

## 0. Chuẩn bị trước khi lên sân khấu (off-camera)

```bash
cd projects/build_a_full_stack_web_app_ai_guided_pub_4eaf5f22
# lần đầu trên máy mới: cp .env.example .env
docker compose up -d db
npx prisma db push       # bắt buộc nếu volume DB mới tạo (nếu không seed sẽ lỗi P2021)
npm run db:seed          # đưa DB về trạng thái demo: form 1.0 ACTIVE, 1 change-request PENDING
npm run dev              # http://localhost:3000
```

- **Mở sẵn 2 tab:** Tab A = `http://localhost:3000` · Tab B = `http://localhost:3000/admin`.
- **Warm cả hai tab** (bấm thử 1 lần) để không dính cold-start giữa demo.
- Lấy `ADMIN_TOKEN` trong file `.env` (dòng `ADMIN_TOKEN=...`) — dán sẵn vào clipboard cho phần admin.
- Nếu vừa chạy thử xong: chạy lại `npm run db:seed` để reset về v1.0 + CR chờ duyệt.
- Câu chốt an toàn: nếu một bước lỗi, nói *"phần này em có bản test tự động chứng minh"* rồi đi tiếp — đừng dừng sửa live.

---

## 1. (0:00 – 0:25) Mở đầu + xác định thủ tục — *tiêu chí: AI-native, UX*

**Thao tác:** Tab A, trang chủ → gõ vào ô tìm kiếm: **`Tôi muốn đăng ký kết hôn`** → Enter.

**Lời thoại:**
> "Người dân chỉ cần nói nhu cầu bằng ngôn ngữ tự nhiên. Hệ thống KHÔNG phải chatbot
> trả lời chung chung — nó phân loại nhu cầu, rồi bám vào dữ liệu thủ tục có cấu trúc."

**Chỉ vào màn hình:** card **"Đăng ký kết hôn — độ tin cậy 95%"** + link **"Nguồn"**.
> "Độ tin cậy hiện rõ, và có link tới đúng trang thủ tục trên Cổng Dịch vụ công Quốc gia —
> mọi câu trả lời đều truy được về nguồn chính thức."

→ Bấm **"Đúng, bắt đầu thủ tục này"**.

---

## 2. (0:25 – 1:05) Hỏi làm rõ + checklist có căn cứ — *tiêu chí: chính xác so với quy định*

**Thao tác:** trả lời 4 câu hỏi (bấm nút, không gõ):
1. Yếu tố nước ngoài? → **Không**
2. Đã từng kết hôn? → **Không**
3. Tỉnh/thành? → chọn **Hà Nội** → **Xác nhận**
4. Nộp trực tuyến/trực tiếp? → **Trực tuyến**

**Lời thoại (trong lúc bấm):**
> "Các câu hỏi này lấy từ database qua một state machine — KHÔNG gọi AI cho từng bước,
> nên nhanh và rẻ. Người dùng có thể bấm *Sửa câu trả lời* bất kỳ lúc nào."

→ Hệ thống báo *"Đã thu thập đủ thông tin!"* → bấm **"Xem danh sách giấy tờ"**.

**Ở trang checklist — ĐÂY LÀ ĐIỂM ĂN TIÊU CHÍ SỐ 1, chỉ tay vào từng chỗ:**
> - "CCCD hai bên ghi rõ **Xuất trình (không nộp)** — đúng thực tế, không bắt nộp bản sao."
> - "Giấy tờ cư trú: **Cơ quan tự tra cứu CSDL dân cư — người dân không cần nộp** — đúng
>   theo Nghị định 104/2022 áp dụng từ 01/01/2023."
> - "Mỗi bước có **ví dụ minh họa**, và cuối trang là **Căn cứ pháp lý**: Luật Hộ tịch 2014,
>   NĐ 123/2015, TT 04/2020, NĐ 104/2022."

---

## 3. (1:05 – 1:50) Điền form động + kiểm tra trước khi nộp — *tiêu chí: phát hiện lỗi (điểm mạnh nhất)*

**Thao tác:** bấm **"Điền biểu mẫu"** → form v1.0 hiện ra (đã prefill tỉnh + kênh nộp từ câu trả lời).

**Lời thoại:**
> "Form này KHÔNG viết cứng trong code — nó sinh ra từ JSON schema trong database.
> Các thông tin đã trả lời được điền sẵn."

**Điền CỐ Ý SAI để bung lỗi (đây là màn ăn điểm):**
- Họ tên nam/nữ: điền bừa
- **Ngày sinh nữ: để TRỐNG**
- **CCCD nam: gõ `123`** (sai định dạng)
- Chọn "Đã từng kết hôn: **Có**" → điền số lần **2** → đổi lại thành **"Chưa"** (tạo mâu thuẫn)

→ Bấm **"Lưu và kiểm tra hồ sơ"**.

**Chỉ vào trang kết quả — bắt ĐÚNG 3 lỗi:**
> "Hệ thống bắt chính xác 3 lỗi TRƯỚC khi nộp:
> 1. Thiếu ngày sinh nữ · 2. CCCD sai định dạng (phải 12 số) ·
> 3. Mâu thuẫn: 'chưa từng kết hôn' nhưng có số lần kết hôn."

**Câu chốt quan trọng nhất về kiến trúc:**
> "Toàn bộ việc kiểm tra này do **rule engine thuần TypeScript** làm — **KHÔNG dùng AI**.
> AI chỉ nhận **mã lỗi** (không thấy dữ liệu cá nhân thật) rồi diễn giải cho dễ hiểu —
> xem dòng *'AI chỉ giải thích mã lỗi — nội dung pháp lý lấy từ cơ sở dữ liệu'*."

**(Tùy chọn, nếu còn thời gian) Kết quả cuối của luồng:** khi hồ sơ đã hợp lệ, trang
kết quả hiển thị **tờ khai đăng ký kết hôn điền sẵn** đúng thể thức văn bản (quốc hiệu,
bảng bên nam/bên nữ, ngày ký, chữ ký) kèm nút **"Xuất PDF"** in đúng khổ A4:
> "Người dân không phải chép tay lại gì cả — hệ thống điền sẵn tờ khai và xuất PDF
> mang tới UBND. Đây là đầu ra thật của cả luồng số hóa."

---

## 4. (1:50 – 2:35) Mô phỏng thay đổi nghị định — *tiêu chí: chính xác + kiến trúc động*

**Thao tác:** chuyển sang **Tab B (`/admin`)** → dán `ADMIN_TOKEN` → **"Tải dữ liệu"**.

**Lời thoại (trong lúc tải):**
> "Khi quy định thay đổi, hệ thống KHÔNG sửa đè bản cũ mà tạo phiên bản mới, và
> cán bộ phải phê duyệt — AI không tự ý thay đổi nội dung pháp lý."

→ Kéo tới mục **"Yêu cầu Thay đổi quy định"** → chỉ vào **bảng diff**:
> "Đề xuất v2.0: thêm *nơi thường trú*, *nơi tạm trú*, *số điện thoại*; bỏ *nơi cư trú*."

→ Bấm **"Phê duyệt & kích hoạt"** → báo thành công.

**Quay lại Tab A**, mở lại form kết hôn (hoặc `/sources`):
> "Ngay lập tức form chuyển sang **v2.0 với các trường mới — KHÔNG sửa một dòng code
> frontend nào**. Đây là bằng chứng kiến trúc thật sự linh hoạt, sẵn sàng cho pilot."

---

## 5. (2:35 – 3:00) Tích hợp + fallback — *tiêu chí: tích hợp + độ bền*

**Thao tác:** Tab A → footer → **"Bàn thử nghiệm Widget"** (`/widget-demo`).

**Lời thoại:**
> "Toàn bộ trợ lý này nhúng được vào BẤT KỲ cổng dịch vụ công nào chỉ bằng một dòng
> script." → bấm bong bóng chat góc phải → trợ lý mở ra ngay trong trang cổng mô phỏng.

**Câu chốt cuối (nói trong lúc widget mở):**
> "Và điểm cuối: cả bản demo này chạy **không cần một API key nào** — có provider mock
> và cơ chế fallback, nên khi nhà cung cấp AI lỗi, người dân **vẫn** tra được thủ tục,
> xem giấy tờ, điền form và kiểm tra lỗi. Sản phẩm không bao giờ 'chết' vì AI."

> **Kết:** "Tóm lại: AI hiểu người dân, database giữ tính chính xác, rule engine bắt lỗi,
> kiến trúc sẵn sàng nối dữ liệu thật. Cảm ơn ban giám khảo."

---

## Bản đồ nhanh: mốc demo → tiêu chí chấm

| Mốc | Cho ban giám khảo thấy | Tiêu chí |
|---|---|---|
| 1 | Hiểu ngôn ngữ tự nhiên + nguồn chính thức | AI-native, UX |
| 2 | Checklist theo NĐ 104/2022 + căn cứ pháp lý | Chính xác so với quy định |
| 3 | Bắt đúng 3 lỗi, AI chỉ thấy mã lỗi | Phát hiện lỗi, an toàn/grounding |
| 4 | Duyệt v1.0→v2.0 live, không sửa code | Chính xác + kiến trúc động |
| 5 | Widget nhúng + fallback không cần key | Tích hợp + độ bền |

## Nếu cháy giờ (rút gọn còn ~2 phút)
Giữ mốc **1 → 3 → 4**. Bỏ phần điền form thủ công ở mốc 3 (dùng dữ liệu có sẵn),
gộp mốc 5 thành một câu nói. Ba mốc đó đã phủ cả 5 tiêu chí.

## Câu hỏi ban giám khảo hay hỏi + trả lời
- *"Dữ liệu có thật không?"* → "Dữ liệu demo chuẩn hóa từ nguồn công khai trên Cổng DVC
  Quốc gia; hệ thống có sẵn lớp `GovernmentApiProvider` để nối dữ liệu thật khi được cấp quyền —
  chỉ đổi một provider, không sửa frontend."
- *"Có hỗ trợ doanh nghiệp không?"* → "Có. Danh mục chia hai đối tượng **Công dân** và
  **Doanh nghiệp** ngay trên trang chủ; demo sẵn thủ tục *Đăng ký thành lập hộ kinh doanh*
  theo Nghị định 168/2025/NĐ-CP (nộp cấp xã, 3 ngày làm việc) với đầy đủ luồng: hỏi làm rõ →
  checklist có điều kiện → form động → rule engine bắt lỗi → tờ khai điền sẵn + PDF. Thử gõ
  *'Tôi muốn mở cửa hàng tạp hóa'* — AI nhận diện đúng thủ tục."
- *"AI có tự bịa quy định không?"* → "Không. AI chỉ phân loại nhu cầu và diễn giải mã lỗi.
  Giấy tờ, phí, biểu mẫu, căn cứ pháp lý đều lấy từ database + rule engine."
- *"Chịu tải nhiều người cùng lúc không?"* → "Có rate-limit, idempotency key và cache theo
  phiên bản; validation không gọi AI nên gần như miễn phí và tức thời."
