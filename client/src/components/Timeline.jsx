import { useMemo } from 'react';

// タイムライン: 6:00〜翌2:00（20時間）
const START_HOUR = 6;
const END_HOUR = 26; // 翌2:00
const TOTAL_HOURS = END_HOUR - START_HOUR;

function toMinutesSinceStart(dateStr) {
  const d = new Date(dateStr);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  let h = jst.getUTCHours();
  const m = jst.getUTCMinutes();
  // 0:00〜2:00は翌日扱い（26時間表記）
  if (h < START_HOUR) h += 24;
  return (h - START_HOUR) * 60 + m;
}

function getPercent(minutes) {
  return Math.max(0, Math.min(100, (minutes / (TOTAL_HOURS * 60)) * 100));
}

export default function Timeline({ staffs, showCurrentTime = false }) {
  const currentMinutes = useMemo(() => {
    if (!showCurrentTime) return null;
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    let h = jst.getUTCHours();
    const m = jst.getUTCMinutes();
    if (h < START_HOUR) h += 24;
    return (h - START_HOUR) * 60 + m;
  }, [showCurrentTime]);

  // 時間軸ラベル生成
  const hourLabels = [];
  for (let h = START_HOUR; h <= END_HOUR; h += 2) {
    hourLabels.push({ hour: h % 24, pos: getPercent((h - START_HOUR) * 60) });
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* 時間軸 */}
        <div className="flex items-end ml-20 mb-1 relative h-5">
          {hourLabels.map((l) => (
            <span key={l.hour} className="absolute text-[10px] text-gray-400 -translate-x-1/2"
              style={{ left: `${l.pos}%` }}>
              {l.hour}:00
            </span>
          ))}
        </div>

        {/* 各スタッフのバー */}
        {staffs.map((s) => (
          <StaffRow key={s.id} staff={s} currentMinutes={currentMinutes} />
        ))}

        {/* 深夜帯背景 & 現在時刻ラインは各行に統合 */}
      </div>
    </div>
  );
}

function StaffRow({ staff, currentMinutes }) {
  const segments = useMemo(() => {
    const records = staff.records || [];
    if (records.length === 0) return [];

    const segs = [];
    let currentIn = null;
    let currentBreakStart = null;

    for (const r of records) {
      const mins = toMinutesSinceStart(r.recordedAt);

      switch (r.recordType) {
        case 'clock_in':
          currentIn = mins;
          break;
        case 'break_start':
          if (currentIn !== null) {
            segs.push({ start: currentIn, end: mins, type: 'work' });
          }
          currentBreakStart = mins;
          break;
        case 'break_end':
          if (currentBreakStart !== null) {
            segs.push({ start: currentBreakStart, end: mins, type: 'break' });
          }
          currentIn = mins;
          currentBreakStart = null;
          break;
        case 'clock_out':
          if (currentBreakStart !== null) {
            segs.push({ start: currentBreakStart, end: mins, type: 'break' });
            currentBreakStart = null;
          } else if (currentIn !== null) {
            segs.push({ start: currentIn, end: mins, type: 'work' });
          }
          currentIn = null;
          break;
      }
    }

    // まだ退勤していない場合
    if (currentIn !== null && currentMinutes !== null) {
      segs.push({ start: currentIn, end: currentMinutes, type: 'work' });
    }
    if (currentBreakStart !== null && currentMinutes !== null) {
      segs.push({ start: currentBreakStart, end: currentMinutes, type: 'break' });
    }

    return segs;
  }, [staff.records, currentMinutes]);

  // 深夜帯の位置（22:00〜翌2:00）
  const nightStart = getPercent((22 - START_HOUR) * 60);
  const nightEnd = 100;

  return (
    <div className="flex items-center mb-1">
      <div className="w-20 text-xs text-gray-600 font-medium truncate pr-2 text-right">
        {staff.name}
      </div>
      <div className="flex-1 relative h-6 bg-gray-50 rounded border border-gray-100">
        {/* 深夜帯背景 */}
        <div
          className="absolute top-0 bottom-0 bg-purple-50 opacity-60"
          style={{ left: `${nightStart}%`, right: `${100 - nightEnd}%` }}
        />

        {/* 勤務/休憩バー */}
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`absolute top-0.5 bottom-0.5 rounded-sm ${
              seg.type === 'work' ? 'bg-blue-400' : 'bg-gray-300'
            }`}
            style={{
              left: `${getPercent(seg.start)}%`,
              width: `${Math.max(0.5, getPercent(seg.end) - getPercent(seg.start))}%`,
            }}
            title={`${Math.floor(seg.start / 60 + START_HOUR)}:${String(seg.start % 60).padStart(2, '0')} - ${Math.floor(seg.end / 60 + START_HOUR)}:${String(seg.end % 60).padStart(2, '0')} (${seg.type === 'work' ? '勤務' : '休憩'})`}
          />
        ))}

        {/* 現在時刻ライン */}
        {currentMinutes !== null && currentMinutes >= 0 && currentMinutes <= TOTAL_HOURS * 60 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ left: `${getPercent(currentMinutes)}%` }}
          />
        )}
      </div>
    </div>
  );
}
