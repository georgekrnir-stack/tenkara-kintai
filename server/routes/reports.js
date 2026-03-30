import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminAuth } from '../middleware/auth.js';
import { calcCashBreakdown } from '../services/payroll.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const prisma = new PrismaClient();

const FONT_REGULAR = path.join(__dirname, '../data/NotoSansJP-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../data/NotoSansJP-Bold.ttf');

// === 色定数 ===
const C = {
  primary: '#1e3a5f',
  accent: '#2563eb',
  lightBg: '#f0f4f8',
  border: '#d1d5db',
  white: '#ffffff',
  black: '#000000',
  red: '#dc2626',
  rowAlt: '#f7f9fc',
  subtotalBg: '#e8edf3',
};

/** Content-Disposition ヘッダー（日本語ファイル名対応） */
function safeContentDisposition(disposition, filename) {
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

// === ヘルパー関数 ===

function toWareki(yearMonth) {
  const [y, m] = yearMonth.split('-').map(Number);
  return `令和${y - 2018}年${m}月分`;
}

function formatYen(amount) {
  return `¥${(amount || 0).toLocaleString()}`;
}

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}時間${m > 0 ? `${m}分` : ''}`;
}

/** ページ上部に紺色バーヘッダーを描画 */
function drawPageHeader(doc, title, subtitle) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const barH = 50;
  doc.save();
  doc.rect(left, doc.y, width, barH).fill(C.primary);
  doc.fill(C.white).font(FONT_BOLD).fontSize(16)
    .text(title, left, doc.y + 10, { width, align: 'center' });
  if (subtitle) {
    doc.fontSize(10).text(subtitle, left, doc.y + 2, { width, align: 'center' });
  }
  doc.restore();
  doc.y += barH + 12;
  doc.fill(C.black);
}

/** テーブルヘッダー行描画（紺背景＋白文字） */
function drawTableHeader(doc, y, cols, headers, rowH) {
  const h = rowH || 20;
  const left = cols[0].x;
  const right = cols[cols.length - 1].x + cols[cols.length - 1].w;
  doc.save();
  doc.rect(left, y, right - left, h).fill(C.primary);
  doc.fill(C.white).font(FONT_BOLD).fontSize(8);
  for (let i = 0; i < cols.length; i++) {
    doc.text(headers[i], cols[i].x + 4, y + 5, { width: cols[i].w - 8, align: cols[i].align || 'left' });
  }
  doc.restore();
  doc.fill(C.black);
  return y + h;
}

/** テーブルデータ行描画（交互背景対応） */
function drawTableRow(doc, y, cols, values, options = {}) {
  const h = options.rowH || 18;
  const left = cols[0].x;
  const right = cols[cols.length - 1].x + cols[cols.length - 1].w;
  const bg = options.bg || (options.rowIndex % 2 === 1 ? C.rowAlt : null);
  doc.save();
  if (bg) {
    doc.rect(left, y, right - left, h).fill(bg);
  }
  // 罫線（下線）
  doc.moveTo(left, y + h).lineTo(right, y + h).lineWidth(0.3).strokeColor(C.border).stroke();

  const font = options.bold ? FONT_BOLD : FONT_REGULAR;
  const color = options.color || C.black;
  doc.fill(color).font(font).fontSize(options.fontSize || 8);
  for (let i = 0; i < cols.length; i++) {
    doc.text(values[i] || '', cols[i].x + 4, y + 4, { width: cols[i].w - 8, align: cols[i].align || 'left' });
  }
  doc.restore();
  doc.fill(C.black);
  return y + h;
}

/** セクションタイトル（薄色背景付き） */
function drawSectionTitle(doc, text, x, width) {
  const y = doc.y;
  const left = x || doc.page.margins.left;
  const w = width || (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  doc.save();
  doc.rect(left, y, w, 22).fill(C.lightBg);
  doc.rect(left, y, 3, 22).fill(C.accent);
  doc.fill(C.primary).font(FONT_BOLD).fontSize(10)
    .text(text, left + 10, y + 5, { width: w - 14 });
  doc.restore();
  doc.fill(C.black);
  doc.y = y + 26;
}

/** フッター描画 */
function drawFooter(doc) {
  const y = doc.page.height - doc.page.margins.bottom - 20;
  const left = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.save();
  doc.moveTo(left, y).lineTo(left + w, y).lineWidth(0.5).strokeColor(C.border).stroke();
  doc.fill('#666666').font(FONT_REGULAR).fontSize(7)
    .text('飛騨牛食べ処てんから', left, y + 4, { width: w, align: 'center' });
  doc.restore();
  doc.fill(C.black);
}

// === 個別給与明細PDF ===
router.get('/payslip/:staffId', adminAuth, async (req, res) => {
  const { month } = req.query;
  const { staffId } = req.params;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const record = await prisma.payrollRecord.findFirst({
    where: { staffId, yearMonth: month, isBonus: false },
    include: { staff: { select: { name: true } } },
  });
  if (!record) return res.status(404).json({ error: 'データが見つかりません' });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', safeContentDisposition('inline', `payslip_${record.staff.name}_${month}.pdf`));
  doc.pipe(res);

  renderPayslip(doc, record, record.staff.name, month);
  doc.end();
});

// === 全員給与明細一括PDF ===
router.get('/payslip-all', adminAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const records = await prisma.payrollRecord.findMany({
    where: { yearMonth: month, isBonus: false },
    include: { staff: { select: { name: true } } },
    orderBy: { staff: { createdAt: 'asc' } },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="payslip_all_${month}.pdf"`);
  doc.pipe(res);

  records.forEach((r, i) => {
    if (i > 0) doc.addPage();
    renderPayslip(doc, r, r.staff.name, month);
  });

  if (records.length === 0) {
    doc.font(FONT_REGULAR).fontSize(14).text('データがありません', { align: 'center' });
  }
  doc.end();
});

