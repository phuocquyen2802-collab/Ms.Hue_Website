// Route cho chính người dùng đang đăng nhập: xem hồ sơ, đổi mật khẩu.
const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { changePassword } = require('../controllers/authController');
const dataAccess = require('../models/dataAccess');

const router = express.Router();

router.get('/', verifyToken, (req, res) => {
  const user = dataAccess.findById('users', req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'Không tìm thấy người dùng' });
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    className: user.className,
    createdAt: user.createdAt,
  });
});

router.put('/password', verifyToken, changePassword);

module.exports = router;
