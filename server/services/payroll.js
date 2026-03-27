import { calcMonthlyAttendance } from './attendance.js';
import { calcIncomeTax } from './tax.js';

/**
 * 特別時給の増額を取得（該当日に複数重なる場合は合算）
 * @param dateStr - 'YYYY-MM-DD'
 * @param specialRates - SpecialRate配列
 * @returns 増額合計（円）
 */
function getSpecialIncrease(dateStr, specialRates) {
  if (!specialRates || specialRates.length === 0) return 0;
  const dayStart = new Date(dateStr + 'T00:00:00+09:00');
  const dayEnd = new Date(dateStr + 'T23:59:59+09:00');
  let increase = 0;
  for (const sr of specialRates) {
    const srStart = new Date(sr.startDate);
    const srEnd = new Date(sr.endDate);
    // 期間が日と重なるか判定（startDate〜endDateの日付範囲）
    if (srStart <= dayEnd && srEnd >= dayStart) {
      increase += sr.amountIncrease;
    }
  }
  return increase;
}

/**
 * 1名分の給与計算
 * @param staff - スタッフ情報
 * @param records - 月間の打刻レコード
 * @param yearMonth - 'YYYY-MM'
 * @param extraInput - 月次手動入力 { mealCount, mealDeductionCount }
 * @param monthlySettings - { scheduledWorkDays } 所定労働日数
 * @param specialRates - SpecialRate配列（特別時給設定）
 * @returns 給与計算結果
 */
