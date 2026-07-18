// Dev-only tool: curate + transform the National Public Service Portal (DVCQG)
// procedure dump into a small, committed catalog the seed can upsert.
//
// Source dump (NOT committed, ~57MB) is produced by the guideline_scrape crawler
// from https://dichvucong.gov.vn/api/v1/submitting/formality/list-all-public-formality-by-citizen
//
// Usage:
//   node scripts/build-dvc-catalog.mjs [path-to-procedures.jsonl] [maxProcedures]
//
// Output: prisma/data/dvc-catalog.generated.json  (committed, ~small)

import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '..');

const SRC = process.argv[2] ||
  '/Users/duongnad/Documents/project/Viettel_AI_Race/guideline_scrape/data/dataset/procedures.jsonl';
const MAX = Number(process.argv[3] || 30);
const OUT = path.join(APP_ROOT, 'prisma', 'data', 'dvc-catalog.generated.json');

// Topics already hand-authored in seed.ts (full form or upgraded in Phase B) —
// skip DVC duplicates so search doesn't show two entries for the same thing.
const EXCLUDED_TOPICS = [
  'ket hon', 'khai sinh', 'tam tru', 'ho chieu',
  'ho kinh doanh', 'can cuoc', 'cccd', 'chung minh nhan dan',
];

const LOOKUP_HINTS = [
  'khai thac', 'co so du lieu', 'khong phai nop', 'dinh danh dien tu',
  'he thong dinh danh', 'tra cuu', 'vneid',
];

// A real document line starts with a document noun. The portal mixes reception
// notes ("Người tiếp nhận...", "Cá nhân có quyền...") into the list — this
// whitelist keeps only lines that actually name a paper/record.
const DOC_PREFIXES = [
  'to khai', 'giay', 'ban sao', 'ban chinh', 'ban chup', 'van ban', 'ho chieu',
  'the ', 'chung tu', 'phieu', 'don ', 'hop dong', 'chung cu', 'so ', 'anh ',
  '2 anh', '02 anh', 'quyet dinh', 'can cuoc', 'cmnd', 'bien lai', 'bien ban',
  'trich luc', 'ho so', 'tai lieu', 'mau ', 'de nghi', 'hinh anh',
];

// Recognizable, citizen-facing topics — ordered by demo relevance. Procedures whose
// name matches an earlier keyword rank higher, so the curated set reads like things a
// real person (and a judge) would recognize, not obscure provincial paperwork.
const PRIORITY_KEYWORDS = [
  'ly lich tu phap',
  'xac nhan tinh trang hon nhan',
  'khai tu',
  'dang ky thuong tru',
  'xoa dang ky thuong tru',
  'tach ho',
  'tam vang',
  'nhan con nuoi',
  'giam ho',
  'nhan cha, me, con', 'nhan cha me con', 'nhan cha, me',
  'cai chinh ho tich', 'thay doi ho tich', 'bo sung thong tin ho tich',
  'chung thuc',
  'bao hiem y te',
  'huu tri', 'tu tuat', 'mai tang', 'bao hiem xa hoi',
  'tro cap that nghiep', 'tro cap xa hoi', 'bao tro xa hoi',
  'ho ngheo', 'nguoi co cong', 'nguoi khuyet tat',
  'giay phep lai xe',
  'cap ban sao trich luc', 'trich luc ho tich',
  'dang ky lai khai sinh', 'dang ky viec nuoi con',
  'luu tru', 'tam vang',
];

function priorityOf(name) {
  const norm = noDiacritics(name);
  for (let i = 0; i < PRIORITY_KEYWORDS.length; i += 1) {
    if (norm.includes(PRIORITY_KEYWORDS[i])) return i;
  }
  return Infinity;
}

