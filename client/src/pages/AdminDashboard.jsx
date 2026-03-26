import { useState, useEffect } from 'react';
import api from '../lib/api';
import Timeline from '../components/Timeline';
import { UserCheck, Coffee, LogOut as LogOutIcon, UserX } from 'lucide-react';

const statusColors = {
  not_working: 'bg-gray-100 text-gray-500',
  working: 'bg-green-100 text-green-700',
  on_break: 'bg-yellow-100 text-yellow-700',
  clocked_out: 'bg-blue-100 text-blue-700',
};

const summaryCards = [
  { key: 'working', label: '出勤中', color: 'text-green-600', bgIcon: 'bg-green-100', icon: UserCheck },
  { key: 'on_break', label: '休憩中', color: 'text-yellow-600', bgIcon: 'bg-yellow-100', icon: Coffee },
  { key: 'clocked_out', label: '退勤済み', color: 'text-blue-600', bgIcon: 'bg-blue-100', icon: LogOutIcon },
  { key: 'not_working', label: '未出勤', color: 'text-gray-400', bgIcon: 'bg-gray-100', icon: UserX },
];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  );

  useEffect(() => {
    api.get(`/admin/dashboard/today?date=${selectedDate}`)
      .then((res) => setData(res.data))
      .catch(() => {});
  }, [selectedDate]);

  const isToday = selectedDate === new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.key} className="bg-white rounded-xl shadow-lg p-4 card-hover">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-gray-500">{card.label}</h3>
                <div className={`w-8 h-8 rounded-lg ${card.bgIcon} flex items-center justify-center`}>
                  <Icon size={16} className={card.color} />
                </div>
              </div>
              <p className={`text-3xl font-bold ${card.color} mt-1`}>{data?.counts?.[card.key] ?? '-'}</p>
            </div>
          );
        })}
      </div>

      {/* タイムライン */}
      {data?.staffs && (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6 card-hover">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">タイムライン</h3>
          <Timeline staffs={data.staffs} showCurrentTime={isToday} />
        </div>
      )}

      {/* スタッフ状況一覧 */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="gradient-table-header border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">スタッフ</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">状態</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">打刻履歴</th>
            </tr>
          </thead>
          <tbody>
            {data?.staffs?.map((s) => (
              <tr key={s.id} className="border-b hover:bg-blue-50/30 transition-colors even:bg-gray-50/50">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[s.status]}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      s.status === 'working' ? 'bg-green-500' :
                      s.status === 'on_break' ? 'bg-yellow-500' :
                      s.status === 'clocked_out' ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    {s.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {s.records.map((r) => {
                    const time = new Date(r.recordedAt).toLocaleTimeString('ja-JP', {
                      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
                    });
                    const labels = { clock_in: '出勤', clock_out: '退勤', break_start: '休憩開始', break_end: '休憩終了' };
                    return `${labels[r.recordType]} ${time}`;
                  }).join(' → ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
