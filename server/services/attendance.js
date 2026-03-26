/**
 * 勤務時間集計ロジック
 *
 * - 1日の実労働 = (退勤 - 出勤) - 休憩合計
 * - 通常 = min(実労働, 480分)
 * - 残業 = max(実労働 - 480分, 0)
 * - 深夜 = 22:00〜翌5:00の実労働（休憩除く）
 * - 休日 = 週(水〜火)の6日目以降
 * - 割増率: 1.25（重複時も加算しない）
 */

const JST_OFFSET = 9 * 60 * 60 * 1000;

// JST基準で日付文字列(YYYY-MM-DD)を返す
function toJSTDateStr(date) {
  const jst = new Date(date.getTime() + JST_OFFSET);
  return jst.toISOString().slice(0, 10);
}

// JST基準で時分を返す { hour, minute }
function toJSTTime(date) {
  const jst = new Date(date.getTime() + JST_OFFSET);
  return { hour: jst.getUTCHours(), minute: jst.getUTCMinutes() };
}

/**
 * 1日分の打刻レコードから勤務セグメントを計算
 * @returns { workSegments: [{start, end}], breakSegments: [{start, end}], clockIn, clockOut }
 */
function parseDayRecords(records) {
  const sorted = [...records].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  const workSegments = [];
  const breakSegments = [];
  let clockIn = null;
  let clockOut = null;
  let segStart = null;
  let breakStart = null;

  for (const r of sorted) {
    const t = new Date(r.recordedAt);
    switch (r.recordType) {
      case 'clock_in':
        clockIn = clockIn || t;
        segStart = t;
        break;
      case 'break_start':
        if (segStart) {
          workSegments.push({ start: segStart, end: t });
          segStart = null;
        }
        breakStart = t;
        break;
      case 'break_end':
        if (breakStart) {
          breakSegments.push({ start: breakStart, end: t });
          breakStart = null;
        }
        segStart = t;
        break;
      case 'clock_out':
        if (breakStart) {
          breakSegments.push({ start: breakStart, end: t });
          breakStart = null;
        }
        if (segStart) {
          workSegments.push({ start: segStart, end: t });
          segStart = null;
        }
        clockOut = t;
        break;
    }
  }

  return { workSegments, breakSegments, clockIn, clockOut };
}

/**
 * 深夜時間（22:00〜翌5:00）の重なり分数を計算
 */
function calcNightMinutes(workSegments, dateStr) {
  // dateStr の 22:00 JST → UTC
  const [y, m, d] = dateStr.split('-').map(Number);
  const nightStart = new Date(Date.UTC(y, m - 1, d, 22 - 9, 0, 0)); // 22:00 JST
  const nightEnd = new Date(Date.UTC(y, m - 1, d + 1, 5 - 9, 0, 0)); // 翌5:00 JST

  let minutes = 0;
  for (const seg of workSegments) {
    const overlapStart = Math.max(seg.start.getTime(), nightStart.getTime());
    const overlapEnd = Math.min(seg.end.getTime(), nightEnd.getTime());
    if (overlapEnd > overlapStart) {
      minutes += (overlapEnd - overlapStart) / 60000;
    }
  }
  return Math.round(minutes);
}

/**
 * 1日分の勤務時間集計結果を返す
 */
function calcDaySummary(records, dateStr) {
  const { workSegments, breakSegments, clockIn, clockOut } = parseDayRecords(records);

  let totalWorkMinutes = 0;
  for (const seg of workSegments) {
    totalWorkMinutes += (seg.end - seg.start) / 60000;
  }
  totalWorkMinutes = Math.round(totalWorkMinutes);

  let breakMinutes = 0;
  for (const seg of breakSegments) {
    breakMinutes += (seg.end - seg.start) / 60000;
  }
  breakMinutes = Math.round(breakMinutes);

  const normalMinutes = Math.min(totalWorkMinutes, 480);
  const overtimeMinutes = Math.max(totalWorkMinutes - 480, 0);
  const nightMinutes = calcNightMinutes(workSegments, dateStr);

  return {
    dateStr,
    clockIn,
    clockOut,
    totalWorkMinutes,
    breakMinutes,
    normalMinutes,
    overtimeMinutes,
    nightMinutes,
    workSegments,
  };
}

