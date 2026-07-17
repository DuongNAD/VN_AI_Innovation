# Prompt gửi Antigravity để Genius build "AI-Guided Public Service Procedures"

Dán NGUYÊN KHỐI dưới đây vào một hội thoại MỚI trong project VN_AI_Innovation
(tốt nhất: gõ `/` → chọn **genius** từ menu rồi dán phần còn lại; nhưng kể cả
dán thẳng như text thường, phần chỉ dẫn đầu tiên vẫn ép agent gọi đúng tool).

---

/genius NHIỆM VỤ CỦA BẠN: điều khiển pipeline Genius qua MCP tools. KHÔNG tự lập kế hoạch, KHÔNG tự viết code, KHÔNG tạo implementation_plan.md, KHÔNG bấm gì vào planning mode. Làm đúng trình tự:

1. Gọi `genius_doctor`. Nếu có role NOT READY → in dòng lỗi và DỪNG.
2. Gọi `genius_orchestrate` với:
   - `pipeline`: "custom"
   - `workspace`: "/Users/duongnad/Documents/project/VN_AI_Innovation"
   - `approval_stages`: ["design"]
   - `prompt`: toàn bộ khối GOLDEN PROMPT bên dưới, NGUYÊN VĂN, không dịch, không rút gọn.
3. Poll `genius_orchestrate_status` mỗi ~20–30 giây. Khi `status = "awaiting_approval"` ở stage design: in NGUYÊN VĂN trường `plan` ra chat cho tôi đọc. Nếu tôi góp ý → gọi `genius_orchestrate_revise(job_id, feedback)` rồi chờ và in bản plan mới. CHỈ khi tôi nhắn "duyệt" mới gọi `genius_orchestrate_approve`.
4. Sau khi duyệt, tiếp tục poll tới `completed`/`failed`. Stage code có thể chạy NHIỀU GIỜ — cứ poll tiếp, báo `current_stage` mỗi lần đổi, đừng bỏ cuộc. Nếu status trả `interrupted` → báo tôi, không tự re-submit.
5. Khi `completed`: đọc artifacts từ `artifacts_ready` (research/design/review/audit/deploy), tóm tắt verdict của Final review, liệt kê cây file trong `projects/<slug>/`, và in các lệnh chạy thử trong ACCEPTANCE để tôi tự chạy.

GOLDEN PROMPT (pass verbatim as the `prompt` argument):

Build a full-stack web app 'AI-Guided Public Service Procedures': an AI-guided assistant that helps Vietnamese citizens identify the correct administrative procedure, get a case-specific document checklist and step-by-step guidance, fill dynamic forms, and catch errors BEFORE submission. The demo runs on seed/mock data normalized from public sources (dichvucong.gov.vn); the architecture must allow swapping in a real government data source later without touching the frontend.

FILES (AT MOST 65, ONE Next.js app — no separate backend service):
- Root: package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs, docker-compose.yml (postgres + redis), .env.example, README.md, openapi.yaml
- prisma/: schema.prisma, seed.ts
- src/lib/: rule-engine.ts; intake-machine.ts (DB-driven guided-intake state machine); form-migration.ts; cache.ts (in-memory default, Redis when REDIS_URL set); rate-limit.ts; idempotency.ts; usage-log.ts; providers/data-provider.ts (interface IProcedureDataProvider) + providers/mock-database-provider.ts + providers/government-api-provider.ts (stub that throws NOT_CONNECTED); providers/llm.ts + providers/stt.ts + providers/tts.ts (interface + deterministic Mock default + optional OpenAI-compatible impl selected by env)
- src/app/api/v1/: route handlers for exactly the 13 endpoints in BEHAVIOR §2
- src/app/ pages: / (home), /chat (guided intake with mic button), /checklist, /form/[applicationId] (dynamic form), /result (validation report), /sources (nguồn + phiên bản + ngày cập nhật), /admin (procedure/version list, change-request diff + approve, AI usage dashboard), /widget-demo (mock "Cổng Dịch vụ công (Mô phỏng)" page embedding the widget)
- src/components/: DynamicForm.tsx (renders JSON schema only — field types: text, textarea, number, date, select, radio, checkbox, file, province selector, conditional visibleWhen), chat/checklist/diff components as needed
- public/widget.js (embeddable script)
- Tests (vitest): tests/rule-engine.test.ts, tests/form-versioning.test.ts, tests/migration.test.ts

