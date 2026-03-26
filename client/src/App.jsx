import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import StaffManagement from './pages/StaffManagement';
import AdminLayout from './components/AdminLayout';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">読み込み中...</div>;
  if (!token) return <Navigate to="/admin/login" />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="staff" element={<StaffManagement />} />
      </Route>
      <Route path="/" element={<Navigate to="/admin" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
