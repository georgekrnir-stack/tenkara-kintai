import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { LogIn, LogOut, Coffee, Play, X } from 'lucide-react';

const statusColors = {
  not_working: 'bg-gray-100 text-gray-500',
  working: 'bg-green-100 text-green-700',
  on_break: 'bg-yellow-100 text-yellow-700',
  clocked_out: 'bg-blue-100 text-blue-700',
};

const statusLabel = {
  not_working: '未出勤',
  working: '出勤中',
  on_break: '休憩中',
  clocked_out: '退勤済み',
};

const upperButtons = [
  { type: 'clock_in', label: '出勤', color: 'bg-green-500 hover:bg-green-600', allowedFrom: ['not_working', 'clocked_out'], icon: LogIn },
  { type: 'break_start', label: '休憩開始', color: 'bg-yellow-500 hover:bg-yellow-600', allowedFrom: ['working'], icon: Coffee },
  { type: 'break_end', label: '休憩終了', color: 'bg-blue-500 hover:bg-blue-600', allowedFrom: ['on_break'], icon: Play },
];

const clockOutButtons = [
  { type: 'clock_out', mealCount: 0, label: '退勤 まかない0', color: 'bg-red-400 hover:bg-red-500', allowedFrom: ['working'], icon: LogOut },
  { type: 'clock_out', mealCount: 1, label: '退勤 まかない1', color: 'bg-red-500 hover:bg-red-600', allowedFrom: ['working'], icon: LogOut },
  { type: 'clock_out', mealCount: 2, label: '退勤 まかない2', color: 'bg-red-600 hover:bg-red-700', allowedFrom: ['working'], icon: LogOut },
];

export default function PunchPage() {
  const [staffList, setStaffList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStaffList = useCallback(async () => {
    try {
      const res = await api.get('/punch/staff-list');
      setStaffList(res.data);
    } catch {
      // silent
    }
  }, []);

  // リアルタイム時計
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // スタッフ一覧取得（初回＋30秒ごと）
  useEffect(() => {
    fetchStaffList();
    const interval = setInterval(fetchStaffList, 30000);
    return () => clearInterval(interval);
  }, [fetchStaffList]);

  // フィードバック自動消去
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const handlePunch = async (recordType, mealCount = 0) => {
    if (!selected || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/punch', { staffId: selected.id, recordType, mealCount });
      setFeedback({ type: 'success', message: res.data.message });
      setSelected(null);
      fetchStaffList();
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.error || '打刻に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  const timeStr = currentTime.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
  });

  const dateStr = currentTime.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'Asia/Tokyo',
  });

  return (
    <div className="min-h-screen gradient-bg p-6">
      {/* 現在時刻 */}
      <div className="text-center mb-8">
        <p className="text-6xl font-bold gradient-text tabular-nums">{timeStr}</p>
        <p className="text-lg text-gray-500 mt-1">{dateStr}</p>
      </div>

      {/* フィードバック */}
      {feedback && (
        <div className={`max-w-2xl mx-auto mb-6 p-4 rounded-xl text-center text-lg font-medium shadow-md ${
          feedback.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {feedback.message}
        </div>
      )}

      {/* 打刻ボタン（スタッフ選択時） */}
      {selected && (
        <div className="max-w-2xl mx-auto mb-8 bg-white rounded-xl shadow-xl p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">{selected.name}</h2>
            <button onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>
          {/* 上段: 出勤・休憩開始・休憩終了 */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {upperButtons.map((btn) => {
              const enabled = btn.allowedFrom.includes(selected.status);
              const Icon = btn.icon;
              return (
                <button
                  key={btn.type}
                  onClick={() => enabled && handlePunch(btn.type)}
                  disabled={!enabled || loading}
                  className={`py-5 rounded-xl text-white text-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                    enabled ? `${btn.color} btn-hover` : 'bg-gray-300 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  <Icon size={24} />
                  {btn.label}
                </button>
              );
            })}
          </div>
          {/* 下段: 退勤×3（まかない食数選択） */}
          <div className="grid grid-cols-3 gap-3">
            {clockOutButtons.map((btn) => {
              const enabled = btn.allowedFrom.includes(selected.status);
              const Icon = btn.icon;
              return (
                <button
                  key={`clock_out_${btn.mealCount}`}
                  onClick={() => enabled && handlePunch(btn.type, btn.mealCount)}
                  disabled={!enabled || loading}
                  className={`py-5 rounded-xl text-white text-lg font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                    enabled ? `${btn.color} btn-hover` : 'bg-gray-300 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  <Icon size={22} />
                  {btn.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* スタッフ一覧グリッド */}
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {staffList.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`p-4 rounded-xl border-2 text-left transition-all card-hover ${
                selected?.id === s.id
                  ? 'border-blue-500 shadow-lg bg-blue-50/50'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              } bg-white`}
            >
              <p className="text-lg font-bold text-gray-800">{s.name}</p>
              <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  s.status === 'working' ? 'bg-green-500' :
                  s.status === 'on_break' ? 'bg-yellow-500' :
                  s.status === 'clocked_out' ? 'bg-blue-500' : 'bg-gray-400'
                }`} />
                {statusLabel[s.status]}
              </span>
            </button>
          ))}
        </div>
        {staffList.length === 0 && (
          <p className="text-center text-gray-400 mt-8">スタッフが登録されていません</p>
        )}
      </div>
    </div>
  );
}
