// Middleware xác thực (JWT) và phân quyền theo role.

const jwt = require('jsonwebtoken');
const dataAccess = require('../models/dataAccess');

// Kiểm tra token JWT gửi kèm header Authorization: Bearer <token>
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Thiếu token xác thực' });
  }

  const token = authHeader.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }

  // Token vẫn còn hạn nhưng tài khoản đã bị giáo viên xoá: kết thúc phiên
  // đăng nhập ngay. Giao diện nhận mã ACCOUNT_DELETED thì tự đăng xuất và
  // báo lý do (frontend/src/services/api.js).
  if (!dataAccess.findById('users', payload.id)) {
    return res.status(401).json({ code: 'ACCOUNT_DELETED', message: 'Tài khoản của bạn đã bị xoá' });
  }

  req.user = payload; // { id, role, name }
  return next();
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
