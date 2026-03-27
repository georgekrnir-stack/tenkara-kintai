import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Timeline from '../components/Timeline';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';

const recordTypeLabel = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}時間${m > 0 ? `${m}分` : ''}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
  });
}

function getCurrentMonth() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 7);
}

export default function Attendance() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [staffId, setStaffId] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalDay, setModalDay] = useState(null);

  useEffect(() => {
    api.get('/admin/staff').then((res) => setStaffList(res.data));
  }, []);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (staffId) params.append('staff_id', staffId);
      const res = await api.get(`/admin/attendance?${params}`);
      setDays(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [month, staffId]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  // モーダル内で変更後にデータ再取得
  const refreshAndUpdateModal = async () => {
    const params = new URLSearchParams({ month });
    if (staffId) params.append('staff_id', staffId);
    const res = await api.get(`/admin/attendance?${params}`);
    setDays(res.data);
    // モーダルが開いている場合、該当dayを更新
    if (modalDay) {
      const key = `${modalDay.staffId}_${modalDay.date}`;
      const updated = res.data.find((d) => `${d.staffId}_${d.date}` === key);
      if (updated) setModalDay(updated);
      else setModalDay(null);
    }
  };

  // タイムライン用データ変換
  const timelineStaffs = (() => {
    if (!staffId || !days.length) return [];
    const byDate = {};
    for (const d of days) {
      if (!byDate[d.date]) byDate[d.date] = { id: d.date, name: d.date, records: [] };
      byDate[d.date].records.push(...d.records);
    }
    return Object.values(byDate);
  })();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">勤怠管理</h2>

      {/* フィルタ */}
      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">年月</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">スタッフ</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
            <option value="">全員</option>
            {staffList.filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* タイムライン（個人選択時） */}
      {staffId && timelineStaffs.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4 card-hover">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">月間タイムライン</h3>
          <Timeline staffs={timelineStaffs} showCurrentTime={false} />
        </div>
      )}

      {/* 勤怠テーブル */}
      {loading ? (
        <p className="text-gray-500">読み込み中...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="gradient-table-header border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">日付</th>
                {!staffId && <th className="text-left px-4 py-3 font-semibold text-gray-600">スタッフ</th>}
                <th className="text-center px-4 py-3 font-semibold text-gray-600">出勤</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">退勤</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">休憩</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">実労働</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const key = `${d.staffId}_${d.date}`;
                const hasModified = d.records.some((r) => r.isModified);
                return (
                  <tr key={key} className="border-b hover:bg-blue-50/30 transition-colors cursor-pointer even:bg-gray-50/50"
                    onClick={() => setModalDay(d)}>
                    <td className="px-4 py-3">
                      {d.date}
                      {hasModified && <span className="ml-1 text-orange-500 text-xs font-medium">*修正あり</span>}
                    </td>
                    {!staffId && <td className="px-4 py-3">{d.staffName}</td>}
                    <td className="px-4 py-3 text-center">{formatTime(d.clockIn)}</td>
                    <td className="px-4 py-3 text-center">{formatTime(d.clockOut)}</td>
                    <td className="px-4 py-3 text-center">{d.breakMinutes > 0 ? formatMinutes(d.breakMinutes) : '-'}</td>
                    <td className="px-4 py-3 text-center font-medium">{d.workMinutes > 0 ? formatMinutes(d.workMinutes) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setModalDay(d); }}
                        className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1 transition-colors">
                        <Pencil size={13} />編集
                      </button>
                    </td>
                  </tr>
                );
              })}
              {days.length === 0 && (
                <tr>
                  <td colSpan={staffId ? 6 : 7} className="px-4 py-8 text-center text-gray-400">
                    勤怠データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* モーダル */}
      {modalDay && (
        <AttendanceModal
          day={modalDay}
          onClose={() => setModalDay(null)}
          onRefresh={refreshAndUpdateModal}
        />
      )}
    </div>
  );
}

