const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const loginGuard = require('../services/loginGuard');
const { EMAIL_RE } = require('./passwordResetController');

const SALT_ROUNDS = 10;

// Đăng ký tài khoản GIÁO VIÊN qua trang công khai. Tài khoản học sinh KHÔNG
// được tự đăng ký ở đây - phải do giáo viên tạo (xem studentAccountController.js),
// để giáo viên kiểm soát được ai thuộc lớp mình và tránh học sinh tự tạo
// nhiều tài khoản ảo.
async function register(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc (name, email, password)' });
  }
  if (req.body.role && req.body.role !== 'teacher') {
    return res.status(403).json({
      message: 'Không thể tự đăng ký tài khoản học sinh. Vui lòng liên hệ giáo viên để được cấp tài khoản.',
    });
  }

  const existing = dataAccess.findOne('users', { email });
  if (existing) {
    return res.status(409).json({ message: 'Email đã được sử dụng' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = {
    id: `u-${uuidv4()}`,
    name,
    email,
    passwordHash,
    role: 'teacher',
    className: null,
    createdAt: new Date().toISOString(),
  };

  dataAccess.insert('users', user);

  return res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    className: user.className,
  });
}

function lockedResponse(res, retryAfterSeconds) {
  return res.status(423).json({
    code: 'LOGIN_LOCKED',
    message: `Bạn đã nhập sai mật khẩu ${loginGuard.MAX_FAILED_LOGINS} lần liên tiếp. Hãy khôi phục mật khẩu qua email hoặc thử lại sau ${loginGuard.LOCK_MINUTES} phút.`,
    retryAfterSeconds,
  });
}

// Đăng nhập, trả về JWT token. Sai mật khẩu nhiều lần liên tiếp thì tạm khoá
// (xem services/loginGuard.js) và giao diện chuyển sang khôi phục qua email.
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' });
  }

  const lock = loginGuard.checkLocked(email);
  if (lock.locked) return lockedResponse(res, lock.retryAfterSeconds);

  const user = dataAccess.findOne('users', { email });
  const isMatch = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!isMatch) {
    const failure = loginGuard.recordFailure(email);
    if (failure.locked) return lockedResponse(res, failure.retryAfterSeconds);
    return res.status(401).json({
      code: 'LOGIN_WRONG',
      message: 'Email hoặc mật khẩu không đúng',
      attemptsLeft: failure.attemptsLeft,
    });
  }
  loginGuard.clearFailures(email);

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  const nowIso = new Date().toISOString();
  dataAccess.updateById('users', user.id, { lastActiveAt: nowIso });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      className: user.className,
      lastActiveAt: nowIso,
    },
  });
}

// Đổi mật khẩu (yêu cầu nhập đúng mật khẩu hiện tại)
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Thiếu currentPassword hoặc newPassword' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  const user = dataAccess.findById('users', req.user.id);
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    // 400 chứ không phải 401: giao diện coi 401 là hết phiên và tự đăng xuất (services/api.js).
    return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const changes = { passwordHash };
  // Học sinh tự đổi mật khẩu: bỏ bản mã hoá mà giáo viên xem được (mật khẩu
  // cũ không còn đúng, mật khẩu mới là của riêng học sinh). Giáo viên vẫn đặt
  // lại được nếu học sinh quên - xem studentAccountController.updateStudent.
  if (user.role === 'student') {
    changes.passwordEnc = null;
    changes.passwordChangedByStudent = true;
  }
  dataAccess.updateById('users', user.id, changes);

  return res.json({ message: 'Đổi mật khẩu thành công' });
}

// Lưu email khôi phục mật khẩu của chính mình (cần nhập đúng mật khẩu hiện
// tại). Gửi chuỗi rỗng để xoá.
async function updateRecoveryEmail(req, res) {
  const { recoveryEmail, currentPassword } = req.body || {};
  const value = String(recoveryEmail || '').trim();
  if (value && !EMAIL_RE.test(value)) {
    return res.status(400).json({ message: 'Email không hợp lệ' });
  }

  const user = dataAccess.findById('users', req.user.id);
  const isMatch = currentPassword ? await bcrypt.compare(String(currentPassword), user.passwordHash) : false;
  if (!isMatch) {
    return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
  }

  dataAccess.updateById('users', user.id, { recoveryEmail: value || null });
  return res.json({ recoveryEmail: value || null, message: 'Đã lưu email khôi phục' });
}

module.exports = { register, login, changePassword, updateRecoveryEmail };
