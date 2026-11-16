// Lưu mật khẩu học sinh ở dạng MÃ HOÁ HAI CHIỀU (AES-256-GCM) để giáo viên
// xem lại và xuất file Excel gửi cho lớp.
//
// - Đăng nhập vẫn kiểm tra bằng passwordHash (bcrypt, một chiều) như cũ.
// - passwordEnc chỉ để hiển thị cho giáo viên; khoá giải mã lấy từ biến môi
//   trường (PASSWORD_ENCRYPTION_KEY, nếu không có thì dùng JWT_SECRET), KHÔNG
//   nằm trong dữ liệu - nên file data/users.json có lộ ra (VD repo GitHub
//   công khai) cũng không đọc được mật khẩu.
// - Đổi JWT_SECRET/PASSWORD_ENCRYPTION_KEY thì các mật khẩu đã lưu không giải
//   mã được nữa (hiển thị như "chưa lưu") - giáo viên đặt lại là có lại.

const crypto = require('crypto');

const VERSION = 'v1';

function getKey() {
  const secret = process.env.PASSWORD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) return null;
  return crypto.createHash('sha256').update(`mathinsight-student-password:${secret}`).digest();
}

function encryptPassword(plain) {
  const key = getKey();
  if (!key || typeof plain !== 'string' || !plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptPassword(stored) {
  try {
    const key = getKey();
    if (!key || typeof stored !== 'string') return null;
    const [version, ivB64, tagB64, dataB64] = stored.split(':');
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encryptPassword, decryptPassword };
