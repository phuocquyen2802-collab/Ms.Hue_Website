// Gửi thử email đặt lại mật khẩu để kiểm tra cấu hình gửi mail (Resend/SMTP).
//
//   cd backend
//   npm run mail:test -- ten-ban@gmail.com       gửi thử bản tiếng Việt
//   npm run mail:test -- ten-ban@gmail.com en    gửi thử bản tiếng Anh
//   npm run mail:test -- --preview               chỉ tạo file HTML xem trước, không gửi
//
// Trên server Docker: docker compose exec app npm run mail:test -- ten-ban@gmail.com
//
// Email thử dùng token mẫu: bấm nút trong email sẽ ra trang báo "đường dẫn
// không hợp lệ", không đổi được mật khẩu của ai.
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mailService = require('../services/mailService');

async function main() {
  const args = process.argv.slice(2);
  const lang = args.includes('en') ? 'en' : 'vi';
  const to = args.find((a) => a.includes('@'));
  const base = mailService.appUrl() || 'http://localhost:5173';
  const sample = {
    name: lang === 'en' ? 'Test student' : 'Học sinh thử nghiệm',
    account: 'hocsinh01',
    link: `${base}/reset-password?token=TEST-${Date.now().toString(36)}`,
    minutes: 30,
    requestedAt: new Date(),
    lang,
  };

  if (args.includes('--preview')) {
    const { subject, html } = mailService.buildPasswordResetEmail(sample);
    const out = path.join(os.tmpdir(), `mathinsight-reset-email-${lang}.html`);
    fs.writeFileSync(out, html, 'utf8');
    console.log(`Tiêu đề: ${subject}\nĐã tạo file xem trước (mở bằng trình duyệt): ${out}`);
    return;
  }

  if (!to) {
    console.error('Nhập email nhận thử, VD: npm run mail:test -- ten-ban@gmail.com');
    process.exitCode = 1;
    return;
  }
  if (!mailService.isConfigured()) {
    console.error(`Chưa cấu hình gửi email, thiếu trong backend/.env: ${mailService.missingConfig().join(', ')}`);
    process.exitCode = 1;
    return;
  }

  console.log(mailService.describeConfig());
  const result = await mailService.sendPasswordResetEmail({ ...sample, to });
  console.log(`Đã gửi (mã ${result.id}). Kiểm tra hộp thư ${to}, xem cả mục Spam/Quảng cáo.`);
}

main().catch((err) => {
  console.error(`Gửi thất bại: ${err.message}`);
  process.exitCode = 1;
});
