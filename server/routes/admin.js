import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { adminAuth } from '../middleware/auth.js';
import { calcPayroll, calcCashBreakdown } from '../services/payroll.js';

const router = Router();
const prisma = new PrismaClient();

// --- 管理者認証 ---

// セットアップ状態確認
router.get('/setup/status', async (req, res) => {
  const setting = await prisma.adminSetting.findUnique({ where: { key: 'admin_password' } });
  res.json({ isSetup: !!setting });
});

// 初回パスワード設定
router.post('/setup', async (req, res) => {
  const existing = await prisma.adminSetting.findUnique({ where: { key: 'admin_password' } });
  if (existing) {
    return res.status(400).json({ error: 'パスワードは既に設定されています' });
  }

  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'パスワードは4文字以上で設定してください' });
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.adminSetting.create({
    data: { key: 'admin_password', value: hash },
  });

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// ログイン
router.post('/login', async (req, res) => {
  const setting = await prisma.adminSetting.findUnique({ where: { key: 'admin_password' } });
  if (!setting) {
    return res.status(400).json({ error: '管理者パスワードが未設定です' });
  }

  const { password } = req.body;
  const valid = await bcrypt.compare(password, setting.value);
  if (!valid) {
    return res.status(401).json({ error: 'パスワードが正しくありません' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// --- スタッフ管理 ---

// スタッフ一覧
router.get('/staff', adminAuth, async (req, res) => {
  const staffs = await prisma.staff.findMany({
    orderBy: { createdAt: 'asc' },
  });
  res.json(staffs);
});

// スタッフ新規登録
router.post('/staff', adminAuth, async (req, res) => {
  const {
    name, title, employmentType, salaryType, monthlySalary, hourlyRate,
    taxColumn, hasEmploymentInsurance, healthInsuranceAmount, careInsuranceAmount,
    pensionAmount, rentDeduction, hasTransportAllowance, transportAllowanceDaily,
    employeePassword,
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: '氏名は必須です' });
  }

  const employeeUrlToken = crypto.randomBytes(32).toString('hex');
  let employeePasswordHash = null;
  if (employeePassword) {
    employeePasswordHash = await bcrypt.hash(employeePassword, 10);
  }

  const staff = await prisma.staff.create({
    data: {
      name,
      title: title || null,
      employmentType: employmentType || 'part_time',
      salaryType: salaryType || 'hourly',
      monthlySalary: monthlySalary ? parseInt(monthlySalary) : null,
      hourlyRate: hourlyRate ? parseInt(hourlyRate) : null,
      taxColumn: taxColumn || 'kou',
      hasEmploymentInsurance: !!hasEmploymentInsurance,
      healthInsuranceAmount: parseInt(healthInsuranceAmount) || 0,
      careInsuranceAmount: parseInt(careInsuranceAmount) || 0,
      pensionAmount: parseInt(pensionAmount) || 0,
      hasMealDeduction: true,
      rentDeduction: parseInt(rentDeduction) || 0,
      hasTransportAllowance: !!hasTransportAllowance,
      transportAllowanceDaily: transportAllowanceDaily ? parseInt(transportAllowanceDaily) : null,
      employeeUrlToken,
      employeePasswordHash,
    },
  });

  res.status(201).json(staff);
});

// スタッフ編集
router.put('/staff/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const {
    name, title, employmentType, salaryType, monthlySalary, hourlyRate,
    taxColumn, hasEmploymentInsurance, healthInsuranceAmount, careInsuranceAmount,
    pensionAmount, rentDeduction, hasTransportAllowance, transportAllowanceDaily,
    employeePassword,
  } = req.body;

  const data = {
    name,
    title: title || null,
    employmentType,
    salaryType,
    monthlySalary: monthlySalary ? parseInt(monthlySalary) : null,
    hourlyRate: hourlyRate ? parseInt(hourlyRate) : null,
    taxColumn,
    hasEmploymentInsurance: !!hasEmploymentInsurance,
    healthInsuranceAmount: parseInt(healthInsuranceAmount) || 0,
    careInsuranceAmount: parseInt(careInsuranceAmount) || 0,
    pensionAmount: parseInt(pensionAmount) || 0,
    rentDeduction: parseInt(rentDeduction) || 0,
    hasTransportAllowance: !!hasTransportAllowance,
    transportAllowanceDaily: transportAllowanceDaily ? parseInt(transportAllowanceDaily) : null,
  };

  if (employeePassword) {
    data.employeePasswordHash = await bcrypt.hash(employeePassword, 10);
  }

  try {
    const staff = await prisma.staff.update({ where: { id }, data });
    res.json(staff);
  } catch {
    res.status(404).json({ error: 'スタッフが見つかりません' });
  }
});

// --- ダッシュボード ---

// 当日出勤状況 + タイムラインデータ
router.get('/dashboard/today', adminAuth, async (req, res) => {
  const dateParam = req.query.date;
  const jstOffset = 9 * 60 * 60 * 1000;
  let start;
  if (dateParam) {
    // new Date('2026-03-26T00:00:00+09:00') → already UTC equivalent of JST midnight
    start = new Date(dateParam + 'T00:00:00+09:00');
  } else {
    const now = new Date();
    const jstNow = new Date(now.getTime() + jstOffset);
    const jstDate = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
    start = new Date(jstDate.getTime() - jstOffset);
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const staffs = await prisma.staff.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  const records = await prisma.timeRecord.findMany({
    where: {
      recordedAt: { gte: start, lt: end },
      staff: { isActive: true },
    },
    orderBy: { recordedAt: 'asc' },
  });

  const recordsByStaff = {};
  for (const r of records) {
    if (!recordsByStaff[r.staffId]) recordsByStaff[r.staffId] = [];
    recordsByStaff[r.staffId].push(r);
  }

  const statusLabel = {
    not_working: '未出勤',
    working: '出勤中',
    on_break: '休憩中',
    clocked_out: '退勤済み',
  };

  const result = staffs.map((s) => {
    const staffRecords = recordsByStaff[s.id] || [];
    let status = 'not_working';
    if (staffRecords.length > 0) {
      const sorted = [...staffRecords].sort(
        (a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)
      );
      switch (sorted[0].recordType) {
        case 'clock_in': case 'break_end': status = 'working'; break;
        case 'break_start': status = 'on_break'; break;
        case 'clock_out': status = 'clocked_out'; break;
      }
    }
    return {
      id: s.id,
      name: s.name,
      status,
      statusLabel: statusLabel[status],
      records: staffRecords.map((r) => ({
        id: r.id,
        recordType: r.recordType,
        recordedAt: r.recordedAt,
      })),
    };
  });

  const counts = { working: 0, on_break: 0, clocked_out: 0, not_working: 0 };
  result.forEach((s) => counts[s.status]++);

  res.json({ staffs: result, counts });
});

// スタッフ無効化
router.patch('/staff/:id/deactivate', adminAuth, async (req, res) => {
  try {
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(staff);
  } catch {
    res.status(404).json({ error: 'スタッフが見つかりません' });
  }
});

// --- 勤怠管理 ---

// 月次勤怠一覧
router.get('/attendance', adminAuth, async (req, res) => {
  const { month, staff_id } = req.query;
  if (!month) {
    return res.status(400).json({ error: 'monthパラメータは必須です（例: 2026-03）' });
  }

  const [year, mon] = month.split('-').map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, mon - 1, 1) - jstOffset);
  const end = new Date(Date.UTC(year, mon, 1) - jstOffset);

  const where = {
    recordedAt: { gte: start, lt: end },
  };
  if (staff_id) {
    where.staffId = staff_id;
  }

  const records = await prisma.timeRecord.findMany({
    where,
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { recordedAt: 'asc' },
  });

  // 日別・スタッフ別にグルーピング
  const grouped = {};
  for (const r of records) {
    const jstDate = new Date(new Date(r.recordedAt).getTime() + jstOffset);
    const dateKey = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
    const key = `${r.staffId}_${dateKey}`;
    if (!grouped[key]) {
      grouped[key] = {
        staffId: r.staffId,
        staffName: r.staff.name,
        date: dateKey,
        records: [],
      };
    }
    grouped[key].records.push({
      id: r.id,
      recordType: r.recordType,
      recordedAt: r.recordedAt,
      mealCount: r.mealCount,
      isModified: r.isModified,
      modifiedBy: r.modifiedBy,
    });
  }

  // 各日の勤務サマリーを計算
  const days = Object.values(grouped).map((day) => {
    const sorted = [...day.records].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    let clockIn = null;
    let clockOut = null;
    let breakMinutes = 0;
    let breakStart = null;

    for (const r of sorted) {
      switch (r.recordType) {
        case 'clock_in':
          if (!clockIn) clockIn = new Date(r.recordedAt);
          break;
        case 'clock_out':
          clockOut = new Date(r.recordedAt);
          break;
        case 'break_start':
          breakStart = new Date(r.recordedAt);
          break;
        case 'break_end':
          if (breakStart) {
            breakMinutes += (new Date(r.recordedAt) - breakStart) / 60000;
            breakStart = null;
          }
          break;
      }
    }

    let workMinutes = 0;
    if (clockIn && clockOut) {
      workMinutes = Math.max(0, (clockOut - clockIn) / 60000 - breakMinutes);
    }

    return {
      ...day,
      clockIn: clockIn?.toISOString() || null,
      clockOut: clockOut?.toISOString() || null,
      breakMinutes: Math.round(breakMinutes),
      workMinutes: Math.round(workMinutes),
    };
  });

  days.sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));

  res.json(days);
});