// === 現金封入用一覧PDF ===
router.get('/cash-envelope', adminAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const records = await prisma.payrollRecord.findMany({
    where: { yearMonth: month, isBonus: false },
    include: { staff: { select: { name: true } } },
    orderBy: { staff: { createdAt: 'asc' } },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="cash_envelope_${month}.pdf"`);
  doc.pipe(res);

  drawPageHeader(doc, '現金封入用一覧', toWareki(month));

  const denomLabels = { 10000: '一万', 5000: '五千', 1000: '千', 500: '500', 100: '100', 50: '50', 10: '10', 5: '5', 1: '1' };
  const denomKeys = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

  // テーブル定義
  const cols = [
    { x: 40, w: 90, align: 'left' },    // 名前
    { x: 130, w: 80, align: 'right' },   // 差引支給額
    { x: 210, w: 40, align: 'center' },  // 一万
    { x: 250, w: 40, align: 'center' },  // 五千
    { x: 290, w: 35, align: 'center' },  // 千
    { x: 325, w: 35, align: 'center' },  // 500
    { x: 360, w: 35, align: 'center' },  // 100
    { x: 395, w: 30, align: 'center' },  // 50
    { x: 425, w: 30, align: 'center' },  // 10
    { x: 455, w: 30, align: 'center' },  // 5
    { x: 485, w: 30, align: 'center' },  // 1
  ];
  const hdrs = ['スタッフ', '支給額', '一万', '五千', '千', '500', '100', '50', '10', '5', '1'];

  let y = drawTableHeader(doc, doc.y, cols, hdrs, 22);

  records.forEach((r, i) => {
    if (y > 740) { doc.addPage(); y = 40; y = drawTableHeader(doc, y, cols, hdrs, 22); }
    const bd = calcCashBreakdown(r.netPay);
    const bdMap = {};
    bd.forEach(b => { bdMap[b.denomination] = b.count; });
    const vals = [
      r.staff.name,
      formatYen(r.netPay),
      ...denomKeys.map(k => bdMap[k] ? String(bdMap[k]) : '-'),
    ];
    y = drawTableRow(doc, y, cols, vals, { rowIndex: i });
  });

  if (records.length === 0) {
    doc.font(FONT_REGULAR).fontSize(14).text('データがありません', 40, y + 20, { align: 'center' });
  }

  drawFooter(doc);
  doc.end();
});

// === 月次勤怠一覧 ===
router.get('/attendance', adminAuth, async (req, res) => {
  const { month, format } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const [year, mon] = month.split('-').map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, mon - 1, 1) - jstOffset);
  const end = new Date(Date.UTC(year, mon, 1) - jstOffset);

  const records = await prisma.timeRecord.findMany({
    where: { recordedAt: { gte: start, lt: end } },
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { recordedAt: 'asc' },
  });

  // 日別・スタッフ別に集計
  const grouped = {};
  for (const r of records) {
    const jstDate = new Date(new Date(r.recordedAt).getTime() + jstOffset);
    const dateKey = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
    const key = `${r.staff.name}_${dateKey}`;
    if (!grouped[key]) grouped[key] = { name: r.staff.name, date: dateKey, records: [] };
    grouped[key].records.push(r);
  }

  const rows = Object.values(grouped).map((g) => {
    const sorted = g.records.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const clockIn = sorted.find((r) => r.recordType === 'clock_in');
    const clockOut = [...sorted].reverse().find((r) => r.recordType === 'clock_out');
    let breakMin = 0, bStart = null;
    for (const r of sorted) {
      if (r.recordType === 'break_start') bStart = new Date(r.recordedAt);
      if (r.recordType === 'break_end' && bStart) { breakMin += (new Date(r.recordedAt) - bStart) / 60000; bStart = null; }
    }
    const workMin = clockIn && clockOut ? Math.max(0, (new Date(clockOut.recordedAt) - new Date(clockIn.recordedAt)) / 60000 - breakMin) : 0;
    const fmtTime = (d) => d ? new Date(d.recordedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : '';
    return { name: g.name, date: g.date, clockIn: fmtTime(clockIn), clockOut: fmtTime(clockOut), breakMin: Math.round(breakMin), workMin: Math.round(workMin) };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.date.localeCompare(b.date));

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance_${month}.csv"`);
    const bom = '\uFEFF';
    const header = 'スタッフ,日付,出勤,退勤,休憩(分),実労働(分)\n';
    const body = rows.map((r) => `${r.name},${r.date},${r.clockIn},${r.clockOut},${r.breakMin},${r.workMin}`).join('\n');
    return res.send(bom + header + body);
  }

  // PDF
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="attendance_${month}.pdf"`);
  doc.pipe(res);

  drawPageHeader(doc, '月次勤怠一覧', toWareki(month));

  const cols = [
    { x: 30, w: 110, align: 'left' },   // スタッフ
    { x: 140, w: 90, align: 'left' },    // 日付
    { x: 230, w: 70, align: 'center' },  // 出勤
    { x: 300, w: 70, align: 'center' },  // 退勤
    { x: 370, w: 70, align: 'center' },  // 休憩
    { x: 440, w: 120, align: 'center' }, // 実労働
  ];
  const hdrs = ['スタッフ', '日付', '出勤', '退勤', '休憩', '実労働'];
  let y = drawTableHeader(doc, doc.y, cols, hdrs, 22);

  let prevName = '';
  rows.forEach((r, i) => {
    if (y > 520) {
      doc.addPage();
      doc.y = 30;
      y = drawTableHeader(doc, 30, cols, hdrs, 22);
      prevName = '';
    }
    // スタッフが変わったら区切り線
    if (prevName && prevName !== r.name) {
      doc.save();
      doc.moveTo(cols[0].x, y).lineTo(cols[cols.length - 1].x + cols[cols.length - 1].w, y)
        .lineWidth(1.5).strokeColor(C.primary).stroke();
      doc.restore();
      y += 2;
    }
    const vals = [
      prevName === r.name ? '' : r.name,
      r.date,
      r.clockIn,
      r.clockOut,
      `${r.breakMin}分`,
      formatMinutes(r.workMin),
    ];
    y = drawTableRow(doc, y, cols, vals, {
      rowIndex: i,
      bold: prevName !== r.name && prevName !== '',
    });
    prevName = r.name;
  });

  drawFooter(doc);
  doc.end();
});

// === 給与一覧 ===
router.get('/payroll', adminAuth, async (req, res) => {
  const { month, format } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const records = await prisma.payrollRecord.findMany({
    where: { yearMonth: month, isBonus: false },
    include: { staff: { select: { name: true } } },
    orderBy: { staff: { createdAt: 'asc' } },
  });

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${month}.csv"`);
    const bom = '\uFEFF';
    const header = 'スタッフ,労働日数,支給総額,控除総額,差引支給額\n';
    const body = records.map((r) => `${r.staff.name},${r.workDays},${r.grossPay},${r.totalDeduction},${r.netPay}`).join('\n');
    return res.send(bom + header + body);
  }

  // PDF
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="payroll_${month}.pdf"`);
  doc.pipe(res);

  drawPageHeader(doc, '給与一覧', toWareki(month));

  const cols = [
    { x: 40, w: 120, align: 'left' },   // スタッフ
    { x: 160, w: 70, align: 'center' },  // 労働日数
    { x: 230, w: 100, align: 'right' },  // 支給総額
    { x: 330, w: 100, align: 'right' },  // 控除総額
    { x: 430, w: 100, align: 'right' },  // 差引支給額
  ];
  const hdrs = ['スタッフ', '労働日数', '支給総額', '控除総額', '差引支給額'];
  let y = drawTableHeader(doc, doc.y, cols, hdrs, 22);

  let totGross = 0, totDeduct = 0, totNet = 0;
  records.forEach((r, i) => {
    totGross += r.grossPay;
    totDeduct += r.totalDeduction;
    totNet += r.netPay;
    const vals = [r.staff.name, `${r.workDays}日`, formatYen(r.grossPay), formatYen(r.totalDeduction), formatYen(r.netPay)];
    y = drawTableRow(doc, y, cols, vals, { rowIndex: i });
  });

  // 合計行
  if (records.length > 0) {
    y = drawTableRow(doc, y, cols,
      ['合計', `${records.length}名`, formatYen(totGross), formatYen(totDeduct), formatYen(totNet)],
      { bold: true, bg: C.subtotalBg, fontSize: 9 },
    );
  }

  drawFooter(doc);
  doc.end();
});

// === 給与明細レンダリング ===
function renderPayslip(doc, record, staffName, month) {
  const warekiMonth = toWareki(month);
  const ml = doc.page.margins.left;
  const pw = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let y;

  // --- ヘッダーバー ---
  doc.save();
  doc.rect(ml, doc.y, pw, 60).fill(C.primary);
  const headerTop = doc.y;
  doc.fill(C.white).font(FONT_REGULAR).fontSize(10)
    .text('飛騨牛食べ処てんから', ml, headerTop + 8, { width: pw, align: 'center' });
  doc.font(FONT_BOLD).fontSize(18)
    .text('給与支払明細書', ml, headerTop + 24, { width: pw, align: 'center' });
  doc.restore();
  doc.fill(C.black);
  doc.y = headerTop + 68;

  // --- 和暦月 & 氏名 ---
  doc.save();
  doc.rect(ml, doc.y, pw, 28).fill(C.lightBg);
  doc.fill(C.primary).font(FONT_REGULAR).fontSize(11)
    .text(warekiMonth, ml + 10, doc.y + 7, { continued: false });
  doc.fill(C.primary).font(FONT_BOLD).fontSize(13)
    .text(`${staffName} 殿`, ml, doc.y - 15, { width: pw - 10, align: 'right' });
  doc.restore();
  doc.fill(C.black);
  doc.y += 20;
  doc.moveDown(0.5);

  // --- 勤怠セクション ---
  drawSectionTitle(doc, '勤怠', ml, pw);

  const attCols = [
    { x: ml, w: pw / 5 },
    { x: ml + pw / 5, w: pw / 5 },
    { x: ml + (pw / 5) * 2, w: pw / 5 },
    { x: ml + (pw / 5) * 3, w: pw / 5 },
    { x: ml + (pw / 5) * 4, w: pw / 5 },
  ];
  const attLabels = ['労働日数', '労働時間', '残業', '深夜', '休日'];
  const attValues = [
    `${record.workDays}日`,
    formatMinutes(record.totalWorkMinutes),
    formatMinutes(record.overtimeMinutes),
    formatMinutes(record.nightWorkMinutes),
    formatMinutes(record.holidayWorkMinutes),
  ];

  y = doc.y;
  // ラベル行
  doc.save();
  doc.rect(ml, y, pw, 18).fill(C.lightBg);
  doc.fill('#666666').font(FONT_REGULAR).fontSize(7);
  attCols.forEach((c, i) => doc.text(attLabels[i], c.x + 4, y + 5, { width: c.w - 8, align: 'center' }));
  doc.restore();
  doc.fill(C.black);
  y += 18;
  // 値行
  doc.font(FONT_BOLD).fontSize(10);
  attCols.forEach((c, i) => doc.text(attValues[i], c.x + 4, y + 3, { width: c.w - 8, align: 'center' }));
  doc.y = y + 22;
  doc.moveDown(0.5);

  // --- 支給・控除を左右2列レイアウト ---
  const colW = (pw - 20) / 2;
  const leftX = ml;
  const rightX = ml + colW + 20;

  // 支給セクション
  drawSectionTitle(doc, '支給', leftX, colW);
  const payStartY = doc.y;

  const payItems = [
    ['基本給', record.basePay],
    ['残業手当', record.overtimePay],
    ['深夜手当', record.nightPay],
    ['休日手当', record.holidayPay],
    ['交通費', record.transportAllowance],
  ].filter(([, v]) => v > 0);

  const itemH = 18;
  y = payStartY;
  doc.font(FONT_REGULAR).fontSize(9);
  payItems.forEach(([label, val], i) => {
    if (i % 2 === 1) {
      doc.save().rect(leftX, y, colW, itemH).fill(C.rowAlt).restore();
    }
    doc.fill(C.black);
    doc.text(label, leftX + 8, y + 4, { width: colW / 2 - 12 });
    doc.text(formatYen(val), leftX + colW / 2, y + 4, { width: colW / 2 - 8, align: 'right' });
    y += itemH;
  });
  // 小計
  doc.save().rect(leftX, y, colW, 22).fill(C.subtotalBg).restore();
  doc.fill(C.primary).font(FONT_BOLD).fontSize(10);
  doc.text('支給額合計', leftX + 8, y + 5, { width: colW / 2 - 12 });
  doc.text(formatYen(record.grossPay), leftX + colW / 2, y + 5, { width: colW / 2 - 8, align: 'right' });
  doc.fill(C.black);
  const payEndY = y + 22;

  // 控除セクション（右側に同じ高さから描画）
  doc.y = payStartY - 26; // sectionTitleの分
  drawSectionTitle(doc, '控除', rightX, colW);

  const deductItems = [
    ['所得税', record.incomeTax],
    ['健康保険料', record.healthInsurance],
    ['介護保険料', record.careInsurance],
    ['厚生年金', record.pension],
    ['雇用保険料', record.employmentInsurance],
    ['食事代', record.mealDeduction],
    ['家賃', record.rentDeduction],
  ].filter(([, v]) => v > 0);

  y = payStartY;
  doc.font(FONT_REGULAR).fontSize(9);
  deductItems.forEach(([label, val], i) => {
    if (i % 2 === 1) {
      doc.save().rect(rightX, y, colW, itemH).fill(C.rowAlt).restore();
    }
    doc.fill(C.black);
    doc.text(label, rightX + 8, y + 4, { width: colW / 2 - 12 });
    doc.text(formatYen(val), rightX + colW / 2, y + 4, { width: colW / 2 - 8, align: 'right' });
    y += itemH;
  });
  // 小計
  doc.save().rect(rightX, y, colW, 22).fill(C.subtotalBg).restore();
  doc.fill(C.primary).font(FONT_BOLD).fontSize(10);
  doc.text('控除額合計', rightX + 8, y + 5, { width: colW / 2 - 12 });
  doc.text(formatYen(record.totalDeduction), rightX + colW / 2, y + 5, { width: colW / 2 - 8, align: 'right' });
  doc.fill(C.black);
  const deductEndY = y + 22;

  doc.y = Math.max(payEndY, deductEndY) + 16;

  // --- 差引支給額（大きな紺背景ボックス） ---
  const netBoxW = pw * 0.7;
  const netBoxX = ml + (pw - netBoxW) / 2;
  y = doc.y;
  doc.save();
  doc.rect(netBoxX, y, netBoxW, 50).fill(C.primary);
  doc.fill(C.white).font(FONT_REGULAR).fontSize(11)
    .text('差引支給額', netBoxX, y + 8, { width: netBoxW, align: 'center' });
  doc.font(FONT_BOLD).fontSize(24)
    .text(formatYen(record.netPay), netBoxX, y + 24, { width: netBoxW, align: 'center' });
  doc.restore();
  doc.fill(C.black);
  doc.y = y + 60;

  // --- 紙幣・硬貨内訳 ---
  const breakdown = calcCashBreakdown(record.netPay);
  if (breakdown && breakdown.length > 0) {
    doc.moveDown(0.3);
    doc.font(FONT_REGULAR).fontSize(8).fill('#666666').text('紙幣・硬貨内訳:', ml, doc.y);
    doc.moveDown(0.3);

    const denomLabels = { 10000: '一万', 5000: '五千', 1000: '千', 500: '500', 100: '100', 50: '50', 10: '10', 5: '5', 1: '1' };
    let bx = ml;
    const badgeH = 18;
    doc.save();
    for (const b of breakdown) {
      const label = `${denomLabels[b.denomination]}×${b.count}`;
      const labelW = doc.font(FONT_REGULAR).fontSize(8).widthOfString(label) + 14;
      doc.rect(bx, doc.y, labelW, badgeH).lineWidth(0.5).strokeColor(C.border).fillAndStroke(C.lightBg, C.border);
      doc.fill(C.primary).text(label, bx + 7, doc.y + 4);
      bx += labelW + 6;
    }
    doc.restore();
    doc.fill(C.black);
    doc.y += badgeH + 10;
  }

  // --- フッター ---
  drawFooter(doc);
}

export default router;
