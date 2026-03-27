import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Calculator, Settings, BarChart3, ArrowLeft, Save, Play } from 'lucide-react';

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function formatYen(amount) {
  return `¥${(amount || 0).toLocaleString()}`;
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

const denomLabels = {
  10000: '一万円札', 5000: '五千円札', 1000: '千円札',
  500: '500円', 100: '100円', 50: '50円', 10: '10円', 5: '5円', 1: '1円',
};

export default function Payroll() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [results, setResults] = useState([]);
  const [extraInputs, setExtraInputs] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [monthlySettings, setMonthlySettings] = useState({ scheduledWorkDays: 22 });
  const [calculating, setCalculating] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [tab, setTab] = useState('settings'); // 'settings' | 'results' | 'detail'

  useEffect(() => {
    api.get('/admin/staff').then((res) => setStaffList(res.data.filter((s) => s.isActive)));
  }, []);

  useEffect(() => {
    // 月次設定と手動入力を取得
    api.get(`/admin/monthly-settings?month=${month}`)
      .then((res) => setMonthlySettings(res.data))
      .catch(() => {});
    api.get(`/admin/monthly-extra?month=${month}`)
      .then((res) => {
        const map = {};
        for (const e of res.data) map[e.staffId] = e;
        setExtraInputs(map);
      })
      .catch(() => {});
    // 既存の計算結果を取得
    api.get(`/admin/payroll?month=${month}`)
      .then((res) => { if (res.data.length) setResults(res.data); })
      .catch(() => {});
  }, [month]);

  const saveMonthlySettings = async () => {
    await api.put('/admin/monthly-settings', { month, ...monthlySettings });
    alert('保存しました');
  };

  const saveExtraInput = async (staffId, data) => {
    await api.put('/admin/monthly-extra', { staffId, yearMonth: month, ...data });
    const res = await api.get(`/admin/monthly-extra?month=${month}`);
    const map = {};
    for (const e of res.data) map[e.staffId] = e;
    setExtraInputs(map);
  };

  const calculate = async () => {
    setCalculating(true);
    try {
      const res = await api.post('/admin/payroll/calculate', { yearMonth: month });
      setResults(res.data);
      setTab('results');
    } catch (err) {
      alert(err.response?.data?.error || '計算に失敗しました');
    } finally {
      setCalculating(false);
    }
  };

  const tabItems = [
    { key: 'settings', label: '月次設定', icon: Settings },
    { key: 'results', label: '計算結果', icon: BarChart3 },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">給与計算</h2>
        <input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setTab('settings'); }}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* タブ */}
      <div className="flex gap-1 mb-4">
        {tabItems.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedStaff(null); }}
              className={`px-4 py-2 text-sm rounded-t-lg inline-flex items-center gap-2 transition-colors ${
                tab === t.key
                  ? 'bg-white border-t-2 border-x border-blue-500 font-medium text-blue-700 shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'settings' && (
        <div className="space-y-4">
          {/* 所定労働日数 */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">月次設定</h3>
            <div className="flex items-end gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">所定労働日数</label>
                <input type="number" value={monthlySettings.scheduledWorkDays}
                  onChange={(e) => setMonthlySettings({ ...monthlySettings, scheduledWorkDays: e.target.value })}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              </div>
              <button onClick={saveMonthlySettings}
                className="gradient-header text-white px-4 py-1.5 rounded-lg text-sm hover:opacity-90 btn-hover inline-flex items-center gap-1.5 shadow-md">
                <Save size={14} />保存
              </button>
            </div>
          </div>

          {/* 手動入力（備考） */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">月次手動入力（備考）</h3>
            <table className="w-full text-sm">
              <thead className="gradient-table-header border-b">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">スタッフ</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600">備考</th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const ex = extraInputs[s.id] || { notes: '' };
                  return (
                    <ExtraInputRow key={s.id} staff={s} extra={ex} onSave={(data) => saveExtraInput(s.id, data)} />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 計算実行 */}
          <div className="text-center">
            <button onClick={calculate} disabled={calculating}
              className="bg-green-600 text-white px-8 py-3 rounded-xl text-lg font-bold hover:bg-green-700 disabled:opacity-50 btn-hover shadow-lg inline-flex items-center gap-2">
              <Play size={20} />
              {calculating ? '計算中...' : '給与計算実行'}
            </button>
          </div>
        </div>
      )}

      {tab === 'results' && !selectedStaff && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="gradient-table-header border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">スタッフ</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">労働日数</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">支給総額</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">控除総額</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">差引支給額</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.staffId} className="border-b hover:bg-blue-50/30 transition-colors even:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium">{r.staffName}</td>
                  <td className="px-4 py-3 text-right">{r.workDays}日</td>
                  <td className="px-4 py-3 text-right">{formatYen(r.grossPay)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatYen(r.totalDeduction)}</td>
                  <td className="px-4 py-3 text-right font-bold text-lg">{formatYen(r.netPay)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setSelectedStaff(r)}
                      className="text-blue-600 hover:text-blue-800 text-xs transition-colors inline-flex items-center gap-1">
                      <BarChart3 size={12} />明細
                    </button>
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">計算結果がありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'results' && selectedStaff && (
        <PayrollDetail data={selectedStaff} month={month} onBack={() => setSelectedStaff(null)} />
      )}
    </div>
  );
}

function ExtraInputRow({ staff, extra, onSave }) {
  const [notes, setNotes] = useState(extra.notes || '');

  useEffect(() => {
    setNotes(extra.notes || '');
  }, [extra]);

  return (
    <tr className="border-b even:bg-gray-50/50">
      <td className="px-3 py-2">{staff.name}</td>
      <td className="px-3 py-2 text-center">
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          className="border rounded-lg px-2 py-1 w-48 text-sm" />
      </td>
      <td className="px-3 py-2 text-center">
        <button onClick={() => onSave({ notes })}
          className="gradient-header text-white px-3 py-1 rounded-lg text-xs hover:opacity-90 btn-hover inline-flex items-center gap-1">
          <Save size={11} />保存
        </button>
      </td>
    </tr>
  );
}

function PayrollDetail({ data, month, onBack }) {
  // 和暦変換
  const [y, m] = month.split('-').map(Number);
  const reiwaYear = y - 2018;
  const warekiMonth = `令和${reiwaYear}年${m}月分`;

  return (
    <div>
      <button onClick={onBack} className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-flex items-center gap-1 transition-colors">
        <ArrowLeft size={14} /> 一覧に戻る
      </button>

      <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg mx-auto border border-gray-100">
        {/* ヘッダー帯 */}
        <div className="gradient-header -mx-6 -mt-6 px-6 py-4 rounded-t-xl mb-4">
          <p className="text-sm text-blue-100">飛騨牛食べ処てんから</p>
          <h3 className="text-lg font-bold text-white">給与支払明細書</h3>
          <p className="text-sm text-blue-100">{warekiMonth}</p>
        </div>
        <p className="text-base font-medium text-center mb-4">{data.staffName} 殿</p>

        <div className="space-y-4 text-sm">
          {/* 勤怠 */}
          <section>
            <h4 className="font-semibold border-b-2 border-gray-200 pb-1 mb-2 text-gray-700">勤怠</h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-600">労働日数:</span><span className="text-right">{data.workDays}日</span>
              <span className="text-gray-600">労働時間:</span><span className="text-right">{formatMinutes(data.totalWorkMinutes)}</span>
              <span className="text-gray-600 pl-4">うち残業:</span><span className="text-right">{formatMinutes(data.overtimeMinutes)}</span>
              <span className="text-gray-600 pl-4">うち深夜:</span><span className="text-right">{formatMinutes(data.nightWorkMinutes)}</span>
              <span className="text-gray-600 pl-4">うち休日:</span><span className="text-right">{formatMinutes(data.holidayWorkMinutes)}</span>
            </div>
          </section>

          {/* 支給 */}
          <section>
            <h4 className="font-semibold border-b-2 border-gray-200 pb-1 mb-2 text-gray-700">支給</h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-600">基本給:</span><span className="text-right">{formatYen(data.basePay)}</span>
              {data.overtimePay > 0 && <><span className="text-gray-600">残業手当:</span><span className="text-right">{formatYen(data.overtimePay)}</span></>}
              {data.nightPay > 0 && <><span className="text-gray-600">深夜手当:</span><span className="text-right">{formatYen(data.nightPay)}</span></>}
              {data.holidayPay > 0 && <><span className="text-gray-600">休日手当:</span><span className="text-right">{formatYen(data.holidayPay)}</span></>}
              {data.specialRateIncrease > 0 && <><span className="text-gray-600">特別時給手当:</span><span className="text-right">{formatYen(data.specialRateIncrease)}</span></>}
              {data.transportAllowance > 0 && <><span className="text-gray-600">交通費:</span><span className="text-right">{formatYen(data.transportAllowance)}</span></>}
            </div>
            <div className="border-t mt-2 pt-1 grid grid-cols-2 font-medium">
              <span>支給額合計:</span><span className="text-right">{formatYen(data.grossPay)}</span>
            </div>
          </section>

          {/* 控除 */}
          <section>
            <h4 className="font-semibold border-b-2 border-gray-200 pb-1 mb-2 text-gray-700">控除</h4>
            <div className="grid grid-cols-2 gap-1">
              {data.incomeTax > 0 && <><span className="text-gray-600">所得税:</span><span className="text-right">{formatYen(data.incomeTax)}</span></>}
              {data.healthInsurance > 0 && <><span className="text-gray-600">健康保険料:</span><span className="text-right">{formatYen(data.healthInsurance)}</span></>}
              {data.careInsurance > 0 && <><span className="text-gray-600">介護保険料:</span><span className="text-right">{formatYen(data.careInsurance)}</span></>}
              {data.pension > 0 && <><span className="text-gray-600">厚生年金:</span><span className="text-right">{formatYen(data.pension)}</span></>}
              {data.employmentInsurance > 0 && <><span className="text-gray-600">雇用保険料:</span><span className="text-right">{formatYen(data.employmentInsurance)}</span></>}
              {data.mealDeduction > 0 && <><span className="text-gray-600">食事代:</span><span className="text-right">{formatYen(data.mealDeduction)}</span></>}
              {data.rentDeduction > 0 && <><span className="text-gray-600">家賃:</span><span className="text-right">{formatYen(data.rentDeduction)}</span></>}
            </div>
            <div className="border-t mt-2 pt-1 grid grid-cols-2 font-medium">
              <span>控除額合計:</span><span className="text-right text-red-600">{formatYen(data.totalDeduction)}</span>
            </div>
          </section>

          {/* 差引支給額 */}
          <div className="border-t-2 border-gray-800 pt-3 text-center">
            <p className="text-sm text-gray-600">差引支給額</p>
            <p className="text-5xl font-bold gradient-text my-2">{formatYen(data.netPay)}</p>
          </div>

          {/* 紙幣・硬貨内訳 */}
          {data.cashBreakdown && data.cashBreakdown.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 mb-2">紙幣・硬貨内訳:</p>
              <div className="flex flex-wrap gap-2">
                {data.cashBreakdown.map((cb) => (
                  <span key={cb.denomination} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs shadow-sm">
                    {denomLabels[cb.denomination]}: {cb.count}枚
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">事業所名: 飛騨牛食べ処てんから</p>
        </div>
      </div>
    </div>
  );
}
