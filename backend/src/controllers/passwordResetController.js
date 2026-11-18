// Khôi phục mật khẩu qua email.
// 1. POST /api/auth/forgot-password { username, email, lang }
//    Gửi đường dẫn đặt lại mật khẩu tới email - CHỈ KHI email khớp với email
//    khôi phục đã lưu của tài khoản (không gửi tới email bất kỳ, nếu không ai
//    cũng chiếm được tài khoản người khác). Phản hồi luôn giống nhau dù khớp
//    hay không, để không dò được tài khoản/email nào có thật.
// 2. POST /api/auth/reset-password/check { token }  -> đường dẫn còn dùng được không
// 3. POST /api/auth/reset-password { token, newPassword }
//
// Token chỉ lưu dạng băm SHA-256 (lộ file dữ liệu cũng không dùng được),
// dùng 1 lần, hết hạn sau TOKEN_TTL_MINUTES phút.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const mailService = require('../services/mailService');
const loginGuard = require('../services/loginGuard');

const COLLECTION = 'password_resets';
const TOKEN_TTL_MINUTES = 30;
const MAX_EMAILS_PER_HOUR = 3;
const SALT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const normalize = (s) => String(s || '').trim().toLowerCase();

// Email nhận link: email khôi phục đã lưu, hoặc chính tên đăng nhập nếu đó là email.
function recoveryAddressOf(user) {
  if (user.recoveryEmail) return user.recoveryEmail;
  return EMAIL_RE.test(user.email || '') ? user.email : null;
}

function findUserByLogin(identifier) {
  const key = normalize(identifier);
  return dataAccess.findAll('users').find((u) => normalize(u.email) === key);
}

function findUsableReset(token) {
  if (!token) return null;
  const record = dataAccess.findOne(COLLECTION, { tokenHash: hashToken(token) });
  if (!record || record.usedAt || record.revokedAt || Date.parse(record.expiresAt) <= Date.now()) return null;
  const user = dataAccess.findById('users', record.userId);
  return user ? { record, user } : null;
}

const TOKEN_INVALID = {
  code: 'TOKEN_INVALID',
  message: 'Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Hãy yêu cầu đường dẫn mới.',
};

async function forgotPassword(req, res) {
  const { username, email, lang } = req.body || {};
  const typedEmail = String(email || '').trim();
  if (!String(username || '').trim() || !typedEmail) {
    return res.status(400).json({ code: 'MISSING_FIELDS', message: 'Nhập tên đăng nhập và email' });
  }
  if (!EMAIL_RE.test(typedEmail)) {
    return res.status(400).json({ code: 'INVALID_EMAIL', message: 'Email không hợp lệ' });
  }

  const production = process.env.NODE_ENV === 'production';
  if (!mailService.isConfigured() && production) {
    return res.status(503).json({
      code: 'MAIL_DISABLED',
      message: 'Hệ thống chưa bật gửi email. Liên hệ giáo viên để được đặt lại mật khẩu.',
    });
  }

  const sent = {
    code: 'RESET_SENT',
    message: 'Nếu tên đăng nhập và email khớp với tài khoản, đường dẫn đặt lại mật khẩu đã được gửi tới email đó.',
    minutes: TOKEN_TTL_MINUTES,
  };

  const user = findUserByLogin(username);
  const address = user && recoveryAddressOf(user);
  if (!user || !address || normalize(address) !== normalize(typedEmail)) return res.json(sent);

  // Chống gửi dồn dập vào hộp thư của 1 người.
  const now = Date.now();
  const mine = dataAccess.findMany(COLLECTION, { userId: user.id });
  if (mine.filter((r) => now - Date.parse(r.createdAt) < 60 * 60 * 1000).length >= MAX_EMAILS_PER_HOUR) {
    return res.json(sent);
  }
  // Link mới thay thế các link cũ còn hạn.
  mine.filter((r) => !r.usedAt && !r.revokedAt).forEach((r) => {
    dataAccess.updateById(COLLECTION, r.id, { revokedAt: new Date(now).toISOString() });
  });

  const token = crypto.randomBytes(32).toString('base64url');
  const record = {
    id: `pr-${uuidv4()}`,
    userId: user.id,
    tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TOKEN_TTL_MINUTES * 60 * 1000).toISOString(),
    usedAt: null,
  };
  dataAccess.insert(COLLECTION, record);

  // Chạy trên máy cá nhân chưa cấu hình gửi email: in link ra cửa sổ máy chủ để thử.
  const base = mailService.appUrl() || req.get('origin') || 'http://localhost:5173';
  const link = `${base}/reset-password?token=${token}`;
  if (!mailService.isConfigured()) {
    console.log(`[Khôi phục mật khẩu] Chưa cấu hình gửi email (thiếu ${mailService.missingConfig().join(', ')}) - link cho ${user.email}: ${link}`);
    return res.json(sent);
  }

  try {
    const result = await mailService.sendPasswordResetEmail({
      to: address,
      name: user.name,
      account: user.email,
      link,
      minutes: TOKEN_TTL_MINUTES,
      requestedAt: new Date(now),
      lang: lang === 'en' ? 'en' : 'vi',
    });
    console.log(`[Khôi phục mật khẩu] Đã gửi email cho tài khoản ${user.email} (${result.provider}, mã ${result.id})`);
  } catch (err) {
    console.error('[Khôi phục mật khẩu] Gửi email thất bại:', err.message);
    dataAccess.removeById(COLLECTION, record.id);
    return res.status(502).json({ code: 'MAIL_FAILED', message: 'Chưa gửi được email. Thử lại sau ít phút.' });
  }
  return res.json(sent);
}

function checkResetToken(req, res) {
  const found = findUsableReset(req.body?.token);
  if (!found) return res.status(400).json(TOKEN_INVALID);
  return res.json({ valid: true, account: found.user.email, expiresAt: found.record.expiresAt });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ code: 'WEAK_PASSWORD', message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }
  const found = findUsableReset(token);
  if (!found) return res.status(400).json(TOKEN_INVALID);

  const { record, user } = found;
  const changes = { passwordHash: await bcrypt.hash(String(newPassword), SALT_ROUNDS) };
  // Giống học sinh tự đổi mật khẩu trong Cài đặt: giáo viên không còn xem được
  // mật khẩu mới (xem authController.changePassword).
  if (user.role === 'student') {
    changes.passwordEnc = null;
    changes.passwordChangedByStudent = true;
  }
  dataAccess.updateById('users', user.id, changes);
  dataAccess.updateById(COLLECTION, record.id, { usedAt: new Date().toISOString() });
  loginGuard.clearFailures(user.email);

  return res.json({ code: 'RESET_DONE', message: 'Đã đổi mật khẩu. Hãy đăng nhập bằng mật khẩu mới.' });
}

module.exports = { forgotPassword, checkResetToken, resetPassword, recoveryAddressOf, EMAIL_RE };