// 打刻修正
router.put('/attendance/:recordId', adminAuth, async (req, res) => {
  const { recordId } = req.params;
  const { recordedAt, recordType, mealCount } = req.body;

  try {
    const data = {
      isModified: true,
      modifiedBy: '管理者',
      modifiedAt: new Date(),
    };
    if (recordedAt) data.recordedAt = new Date(recordedAt);
    if (recordType) data.recordType = recordType;
    if (mealCount !== undefined) data.mealCount = parseInt(mealCount) || 0;

    const record = await prisma.timeRecord.update({
      where: { id: recordId },
      data,
    });
    res.json(record);
  } catch {
    res.status(404).json({ error: '打刻記録が見つかりません' });
  }
});

// 打刻追加（打刻忘れ対応）
router.post('/attendance', adminAuth, async (req, res) => {
  const { staffId, recordType, recordedAt, mealCount } = req.body;

  if (!staffId || !recordType || !recordedAt) {
    return res.status(400).json({ error: 'staffId, recordType, recordedAtは必須です' });
  }

  const record = await prisma.timeRecord.create({
    data: {
      staffId,
      recordType,
      recordedAt: new Date(recordedAt),
      mealCount: parseInt(mealCount) || 0,
      isModified: true,
      modifiedBy: '管理者',
      modifiedAt: new Date(),
    },
  });
  res.status(201).json(record);
});

