import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, Clock, Star, Calculator, FileText, LogOut } from 'lucide-react';

const navItems = [
  { to: '/admin', label: 'ダッシュボード', end: true, icon: LayoutDashboard },
  { to: '/admin/staff', label: 'スタッフ管理', icon: Users },
  { to: '/admin/attendance', label: '勤怠管理', icon: Clock },
  { to: '/admin/special-rate', label: '特別時給', icon: Star },
  { to: '/admin/payroll', label: '給与計算', icon: Calculator },
  { to: '/admin/reports', label: '帳票出力', icon: FileText },
];

export default function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-60 bg-white shadow-lg flex flex-col border-r border-gray-200">
        <div className="px-5 py-4 gradient-header">
          <h1 className="text-lg font-bold text-white">てんから勤怠</h1>
          <p className="text-xs text-blue-100">管理画面</p>
        </div>
        <nav className="flex-1 py-3 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm mb-1 transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium border-l-3 border-blue-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`
                }
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            ログアウト
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 gradient-bg">
        <Outlet />
      </main>
    </div>
  );
}
