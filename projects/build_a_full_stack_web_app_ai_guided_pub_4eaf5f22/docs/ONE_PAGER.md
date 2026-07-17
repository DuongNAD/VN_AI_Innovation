# TRỢ LÝ THỦ TỤC HÀNH CHÍNH (AI PUBLIC SERVICE ASSISTANT)
## Tóm Tắt Dự Án (One-Pager)

### 1. VẤN ĐỀ (THE PROBLEM)
* **Người dân bối rối trong mê lộ thủ tục:** Quy trình hành chính trực tuyến phức tạp, biểu mẫu chứa nhiều thuật ngữ pháp lý và chuyên ngành khiến người dân khó tiếp cận.
* **Lỗi chỉ phát hiện sau khi đã nộp hồ sơ:** Người dân tự điền hồ sơ theo cảm tính, các sai sót thông tin hoặc thiếu giấy tờ đi kèm chỉ được cán bộ tiếp nhận phát hiện sau khi gửi, gây lãng phí thời gian và công sức đi lại nhiều lần.
* **Bỏ rơi nhóm đối tượng yếu thế:** Người lớn tuổi hoặc những người hạn chế về năng lực tiếp cận công nghệ bị cô lập và gặp nhiều trở ngại với các giao diện dịch vụ công trực tuyến khô khan hiện tại.

### 2. GIẢI PHÁP (THE SOLUTION)
Hệ thống Trợ lý AI Native 3 giai đoạn được kiểm soát chặt chẽ (Grounded 3-Stage AI Assistant):
1. **Giai đoạn 1 - Nhận diện Ý định (Intent Stage):** Tiếp nhận mô tả tự nhiên từ người dân (qua văn bản hoặc giọng nói), đối khớp từ khóa để định danh chính xác thủ tục hành chính cần thực hiện. LLM được giới hạn chỉ chọn mã thủ tục có sẵn trong cơ sở dữ liệu.
2. **Giai đoạn 2 - Khảo sát hướng dẫn (Intake & Guidance Stage):** Sử dụng máy trạng thái câu hỏi động dẫn dắt hoàn toàn bởi dữ liệu quy định có cấu trúc trong DB. Hệ thống không tạo hội thoại tự do nhằm loại bỏ hoàn toàn khả năng AI tự suy diễn hay hallucinate.
3. **Giai đoạn 3 - Xác thực trước nộp (Validation Stage):** Sử dụng bộ công cụ quy tắc (Rule Engine) thuần định tính để kiểm tra lỗi chính xác tuyệt đối. Mô hình AI chỉ đóng vai trò dịch các mã lỗi thô thành văn bản giải thích tiếng Việt thân thiện. **AI không bao giờ tự đưa ra quyết định pháp lý.**

### 3. ĐỐI TƯỢNG PHỤC VỤ (TARGET AUDIENCE)
* **Người dân lần đầu làm thủ tục:** Giúp họ chuẩn bị đầy đủ giấy tờ cần thiết và điền đúng biểu mẫu ngay từ đầu.
* **Người lớn tuổi / Hạn chế công nghệ:** Hỗ trợ giao diện giọng nói thân thiện qua cổng STT/TTS để tương tác tự nhiên.
* **Cán bộ bộ phận một cửa:** Giảm tải áp lực sàng lọc hồ sơ sai lệch, nâng cao năng suất xử lý thủ tục hành chính.
* **Đơn vị vận hành cổng Dịch vụ công (DVC):** Nhúng widget hỗ trợ trực tiếp mà không ảnh hưởng tới kiến trúc sẵn có.

### 4. LỘ TRÌNH TRIỂN KHAI (ROADMAP)
* **Giai đoạn 1 - Thử nghiệm (Pilot):**
  * Triển khai thí điểm tại 01 phường/xã đối với nhóm thủ tục Hộ tịch phổ biến (Đăng ký kết hôn, Đăng ký khai sinh).
  * Mục tiêu: Đo lường và tối ưu hóa tỷ lệ hồ sơ hợp lệ đạt chuẩn ngay từ lần nộp đầu tiên.
* **Giai đoạn 2 - Tích hợp Cổng Dịch vụ công (Integration):**
  * Tích hợp lên cổng Dịch vụ công của tỉnh thông qua widget thông minh dạng nhúng (`widget.js`).
  * Đồng bộ tự động danh mục thủ tục và biểu mẫu từ cổng quốc gia `dichvucong.gov.vn` qua `GovernmentApiProvider`.
* **Giai đoạn 3 - Mở rộng & Tối ưu (Scale-up):**
  * Mở rộng quy mô sang các lĩnh vực quản lý khác: Cư trú, Căn cước, và Xuất nhập cảnh.
  * Tích hợp đăng nhập một lần (SSO) qua định danh điện tử VNeID.
  * Thiết lập luồng tự động chuyển tiếp các hồ sơ phức tạp hoặc có tranh chấp pháp lý cho cán bộ chuyên môn giải quyết.

---

> [!NOTE]  
> **Tuyên bố miễn trừ trách nhiệm:** Hệ thống hiện tại sử dụng dữ liệu mô phỏng được chuẩn hóa từ các nguồn thông tin thủ tục hành chính công khai. Trợ lý chỉ mang tính chất hướng dẫn tham khảo và không có kết nối trực tiếp hoặc thay thế các cổng thông tin chính thức của Chính phủ.