// 打刻削除
router.delete('/attendance/:recordId', adminAuth, async (req, res) => {
  try {
    await prisma.timeRecord.delete({ where: { id: req.params.recordId } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: '打刻記録が見つかりません' });
  }
});

// --- 月次設定 ---

// 月次設定取得
router.get('/monthly-settings', adminAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const setting = await prisma.adminSetting.findUnique({
    where: { key: `monthly_settings_${month}` },
  });

  const defaults = { scheduledWorkDays: 22 };
  if (setting) {
    res.json({ ...defaults, ...JSON.parse(setting.value) });
  } else {
    res.json(defaults);
  }
});

// 月次設定更新
router.put('/monthly-settings', adminAuth, async (req, res) => {
  const { month, scheduledWorkDays } = req.body;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const key = `monthly_settings_${month}`;
  const value = JSON.stringify({ scheduledWorkDays: parseInt(scheduledWorkDays) || 22 });

  await prisma.adminSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  res.json({ success: true });
});

// --- 月次手動入力 ---

// 月次手動入力取得
router.get('/monthly-extra', adminAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const inputs = await prisma.monthlyExtraInput.findMany({
    where: { yearMonth: month },
    include: { staff: { select: { id: true, name: true } } },
  });
  res.json(inputs);
});

// 月次手動入力更新（upsert）
router.put('/monthly-extra', adminAuth, async (req, res) => {
  const { staffId, yearMonth, notes } = req.body;
  if (!staffId || !yearMonth) return res.status(400).json({ error: 'staffIdとyearMonthは必須です' });

  const input = await prisma.monthlyExtraInput.upsert({
    where: { staffId_yearMonth: { staffId, yearMonth } },
    update: {
      notes: notes || null,
    },
    create: {
      staffId,
      yearMonth,
      notes: notes || null,
    },
  });
  res.json(input);
});

