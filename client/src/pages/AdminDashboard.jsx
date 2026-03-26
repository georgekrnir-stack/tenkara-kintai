export default function AdminDashboard() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ダッシュボード</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">本日の出勤</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">-</p>
          <p className="text-xs text-gray-400 mt-1">Phase 2で実装</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">現在出勤中</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">-</p>
          <p className="text-xs text-gray-400 mt-1">Phase 2で実装</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">登録スタッフ数</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">-</p>
          <p className="text-xs text-gray-400 mt-1">スタッフ管理で確認</p>
        </div>
      </div>
    </div>
  );
}
