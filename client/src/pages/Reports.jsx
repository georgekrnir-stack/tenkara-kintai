import { useState, useEffect } from 'react';
import api from '../lib/api';

function getCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

export default function Reports() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');

  useEffect(() => {
    api.get('/admin/staff').then((res) => setStaffList(res.data.filter((s) => s.isActive)));
  }, []);

  const baseUrl = '/api/admin/reports';

  const openReport = (url) => {
    const token = localStorage.getItem('admin_token');
    // PDFやCSVダウンロード用にトークン付きURLを開く
    const separator = url.includes('?') ? '&' : '?';
    window.open(`${url}${separator}token=${token}`, '_blank');
  };

  const reports = [
    {
      title: '月次勤怠一覧表',
      description: '全スタッフの日別出退勤・休憩・実労働時間',
      actions: [
        { label: 'PDF', onClick: () => openReport(`${baseUrl}/attendance?month=${month}&format=pdf`) },
        { label: 'CSV', onClick: () => openReport(`${baseUrl}/attendance?month=${month}&format=csv`) },
      ],
    },
    {
      title: '給与一覧',
      description: '全スタッフの支給総額・控除総額・差引支給額',
      actions: [
        { label: 'PDF', onClick: () => openReport(`${baseUrl}/payroll?month=${month}&format=pdf`) },
        { label: 'CSV', onClick: () => openReport(`${baseUrl}/payroll?month=${month}&format=csv`) },
      ],
    },
    {
      title: '現金封入用一覧',
      description: '差引支給額と紙幣・硬貨の枚数内訳',
      actions: [
        { label: 'PDF', onClick: () => openReport(`${baseUrl}/cash-envelope?month=${month}`) },
      ],
    },
    {
      title: '給与明細（全員一括）',
      description: '全スタッフの給与明細を一括出力',
      actions: [
        { label: 'PDF', onClick: () => openReport(`${baseUrl}/payslip-all?month=${month}`) },
      ],
    },
    {
      title: '給与明細（個別）',
      description: '選択したスタッフの給与明細',
      actions: [
        {
          label: 'PDF',
          onClick: () => {
            if (!selectedStaff) { alert('スタッフを選択してください'); return; }
            openReport(`${baseUrl}/payslip/${selectedStaff}?month=${month}`);
          },
        },
      ],
      extra: (
        <select value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}
          className="border rounded px-2 py-1 text-sm mt-2 w-full">
          <option value="">スタッフを選択</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">帳票出力</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.title} className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold text-gray-800">{r.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{r.description}</p>
            {r.extra}
            <div className="flex gap-2 mt-3">
              {r.actions.map((a) => (
                <button key={a.label} onClick={a.onClick}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
