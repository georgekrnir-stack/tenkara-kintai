import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { adminAuth } from '../middleware/auth.js';

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
    pensionAmount, hasMealDeduction, rentDeduction, hasTransportAllowance,
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
      hasMealDeduction: !!hasMealDeduction,
      rentDeduction: parseInt(rentDeduction) || 0,
      hasTransportAllowance: !!hasTransportAllowance,
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
    pensionAmount, hasMealDeduction, rentDeduction, hasTransportAllowance,
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
    hasMealDeduction: !!hasMealDeduction,
    rentDeduction: parseInt(rentDeduction) || 0,
    hasTransportAllowance: !!hasTransportAllowance,
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

export default router;