// --- モーダルダイアログ ---
function AttendanceModal({ day, onClose, onRefresh }) {
  const [editingRecord, setEditingRecord] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  // 打刻修正
  const handleEditRecord = async (recordId, data) => {
    try {
      await api.put(`/admin/attendance/${recordId}`, data);
      setEditingRecord(null);
      await onRefresh();
    } catch {
      alert('修正に失敗しました');
    }
  };

  // 打刻追加
  const handleAddRecord = async (data) => {
    try {
      await api.post('/admin/attendance', data);
      setIsAdding(false);
      await onRefresh();
    } catch {
      alert('追加に失敗しました');
    }
  };

  // 打刻削除
  const handleDeleteRecord = async (recordId) => {
    if (!confirm('この打刻を削除しますか？')) return;
    try {
      await api.delete(`/admin/attendance/${recordId}`);
      await onRefresh();
    } catch {
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/40" />
      {/* モーダル本体 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="gradient-header text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{day.date}</h3>
            <p className="text-sm opacity-90">{day.staffName}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">打刻記録</p>

          {day.records.length === 0 && (
            <p className="text-sm text-gray-400 py-2">打刻データがありません</p>
          )}

          {day.records.map((r) => (
            <ModalRecordRow
              key={r.id}
              record={r}
              isEditing={editingRecord === r.id}
              onEdit={() => setEditingRecord(r.id)}
              onSave={(data) => handleEditRecord(r.id, data)}
              onCancel={() => setEditingRecord(null)}
              onDelete={() => handleDeleteRecord(r.id)}
            />
          ))}

          {/* 打刻追加 */}
          {isAdding ? (
            <ModalAddForm
              staffId={day.staffId}
              date={day.date}
              onSubmit={handleAddRecord}
              onCancel={() => setIsAdding(false)}
            />
          ) : (
            <button onClick={() => setIsAdding(true)}
              className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-flex items-center gap-1 transition-colors">
              <Plus size={14} /> 打刻を追加
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- モーダル内レコード行 ---
function ModalRecordRow({ record, isEditing, onEdit, onSave, onCancel, onDelete }) {
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('');
  const [editMealCount, setEditMealCount] = useState(0);

  useEffect(() => {
    if (isEditing) {
      setEditTime(new Date(record.recordedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T').slice(0, 16));
      setEditType(record.recordType);
      setEditMealCount(record.mealCount || 0);
    }
  }, [isEditing, record]);

  if (isEditing) {
    return (
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <select value={editType} onChange={(e) => setEditType(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm">
            {Object.entries(recordTypeLabel).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm flex-1" />
        </div>
        {editType === 'clock_out' && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">まかない食数:</span>
            <select value={editMealCount} onChange={(e) => setEditMealCount(parseInt(e.target.value))}
              className="border rounded-lg px-2 py-1.5 text-sm">
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={() => onSave({ recordType: editType, recordedAt: editTime, mealCount: editType === 'clock_out' ? editMealCount : 0 })}
            className="gradient-header text-white px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1">
            <Save size={13} />保存
          </button>
          <button onClick={onCancel} className="text-gray-500 px-2 py-1.5 text-sm hover:text-gray-700 inline-flex items-center gap-1">
            <X size={13} />キャンセル
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group">
      <span className="w-16 font-medium text-gray-700">{recordTypeLabel[record.recordType]}</span>
      <span className="text-gray-600">{formatTime(record.recordedAt)}</span>
      {record.recordType === 'clock_out' && record.mealCount > 0 && (
        <span className="text-orange-600 text-xs bg-orange-50 px-1.5 py-0.5 rounded">
          まかない{record.mealCount}食
        </span>
      )}
      {record.isModified && <span className="text-orange-500 text-xs">(修正済み)</span>}
      <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
          <Pencil size={12} />編集
        </button>
        <button onClick={onDelete} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1">
          <Trash2 size={12} />削除
        </button>
      </div>
    </div>
  );
}

// --- モーダル内追加フォーム ---
function ModalAddForm({ staffId, date, onSubmit, onCancel }) {
  const [recordType, setRecordType] = useState('clock_in');
  const [time, setTime] = useState(`${date}T09:00`);
  const [mealCount, setMealCount] = useState(0);

  return (
    <div className="bg-green-50 p-3 rounded-lg border border-green-200 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <select value={recordType} onChange={(e) => setRecordType(e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm">
          {Object.entries(recordTypeLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)}
          className="border rounded-lg px-2 py-1.5 text-sm flex-1" />
      </div>
      {recordType === 'clock_out' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">まかない食数:</span>
          <select value={mealCount} onChange={(e) => setMealCount(parseInt(e.target.value))}
            className="border rounded-lg px-2 py-1.5 text-sm">
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button onClick={() => onSubmit({ staffId, recordType, recordedAt: time, mealCount: recordType === 'clock_out' ? mealCount : 0 })}
          className="gradient-header text-white px-3 py-1.5 rounded-lg text-sm inline-flex items-center gap-1">
          <Plus size={13} />追加
        </button>
        <button onClick={onCancel} className="text-gray-500 px-2 py-1.5 text-sm hover:text-gray-700 inline-flex items-center gap-1">
          <X size={13} />キャンセル
        </button>
      </div>
    </div>
  );
}
