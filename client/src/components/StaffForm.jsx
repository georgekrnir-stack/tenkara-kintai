import { useState, useEffect } from 'react';

const defaultValues = {
  name: '',
  title: '',
  employmentType: 'part_time',
  salaryType: 'hourly',
  monthlySalary: '',
  hourlyRate: '',
  taxColumn: 'kou',
  hasEmploymentInsurance: false,
  healthInsuranceAmount: 0,
  careInsuranceAmount: 0,
  pensionAmount: 0,
  hasMealDeduction: false,
  rentDeduction: 0,
  hasTransportAllowance: false,
  employeePassword: '',
};

export default function StaffForm({ staff, onSubmit, onCancel }) {
  const [form, setForm] = useState(defaultValues);

  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name || '',
        title: staff.title || '',
        employmentType: staff.employmentType || 'part_time',
        salaryType: staff.salaryType || 'hourly',
        monthlySalary: staff.monthlySalary ?? '',
        hourlyRate: staff.hourlyRate ?? '',
        taxColumn: staff.taxColumn || 'kou',
        hasEmploymentInsurance: staff.hasEmploymentInsurance || false,
        healthInsuranceAmount: staff.healthInsuranceAmount || 0,
        careInsuranceAmount: staff.careInsuranceAmount || 0,
        pensionAmount: staff.pensionAmount || 0,
        hasMealDeduction: staff.hasMealDeduction || false,
        rentDeduction: staff.rentDeduction || 0,
        hasTransportAllowance: staff.hasTransportAllowance || false,
        employeePassword: '',
      });
    }
  }, [staff]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本情報 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">基本情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">氏名 *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">肩書</label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" placeholder="任意" />
          </div>
        </div>
      </section>

      {/* 雇用・給与 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">雇用・給与</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">雇用形態</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="full_time" checked={form.employmentType === 'full_time'}
                  onChange={(e) => set('employmentType', e.target.value)} />
                正社員
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="part_time" checked={form.employmentType === 'part_time'}
                  onChange={(e) => set('employmentType', e.target.value)} />
                パート
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">給与形態</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="monthly" checked={form.salaryType === 'monthly'}
                  onChange={(e) => set('salaryType', e.target.value)} />
                月給制
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="hourly" checked={form.salaryType === 'hourly'}
                  onChange={(e) => set('salaryType', e.target.value)} />
                時給制
              </label>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          {form.salaryType === 'monthly' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">基本給（月額・円）</label>
              <input type="number" value={form.monthlySalary} onChange={(e) => set('monthlySalary', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {form.salaryType === 'monthly' ? '時給（残業計算用・円）' : '時給（円）'}
            </label>
            <input type="number" value={form.hourlyRate} onChange={(e) => set('hourlyRate', e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* 税・保険 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">税・保険</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">税区分</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="kou" checked={form.taxColumn === 'kou'}
                  onChange={(e) => set('taxColumn', e.target.value)} />
                甲欄
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input type="radio" value="otsu" checked={form.taxColumn === 'otsu'}
                  onChange={(e) => set('taxColumn', e.target.value)} />
                乙欄
              </label>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.hasEmploymentInsurance}
                onChange={(e) => set('hasEmploymentInsurance', e.target.checked)} />
              雇用保険対象
            </label>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">健康保険料（月額・円）</label>
            <input type="number" value={form.healthInsuranceAmount}
              onChange={(e) => set('healthInsuranceAmount', parseInt(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">介護保険料（月額・円）</label>
            <input type="number" value={form.careInsuranceAmount}
              onChange={(e) => set('careInsuranceAmount', parseInt(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">厚生年金（月額・円）</label>
            <input type="number" value={form.pensionAmount}
              onChange={(e) => set('pensionAmount', parseInt(e.target.value) || 0)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </section>

      {/* 控除・手当 */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">控除・手当</h3>
        <div className="grid grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.hasMealDeduction}
              onChange={(e) => set('hasMealDeduction', e.target.checked)} />
            食事代控除対象
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.hasTransportAllowance}
              onChange={(e) => set('hasTransportAllowance', e.target.checked)} />
            交通費支給
          </label>
        </div>
        <div className="mt-3">
          <label className="block text-sm text-gray-600 mb-1">家賃控除（月額・円、0で控除なし）</label>
          <input type="number" value={form.rentDeduction}
            onChange={(e) => set('rentDeduction', parseInt(e.target.value) || 0)}
            className="w-full max-w-xs border rounded px-3 py-2 text-sm" />
        </div>
      </section>

      {/* 従業員ページ */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">従業員ページ</h3>
        {staff?.employeeUrlToken && (
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">従業員ページURL</label>
            <div className="flex items-center gap-2">
              <input type="text" readOnly
                value={`${window.location.origin}/employee/${staff.employeeUrlToken}`}
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-700" />
              <button type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/employee/${staff.employeeUrlToken}`);
                }}
                className="shrink-0 bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-300">
                コピー
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">このURLをスタッフに共有してください</p>
          </div>
        )}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            パスワード{staff ? '（変更する場合のみ入力）' : ''}
          </label>
          <input type="password" value={form.employeePassword}
            onChange={(e) => set('employeePassword', e.target.value)}
            className="w-full max-w-xs border rounded px-3 py-2 text-sm" />
        </div>
      </section>

      {/* ボタン */}
      <div className="flex gap-3 pt-2">
        <button type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm hover:bg-blue-700">
          {staff ? '更新' : '登録'}
        </button>
        <button type="button" onClick={onCancel}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded text-sm hover:bg-gray-300">
          キャンセル
        </button>
      </div>
    </form>
  );
}