// --- 特別時給 ---

// 特別時給一覧
router.get('/special-rates', adminAuth, async (req, res) => {
  const rates = await prisma.specialRate.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json(rates);
});

// 特別時給作成
router.post('/special-rates', adminAuth, async (req, res) => {
  const { name, startDate, endDate, amountIncrease } = req.body;
  if (!name || !startDate || !endDate || !amountIncrease) {
    return res.status(400).json({ error: '全項目を入力してください' });
  }
  const rate = await prisma.specialRate.create({
    data: {
      name,
      startDate: new Date(startDate + 'T00:00:00+09:00'),
      endDate: new Date(endDate + 'T23:59:59+09:00'),
      amountIncrease: parseInt(amountIncrease),
    },
  });
  res.status(201).json(rate);
});

// 特別時給更新
router.put('/special-rates/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { name, startDate, endDate, amountIncrease } = req.body;
  try {
    const rate = await prisma.specialRate.update({
      where: { id },
      data: {
        name,
        startDate: new Date(startDate + 'T00:00:00+09:00'),
        endDate: new Date(endDate + 'T23:59:59+09:00'),
        amountIncrease: parseInt(amountIncrease),
      },
    });
    res.json(rate);
  } catch {
    res.status(404).json({ error: '特別時給設定が見つかりません' });
  }
});

// 特別時給削除
router.delete('/special-rates/:id', adminAuth, async (req, res) => {
  try {
    await prisma.specialRate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: '特別時給設定が見つかりません' });
  }
});

// --- 給与計算 ---

// 給与計算実行
router.post('/payroll/calculate', adminAuth, async (req, res) => {
  const { yearMonth } = req.body;
  if (!yearMonth) return res.status(400).json({ error: 'yearMonthは必須です' });

  const [year, mon] = yearMonth.split('-').map(Number);
  const jstOffset = 9 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, mon - 1, 1) - jstOffset);
  const end = new Date(Date.UTC(year, mon, 1) - jstOffset);

  // 月次設定取得
  const settingRow = await prisma.adminSetting.findUnique({
    where: { key: `monthly_settings_${yearMonth}` },
  });
  const monthlySettings = settingRow ? JSON.parse(settingRow.value) : { scheduledWorkDays: 22 };

  // 対象月にかかる特別時給を取得
  const specialRates = await prisma.specialRate.findMany({
    where: {
      startDate: { lt: end },
      endDate: { gte: start },
    },
  });

  // 全スタッフ取得
  const staffs = await prisma.staff.findMany({ where: { isActive: true } });

  // 全打刻取得
  const allRecords = await prisma.timeRecord.findMany({
    where: { recordedAt: { gte: start, lt: end } },
    orderBy: { recordedAt: 'asc' },
  });

  // 月次手動入力取得
  const extraInputs = await prisma.monthlyExtraInput.findMany({
    where: { yearMonth },
  });
  const extraMap = {};
  for (const e of extraInputs) {
    extraMap[e.staffId] = e;
  }

  // スタッフごとに計算
  const results = [];
  for (const staff of staffs) {
    const staffRecords = allRecords.filter((r) => r.staffId === staff.id);
    const extraInput = extraMap[staff.id] || {};
    const result = calcPayroll(staff, staffRecords, yearMonth, extraInput, monthlySettings, specialRates);

    // DB保存（upsert）— specialRateIncreaseはPayrollRecordに無いカラムなので除外
    const { specialRateIncrease, ...dbResult } = result;
    await prisma.payrollRecord.upsert({
      where: {
        staffId_yearMonth_isBonus: { staffId: staff.id, yearMonth, isBonus: false },
      },
      update: { ...dbResult, calculatedAt: new Date() },
      create: { staffId: staff.id, yearMonth, isBonus: false, ...dbResult, calculatedAt: new Date() },
    });

    results.push({
      staffId: staff.id,
      staffName: staff.name,
      ...result,
      cashBreakdown: calcCashBreakdown(result.netPay),
    });
  }

  res.json(results);
});