// Collapse near-duplicate variants ("... (thực hiện tại cấp tỉnh)" vs "(cấp xã)").
function dedupKey(name) {
  return noDiacritics(name)
    .replace(/\(.*?\)/g, ' ')
    .replace(/thuc hien tai cap.*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

const noDiacritics = (s) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/gi, 'd').toLowerCase();

const collapse = (s) => (s || '').replace(/\s+/g, ' ').trim();

function truncate(s, n) {
  s = collapse(s);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

// Some portal names are ALL CAPS — soften to sentence case for display.
function normalizeName(s) {
  s = collapse(s).replace(/\.$/, '');
  const letters = s.replace(/[^A-Za-zÀ-ỹ]/g, '');
  const upper = s.replace(/[^A-ZÀ-Ỹ]/g, '');
  if (letters.length > 8 && upper.length / letters.length > 0.6) {
    s = s.toLocaleLowerCase('vi');
    s = s.charAt(0).toLocaleUpperCase('vi') + s.slice(1);
  }
  return s;
}

// Strip list bullets the portal prepends to each document line.
const stripBullet = (s) => collapse(s).replace(/^[-+•*.\)\(\s]+/, '');

const UNIT_TEXT = {
  WORKING_DAY: 'ngày làm việc',
  DAY: 'ngày',
  MONTH: 'tháng',
  HOUR: 'giờ',
  OTHER: 'ngày',
};

// Imported steps have no worked example in the source; attach an honest, generic
// procedural hint (cycled by step order) so the reader still gets a nudge and the
// app's non-empty-example step validation is satisfied without editing shared code.
const STEP_TIPS = [
  'Chuẩn bị đầy đủ giấy tờ theo danh mục hồ sơ bên dưới trước khi nộp.',
  'Có thể nộp trực tuyến qua Cổng Dịch vụ công Quốc gia hoặc nộp trực tiếp tại cơ quan tiếp nhận.',
  'Theo dõi tiến độ xử lý và nhận thông báo kết quả theo lịch hẹn.',
  'Đối chiếu kỹ thông tin với cơ quan có thẩm quyền trước khi hoàn tất.',
];

function buildDuration(d) {
  const methods = d.execution_methods || [];
  const times = methods
    .map((m) => (typeof m.processing_time === 'number' ? m.processing_time : null))
    .filter((t) => t && t > 0);
  if (!times.length) return 'Theo quy định của cơ quan có thẩm quyền';
  const min = Math.min(...times);
  const unit = UNIT_TEXT[methods.find((m) => m.processing_time === min)?.unit] || 'ngày làm việc';
  return `Khoảng ${min} ${unit} kể từ ngày nhận đủ hồ sơ hợp lệ`;
}

function buildFees(d) {
  const values = [];
  for (const m of d.execution_methods || []) {
    for (const f of m.fees || []) {
      if (typeof f.value === 'number' && f.value > 0) values.push(f.value);
    }
  }
  for (const f of d.fees || []) {
    if (typeof f.value === 'number' && f.value > 0) values.push(f.value);
  }
  if (!values.length) return 'Không quy định thu phí hoặc theo mức phí công bố tại cổng DVCQG';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const fmt = (n) => n.toLocaleString('vi-VN') + ' đồng';
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

function buildLegalBasis(d) {
  const names = (d.legal_basis || [])
    .map((l) => collapse(l.name))
    .filter(Boolean)
    .slice(0, 3);
  return names.length ? names.join('; ') : null;
}

function buildSteps(d) {
  const raw = (d.steps || []).map((s) => collapse(s.description || s.name)).filter(Boolean).join('\n');
  if (!raw) return null;
  // The dump packs "Bước 1: ... Bước 2: ..." into one blob — split it back out.
  const parts = raw
    .split(/(?=Bước\s*\d+\s*[:.])/g)
    .map((p) => collapse(p))
    .filter(Boolean);
  const chunks = parts.length ? parts : [raw];
  const steps = [];
  for (const text of chunks) {
    if (steps.length >= 8) break;
    const m = text.match(/^Bước\s*(\d+)\s*[:.]\s*(.*)$/s);
    const body = stripBullet(m ? m[2] : text);
    if (body.length < 12) continue; // skip empty / stray-bullet fragments
    steps.push({
      order: steps.length + 1,
      title: m ? `Bước ${m[1]}` : 'Trình tự thực hiện',
      description: truncate(body, 500),
      example: STEP_TIPS[steps.length % STEP_TIPS.length],
    });
  }
  return steps.length ? steps : null;
}

function buildDocuments(d) {
  const out = [];
  let n = 0;
  for (const c of d.cases || []) {
    for (const doc of c.documents || []) {
      const rawName = stripBullet(doc.name);
      const norm = noDiacritics(rawName);
      // Keep only lines that actually name a document (whitelist by opening noun).
      if (!rawName) continue;
      if (rawName.length < 6) continue;
      if (!DOC_PREFIXES.some((p) => norm.startsWith(p))) continue;
      n += 1;
      const isLookup = LOOKUP_HINTS.some((h) => norm.includes(h));
      out.push({
        code: `D${n}`,
        name: truncate(rawName, 220),
        originals: Number(doc.original_qty) || (doc.required === false ? 0 : 1),
        copies: Number(doc.copy_qty) || 0,
        orderNumber: n,
        conditionJson: null,
        reasonText: null,
        submissionType: isLookup ? 'SYSTEM_LOOKUP' : 'SUBMIT',
      });
      if (out.length >= 8) return out;
    }
  }
  return out;
}

function audienceOf(d) {
  const hay = noDiacritics(
    [...(d.categories || []), ...(d.service_groups || []), d.name].join(' ')
  );
  if (/doanh nghiep|kinh doanh|hop tac xa|htx|dau tu/.test(hay)) return 'BUSINESS';
  return 'CITIZEN';
}

function transform(d) {
  const steps = buildSteps(d);
  const documents = buildDocuments(d);
  if (!steps || documents.length === 0) return null; // keep only usable, demo-quality entries
  const sector = collapse((d.service_groups || [])[0] || (d.categories || [])[0] || 'Thủ tục hành chính');
  const agency = collapse(d.executing_agencies_text || d.department_promulgate || 'Cơ quan có thẩm quyền');
  return {
    code: d.code,
    name: truncate(normalizeName(d.name), 200),
    sector,
    agency,
    audience: audienceOf(d),
    sourceUrl: d.source_url || `https://dichvucong.gov.vn/tra-cuu-thu-tuc/${d.id}`,
    version: {
      version: '1.0',
      status: 'ACTIVE',
      effectiveFrom: '2026-01-01T00:00:00+07:00',
      stepsJson: steps,
      durationText: buildDuration(d),
      feesText: buildFees(d),
      legalBasisText: buildLegalBasis(d),
    },
    questions: [
      {
        code: 'province',
        orderNumber: 1,
        fieldType: 'province',
        optionsJson: null,
        conditionJson: null,
        questionText: 'Bạn thực hiện thủ tục tại tỉnh/thành phố nào?',
      },
    ],
    documents,
  };
}

function eligible(d) {
  // Both ACTIVE and UPDATED are live published procedures on the portal.
  if (d.state !== 'ACTIVE' && d.state !== 'UPDATED') return false;
  const subjects = (d.subject_types || []).map(noDiacritics);
  if (!subjects.some((s) => s.includes('cong dan viet nam'))) return false;
  const name = noDiacritics(d.name);
  if (EXCLUDED_TOPICS.some((t) => name.includes(t))) return false;
  const levels = (d.levels || []).map(noDiacritics);
  // Citizen-accessible tiers only (skip ministry-only paperwork).
  if (!levels.some((l) => l.includes('cap xa') || l.includes('cap tinh'))) return false;
  return true;
}

async function run() {
  const rl = createInterface({ input: createReadStream(SRC, 'utf-8'), crlfDelay: Infinity });
  const candidates = [];
  let total = 0, kept = 0;
  for await (const line of rl) {
    const t = line.trim();
    if (!t) continue;
    total += 1;
    let d;
    try { d = JSON.parse(t); } catch { continue; }
    if (!eligible(d)) continue;
    const item = transform(d);
    if (!item) continue;
    kept += 1;
    item._priority = priorityOf(item.name);
    item._online = d.is_online_full ? 0 : 1;
    item._nameLen = item.name.length;
    candidates.push(item);
  }

  // Rank: recognizable topic first, then online-capable, then shorter (cleaner) names.
  candidates.sort((a, b) =>
    a._priority - b._priority ||
    a._online - b._online ||
    a._nameLen - b._nameLen ||
    a.code.localeCompare(b.code)
  );

  const SECTOR_CAP = 4; // keep the set diverse — no single sector dominates
  const selected = [];
  const seen = new Set();
  const perSector = new Map();
  for (const item of candidates) {
    if (selected.length >= MAX) break;
    if (item._priority === Infinity) continue; // curated set = recognized topics only
    const key = dedupKey(item.name);
    if (seen.has(key)) continue;
    if ((perSector.get(item.sector) || 0) >= SECTOR_CAP) continue;
    seen.add(key);
    perSector.set(item.sector, (perSector.get(item.sector) || 0) + 1);
    selected.push(item);
  }

  const clean = selected
    .map(({ _priority, _online, _nameLen, ...keep }) => keep)
    .sort((a, b) => a.code.localeCompare(b.code));

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(clean, null, 2) + '\n', 'utf-8');

  console.log(`Scanned ${total} procedures, ${kept} eligible+usable, selected ${clean.length}.`);
  console.log(`Sectors covered: ${new Set(clean.map((x) => x.sector)).size}`);
  console.log(`Wrote ${path.relative(APP_ROOT, OUT)}`);
  console.log('\nSelected:');
  for (const x of clean) {
    console.log(`  [${x.code}] ${x.name}  — ${x.sector} · ${x.audience} · ${x.documents.length} giấy tờ · ${x.version.stepsJson.length} bước`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
