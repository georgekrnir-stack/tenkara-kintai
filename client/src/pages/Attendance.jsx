import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import Timeline from '../components/Timeline';
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2, Save, X } from 'lucide-react';

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
  const [editingRecord, setEditingRecord] = useState(null);
  const [addingDay, setAddingDay] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

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

  // 打刻修正
  const handleEditRecord = async (recordId, data) => {
    try {
      await api.put(`/admin/attendance/${recordId}`, data);
      setEditingRecord(null);
      fetchAttendance();
    } catch {
      alert('修正に失敗しました');
    }
  };

  // 打刻追加
  const handleAddRecord = async (data) => {
    try {
      await api.post('/admin/attendance', data);
      setAddingDay(null);
      fetchAttendance();
    } catch {
      alert('追加に失敗しました');
    }
  };

  // 打刻削除
  const handleDeleteRecord = async (recordId) => {
    if (!confirm('この打刻を削除しますか？')) return;
    try {
      await api.delete(`/admin/attendance/${recordId}`);
      fetchAttendance();
    } catch {
      alert('削除に失敗しました');
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
                const isExpanded = expandedDay === key;
                return (
                  <DayRow
                    key={key}
                    day={d}
                    showStaff={!staffId}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedDay(isExpanded ? null : key)}
                    onEditRecord={handleEditRecord}
                    onDeleteRecord={handleDeleteRecord}
                    editingRecord={editingRecord}
                    setEditingRecord={setEditingRecord}
                    onAddRecord={handleAddRecord}
                    addingDay={addingDay}
                    setAddingDay={setAddingDay}
                  />
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
    </div>
  );
}

function DayRow({ day, showStaff, isExpanded, onToggle, onEditRecord, onDeleteRecord, editingRecord, setEditingRecord, onAddRecord, addingDay, setAddingDay }) {
  const hasModified = day.records.some((r) => r.isModified);
  const dayKey = `${day.staffId}_${day.date}`;
  const isAdding = addingDay === dayKey;

  return (
    <>
      <tr className="border-b hover:bg-blue-50/30 transition-colors cursor-pointer even:bg-gray-50/50" onClick={onToggle}>
        <td className="px-4 py-3">
          {day.date}
          {hasModified && <span className="ml-1 text-orange-500 text-xs font-medium">*修正あり</span>}
        </td>
        {showStaff && <td className="px-4 py-3">{day.staffName}</td>}
        <td className="px-4 py-3 text-center">{formatTime(day.clockIn)}</td>
        <td className="px-4 py-3 text-center">{formatTime(day.clockOut)}</td>
        <td className="px-4 py-3 text-center">{day.breakMinutes > 0 ? formatMinutes(day.breakMinutes) : '-'}</td>
        <td className="px-4 py-3 text-center font-medium">{day.workMinutes > 0 ? formatMinutes(day.workMinutes) : '-'}</td>
        <td className="px-4 py-3 text-center">
          <button onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="text-blue-600 hover:text-blue-800 text-xs inline-flex items-center gap-1 transition-colors">
            {isExpanded ? <><ChevronUp size={14} />閉じる</> : <><ChevronDown size={14} />詳細</>}
          </button>
        </td>
      </tr>

      {/* 展開: 打刻詳細 */}
      {isExpanded && (
        <tr className="bg-blue-50/20">
          <td colSpan={showStaff ? 7 : 6} className="px-6 py-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600">打刻記録:</p>
              {day.records.map((r) => {
                const isEditing = editingRecord === r.id;
                return (
                  <RecordRow
                    key={r.id}
                    record={r}
                    isEditing={isEditing}
                    onEdit={() => setEditingRecord(r.id)}
                    onSave={(data) => onEditRecord(r.id, data)}
                    onCancel={() => setEditingRecord(null)}
                    onDelete={() => onDeleteRecord(r.id)}
                  />
                );
              })}

              {/* 打刻追加 */}
              {isAdding ? (
                <AddRecordForm
                  staffId={day.staffId}
                  date={day.date}
                  onSubmit={onAddRecord}
                  onCancel={() => setAddingDay(null)}
                />
              ) : (
                <button
                  onClick={() => setAddingDay(dayKey)}
                  className="text-blue-600 hover:text-blue-800 text-xs mt-1 inline-flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} /> 打刻を追加
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RecordRow({ record, isEditing, onEdit, onSave, onCancel, onDelete }) {
  const [editTime, setEditTime] = useState('');
  const [editType, setEditType] = useState('');

  useEffect(() => {
    if (isEditing) {
      setEditTime(new Date(record.recordedAt).toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).replace(' ', 'T').slice(0, 16));
      setEditType(record.recordType);
    }
  }, [isEditing, record]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 text-xs bg-white p-2.5 rounded-lg border border-blue-200 shadow-sm">
        <select value={editType} onChange={(e) => setEditType(e.target.value)}
          className="border rounded-lg px-2 py-1">
          {Object.entries(recordTypeLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)}
          className="border rounded-lg px-2 py-1" />
        <button onClick={() => onSave({ recordType: editType, recordedAt: editTime })}
          className="gradient-header text-white px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
          <Save size={12} />保存
        </button>
        <button onClick={onCancel} className="text-gray-500 px-2 py-1 hover:text-gray-700 inline-flex items-center gap-1">
          <X size={12} />キャンセル
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 font-medium">{recordTypeLabel[record.recordType]}</span>
      <span>{formatTime(record.recordedAt)}</span>
      {record.isModified && <span className="text-orange-500 font-medium">(修正済み)</span>}
      <button onClick={onEdit} className="text-blue-600 hover:text-blue-800 ml-auto inline-flex items-center gap-1 transition-colors">
        <Pencil size={11} />編集
      </button>
      <button onClick={onDelete} className="text-red-600 hover:text-red-800 inline-flex items-center gap-1 transition-colors">
        <Trash2 size={11} />削除
      </button>
    </div>
  );
}

function AddRecordForm({ staffId, date, onSubmit, onCancel }) {
  const [recordType, setRecordType] = useState('clock_in');
  const [time, setTime] = useState(`${date}T09:00`);

  return (
    <div className="flex items-center gap-2 text-xs bg-white p-2.5 rounded-lg border border-blue-200 shadow-sm">
      <select value={recordType} onChange={(e) => setRecordType(e.target.value)}
        className="border rounded-lg px-2 py-1">
        {Object.entries(recordTypeLabel).map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)}
        className="border rounded-lg px-2 py-1" />
      <button onClick={() => onSubmit({ staffId, recordType, recordedAt: time })}
        className="gradient-header text-white px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
        <Plus size={12} />追加
      </button>
      <button onClick={onCancel} className="text-gray-500 px-2 py-1 hover:text-gray-700 inline-flex items-center gap-1">
        <X size={12} />キャンセル
      </button>
    </div>
  );
}
