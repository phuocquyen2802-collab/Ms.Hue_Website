const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');

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

// Đăng nhập, trả về JWT token
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Thiếu email hoặc mật khẩu' });
  }

  const user = dataAccess.findOne('users', { email });
  if (!user) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
  }

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
    return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  dataAccess.updateById('users', user.id, { passwordHash });

  return res.json({ message: 'Đổi mật khẩu thành công' });
}

module.exports = { register, login, changePassword };
