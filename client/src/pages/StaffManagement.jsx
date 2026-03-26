import { useState, useEffect } from 'react';
import api from '../lib/api';
import StaffForm from '../components/StaffForm';

const employmentTypeLabel = { full_time: '正社員', part_time: 'パート' };
const salaryTypeLabel = { monthly: '月給制', hourly: '時給制' };

export default function StaffManagement() {
  const [staffs, setStaffs] = useState([]);
  const [mode, setMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStaffs = async () => {
    try {
      const res = await api.get('/admin/staff');
      setStaffs(res.data);
    } catch {
      setError('スタッフ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStaffs(); }, []);

  const handleCreate = async (data) => {
    try {
      await api.post('/admin/staff', data);
      setMode('list');
      fetchStaffs();
    } catch (err) {
      setError(err.response?.data?.error || '登録に失敗しました');
    }
  };

  const handleUpdate = async (data) => {
    try {
      await api.put(`/admin/staff/${editTarget.id}`, data);
      setMode('list');
      setEditTarget(null);
      fetchStaffs();
    } catch (err) {
      setError(err.response?.data?.error || '更新に失敗しました');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('このスタッフを無効化しますか？')) return;
    try {
      await api.patch(`/admin/staff/${id}/deactivate`);
      fetchStaffs();
    } catch {
      setError('無効化に失敗しました');
    }
  };

  if (mode === 'create') {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">スタッフ新規登録</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <StaffForm onSubmit={handleCreate} onCancel={() => setMode('list')} />
        </div>
      </div>
    );
  }

  if (mode === 'edit' && editTarget) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">スタッフ編集: {editTarget.name}</h2>
        <div className="bg-white rounded-lg shadow p-6">
          <StaffForm staff={editTarget} onSubmit={handleUpdate}
            onCancel={() => { setMode('list'); setEditTarget(null); }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">スタッフ管理</h2>
        <button onClick={() => setMode('create')}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          新規登録
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">氏名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">雇用形態</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">給与形態</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">時給/基本給</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">状態</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {staffs.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {s.name}
                    {s.title && <span className="text-gray-400 ml-1 text-xs">({s.title})</span>}
                  </td>
                  <td className="px-4 py-3">{employmentTypeLabel[s.employmentType]}</td>
                  <td className="px-4 py-3">{salaryTypeLabel[s.salaryType]}</td>
                  <td className="px-4 py-3 text-right">
                    {s.salaryType === 'monthly'
                      ? `¥${(s.monthlySalary || 0).toLocaleString()}/月`
                      : `¥${(s.hourlyRate || 0).toLocaleString()}/時`}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {s.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <button onClick={() => { setEditTarget(s); setMode('edit'); }}
                      className="text-blue-600 hover:underline text-xs mr-3">編集</button>
                    {s.employeeUrlToken && (
                      <button onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/employee/${s.employeeUrlToken}`);
                        alert(`${s.name}さんの従業員ページURLをコピーしました`);
                      }}
                        className="text-green-600 hover:underline text-xs mr-3">URL共有</button>
                    )}
                    {s.isActive && (
                      <button onClick={() => handleDeactivate(s.id)}
                        className="text-red-600 hover:underline text-xs">無効化</button>
                    )}
                  </td>
                </tr>
              ))}
              {staffs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-400">
                    スタッフが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
