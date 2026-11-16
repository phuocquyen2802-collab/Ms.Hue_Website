// Route cho chính người dùng đang đăng nhập: xem hồ sơ, đổi mật khẩu, email khôi phục.
const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { changePassword, updateRecoveryEmail } = require('../controllers/authController');
const { recoveryAddressOf } = require('../controllers/passwordResetController');
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
    recoveryEmail: user.recoveryEmail || null,
    // Email thực sự nhận link khôi phục (tên đăng nhập là email thì dùng luôn).
    effectiveRecoveryEmail: recoveryAddressOf(user),
  });
});

router.put('/password', verifyToken, changePassword);
router.put('/recovery-email', verifyToken, updateRecoveryEmail);

module.exports = router;