BEHAVIOR (exact):
1. Prisma models: procedures (code, name, sector, agency, status, source_url, last_checked_at), procedure_versions, forms, form_versions (version, schema_json, effective_from, effective_to, status), validation_rules (rule_type, rule_config_json, error_message, severity), document_requirements (condition_json, original_count, copy_count), clarifying_questions (question_text, field_type, options_json, order_number, condition_json), applications (pins form_version, status DRAFT, data_json), sessions (intent, current_step, answers_json, expires_at), ai_usage_logs (service_type, model, input_tokens, output_tokens, audio_seconds, latency_ms, estimated_cost, cache_hit), change_requests (old_version_id, proposed_data_json, diff_json, source_url, status, reviewed_by). Seed EXACTLY two procedures: MARRIAGE_REGISTRATION (domestic) and BIRTH_REGISTRATION — each with real dichvucong.gov.vn source_url, version, last_checked_at, its clarifying questions (marriage: foreign element? / province? / previously married? / online or in person?), document checklist incl. conditional DIVORCE_DOCUMENT requiredWhen previously_married=true, form v1.0 ACTIVE; for MARRIAGE_REGISTRATION also seed form v2.0 DRAFT (replaces field residence with permanent_address required + temporary_address optional, adds phone_number) and ONE pending change_request with a human-readable diff_json — this powers the live "regulatory update simulation" demo.
2. REST APIs, all JSON under /api/v1, errors as {"error":{"code","message"}} with proper 400/404/409/429: POST /procedures/search; POST /guided-intake/start; POST /guided-intake/:sessionId/answer; GET /guided-intake/:sessionId/guidance; GET /forms/:formCode/active; POST /forms/:formCode/validate; POST /applications; PUT /applications/:id; POST /applications/:id/migrate; POST /speech/transcribe; POST /speech/synthesize; GET /admin/change-requests; POST /admin/change-requests/:id/approve. Admin routes require header X-Admin-Token equal to env ADMIN_TOKEN.
3. Intent: POST /procedures/search {"message":"Tôi muốn đăng ký kết hôn","province":"Hà Nội"} → 200 {"procedure":{"code":"MARRIAGE_REGISTRATION",...},"confidence":>=0.9}. Classification is keyword/synonym-table first (kết hôn/marriage, khai sinh/birth...); the LLM provider is called ONLY when no keyword matches; every step of guided intake comes from clarifying_questions in the DB via the state machine — NEVER one LLM call per step.
4. Guidance: GET /guided-intake/:sessionId/guidance → resolved procedure + checklist with conditional documents applied from the session's answers + the 7 fixed steps (chuẩn bị hồ sơ → nhận kết quả) + agency, duration, fees + source_url + the disclaimer string "Dữ liệu demo được chuẩn hóa từ nguồn công khai. Hệ thống chưa kết nối trực tiếp với cơ sở dữ liệu nội bộ của cơ quan nhà nước."
5. Dynamic form: GET /forms/MARRIAGE_REGISTRATION/active returns the ACTIVE form_version by effective dates: {"formCode","version","effectiveFrom","fields":[{"id","label","type","required","visibleWhen"?,"options"?}]}. DynamicForm.tsx renders ONLY from this JSON — zero hardcoded administrative fields in JSX. Example conditional field: divorce_document (type file) visibleWhen {"field":"previously_married","operator":"equals","value":true}.
6. Validation: POST /forms/:formCode/validate {formVersion, data} runs the pure-TypeScript rule engine (NO LLM anywhere in validation): required, regex, date_not_after_today, date_after(field,compareWith), range, conditional required, cross-field conflict, conditional document. Canonical demo case — data {"female_birth_date":"","male_identity_number":"123","previously_married":false,"marriage_number":2} returns EXACTLY 3 errors: [{"field":"female_birth_date","code":"MISSING_REQUIRED"},{"field":"male_identity_number","code":"INVALID_FORMAT"} (rule ^[0-9]{12}$),{"code":"CONFLICT","fields":["previously_married","marriage_number"]}], each with a Vietnamese message and a fix suggestion. Backend always re-validates even though the form validates client-side.
7. Versioning & migration: applications pin their form_version. POST /admin/change-requests/:id/approve activates v2.0 (sets effective_from, closes v1.0's effective_to) → GET .../active immediately serves v2.0 with NO frontend change. POST /applications/:id/migrate copies compatible fields by id and returns {"migrated":[...],"needsConfirmation":[{"from":"residence","options":["permanent_address","temporary_address"]}]} — ambiguous fields are NEVER auto-guessed; the form page then asks the user to confirm and shows "Biểu mẫu đã được cập nhật theo quy định mới."
8. AI gateways: LLM/STT/TTS behind provider interfaces; defaults are deterministic mocks so the demo needs NO API key: MockLLM renders template explanations of rule-engine error codes and intent fallback; POST /speech/transcribe (multipart audio, max 60s/5MB) with MockSTT returns a canned transcript; POST /speech/synthesize returns audio with cache key hash(text+voice+speed+language) — a second identical call MUST return cache_hit=true and the same file. The chat UI's live voice uses the browser Web Speech API (vi-VN SpeechRecognition for mic, speechSynthesis for "Nghe nội dung") when available, so the stage demo works with real voice and zero keys; server gateways prove the swap-in architecture. STT runs only on explicit mic action; TTS only on the "Nghe nội dung" button — never automatic. Every provider call (and cache hit) writes one ai_usage_logs row; /admin shows totals per service.
9. Cross-cutting: rate limit 10 requests/min per session+IP → 429 with Retry-After; idempotency key sessionId+messageId on answer/validate/application POSTs replays the stored result instead of reprocessing; cache (memory default, Redis when REDIS_URL set) for procedure info, active form schema, guidance and TTS audio with version-scoped keys like marriage:hanoi:domestic:v2:vi so activating v3 naturally bypasses v2 entries. FALLBACK MODE: with AI_PROVIDER=mock or the LLM erroring, the ENTIRE core flow still works (keyword search → checklist → dynamic form → rule-engine validation) and the UI shows a "chế độ tiết kiệm" badge. Never send full personal data to the LLM — it only ever receives error codes and reduced context (e.g. {"errors":[{"field":"identity_number","code":"INVALID_LENGTH"}]}); no full ID numbers in logs. UI entirely Vietnamese, responsive, elderly-friendly (large type, plain wording); every legal-content screen shows source_url + version + last_checked_at + the disclaimer.
10. Widget: public/widget.js is a self-contained script embeddable as <script src=".../widget.js" data-api-key="demo-key" data-theme="light" data-position="bottom-right"> that injects a floating launcher opening the search → clarify → checklist → open-form flow against the same APIs; /widget-demo is a fake gov-portal page that embeds it and is clearly labeled "Mô phỏng".

CONSTRAINTS: TypeScript strict everywhere; Next.js 14+ App Router only (API route handlers; no NestJS, no second service); Prisma + PostgreSQL; Redis OPTIONAL — every cache/rate-limit driver has an in-memory default so `npm run dev` needs only Postgres; vitest for tests; Node 20; no paid API required to run any demo scenario; docker-compose only provides postgres and redis; no code comments explaining changes.

ACCEPTANCE (done when):
1. `npm install` then `npm run build` exit 0.
2. `npx vitest run` exit 0, covering: every rule type incl. the canonical 3-error demo case exactly; active-version selection by effective dates (v1.0 before approval, v2.0 after); migration copies compatible fields and flags residence as needsConfirmation without guessing.
3. `docker compose up -d` then `npx prisma migrate deploy` (or db push) then `npm run seed` exit 0; seeded rows carry source_url, version, last_checked_at.
4. With the dev server running: POST /api/v1/procedures/search {"message":"Tôi muốn đăng ký kết hôn"} → MARRIAGE_REGISTRATION; the canonical validate payload → exactly the 3 errors; GET /api/v1/forms/MARRIAGE_REGISTRATION/active → version "1.0"; POST /api/v1/admin/change-requests/<seeded-id>/approve with X-Admin-Token → subsequent GET active → "2.0" with the new fields, zero frontend edits.
5. All 8 pages render; /widget-demo shows the working embedded widget; openapi.yaml describes all 13 endpoints and is linked from the README and served by the app.
6. With AI_PROVIDER=mock and REDIS_URL unset, the full citizen flow works end-to-end (fallback proof, demo scenario 5).

NON-GOALS (explicitly out of scope — accepted risks, do not flag them): real government DB/API connection (interface + throwing stub only; the UI/README must NEVER claim a live government connection); citizen accounts/SSO/authentication (admin = the single X-Admin-Token env check); real cloud LLM/STT/TTS keys for the demo (mocks + browser Web Speech API); background job-queue workers (BullMQ), vector/semantic search, monitoring/alerting stacks, multi-language UI, a third procedure — these are README-roadmap items only; production IaC beyond docker-compose plus a short Vercel + Neon + Upstash deployment guide in the README.

ORIGINAL REQUEST (verbatim): "Hãy xây dựng một ứng dụng web full-stack có tên 'AI-Guided Public Service Procedures'. Mục tiêu: Tạo trợ lý AI hỗ trợ người dân xác định thủ tục hành chính, nhận checklist giấy tờ, hướng dẫn từng bước và kiểm tra thông tin trước khi nộp. Sản phẩm phải là một website hoạt động thật, không phải mockup. AI chỉ hỗ trợ hiểu câu hỏi, phân loại nhu cầu, hỏi câu làm rõ, diễn giải và giải thích lỗi; giấy tờ bắt buộc, mức phí, thời hạn, cơ quan giải quyết và biểu mẫu hiệu lực phải lấy từ database và rule engine, không do AI tự quyết. Validation không được phụ thuộc vào LLM. Không được tuyên bố hệ thống đã kết nối database Chính phủ. Bản demo sử dụng mock/seed data được chuẩn hóa từ nguồn công khai. Kiến trúc phải cho phép thay MockDatabaseProvider bằng GovernmentApiProvider khi được cấp API hoặc quyền truy cập."

---

## Ghi chú vận hành

- Thời gian dự kiến: research+design ~5–10 phút → dừng ở gate design chờ bạn duyệt
  (nhắn "duyệt" khi ưng plan; góp ý bằng tiếng Việt bình thường để nó revise).
  Stage code với ~60 file có thể chạy NHIỀU GIỜ. Job chạy trong tiến trình MCP
  server — đừng thoát Antigravity, đừng để máy sleep.
- Nếu hội thoại ngừng poll giữa chừng: job vẫn chạy; mở tin nhắn mới và nhắn
  "kiểm tra job <job_id> bằng genius_orchestrate_status".
- Kết quả nằm trong `projects/<slug>/` ngay trong folder này; report
  (research/design/review/audit/deploy.md) ở gốc workspace; hackathon mode đang
  bật nên sẽ có thêm `pitch.md` + `ai_collaboration_log.md`.
- (Tùy chọn, nên làm cho project Node) Thêm vào env của server `genius` trong
  `~/.gemini/config/mcp_config.json`:
  `"GENIUS_PROJECT_GATE": "1", "GENIUS_FULL_SUITE_GATE": "0"`
  rồi restart MCP servers — pipeline sẽ tự chạy `npm install` + `test`/`lint`/
  `build` của project và ghi kết quả vào review.md (report-only, không đánh
  fail job muộn). Mặc định pipeline chỉ thực thi được test Python, nên với
  project TypeScript đây là lớp kiểm chứng đáng giá.
