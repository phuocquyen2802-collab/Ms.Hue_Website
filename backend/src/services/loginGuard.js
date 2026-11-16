// Đếm số lần đăng nhập sai LIÊN TIẾP của từng tên đăng nhập. Sai đủ
// MAX_FAILED_LOGINS lần thì tạm khoá đăng nhập bằng mật khẩu LOCK_MINUTES
// phút (chống dò mật khẩu) và giao diện chuyển sang màn hình khôi phục mật
// khẩu qua email. Đăng nhập đúng hoặc đặt lại mật khẩu thì xoá bộ đếm.
//
// Đếm theo chuỗi tên đăng nhập người dùng gõ, kể cả tên không tồn tại, để
// phản hồi giống hệt nhau - không ai dò được tài khoản nào có thật.
const dataAccess = require('../models/dataAccess');

const COLLECTION = 'login_attempts';
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
// Lần sai cũ hơn mốc này không tính là "liên tiếp" nữa.
const FORGET_AFTER_MS = 24 * 60 * 60 * 1000;

const keyOf = (identifier) => `la:${String(identifier || '').trim().toLowerCase()}`;

function lockState(record, now) {
  const until = record?.lockedUntil ? Date.parse(record.lockedUntil) : 0;
  if (until > now) return { locked: true, retryAfterSeconds: Math.ceil((until - now) / 1000) };
  return { locked: false, retryAfterSeconds: 0 };
}

function checkLocked(identifier, now = Date.now()) {
  return lockState(dataAccess.findById(COLLECTION, keyOf(identifier)), now);
}

function recordFailure(identifier, now = Date.now()) {
  const id = keyOf(identifier);
  const record = dataAccess.findById(COLLECTION, id);
  const stale = !record
    || (record.lockedUntil && Date.parse(record.lockedUntil) <= now)
    || now - Date.parse(record.lastFailedAt || 0) > FORGET_AFTER_MS;
  const failedCount = (stale ? 0 : record.failedCount) + 1;
  const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? new Date(now + LOCK_MINUTES * 60 * 1000).toISOString() : null;
  const next = { failedCount, lockedUntil, lastFailedAt: new Date(now).toISOString() };

  if (record) dataAccess.updateById(COLLECTION, id, next);
  else dataAccess.insert(COLLECTION, { id, ...next });

  return { ...lockState(next, now), attemptsLeft: Math.max(0, MAX_FAILED_LOGINS - failedCount) };
}

function clearFailures(identifier) {
  const id = keyOf(identifier);
  if (dataAccess.findById(COLLECTION, id)) dataAccess.removeById(COLLECTION, id);
}

module.exports = { MAX_FAILED_LOGINS, LOCK_MINUTES, checkLocked, recordFailure, clearFailures };
