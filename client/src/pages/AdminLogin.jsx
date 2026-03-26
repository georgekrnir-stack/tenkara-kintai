import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isSetup, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen">読み込み中...</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isSetup ? '/admin/login' : '/admin/setup';
      const res = await api.post(endpoint, { password });
      login(res.data.token);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-xl font-bold text-center mb-1 text-gray-800">てんから勤怠システム</h1>
        <p className="text-sm text-center text-gray-500 mb-6">
          {isSetup ? '管理者ログイン' : '初回セットアップ - 管理者パスワードを設定'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isSetup ? 'パスワード' : '新しいパスワード（4文字以上）'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="パスワードを入力"
            required
          />

          {error && (
            <p className="text-red-600 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '処理中...' : isSetup ? 'ログイン' : 'パスワードを設定'}
          </button>
        </form>
      </div>
    </div>
  );
}
