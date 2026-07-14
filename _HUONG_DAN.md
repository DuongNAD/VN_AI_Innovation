# 🏆 VN AI Innovation — Folder chạy Genius để đi thi

Mở **đúng folder này** bằng Antigravity → gõ `/genius` + nội dung → Genius (6 agent)
tự research → design → code → test → review, và **ghi thẳng kết quả vào folder này**.

---

## ✅ Trước khi thi (kiểm 30 giây)

1. Mở Antigravity → **File → Open Folder** → chọn folder `VN_AI_Innovation` này.
   (App tự đăng ký project, `/genius` xuất hiện trong menu `/`.)
2. Vào **Customizations → Installed MCP Servers**: cả `genius` (18 tools) và
   `genius-debug` (5 tools) phải có **chấm xanh + gạt bật**.
3. Có mạng (agy/gemini + codex + claude gọi qua CLI local).
4. Gõ thử `/` trong chat → thấy `genius` trong danh sách là OK.
5. **2 env bắt buộc bật** (đã kiểm chứng qua lần chạy thử 14/07): mở
   `~/.gemini/config/mcp_config.json`, trong server `genius` → mục `"env"` thêm:
   ```json
   "GENIUS_PROJECT_GATE": "1",
   "GENIUS_CLI_TIMEOUT": "1800"
   ```
   - `GENIUS_PROJECT_GATE=1`: sau khi code xong, Genius chạy **thật**
     `npm install/test/lint/build` của sản phẩm (project Node/Next.js) và
     **chặn job báo "hoàn thành ảo"** khi test/lint/build đỏ — lần chạy thử
     chính nhờ gate này mà bắt được 3 lỗi thật.
   - `GENIUS_CLI_TIMEOUT=1800`: call model chậm có 30 phút thay vì 10 —
     tránh job chết oan giữa stage code (đã xảy ra ở lần thử đầu).
   Sửa xong: tắt/bật lại server `genius` trong Customizations → MCP.

> Không cần tự bật server nào. Lần build đầu tiên Genius **tự khởi động** các
> skill server (mất thêm ~30–45s) — cứ để nó chạy.

---

## 🔨 BUILD — làm dự án mới

Chỉ cần gõ `/genius` rồi **dán/mô tả nội dung dự án**. Agent sẽ tự dịch sang
"golden prompt" tiếng Anh và chạy pipeline `custom`.

```
/genius Làm một web API quản lý công việc (TODO) bằng FastAPI:
thêm/sửa/xoá/liệt kê task, lưu SQLite, có test. Chạy được bằng uvicorn.
```

Càng nói rõ 3 thứ này thì kết quả càng đúng ý:
- **Làm gì** (mục tiêu 1 câu) + **ngôn ngữ/framework**.
- **Hành vi cụ thể**: input → output mẫu, lỗi thì báo sao.
- **"Xong khi..."**: lệnh chạy + kết quả mong đợi (vd `pytest` pass).

Agent sẽ báo tiến độ (`current_stage`): research → design → **code (lâu nhất, ~10ph)**
→ review → deploy. Xong sẽ tóm tắt + kết luận review, **file nằm ngay trong folder này**.

> Mẹo: nếu muốn duyệt từng bước, thêm câu "duyệt từng stage" → agent bật
> `require_approval` và dừng chờ bạn OK ở mỗi chặng.

---

## 🐞 DEBUG — vừa làm xong nhưng SAI

KHÔNG chạy lại từ đầu. Chỉ cần nói cái sai — agent vào **vòng debug nhanh** (1 agent),
sửa tại chỗ file trong folder này:

```
/genius tool vừa làm đếm từ tiếng Việt bị sai, "xin chào các bạn" ra 5 từ,
phải ra 4. Đây là output: <dán output/lỗi>
```

Dán được càng nhiều bằng chứng càng tốt: **lỗi/traceback**, **input đã thử**,
**kết quả mong đợi**. Agent đọc file → `gdbg_code`/`gdbg_review` sửa → chạy lại →
báo diff. Muốn khoá lại bằng test thì bảo "thêm test cho lỗi này".

---

## 📂 Kết quả nằm đâu

Ngay trong folder này sau khi build:
- **Code dự án** + thư mục `tests/`
- `research.md`, `design.md`, `plan.md`, `review.md`, `audit.md`, `deploy.md`
  (Genius tự tạo — chính là "hồ sơ quá trình", nộp kèm rất hợp cho cuộc thi AI)
- Trong `review.md` chú ý 3 mục: **Verification coverage** (file nào được chạy
  test thật), **Project gates** (kết quả npm test/lint/build) và
  **Release readiness** (`release-ready: YES/NO` — YES mới đáng nộp).
- File hướng dẫn này (`_HUONG_DAN.md`) và `.agents/` **không bị đụng tới**.

---

## 🚑 Sự cố thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| Gõ `/genius` không ra | Chưa Open đúng folder này, hoặc chưa có `.agents/skills/genius.md`. Mở lại folder. |
| "tools unavailable" | Bật lại 2 server `genius` + `genius-debug` ở Customizations → MCP, rồi thử lại. |
| Build "xong" mà không có file | Hiếm — do workspace sai. Skill đã ghim đường dẫn tuyệt đối của folder; kiểm `workspace` trong status có trỏ về folder này không. |
| Đứng im lâu ở stage đầu | Lần đầu đang boot server (~45s). Chờ, rồi poll lại status. |
| Muốn build lại từ đầu | Build mới sẽ **ghi đè** báo cáo cũ (bản cũ lưu `.bak`). Copy đi nơi khác nếu cần giữ. |

---

## ⚙️ Chi tiết kỹ thuật (khỏi cần đọc lúc thi)

- Skill điều khiển: `.agents/skills/genius.md` (đã ghim `workspace` = đường dẫn
  tuyệt đối folder này).
- Pipeline `custom`: plan-first Claude Opus → codex-gpt5.6-sol debate →
  gemini-3.5-flash code+test → codex-gpt5.6-sol final review.
- Model/effort cấu hình trong `~/.gemini/config/mcp_config.json` (server `genius`).
- Nếu đổi chỗ folder: sửa 1 dòng đường dẫn tuyệt đối trong `.agents/skills/genius.md`.
