const express = require('express');
const { register, login } = require('../controllers/authController');
const { forgotPassword, checkResetToken, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// Quên mật khẩu: gửi link qua email -> kiểm tra link -> đặt mật khẩu mới
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/check', checkResetToken);
router.post('/reset-password', resetPassword);

module.exports = router;
