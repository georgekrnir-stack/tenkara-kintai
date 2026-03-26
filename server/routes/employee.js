import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const prisma = new PrismaClient();

// 従業員認証ミドルウェア
function employeeAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: '認証が必要です' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'employee' || !decoded.staffId) {
      return res.status(403).json({ error: '権限がありません' });
    }
    req.staffId = decoded.staffId;
    req.urlToken = decoded.urlToken;
    next();
  } catch {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}

// ログイン
router.post('/login', async (req, res) => {
  const { token: urlToken, password } = req.body;
  if (!urlToken || !password) {
    return res.status(400).json({ error: 'トークンとパスワードは必須です' });
  }

  const staff = await prisma.staff.findUnique({
    where: { employeeUrlToken: urlToken },
  });
  if (!staff || !staff.isActive || !staff.employeePasswordHash) {
    return res.status(401).json({ error: '認証に失敗しました' });
  }

  const valid = await bcrypt.compare(password, staff.employeePasswordHash);
  if (!valid) {
    return res.status(401).json({ error: 'パスワードが正しくありません' });
  }

  const jwtToken = jwt.sign(
    { role: 'employee', staffId: staff.id, urlToken },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token: jwtToken, staffName: staff.name });
});

// 自分の勤怠
router.get('/attendance', employeeAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const [year, mon] = month.split('-').map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const start = new Date(new Date(year, mon - 1, 1).getTime() - jstOffset);
  const end = new Date(new Date(year, mon, 1).getTime() - jstOffset);

  const records = await prisma.timeRecord.findMany({
    where: { staffId: req.staffId, recordedAt: { gte: start, lt: end } },
    orderBy: { recordedAt: 'asc' },
  });

  // 日別にグルーピング
  const grouped = {};
  for (const r of records) {
    const jstDate = new Date(new Date(r.recordedAt).getTime() + jstOffset);
    const dateKey = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push({
      recordType: r.recordType,
      recordedAt: r.recordedAt,
    });
  }

  const days = Object.entries(grouped).map(([date, recs]) => {
    const sorted = recs.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const clockIn = sorted.find((r) => r.recordType === 'clock_in');
    const clockOut = [...sorted].reverse().find((r) => r.recordType === 'clock_out');
    let breakMin = 0, bStart = null;
    for (const r of sorted) {
      if (r.recordType === 'break_start') bStart = new Date(r.recordedAt);
      if (r.recordType === 'break_end' && bStart) { breakMin += (new Date(r.recordedAt) - bStart) / 60000; bStart = null; }
    }
    const workMin = clockIn && clockOut ? Math.max(0, (new Date(clockOut.recordedAt) - new Date(clockIn.recordedAt)) / 60000 - breakMin) : 0;

    return { date, records: sorted, breakMinutes: Math.round(breakMin), workMinutes: Math.round(workMin) };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // 月合計
  const totalWorkMinutes = days.reduce((sum, d) => sum + d.workMinutes, 0);
  const workDays = days.filter((d) => d.workMinutes > 0).length;

  res.json({ days, totalWorkMinutes, workDays });
});

// 自分の給与見込み / 確定明細
router.get('/payroll', employeeAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const record = await prisma.payrollRecord.findFirst({
    where: { staffId: req.staffId, yearMonth: month, isBonus: false },
  });

  if (!record) return res.json(null);
  res.json(record);
});

// 過去の給与明細一覧
router.get('/payroll/history', employeeAuth, async (req, res) => {
  const records = await prisma.payrollRecord.findMany({
    where: { staffId: req.staffId },
    orderBy: { yearMonth: 'desc' },
    select: {
      yearMonth: true,
      isBonus: true,
      grossPay: true,
      totalDeduction: true,
      netPay: true,
      calculatedAt: true,
    },
  });
  res.json(records);
});

export default router;
