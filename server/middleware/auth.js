import jwt from 'jsonwebtoken';

export function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証が必要です' });
  }

  const token = authHeader.split(' ')[1];
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