/**
 * 週(水〜火)の起算日に基づき、休日判定を行う
 * 1週間で6日目以降の勤務を休日扱い
 * @returns Map<dateStr, boolean> true=休日勤務
 */
function calcHolidayDays(daySummaries) {
  if (daySummaries.length === 0) return new Map();

  // 出勤日（実労働 > 0）の日付を時系列でソート
  const workDates = daySummaries
    .filter((d) => d.totalWorkMinutes > 0)
    .map((d) => d.dateStr)
    .sort();

  const holidayMap = new Map();

  // 各出勤日を週に分類（水曜起算）
  for (const dateStr of workDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0=日, 3=水
    // 水曜起算: 水=0, 木=1, 金=2, 土=3, 日=4, 月=5, 火=6
    const offsetFromWed = (dayOfWeek - 3 + 7) % 7;
    // 週の開始日（水曜日）
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - offsetFromWed);
    const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

    if (!holidayMap.has(weekKey)) {
      holidayMap.set(weekKey, []);
    }
    holidayMap.get(weekKey).push(dateStr);
  }

  // 各週で6日目以降を休日判定
  const result = new Map();
  for (const [, dates] of holidayMap) {
    dates.sort();
    dates.forEach((d, i) => {
      result.set(d, i >= 5); // 0-indexed: 5 = 6日目
    });
  }

  return result;
}

/**
 * 月次の勤務時間を集計
 * @param records - time_records配列
 * @param yearMonth - 'YYYY-MM'
 * @returns 集計結果
 */
export function calcMonthlyAttendance(records, yearMonth) {
  // 日別にグルーピング
  const byDate = {};
  for (const r of records) {
    const dateStr = toJSTDateStr(new Date(r.recordedAt));
    if (!dateStr.startsWith(yearMonth)) continue;
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(r);
  }

  // 日別サマリー
  const daySummaries = Object.entries(byDate).map(([dateStr, recs]) =>
    calcDaySummary(recs, dateStr)
  );

  // 休日判定
  const holidayMap = calcHolidayDays(daySummaries);

  // 月合計
  let workDays = 0;
  let totalWorkMinutes = 0;
  let normalWorkMinutes = 0;
  let overtimeMinutes = 0;
  let nightWorkMinutes = 0;
  let holidayWorkMinutes = 0;

  for (const d of daySummaries) {
    if (d.totalWorkMinutes > 0) workDays++;
    const isHoliday = holidayMap.get(d.dateStr) || false;

    if (isHoliday) {
      // 休日勤務は全て休日時間（深夜と重複しても1.25のまま）
      holidayWorkMinutes += d.totalWorkMinutes;
      nightWorkMinutes += d.nightMinutes;
    } else {
      totalWorkMinutes += d.totalWorkMinutes;
      normalWorkMinutes += d.normalMinutes;
      overtimeMinutes += d.overtimeMinutes;
      nightWorkMinutes += d.nightMinutes;
    }
  }

  // 通常時間から深夜時間（通常日分のみ）を差し引く必要はない
  // 深夜手当は深夜時間に対して×1.25、残業手当は残業時間に対して×1.25
  // 重複時は1.25のまま（加算しない）ため、
  // 深夜かつ残業の時間はどちらか一方で計算する
  // → 深夜時間をまず確保し、残業時間から深夜残業分を除外

  // 通常日の深夜時間のうち、残業に含まれる分
  const normalDayNight = daySummaries
    .filter((d) => !holidayMap.get(d.dateStr))
    .reduce((sum, d) => sum + d.nightMinutes, 0);

  // 残業時間から「深夜かつ残業」分を除外して二重計算を防ぐ
  // 深夜時間はそのまま×1.25、残業時間は深夜でない残業分のみ×1.25
  const pureOvertimeMinutes = Math.max(0, overtimeMinutes - normalDayNight);

  return {
    workDays,
    totalWorkMinutes: totalWorkMinutes + holidayWorkMinutes,
    normalWorkMinutes,
    overtimeMinutes: pureOvertimeMinutes,
    nightWorkMinutes,
    holidayWorkMinutes,
    daySummaries,
    holidayMap,
  };
}
