// Middleware xác thực (JWT) và phân quyền theo role.

const jwt = require('jsonwebtoken');

// Kiểm tra token JWT gửi kèm header Authorization: Bearer <token>
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Thiếu token xác thực' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Chỉ cho phép các role được liệt kê truy cập route,
// dùng sau verifyToken: router.get('/x', verifyToken, requireRole('teacher'), handler)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập chức năng này' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