export function calcPayroll(staff, records, yearMonth, extraInput = {}, monthlySettings = {}, specialRates = []) {
  const attendance = calcMonthlyAttendance(records, yearMonth);

  const {
    workDays,
    totalWorkMinutes,
    normalWorkMinutes,
    overtimeMinutes,
    nightWorkMinutes,
    holidayWorkMinutes,
    daySummaries,
    holidayMap,
  } = attendance;

  // --- 支給額計算 ---
  let basePay = 0;
  let overtimePay = 0;
  let nightPay = 0;
  let holidayPay = 0;
  let specialRateIncrease = 0;

  if (staff.salaryType === 'hourly') {
    const baseRate = staff.hourlyRate || 0;
    const hasSpecial = specialRates && specialRates.length > 0;

    if (hasSpecial) {
      // 日別計算: 特別時給がある場合は日ごとにレートを決定して合算
      // 通常日の深夜時間を追跡（二重計算防止用）
      let totalNormalDayNight = 0;
      let totalOvertimeRaw = 0;

      for (const d of daySummaries) {
        if (d.totalWorkMinutes === 0) continue;
        const increase = getSpecialIncrease(d.dateStr, specialRates);
        const dayRate = baseRate + increase;
        const isHoliday = holidayMap.get(d.dateStr) || false;

        if (isHoliday) {
          // 休日: 全労働時間を基本給 + 休日割増
          basePay += dayRate * (d.totalWorkMinutes / 60);
          holidayPay += dayRate * 0.25 * (d.totalWorkMinutes / 60);
          nightPay += dayRate * 0.25 * (d.nightMinutes / 60);
        } else {
          // 通常日: 全労働時間を基本給
          basePay += dayRate * (d.totalWorkMinutes / 60);
          overtimePay += dayRate * 0.25 * (d.overtimeMinutes / 60);
          nightPay += dayRate * 0.25 * (d.nightMinutes / 60);
          totalNormalDayNight += d.nightMinutes;
          totalOvertimeRaw += d.overtimeMinutes;
        }

        if (increase > 0) {
          specialRateIncrease += increase * (d.totalWorkMinutes / 60);
        }
      }

      // 残業と深夜の二重計算を補正（通常日の深夜残業分）
      // 既存ロジックと同様: 残業時間から深夜分を除外
      const pureOvertimeMinutes = Math.max(0, totalOvertimeRaw - totalNormalDayNight);
      // overtimePayを再計算（日ごとの増額レートを考慮するため、差分を調整）
      // → 日別計算なので、overtimePay の各日分から深夜重複分を引く必要がある
      // 簡易方式: 日別に正確に計算するため、overtimePayをリセットして再計算
      overtimePay = 0;
      for (const d of daySummaries) {
        if (d.totalWorkMinutes === 0) continue;
        const isHoliday = holidayMap.get(d.dateStr) || false;
        if (isHoliday) continue;
        const increase = getSpecialIncrease(d.dateStr, specialRates);
        const dayRate = baseRate + increase;
        // その日の純残業時間（深夜でない残業）
        const dayPureOvertime = Math.max(0, d.overtimeMinutes - d.nightMinutes);
        overtimePay += dayRate * 0.25 * (dayPureOvertime / 60);
      }

      basePay = Math.round(basePay);
      overtimePay = Math.round(overtimePay);
      nightPay = Math.round(nightPay);
      holidayPay = Math.round(holidayPay);
      specialRateIncrease = Math.round(specialRateIncrease);
    } else {
      // 従来ロジック: 単一レートで一括計算
      basePay = Math.round(baseRate * (totalWorkMinutes / 60));
      overtimePay = Math.round(baseRate * 0.25 * (overtimeMinutes / 60));
      nightPay = Math.round(baseRate * 0.25 * (nightWorkMinutes / 60));
      holidayPay = Math.round(baseRate * 0.25 * (holidayWorkMinutes / 60));
    }
  } else {
    // 月給制
    basePay = staff.monthlySalary || 0;
    const overtimeRate = staff.hourlyRate || 0;

    const hasSpecial = specialRates && specialRates.length > 0;
    if (hasSpecial) {
      // 月給制: 残業等の割増計算にのみ増額レートを適用
      for (const d of daySummaries) {
        if (d.totalWorkMinutes === 0) continue;
        const increase = getSpecialIncrease(d.dateStr, specialRates);
        const dayOvertimeRate = overtimeRate + increase;
        const isHoliday = holidayMap.get(d.dateStr) || false;

        if (isHoliday) {
          overtimePay += dayOvertimeRate * 1.25 * (d.totalWorkMinutes / 60);
          nightPay += dayOvertimeRate * 0.25 * (d.nightMinutes / 60);
        } else {
          const dayPureOvertime = Math.max(0, d.overtimeMinutes - d.nightMinutes);
          overtimePay += dayOvertimeRate * 1.25 * (dayPureOvertime / 60);
          nightPay += dayOvertimeRate * 0.25 * (d.nightMinutes / 60);
        }

        if (increase > 0) {
          specialRateIncrease += increase * (d.totalWorkMinutes / 60);
        }
      }
      overtimePay = Math.round(overtimePay);
      nightPay = Math.round(nightPay);
      holidayPay = 0; // holidayは overtimePay に含む
      specialRateIncrease = Math.round(specialRateIncrease);
    } else {
      // 従来ロジック
      overtimePay = Math.round(overtimeRate * 1.25 * (overtimeMinutes / 60));
      nightPay = Math.round(overtimeRate * 0.25 * (nightWorkMinutes / 60));
      holidayPay = Math.round(overtimeRate * 1.25 * (holidayWorkMinutes / 60));
    }

    // 欠勤控除（ノーワーク・ノーペイ）
    const scheduledDays = monthlySettings.scheduledWorkDays || 22;
    if (workDays < scheduledDays) {
      const dailyRate = Math.round(basePay / scheduledDays);
      const absenceDays = scheduledDays - workDays;
      basePay = Math.max(0, basePay - dailyRate * absenceDays);
    }
  }

  // 交通費
  const dailyTransport = staff.transportAllowanceDaily || 500;
  const transportAllowance = staff.hasTransportAllowance ? workDays * dailyTransport : 0;

  // まかない手当は廃止（常に0）
  const mealAllowance = 0;

  // 支給総額（specialRateIncreaseは既にbasePayに含まれているため加算不要）
  const grossPay = basePay + overtimePay + nightPay + holidayPay + transportAllowance;

  // --- 控除額計算 ---
  const healthInsurance = staff.healthInsuranceAmount || 0;
  const careInsurance = staff.careInsuranceAmount || 0;
  const pension = staff.pensionAmount || 0;

  // 雇用保険料（令和7年度 一般の事業 労働者負担 5.5/1000）
  const employmentInsurance = staff.hasEmploymentInsurance
    ? Math.round(grossPay * 0.0055)
    : 0;

  // 社会保険料合計
  const socialInsurance = healthInsurance + careInsurance + pension + employmentInsurance;

  // 所得税
  const taxableAmount = grossPay - transportAllowance - socialInsurance;
  const incomeTax = calcIncomeTax(taxableAmount, staff.taxColumn);

  // 食事代控除（TimeRecordのclock_outレコードから自動集計）
  const mealDeduction = records
    .filter(r => r.recordType === 'clock_out')
    .reduce((sum, r) => sum + (r.mealCount || 0), 0) * 125;

  // 家賃控除
  const rentDeduction = staff.rentDeduction || 0;

  // 控除総額
  const totalDeduction = incomeTax + healthInsurance + careInsurance + pension + employmentInsurance + mealDeduction + rentDeduction;

  // 差引支給額
  const netPay = grossPay - totalDeduction;

  return {
    workDays,
    totalWorkMinutes,
    normalWorkMinutes,
    overtimeMinutes,
    nightWorkMinutes,
    holidayWorkMinutes,
    basePay,
    overtimePay,
    nightPay,
    holidayPay,
    transportAllowance,
    mealAllowance,
    grossPay,
    incomeTax,
    healthInsurance,
    careInsurance,
    pension,
    employmentInsurance,
    mealDeduction,
    rentDeduction,
    totalDeduction,
    netPay,
    specialRateIncrease,
  };
}

/**
 * 差引支給額から紙幣・硬貨の内訳を計算
 */
export function calcCashBreakdown(amount) {
  const denominations = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];
  const result = [];
  let remaining = Math.max(0, amount);

  for (const denom of denominations) {
    const count = Math.floor(remaining / denom);
    if (count > 0) {
      result.push({ denomination: denom, count });
      remaining -= denom * count;
    }
  }

  return result;
}
