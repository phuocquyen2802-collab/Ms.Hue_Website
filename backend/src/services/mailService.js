// Gửi email qua SMTP (dùng được với mọi dịch vụ: Resend, Brevo, Gmail...).
// Cấu hình trong backend/.env - xem backend/.env.example:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL
// APP_URL là địa chỉ trang web (VD https://mathinsigth-ai.work.gd), dùng để
// tạo đường dẫn trong email. Không lấy từ header Host của request vì kẻ xấu
// có thể giả header đó để link trong email trỏ sang trang của họ.
const nodemailer = require('nodemailer');

let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.APP_URL);
}

function appUrl() {
  return String(process.env.APP_URL || '').replace(/\/+$/, '');
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465: TLS ngay từ đầu; 587: STARTTLS
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const RESET_TEXT = {
  vi: {
    subject: 'Đặt lại mật khẩu MathInsight AI',
    hello: (name) => `Chào ${name},`,
    intro: 'Có yêu cầu đặt lại mật khẩu cho tài khoản MathInsight AI của bạn. Bấm nút bên dưới để đặt mật khẩu mới:',
    button: 'Đặt lại mật khẩu',
    expires: (m) => `Đường dẫn chỉ dùng được 1 lần và hết hạn sau ${m} phút.`,
    fallback: 'Nếu nút không bấm được, hãy mở đường dẫn này:',
    ignore: 'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này - mật khẩu của bạn vẫn giữ nguyên.',
  },
  en: {
    subject: 'Reset your MathInsight AI password',
    hello: (name) => `Hi ${name},`,
    intro: 'We received a request to reset the password of your MathInsight AI account. Press the button below to choose a new password:',
    button: 'Reset password',
    expires: (m) => `The link can be used once and expires in ${m} minutes.`,
    fallback: "If the button doesn't work, open this link:",
    ignore: "If you didn't ask to reset your password, you can ignore this email - your password stays the same.",
  },
};

async function sendPasswordResetEmail({ to, name, link, minutes, lang = 'vi' }) {
  const t = RESET_TEXT[lang] || RESET_TEXT.vi;
  const safeName = escapeHtml(name || to);
  const safeLink = escapeHtml(link);

  const text = [
    t.hello(name || to), '', t.intro, link, '', t.expires(minutes), '', t.ignore, '', 'MathInsight AI',
  ].join('\n');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#15203a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px">
      <tr><td style="padding:28px 28px 8px">
        <div style="font-size:18px;font-weight:700;color:#2952d9">MathInsight AI</div>
      </td></tr>
      <tr><td style="padding:8px 28px 4px;font-size:15px;line-height:1.6">
        <p style="margin:0 0 12px">${t.hello(safeName)}</p>
        <p style="margin:0 0 20px">${escapeHtml(t.intro)}</p>
        <p style="margin:0 0 20px">
          <a href="${safeLink}" style="display:inline-block;padding:12px 22px;background:#2952d9;color:#ffffff;text-decoration:none;font-weight:700;border-radius:999px">${escapeHtml(t.button)}</a>
        </p>
        <p style="margin:0 0 16px;font-size:13.5px;color:#56627d">${escapeHtml(t.expires(minutes))}</p>
        <p style="margin:0 0 6px;font-size:13px;color:#56627d">${escapeHtml(t.fallback)}</p>
        <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${safeLink}" style="color:#2952d9">${safeLink}</a></p>
        <p style="margin:0 0 24px;font-size:13px;color:#56627d">${escapeHtml(t.ignore)}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return getTransporter().sendMail({ from: process.env.MAIL_FROM, to, subject: t.subject, text, html });
}

module.exports = { isConfigured, appUrl, sendPasswordResetEmail };
