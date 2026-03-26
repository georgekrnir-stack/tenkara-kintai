import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/admin', label: 'ダッシュボード', end: true },
  { to: '/admin/staff', label: 'スタッフ管理' },
  { to: '/admin/attendance', label: '勤怠管理' },
  { to: '/admin/payroll', label: '給与計算' },
  { to: '/admin/reports', label: '帳票出力' },
];

export default function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-56 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold text-gray-800">てんから勤怠</h1>
          <p className="text-xs text-gray-500">管理画面</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-4 py-2 rounded text-sm mb-1 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t">
          <button
            onClick={logout}
            className="w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded text-left"
          >
            ログアウト
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
