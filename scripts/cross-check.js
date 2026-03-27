/**
 * 検算スクリプト: 控除内訳.xlsx のデータとアプリの計算結果を比較
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { calcPayroll } from '../server/services/payroll.js';

const prisma = new PrismaClient();

// 控除内訳のデータ（先方提供）
const clientData = {
  '2026-01': {
    'TRANTHI LAN': { gross: 292288, incomeTax: 8040, healthInsurance: 12883, pension: 23790, rent: 15000, employmentInsurance: 1608, meal: 0, net: 230967 },
    '池田優菜': { gross: 65858, incomeTax: 2017, meal: 0, net: 63841 },
    '武田千恵美': { gross: 66128, incomeTax: 2026, meal: 0, net: 64102 },
    '堀田美穂': { gross: 59517, incomeTax: 1823, meal: 0, net: 57694 },
    '大塚恭子': { gross: 27977, incomeTax: 857, net: 27120 },
    '三島恵里加': { gross: 16900, incomeTax: 518, net: 16382 },
    '下方沙世': { gross: 25625, incomeTax: 785, net: 24840 },
    '下方綾華': { gross: 104650, incomeTax: 3205, employmentInsurance: 576, meal: 0, net: 100869 },
    '今藤ひかる': { gross: 14189, incomeTax: 435, net: 13754 },
    '森井翼': { gross: 18263, incomeTax: 559, net: 17704 },
    'HUNGSHIN MIN': { gross: 15626, incomeTax: 479, net: 15147 },
  },
  '2026-02': {
    'TRANTHI LAN': { gross: 268828, incomeTax: 6750, healthInsurance: 12883, pension: 23790, rent: 15000, employmentInsurance: 1479, meal: 0, net: 208926 },
    '池田優菜': { gross: 82109, incomeTax: 2515, meal: 0, net: 79594 },
    '武田千恵美': { gross: 56027, incomeTax: 1716, meal: 0, net: 54311 },
    '堀田美穂': { gross: 55776, incomeTax: 1708, meal: 0, net: 54068 },
    '大塚恭子': { gross: 23765, incomeTax: 728, net: 23037 },
    '山腰明日香': { gross: 3900, incomeTax: 119, net: 3781 },
    '三島恵里加': { gross: 18850, incomeTax: 577, net: 18273 },
    '下方沙世': { gross: 23625, incomeTax: 724, net: 22901 },
    '下方綾華': { gross: 117000, incomeTax: 3584, employmentInsurance: 644, meal: 0, net: 112773 },
    '今藤ひかる': { gross: 9968, incomeTax: 305, net: 9663 },
    '森井翼': { gross: 16791, incomeTax: 514, net: 16277 },
    '木下歩紀': { gross: 66875, incomeTax: 2048, meal: 875, net: 63952 },
    'HUNGSHIN MIN': { gross: 11875, incomeTax: 364, net: 11511 },
  },
};

// シミュレーションCSVのデータ（先方提供）
const simData = {
  '2026-01': {
    'TRANTHI LAN': { days: 22, hours: '194:03', overtime: '24:03', night: '0:00', rate: 1250, basePay: 242564, overtimePay: 7515, nightPay: 0, transport: 0, total: 250079 },
    '池田優菜':   { days: 11, hours: '44:44',  overtime: '2:44',  night: '0:00', rate: 1450, basePay: 64867,  overtimePay: 991,  nightPay: 0, transport: 0, total: 65858 },
    '武田千恵美': { days: 8,  hours: '48:30',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 66128,  overtimePay: 0,    nightPay: 0, transport: 0, total: 66128 },
    '堀田美穂':   { days: 5,  hours: '41:01',  overtime: '4:52',  night: '0:00', rate: 1350, basePay: 55374,  overtimePay: 1643, nightPay: 0, transport: 2500, total: 59517 },
    '大塚恭子':   { days: 6,  hours: '18:30',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 24977,  overtimePay: 0,    nightPay: 0, transport: 3000, total: 27977 },
    '三島恵里加': { days: 4,  hours: '13:00',  overtime: '0:00',  night: '0:00', rate: 1300, basePay: 16900,  overtimePay: 0,    nightPay: 0, transport: 0, total: 16900 },
    '下方沙世':   { days: 3,  hours: '18:30',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 25625,  overtimePay: 0,    nightPay: 0, transport: 0, total: 25625 },
    '下方綾華':   { days: 12, hours: '80:30',  overtime: '0:00',  night: '0:00', rate: 1300, basePay: 104650, overtimePay: 0,    nightPay: 0, transport: 0, total: 104650 },
    '今藤ひかる': { days: 5,  hours: '10:15',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 14189,  overtimePay: 0,    nightPay: 0, transport: 0, total: 14189 },
    '森井翼':     { days: 3,  hours: '13:15',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 18263,  overtimePay: 0,    nightPay: 0, transport: 0, total: 18263 },
    'HUNGSHIN MIN': { days: 4, hours: '12:30', overtime: '0:00',  night: '0:00', rate: 1250, basePay: 15626,  overtimePay: 0,    nightPay: 0, transport: 0, total: 15626 },
  },
  '2026-02': {
    'TRANTHI LAN': { days: 20, hours: '177:22', overtime: '17:23', night: '0:00', rate: 1250, basePay: 221709, overtimePay: 5434, nightPay: 0, transport: 0, total: 227143 },
    '池田優菜':   { days: 13, hours: '55:36',  overtime: '3:51',  night: '0:15', rate: 1450, basePay: 80622,  overtimePay: 1396, nightPay: 91, transport: 0, total: 82109 },
    '武田千恵美': { days: 7,  hours: '41:30',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 56027,  overtimePay: 0,    nightPay: 0, transport: 0, total: 56027 },
    '堀田美穂':   { days: 4,  hours: '38:13',  overtime: '6:13',  night: '0:15', rate: 1350, basePay: 51593,  overtimePay: 2099, nightPay: 84, transport: 2000, total: 55776 },
    '大塚恭子':   { days: 5,  hours: '15:45',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 21265,  overtimePay: 0,    nightPay: 0, transport: 2500, total: 23765 },
    '山腰明日香': { days: 1,  hours: '3:00',   overtime: '0:00',  night: '0:00', rate: 1300, basePay: 3900,   overtimePay: 0,    nightPay: 0, transport: 0, total: 3900 },
    '三島恵里加': { days: 4,  hours: '14:30',  overtime: '0:00',  night: '0:00', rate: 1300, basePay: 18850,  overtimePay: 0,    nightPay: 0, transport: 0, total: 18850 },
    '下方沙世':   { days: 3,  hours: '17:30',  overtime: '0:00',  night: '0:00', rate: 1350, basePay: 23625,  overtimePay: 0,    nightPay: 0, transport: 0, total: 23625 },
    '下方綾華':   { days: 14, hours: '90:00',  overtime: '0:00',  night: '0:00', rate: 1300, basePay: 117000, overtimePay: 0,    nightPay: 0, transport: 0, total: 117000 },
    '今藤ひかる': { days: 2,  hours: '7:23',   overtime: '0:00',  night: '0:00', rate: 1350, basePay: 9968,   overtimePay: 0,    nightPay: 0, transport: 0, total: 9968 },
    '森井翼':     { days: 2,  hours: '12:00',  overtime: '0:00',  night: '1:45', rate: 1350, basePay: 16200,  overtimePay: 0,    nightPay: 591, transport: 0, total: 16791 },
    '木下歩紀':   { days: 10, hours: '55:26',  overtime: '1:11',  night: '0:00', rate: 1200, basePay: 66520,  overtimePay: 355,  nightPay: 0, transport: 0, total: 66875 },
    'HUNGSHIN MIN': { days: 3, hours: '9:30',  overtime: '0:00',  night: '0:00', rate: 1250, basePay: 11875,  overtimePay: 0,    nightPay: 0, transport: 0, total: 11875 },
  },
};

const jstOffset = 9 * 60 * 60 * 1000;

// 名前マッチングヘルパー
function matchName(dbName, targetName) {
  const n = dbName.replace(/\s+/g, '');
  const t = targetName.replace(/\s+/g, '');
  return n.includes(t) || t.includes(n);
}

async function run() {
  const staffs = await prisma.staff.findMany({ where: { isActive: true } });

  // 特別時給取得
  const specialRates = await prisma.specialRate.findMany();

  for (const yearMonth of ['2026-01', '2026-02']) {
    const [year, mon] = yearMonth.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1) - jstOffset);
    const end = new Date(Date.UTC(year, mon, 1) - jstOffset);

    const allRecords = await prisma.timeRecord.findMany({
      where: { recordedAt: { gte: start, lt: end } },
      orderBy: { recordedAt: 'asc' },
    });

    const monthSpecialRates = specialRates.filter(sr =>
      new Date(sr.startDate) < end && new Date(sr.endDate) >= start
    );

    console.log(`\n${'='.repeat(80)}`);
    console.log(`■ ${yearMonth} 検算結果`);
    console.log(`${'='.repeat(80)}`);

    const cdMonth = clientData[yearMonth] || {};
    const smMonth = simData[yearMonth] || {};

    for (const staff of staffs) {
      const staffRecords = allRecords.filter(r => r.staffId === staff.id);
      if (staffRecords.length === 0) continue;

      const result = calcPayroll(staff, staffRecords, yearMonth, {}, { scheduledWorkDays: 22 }, monthSpecialRates);

      // マッチする先方データを探す
      let cdKey = Object.keys(cdMonth).find(k => matchName(staff.name, k));
      let smKey = Object.keys(smMonth).find(k => matchName(staff.name, k));
      const cd = cdKey ? cdMonth[cdKey] : null;
      const sm = smKey ? smMonth[smKey] : null;

      console.log(`\n--- ${staff.name} ---`);

      if (sm) {
        const grossDiff = result.grossPay - sm.total;
        const daysDiff = result.workDays - sm.days;
        console.log(`  [支給] アプリ: ¥${result.grossPay.toLocaleString()} | シミュレーション: ¥${sm.total.toLocaleString()} | 差: ${grossDiff >= 0 ? '+' : ''}${grossDiff.toLocaleString()}`);
        console.log(`    出勤日数: アプリ ${result.workDays}日 / シミュ ${sm.days}日 (差: ${daysDiff})`);
        console.log(`    基本給: ¥${result.basePay.toLocaleString()} / ¥${sm.basePay.toLocaleString()}`);
        console.log(`    残業手当: ¥${result.overtimePay.toLocaleString()} / ¥${sm.overtimePay.toLocaleString()}`);
        console.log(`    深夜手当: ¥${result.nightPay.toLocaleString()} / ¥${sm.nightPay.toLocaleString()}`);
        console.log(`    交通費: ¥${result.transportAllowance.toLocaleString()} / ¥${sm.transport.toLocaleString()}`);
        if (result.specialRateIncrease > 0) {
          console.log(`    特別時給増額分: ¥${result.specialRateIncrease.toLocaleString()}`);
        }
      }

      if (cd) {
        const netDiff = result.netPay - cd.net;
        console.log(`  [控除] アプリ → 控除内訳`);
        console.log(`    所得税: ¥${result.incomeTax.toLocaleString()} / ¥${cd.incomeTax.toLocaleString()} ${result.incomeTax === cd.incomeTax ? '✓' : '✗ 差:' + (result.incomeTax - cd.incomeTax)}`);
        if (cd.healthInsurance) console.log(`    健康保険: ¥${result.healthInsurance.toLocaleString()} / ¥${cd.healthInsurance.toLocaleString()} ${result.healthInsurance === cd.healthInsurance ? '✓' : '✗'}`);
        if (cd.pension) console.log(`    厚生年金: ¥${result.pension.toLocaleString()} / ¥${cd.pension.toLocaleString()} ${result.pension === cd.pension ? '✓' : '✗'}`);
        if (cd.rent) console.log(`    家賃: ¥${result.rentDeduction.toLocaleString()} / ¥${cd.rent.toLocaleString()} ${result.rentDeduction === cd.rent ? '✓' : '✗'}`);
        if (cd.employmentInsurance !== undefined) console.log(`    雇用保険: ¥${result.employmentInsurance.toLocaleString()} / ¥${cd.employmentInsurance.toLocaleString()} ${result.employmentInsurance === cd.employmentInsurance ? '✓' : '✗ 差:' + (result.employmentInsurance - cd.employmentInsurance)}`);
        if (cd.meal !== undefined) console.log(`    賄い: ¥${result.mealDeduction.toLocaleString()} / ¥${cd.meal.toLocaleString()} ${result.mealDeduction === cd.meal ? '✓' : '✗'}`);
        console.log(`  [差引支給額] アプリ: ¥${result.netPay.toLocaleString()} / 控除内訳: ¥${cd.net.toLocaleString()} | 差: ${netDiff >= 0 ? '+' : ''}${netDiff.toLocaleString()}`);
      }
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
