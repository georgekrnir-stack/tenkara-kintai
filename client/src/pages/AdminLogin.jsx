import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Lock, KeyRound } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isSetup, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen gradient-bg">読み込み中...</div>;
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
    <div className="flex items-center justify-center min-h-screen gradient-bg">
      <div className="w-full max-w-sm bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 border border-white/50">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full gradient-header flex items-center justify-center shadow-lg">
            <Lock className="text-white" size={24} />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center mb-1 text-gray-800">てんから勤怠システム</h1>
        <p className="text-sm text-center text-gray-500 mb-6">
          {isSetup ? '管理者ログイン' : '初回セットアップ - 管理者パスワードを設定'}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isSetup ? 'パスワード' : '新しいパスワード（4文字以上）'}
          </label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="パスワードを入力"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-header text-white py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 btn-hover font-medium shadow-md"
          >
            {loading ? '処理中...' : isSetup ? 'ログイン' : 'パスワードを設定'}
          </button>
        </form>
      </div>
    </div>
  );
}