// 計算結果一覧取得
router.get('/payroll', adminAuth, async (req, res) => {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const records = await prisma.payrollRecord.findMany({
    where: { yearMonth: month },
    include: { staff: { select: { id: true, name: true } } },
    orderBy: { staff: { createdAt: 'asc' } },
  });

  const results = records.map((r) => ({
    ...r,
    staffName: r.staff.name,
    cashBreakdown: calcCashBreakdown(r.netPay),
  }));

  res.json(results);
});

// 個別明細取得
router.get('/payroll/:staffId', adminAuth, async (req, res) => {
  const { month } = req.query;
  const { staffId } = req.params;
  if (!month) return res.status(400).json({ error: 'monthは必須です' });

  const record = await prisma.payrollRecord.findFirst({
    where: { staffId, yearMonth: month, isBonus: false },
    include: { staff: true },
  });

  if (!record) return res.status(404).json({ error: 'データが見つかりません' });

  res.json({
    ...record,
    staffName: record.staff.name,
    cashBreakdown: calcCashBreakdown(record.netPay),
  });
});

// --- 賞与 ---

// 賞与登録
router.post('/bonus', adminAuth, async (req, res) => {
  const { staffId, yearMonth, grossPay, incomeTax, healthInsurance, careInsurance, pension, employmentInsurance } = req.body;
  if (!staffId || !yearMonth) return res.status(400).json({ error: 'staffIdとyearMonthは必須です' });

  const gross = parseInt(grossPay) || 0;
  const tax = parseInt(incomeTax) || 0;
  const hi = parseInt(healthInsurance) || 0;
  const ci = parseInt(careInsurance) || 0;
  const pen = parseInt(pension) || 0;
  const ei = parseInt(employmentInsurance) || 0;
  const totalDed = tax + hi + ci + pen + ei;

  const record = await prisma.payrollRecord.upsert({
    where: {
      staffId_yearMonth_isBonus: { staffId, yearMonth, isBonus: true },
    },
    update: {
      grossPay: gross, incomeTax: tax, healthInsurance: hi, careInsurance: ci,
      pension: pen, employmentInsurance: ei, totalDeduction: totalDed,
      netPay: gross - totalDed, calculatedAt: new Date(),
    },
    create: {
      staffId, yearMonth, isBonus: true,
      workDays: 0, totalWorkMinutes: 0, normalWorkMinutes: 0,
      overtimeMinutes: 0, nightWorkMinutes: 0, holidayWorkMinutes: 0,
      basePay: gross, overtimePay: 0, nightPay: 0, holidayPay: 0,
      transportAllowance: 0, mealAllowance: 0,
      grossPay: gross, incomeTax: tax, healthInsurance: hi, careInsurance: ci,
      pension: pen, employmentInsurance: ei, mealDeduction: 0, rentDeduction: 0,
      totalDeduction: totalDed, netPay: gross - totalDed,
      calculatedAt: new Date(),
    },
  });

  res.json(record);
});

export default router;
