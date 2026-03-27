import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 今日の日付の開始・終了（日本時間ベース）
function getTodayRange() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffset);
  const jstDate = new Date(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());
  const start = new Date(jstDate.getTime() - jstOffset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// スタッフの現在の状態を算出
function getStaffStatus(todayRecords) {
  if (todayRecords.length === 0) return 'not_working';

  const sorted = [...todayRecords].sort(
    (a, b) => new Date(b.recordedAt) - new Date(a.recordedAt)
  );
  const latest = sorted[0].recordType;

  switch (latest) {
    case 'clock_in':
    case 'break_end':
      return 'working';
    case 'break_start':
      return 'on_break';
    case 'clock_out':
      return 'clocked_out';
    default:
      return 'not_working';
  }
}

// 状態遷移の検証
function validateTransition(currentStatus, recordType) {
  const allowed = {
    not_working: ['clock_in'],
    working: ['clock_out', 'break_start'],
    on_break: ['break_end'],
    clocked_out: ['clock_in'], // 再出勤対応
  };

  return (allowed[currentStatus] || []).includes(recordType);
}

const statusLabel = {
  not_working: '未出勤',
  working: '出勤中',
  on_break: '休憩中',
  clocked_out: '退勤済み',
};

const recordTypeLabel = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

// 打刻画面用スタッフ一覧（名前+現在状態）
router.get('/staff-list', async (req, res) => {
  const staffs = await prisma.staff.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  const { start, end } = getTodayRange();

  const todayRecords = await prisma.timeRecord.findMany({
    where: {
      recordedAt: { gte: start, lt: end },
      staff: { isActive: true },
    },
    orderBy: { recordedAt: 'asc' },
  });

  const recordsByStaff = {};
  for (const r of todayRecords) {
    if (!recordsByStaff[r.staffId]) recordsByStaff[r.staffId] = [];
    recordsByStaff[r.staffId].push(r);
  }

  const result = staffs.map((s) => ({
    id: s.id,
    name: s.name,
    status: getStaffStatus(recordsByStaff[s.id] || []),
    statusLabel: statusLabel[getStaffStatus(recordsByStaff[s.id] || [])],
  }));

  res.json(result);
});

// 打刻実行
router.post('/', async (req, res) => {
  const { staffId, recordType, mealCount: rawMealCount } = req.body;

  if (!staffId || !recordType) {
    return res.status(400).json({ error: 'staffIdとrecordTypeは必須です' });
  }

  const validTypes = ['clock_in', 'clock_out', 'break_start', 'break_end'];
  if (!validTypes.includes(recordType)) {
    return res.status(400).json({ error: '無効な打刻種別です' });
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.isActive) {
    return res.status(404).json({ error: 'スタッフが見つかりません' });
  }

  const { start, end } = getTodayRange();
  const todayRecords = await prisma.timeRecord.findMany({
    where: {
      staffId,
      recordedAt: { gte: start, lt: end },
    },
    orderBy: { recordedAt: 'asc' },
  });

  const currentStatus = getStaffStatus(todayRecords);

  if (!validateTransition(currentStatus, recordType)) {
    return res.status(400).json({
      error: `${statusLabel[currentStatus]}の状態では${recordTypeLabel[recordType]}できません`,
    });
  }

  // mealCountは退勤時のみ保存（0〜2）
  const mealCount = recordType === 'clock_out'
    ? Math.max(0, Math.min(2, parseInt(rawMealCount) || 0))
    : 0;

  const now = new Date();
  const record = await prisma.timeRecord.create({
    data: {
      staffId,
      recordType,
      recordedAt: now,
      mealCount,
    },
  });

  // 打刻時刻を日本時間でフォーマット
  const timeStr = now.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });

  const mealMsg = recordType === 'clock_out' && mealCount > 0
    ? ` (まかない${mealCount}食)`
    : '';

  res.status(201).json({
    record,
    message: `${staff.name}さん、${recordTypeLabel[recordType]}しました ${timeStr}${mealMsg}`,
  });
});

export default router;
