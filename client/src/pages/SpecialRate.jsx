import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Star, Plus, Pencil, Trash2, Save, X } from 'lucide-react';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}/${String(jst.getUTCMonth() + 1).padStart(2, '0')}/${String(jst.getUTCDate()).padStart(2, '0')}`;
}

function toInputDate(dateStr) {
  const d = new Date(dateStr);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}`;
}

const emptyForm = { name: '', startDate: '', endDate: '', amountIncrease: 100 };

export default function SpecialRate() {
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchRates = async () => {
    const res = await api.get('/admin/special-rates');
    setRates(res.data);
  };

  useEffect(() => { fetchRates(); }, []);

  const handleSave = async () => {
    if (!form.name || !form.startDate || !form.endDate || !form.amountIncrease) {
      alert('全項目を入力してください');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/admin/special-rates/${editingId}`, form);
      } else {
        await api.post('/admin/special-rates', form);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      fetchRates();
    } catch (err) {
      alert(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleEdit = (rate) => {
    setForm({
      name: rate.name,
      startDate: toInputDate(rate.startDate),
      endDate: toInputDate(rate.endDate),
      amountIncrease: rate.amountIncrease,
    });
    setEditingId(rate.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('この特別時給設定を削除しますか？')) return;
    await api.delete(`/admin/special-rates/${id}`);
    fetchRates();
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">特別時給設定</h2>
          <p className="text-sm text-gray-500 mt-1">※毎年の設定が必要です（自動繰り返しされません）</p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="gradient-header text-white px-4 py-2 rounded-lg text-sm hover:opacity-90 btn-hover inline-flex items-center gap-2 shadow-md"
          >
            <Plus size={16} />新規追加
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-5 mb-6 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            {editingId ? '特別時給を編集' : '特別時給を追加'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">名前</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: 正月手当"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">増額（円）</label>
              <input
                type="number"
                value={form.amountIncrease}
                onChange={(e) => setForm({ ...form, amountIncrease: parseInt(e.target.value) || 0 })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始日</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了日</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              className="gradient-header text-white px-5 py-2 rounded-lg text-sm hover:opacity-90 btn-hover inline-flex items-center gap-2 shadow-md"
            >
              <Save size={14} />保存
            </button>
            <button
              onClick={handleCancel}
              className="border border-gray-300 text-gray-600 px-5 py-2 rounded-lg text-sm hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <X size={14} />キャンセル
            </button>
          </div>
        </div>
      )}

      {rates.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
          <Star size={48} className="mx-auto mb-3 text-gray-300" />
          <p>特別時給の設定はありません。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rates.map((rate) => (
            <div key={rate.id} className="bg-white rounded-xl shadow-lg p-4 border border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-800">{rate.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(rate.startDate)} 〜 {formatDate(rate.endDate)}
                </p>
                <p className="text-sm font-medium text-blue-600 mt-0.5">
                  時給 +{rate.amountIncrease.toLocaleString()}円
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(rate)}
                  className="text-gray-500 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(rate.id)}
                  className="text-gray-500 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
