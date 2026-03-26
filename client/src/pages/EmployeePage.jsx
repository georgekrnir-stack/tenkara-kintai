import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Timeline from '../components/Timeline';

const empApi = axios.create({ baseURL: '/api/employee' });

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatYen(amount) {
  return `¥${(amount || 0).toLocaleString()}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

const recordTypeLabel = { clock_in: '出勤', clock_out: '退勤', break_start: '休憩開始', break_end: '休憩終了' };

export default function EmployeePage() {
  const { token: urlToken } = useParams();
  const [authToken, setAuthToken] = useState(localStorage.getItem(`emp_token_${urlToken}`));
  const [staffName, setStaffName] = useState(localStorage.getItem(`emp_name_${urlToken}`) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [attendance, setAttendance] = useState(null);
  const [payroll, setPayroll] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('attendance');

  // API interceptor
  useEffect(() => {
    if (authToken) {
      empApi.defaults.headers.common.Authorization = `Bearer ${authToken}`;
    }
  }, [authToken]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('/api/employee/login', { token: urlToken, password });
      setAuthToken(res.data.token);
      setStaffName(res.data.staffName);
      localStorage.setItem(`emp_token_${urlToken}`, res.data.token);
      localStorage.setItem(`emp_name_${urlToken}`, res.data.staffName);
      empApi.defaults.headers.common.Authorization = `Bearer ${res.data.token}`;
    } catch (err) {
      setError(err.response?.data?.error || 'ログインに失敗しました');
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setStaffName('');
    localStorage.removeItem(`emp_token_${urlToken}`);
    localStorage.removeItem(`emp_name_${urlToken}`);
  };

  // データ取得
  useEffect(() => {
    if (!authToken) return;
    empApi.get(`/attendance?month=${month}`)
      .then((res) => setAttendance(res.data))
      .catch((err) => { if (err.response?.status === 401) handleLogout(); });
    empApi.get(`/payroll?month=${month}`)
      .then((res) => setPayroll(res.data))
      .catch(() => {});
    empApi.get('/payroll/history')
      .then((res) => setHistory(res.data))
      .catch(() => {});
  }, [authToken, month]);

  // ログイン画面
  if (!authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
          <h1 className="text-xl font-bold text-center mb-1 text-gray-800">てんから勤怠システム</h1>
          <p className="text-sm text-center text-gray-500 mb-6">従業員ページ</p>
          <form onSubmit={handleLogin}>
            <label className="block text-sm text-gray-700 mb-1">パスワード</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded px-3 py-2 mb-4" placeholder="パスワードを入力" required />
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              ログイン
            </button>
          </form>
        </div>
      </div>
    );
  }

  // タイムライン用データ
  const timelineStaffs = attendance?.days?.map((d) => ({
    id: d.date, name: d.date, records: d.records,
  })) || [];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-gray-800">てんから勤怠</h1>
          <p className="text-xs text-gray-500">{staffName}さんのページ</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">ログアウト</button>
        </div>
      </header>

      {/* タブ */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 mb-4">
          {[
            { key: 'attendance', label: '勤務履歴' },
            { key: 'payroll', label: '給与情報' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-t ${
                tab === t.key ? 'bg-white border-t border-x font-medium' : 'bg-gray-200 text-gray-500'
              }`}>{t.label}</button>
          ))}
        </div>

        {tab === 'attendance' && (
          <div className="space-y-4">
            {/* サマリー */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">当月労働日数</p>
                <p className="text-3xl font-bold text-gray-800">{attendance?.workDays ?? '-'}日</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">当月合計労働時間</p>
                <p className="text-3xl font-bold text-gray-800">{attendance ? formatMinutes(attendance.totalWorkMinutes) : '-'}</p>
              </div>
            </div>

            {/* タイムライン */}
            {timelineStaffs.length > 0 && (
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">タイムライン</h3>
                <Timeline staffs={timelineStaffs} showCurrentTime={false} />
              </div>
            )}

            {/* 日別一覧 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">日付</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">出勤</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">退勤</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">休憩</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">実労働</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance?.days?.map((d) => {
                    const ci = d.records.find((r) => r.recordType === 'clock_in');
                    const co = [...d.records].reverse().find((r) => r.recordType === 'clock_out');
                    return (
                      <tr key={d.date} className="border-b">
                        <td className="px-4 py-3">{d.date}</td>
                        <td className="px-4 py-3 text-center">{ci ? formatTime(ci.recordedAt) : '-'}</td>
                        <td className="px-4 py-3 text-center">{co ? formatTime(co.recordedAt) : '-'}</td>
                        <td className="px-4 py-3 text-center">{d.breakMinutes > 0 ? `${d.breakMinutes}分` : '-'}</td>
                        <td className="px-4 py-3 text-center font-medium">{formatMinutes(d.workMinutes)}</td>
                      </tr>
                    );
                  })}
                  {(!attendance?.days || attendance.days.length === 0) && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'payroll' && (
          <div className="space-y-4">
            {/* 当月給与見込み */}
            {payroll ? (
              <div className="bg-white rounded-lg shadow p-6 max-w-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">当月の給与</h3>
                <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                  <span className="text-gray-600">支給総額:</span><span className="text-right">{formatYen(payroll.grossPay)}</span>
                  <span className="text-gray-600">控除総額:</span><span className="text-right text-red-600">{formatYen(payroll.totalDeduction)}</span>
                </div>
                <div className="border-t-2 pt-3 text-center">
                  <p className="text-xs text-gray-500">差引支給額</p>
                  <p className="text-4xl font-bold text-gray-800">{formatYen(payroll.netPay)}</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-gray-400 text-center">
                当月の給与データがありません
              </div>
            )}

            {/* 過去の明細 */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b">過去の給与明細</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">年月</th>
                    <th className="text-center px-4 py-2 font-medium text-gray-600">区分</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">支給</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">控除</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">差引支給額</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={`${h.yearMonth}_${h.isBonus}`} className="border-b">
                      <td className="px-4 py-2">{h.yearMonth}</td>
                      <td className="px-4 py-2 text-center">{h.isBonus ? '賞与' : '給与'}</td>
                      <td className="px-4 py-2 text-right">{formatYen(h.grossPay)}</td>
                      <td className="px-4 py-2 text-right text-red-600">{formatYen(h.totalDeduction)}</td>
                      <td className="px-4 py-2 text-right font-bold">{formatYen(h.netPay)}</td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">データがありません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
