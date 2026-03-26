import jwt from 'jsonwebtoken';

export function adminAuth(req, res, next) {
  // Bearerトークンまたはクエリパラメータのtokenを受け付ける（PDF/CSVダウンロード用）
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'トークンが無効です' });
  }
}
