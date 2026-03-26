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

// --- 個別給与明細PDF ---
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
  res.setHeader('Content-Disposition', `inline; filename="payslip_${record.staff.name}_${month}.pdf"`);
  doc.pipe(res);

  renderPayslip(doc, record, record.staff.name, month);
  doc.end();
});

// --- 全員給与明細一括PDF ---
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

// --- 現金封入用一覧PDF ---
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

  doc.font(FONT_BOLD).fontSize(16).text(`現金封入用一覧 ${toWareki(month)}`, { align: 'center' });
  doc.moveDown();

  const denomLabels = { 10000: '万', 5000: '五千', 1000: '千', 500: '500', 100: '100', 50: '50', 10: '10', 5: '5', 1: '1' };

  for (const r of records) {
    const breakdown = calcCashBreakdown(r.netPay);
    const y = doc.y;

    doc.font(FONT_BOLD).fontSize(14).text(r.staff.name, 40, y);
    doc.font(FONT_BOLD).fontSize(24).text(formatYen(r.netPay), 200, y - 4);
    doc.font(FONT_REGULAR).fontSize(9);
    const parts = breakdown.map((b) => `${denomLabels[b.denomination]}×${b.count}`).join('  ');
    doc.text(parts, 40, y + 28);
    doc.moveDown(0.8);

    if (doc.y > 720) doc.addPage();
  }

  if (records.length === 0) {
    doc.font(FONT_REGULAR).fontSize(14).text('データがありません', { align: 'center' });
  }
  doc.end();
});

// --- 月次勤怠一覧 ---
router.get('/attendance', adminAuth, async (req, res) => {
  const { month, format } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const [year, mon] = month.split('-').map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const start = new Date(new Date(year, mon - 1, 1).getTime() - jstOffset);
  const end = new Date(new Date(year, mon, 1).getTime() - jstOffset);

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

  doc.font(FONT_BOLD).fontSize(14).text(`月次勤怠一覧 ${toWareki(month)}`, { align: 'center' });
  doc.moveDown();

  const cols = [30, 130, 230, 330, 430, 530, 630];
  const headers = ['スタッフ', '日付', '出勤', '退勤', '休憩', '実労働'];
  doc.font(FONT_BOLD).fontSize(9);
  headers.forEach((h, i) => doc.text(h, cols[i], doc.y, { continued: i < headers.length - 1, width: 90 }));
  doc.moveDown(0.5);

  doc.font(FONT_REGULAR).fontSize(8);
  for (const r of rows) {
    if (doc.y > 520) { doc.addPage(); }
    const y = doc.y;
    doc.text(r.name, cols[0], y, { width: 95 });
    doc.text(r.date, cols[1], y, { width: 95 });
    doc.text(r.clockIn, cols[2], y, { width: 95 });
    doc.text(r.clockOut, cols[3], y, { width: 95 });
    doc.text(`${r.breakMin}分`, cols[4], y, { width: 95 });
    doc.text(formatMinutes(r.workMin), cols[5], y, { width: 95 });
    doc.moveDown(0.3);
  }

  doc.end();
});

// --- 給与一覧 ---
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

  doc.font(FONT_BOLD).fontSize(14).text(`給与一覧 ${toWareki(month)}`, { align: 'center' });
  doc.moveDown();

  doc.font(FONT_BOLD).fontSize(10);
  doc.text('スタッフ', 40, doc.y, { continued: true, width: 100 });
  doc.text('労働日数', 160, doc.y, { continued: true, width: 70 });
  doc.text('支給総額', 240, doc.y, { continued: true, width: 90 });
  doc.text('控除総額', 340, doc.y, { continued: true, width: 90 });
  doc.text('差引支給額', 440, doc.y, { width: 100 });
  doc.moveDown(0.5);

  doc.font(FONT_REGULAR).fontSize(9);
  for (const r of records) {
    const y = doc.y;
    doc.text(r.staff.name, 40, y, { width: 100 });
    doc.text(`${r.workDays}日`, 160, y, { width: 70 });
    doc.text(formatYen(r.grossPay), 240, y, { width: 90 });
    doc.text(formatYen(r.totalDeduction), 340, y, { width: 90 });
    doc.font(FONT_BOLD).text(formatYen(r.netPay), 440, y, { width: 100 });
    doc.font(FONT_REGULAR);
    doc.moveDown(0.3);
  }

  doc.end();
});

