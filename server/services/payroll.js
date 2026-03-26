import { calcMonthlyAttendance } from './attendance.js';
import { calcIncomeTax } from './tax.js';

/**
 * 1名分の給与計算
 * @param staff - スタッフ情報
 * @param records - 月間の打刻レコード
 * @param yearMonth - 'YYYY-MM'
 * @param extraInput - 月次手動入力 { mealCount, mealDeductionCount }
 * @param monthlySettings - { scheduledWorkDays } 所定労働日数
 * @returns 給与計算結果
 */
export function calcPayroll(staff, records, yearMonth, extraInput = {}, monthlySettings = {}) {
  const attendance = calcMonthlyAttendance(records, yearMonth);

  const {
    workDays,
    totalWorkMinutes,
    normalWorkMinutes,
    overtimeMinutes,
    nightWorkMinutes,
    holidayWorkMinutes,
  } = attendance;

  // --- 支給額計算 ---
  let basePay = 0;
  let overtimePay = 0;
  let nightPay = 0;
  let holidayPay = 0;

  if (staff.salaryType === 'hourly') {
    // 時給制
    const rate = staff.hourlyRate || 0;
    basePay = Math.round(rate * (normalWorkMinutes / 60));
    overtimePay = Math.round(rate * 1.25 * (overtimeMinutes / 60));
    nightPay = Math.round(rate * 1.25 * (nightWorkMinutes / 60));
    holidayPay = Math.round(rate * 1.25 * (holidayWorkMinutes / 60));
  } else {
    // 月給制
    basePay = staff.monthlySalary || 0;
    const overtimeRate = staff.hourlyRate || 0;
    overtimePay = Math.round(overtimeRate * 1.25 * (overtimeMinutes / 60));
    nightPay = Math.round(overtimeRate * 1.25 * (nightWorkMinutes / 60));
    holidayPay = Math.round(overtimeRate * 1.25 * (holidayWorkMinutes / 60));

    // 欠勤控除（ノーワーク・ノーペイ）
    const scheduledDays = monthlySettings.scheduledWorkDays || 22;
    if (workDays < scheduledDays) {
      const dailyRate = Math.round(basePay / scheduledDays);
      const absenceDays = scheduledDays - workDays;
      basePay = Math.max(0, basePay - dailyRate * absenceDays);
    }
  }

  // 交通費
  const transportAllowance = staff.hasTransportAllowance ? workDays * 500 : 0;

  // まかない手当
  const mealCount = extraInput.mealCount || 0;
  const mealAllowance = mealCount * 125;

  // 支給総額
  const grossPay = basePay + overtimePay + nightPay + holidayPay + transportAllowance + mealAllowance;

  // --- 控除額計算 ---
  const healthInsurance = staff.healthInsuranceAmount || 0;
  const careInsurance = staff.careInsuranceAmount || 0;
  const pension = staff.pensionAmount || 0;

  // 雇用保険料
  const employmentInsurance = staff.hasEmploymentInsurance
    ? Math.floor(grossPay * 0.005)
    : 0;

  // 社会保険料合計
  const socialInsurance = healthInsurance + careInsurance + pension + employmentInsurance;

  // 所得税
  const taxableAmount = grossPay - transportAllowance - socialInsurance;
  const incomeTax = calcIncomeTax(taxableAmount, staff.taxColumn);

  // 食事代控除
  const mealDeductionCount = extraInput.mealDeductionCount || 0;
  const mealDeduction = staff.hasMealDeduction ? mealDeductionCount * 125 : 0;

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
