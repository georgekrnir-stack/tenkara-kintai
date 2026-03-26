import { useState, useEffect } from 'react';
import api from '../lib/api';
import Timeline from '../components/Timeline';

const statusColors = {
  not_working: 'bg-gray-100 text-gray-500',
  working: 'bg-green-100 text-green-700',
  on_break: 'bg-yellow-100 text-yellow-700',
  clocked_out: 'bg-blue-100 text-blue-700',
};

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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">ダッシュボード</h2>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-500">出勤中</h3>
          <p className="text-3xl font-bold text-green-600 mt-1">{data?.counts?.working ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-500">休憩中</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-1">{data?.counts?.on_break ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-500">退勤済み</h3>
          <p className="text-3xl font-bold text-blue-600 mt-1">{data?.counts?.clocked_out ?? '-'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-xs font-medium text-gray-500">未出勤</h3>
          <p className="text-3xl font-bold text-gray-400 mt-1">{data?.counts?.not_working ?? '-'}</p>
        </div>
      </div>

      {/* タイムライン */}
      {data?.staffs && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">タイムライン</h3>
          <Timeline staffs={data.staffs} showCurrentTime={isToday} />
        </div>
      )}

      {/* スタッフ状況一覧 */}
      <div className="bg-white rounded-lg shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">スタッフ</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">打刻履歴</th>
            </tr>
          </thead>
          <tbody>
            {data?.staffs?.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[s.status]}`}>
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
