import { useState, useEffect } from 'react';
import api from '../lib/api';
import { FileText, Download, ClipboardList, Wallet, Users, User } from 'lucide-react';

function getCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

const reportIcons = [ClipboardList, Wallet, Wallet, Users, User];

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
          className="border border-gray-300 rounded-lg px-2 py-1 text-sm mt-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">スタッフを選択</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">帳票出力</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => {
          const Icon = reportIcons[i];
          return (
            <div key={r.title} className="bg-white rounded-xl shadow-lg p-5 card-hover border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Icon size={18} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                </div>
              </div>
              {r.extra}
              <div className="flex gap-2 mt-3">
                {r.actions.map((a) => (
                  <button key={a.label} onClick={a.onClick}
                    className="gradient-header text-white px-4 py-1.5 rounded-lg text-sm hover:opacity-90 btn-hover shadow-md inline-flex items-center gap-1.5">
                    <Download size={14} />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