// --- 給与明細レンダリング ---
function renderPayslip(doc, record, staffName, month) {
  const warekiMonth = toWareki(month);
  let y;

  // ヘッダー
  doc.font(FONT_REGULAR).fontSize(10).text('飛騨牛食べ処てんから', { align: 'center' });
  doc.font(FONT_BOLD).fontSize(16).text('給与支払明細書', { align: 'center' });
  doc.font(FONT_REGULAR).fontSize(11).text(warekiMonth, { align: 'center' });
  doc.font(FONT_BOLD).fontSize(12).text(`${staffName} 殿`, { align: 'center' });
  doc.moveDown();

  // 勤怠
  doc.font(FONT_BOLD).fontSize(11).text('【勤怠】');
  doc.font(FONT_REGULAR).fontSize(10);
  doc.text(`労働日数: ${record.workDays}日`);
  doc.text(`労働時間: ${formatMinutes(record.totalWorkMinutes)}`);
  doc.text(`  うち残業: ${formatMinutes(record.overtimeMinutes)}`);
  doc.text(`  うち深夜: ${formatMinutes(record.nightWorkMinutes)}`);
  doc.text(`  うち休日: ${formatMinutes(record.holidayWorkMinutes)}`);
  doc.moveDown(0.5);

  // 支給
  doc.font(FONT_BOLD).fontSize(11).text('【支給】');
  doc.font(FONT_REGULAR).fontSize(10);
  const payItems = [
    ['基本給', record.basePay],
    ['残業手当', record.overtimePay],
    ['深夜手当', record.nightPay],
    ['休日手当', record.holidayPay],
    ['交通費', record.transportAllowance],
    ['まかない手当', record.mealAllowance],
  ];
  for (const [label, val] of payItems) {
    if (val > 0) {
      y = doc.y;
      doc.text(label + ':', 70, y, { width: 150 });
      doc.text(formatYen(val), 250, y, { width: 100, align: 'right' });
    }
  }
  doc.moveDown(0.3);
  doc.moveTo(70, doc.y).lineTo(350, doc.y).stroke();
  y = doc.y + 5;
  doc.font(FONT_BOLD).text('支給額合計:', 70, y, { width: 150 });
  doc.text(formatYen(record.grossPay), 250, y, { width: 100, align: 'right' });
  doc.moveDown();

  // 控除
  doc.font(FONT_BOLD).fontSize(11).text('【控除】');
  doc.font(FONT_REGULAR).fontSize(10);
  const deductItems = [
    ['所得税', record.incomeTax],
    ['健康保険料', record.healthInsurance],
    ['介護保険料', record.careInsurance],
    ['厚生年金', record.pension],
    ['雇用保険料', record.employmentInsurance],
    ['食事代', record.mealDeduction],
    ['家賃', record.rentDeduction],
  ];
  for (const [label, val] of deductItems) {
    if (val > 0) {
      y = doc.y;
      doc.text(label + ':', 70, y, { width: 150 });
      doc.text(formatYen(val), 250, y, { width: 100, align: 'right' });
    }
  }
  doc.moveDown(0.3);
  doc.moveTo(70, doc.y).lineTo(350, doc.y).stroke();
  y = doc.y + 5;
  doc.font(FONT_BOLD).text('控除額合計:', 70, y, { width: 150 });
  doc.text(formatYen(record.totalDeduction), 250, y, { width: 100, align: 'right' });
  doc.moveDown(1.5);

  // 差引支給額
  doc.moveTo(60, doc.y).lineTo(360, doc.y).lineWidth(2).stroke();
  doc.moveDown(0.5);
  y = doc.y;
  doc.font(FONT_BOLD).fontSize(12).text('差引支給額:', 70, y, { width: 150 });
  doc.fontSize(20).text(formatYen(record.netPay), 230, y - 3, { width: 130, align: 'right' });
  doc.moveDown(0.5);
  doc.moveTo(60, doc.y).lineTo(360, doc.y).lineWidth(2).stroke();
  doc.moveDown(2);

  // フッター
  doc.font(FONT_REGULAR).fontSize(9).text('事業所名: 飛騨牛食べ処てんから', { align: 'center' });
}

export default router;
