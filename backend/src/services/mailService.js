// Gửi email của hệ thống (hiện dùng cho email đặt lại mật khẩu).
//
// Cấu hình trong backend/.env - xem backend/.env.example. Tự chọn cách gửi:
//   1. Resend API (khuyên dùng): RESEND_API_KEY + EMAIL_FROM
//      Gửi qua HTTPS nên không bị chặn như cổng SMTP 465/587 trên nhiều server.
//   2. SMTP bất kỳ (Brevo, Gmail...): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//      + EMAIL_FROM. Chỉ dùng khi không đặt RESEND_API_KEY.
// EMAIL_FROM (tên cũ MAIL_FROM vẫn dùng được) phải thuộc tên miền đã xác minh
// ở dịch vụ gửi mail, VD: MathInsight AI <support@ten-mien-cua-ban>.
//
// APP_URL là địa chỉ trang web (VD https://ten-mien-cua-ban), dùng để tạo
// đường dẫn trong email. Không lấy từ header Host của request vì kẻ xấu có
// thể giả header đó để link trong email trỏ sang trang của họ.
const nodemailer = require('nodemailer');

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 15000;
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

// Màu lấy theo giao diện web (frontend/src/index.css, BrandMark.jsx).
const C = {
  primary: '#2952d9',
  primaryLight: '#edf1fd',
  insight: '#f2a33a',
  ink: '#15203a',
  ink2: '#3a4562',
  muted: '#56627d',
  faint: '#8b95aa',
  canvas: '#f4f6fa',
  subtle: '#f8fafc',
  line: '#e2e8f0',
};
// Email không tải được web font: dùng font có sẵn, đủ dấu tiếng Việt.
const FONT = "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

// ---------------------------------------------------------------------------
// Cấu hình
// ---------------------------------------------------------------------------
// Bỏ cặp ngoặc kép/đơn bao ngoài: `docker run --env-file` giữ nguyên dấu
// ngoặc trong giá trị (khác dotenv và docker compose), VD EMAIL_FROM="...".
const env = (name) => String(process.env[name] || '').trim().replace(/^(['"])(.*)\1$/, '$2').trim();

function fromAddress() {
  return env('EMAIL_FROM') || env('MAIL_FROM');
}

function appUrl() {
  return env('APP_URL').replace(/\/+$/, '');
}

function provider() {
  if (env('RESEND_API_KEY')) return 'resend';
  if (env('SMTP_HOST')) return 'smtp';
  return null;
}

// Tên các biến .env còn thiếu (rỗng = đã đủ để gửi email).
function missingConfig() {
  const missing = [];
  if (!provider()) missing.push('RESEND_API_KEY');
  if (!fromAddress()) missing.push('EMAIL_FROM');
  if (!appUrl()) missing.push('APP_URL');
  return missing;
}

function isConfigured() {
  return missingConfig().length === 0;
}

// Một dòng mô tả cấu hình, in ra lúc khởi động server để dễ kiểm tra.
function describeConfig() {
  const missing = missingConfig();
  if (missing.length) {
    return `Chưa bật gửi email (thiếu ${missing.join(', ')} trong backend/.env) - link đặt lại mật khẩu sẽ in ra cửa sổ máy chủ.`;
  }
  const via = provider() === 'resend' ? 'Resend API' : `SMTP ${env('SMTP_HOST')}`;
  return `Gửi email qua ${via}, người gửi: ${fromAddress()}, link trỏ tới: ${appUrl()}`;
}

// ---------------------------------------------------------------------------
// Gửi
// ---------------------------------------------------------------------------
let transporter = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(env('SMTP_PORT') || 587);
    transporter = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: port === 465, // 465: TLS ngay từ đầu; 587: STARTTLS
      auth: env('SMTP_USER') ? { user: env('SMTP_USER'), pass: env('SMTP_PASS') } : undefined,
    });
  }
  return transporter;
}

async function sendViaResend({ to, subject, html, text, tags }) {
  let res;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
        'User-Agent': 'mathinsight-backend/1.0',
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, html, text, tags }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? `quá ${SEND_TIMEOUT_MS / 1000} giây không phản hồi` : err.message;
    throw new Error(`Không kết nối được Resend: ${reason}`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // VD: 403 "The ... domain is not verified", 401 "API key is invalid"
    throw new Error(`Resend từ chối gửi (HTTP ${res.status}): ${data.message || res.statusText}`);
  }
  return { provider: 'resend', id: data.id };
}

async function sendViaSmtp({ to, subject, html, text }) {
  const info = await getTransporter().sendMail({ from: fromAddress(), to, subject, html, text });
  return { provider: 'smtp', id: info.messageId };
}

async function sendMail(message) {
  const via = provider();
  if (via === 'resend') return sendViaResend(message);
  if (via === 'smtp') return sendViaSmtp(message);
  throw new Error('Chưa cấu hình gửi email (RESEND_API_KEY hoặc SMTP_HOST trong backend/.env)');
}

// ---------------------------------------------------------------------------
// Giao diện email đặt lại mật khẩu
// ---------------------------------------------------------------------------
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "14:32, 18/11/2026" theo giờ Việt Nam, không phụ thuộc múi giờ của server.
function formatTime(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.hour}:${parts.minute}, ${parts.day}/${parts.month}/${parts.year}`;
}

const RESET_TEXT = {
  vi: {
    subject: 'Đặt lại mật khẩu MathInsight AI',
    preheader: (account, m) => `Đường dẫn đặt mật khẩu mới cho tài khoản ${account}, hết hạn sau ${m} phút.`,
    tagline: 'Phần mềm học toán cùng AI',
    title: 'Đặt lại mật khẩu',
    hello: (name) => `Chào ${name},`,
    intro: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản MathInsight AI của bạn. Bấm nút bên dưới để tạo mật khẩu mới.',
    account: 'Tài khoản',
    requestedAt: 'Thời gian yêu cầu',
    expiresAt: 'Hết hạn lúc',
    expiresNote: (m) => `Sau ${m} phút, chỉ dùng được 1 lần`,
    button: 'Đặt lại mật khẩu',
    fallback: 'Nút không bấm được? Sao chép đường dẫn sau và dán vào trình duyệt:',
    notYouTitle: 'Bạn không yêu cầu đổi mật khẩu?',
    notYouText: 'Hãy bỏ qua email này, mật khẩu hiện tại của bạn vẫn giữ nguyên. Không chuyển tiếp email này cho người khác.',
    signOff: 'Trân trọng,',
    team: 'Đội ngũ MathInsight AI',
    footerAuto: 'Email này được gửi tự động vì có yêu cầu đặt lại mật khẩu trên MathInsight AI.',
    footerHelp: 'Cần hỗ trợ? Hãy liên hệ giáo viên hoặc quản trị viên của bạn.',
    textOpen: 'Mở đường dẫn sau để đặt mật khẩu mới:',
  },
  en: {
    subject: 'Reset your MathInsight AI password',
    preheader: (account, m) => `Your link to set a new password for ${account}. It expires in ${m} minutes.`,
    tagline: 'Learn math with AI',
    title: 'Reset your password',
    hello: (name) => `Hi ${name},`,
    intro: 'We received a request to reset the password of your MathInsight AI account. Press the button below to choose a new password.',
    account: 'Account',
    requestedAt: 'Requested at',
    expiresAt: 'Expires at',
    expiresNote: (m) => `In ${m} minutes, single use only`,
    button: 'Reset password',
    fallback: "Button not working? Copy this link and paste it into your browser:",
    notYouTitle: "Didn't ask to reset your password?",
    notYouText: "Just ignore this email - your current password stays the same. Don't forward this email to anyone.",
    signOff: 'Best regards,',
    team: 'The MathInsight AI team',
    footerAuto: 'This email was sent automatically because a password reset was requested on MathInsight AI.',
    footerHelp: 'Need help? Contact your teacher or administrator.',
    textOpen: 'Open this link to choose a new password:',
  },
};

function infoRow(label, valueHtml, { last = false, breakAll = false } = {}) {
  const border = last ? '' : `border-bottom:1px solid ${C.line};`;
  const wrap = breakAll ? 'word-break:break-all;' : '';
  return `<tr>
                        <td valign="top" style="padding:11px 16px;${border}font-family:${FONT};font-size:13px;line-height:1.5;color:${C.muted};width:38%;">${escapeHtml(label)}</td>
                        <td valign="top" style="padding:11px 16px;${border}font-family:${FONT};font-size:14px;line-height:1.5;font-weight:600;color:${C.ink};${wrap}">${valueHtml}</td>
                      </tr>`;
}

// "14:32, 18/11/2026 (GMT+7)" - phần múi giờ chữ nhạt, không bị ngắt dòng giữa chừng.
const timeHtml = (date) => `${escapeHtml(formatTime(date))} <span style="white-space:nowrap;font-weight:400;color:${C.muted};">(GMT+7)</span>`;

// Trả về { subject, html, text }. Mọi giá trị đưa vào đều được escape.
function buildPasswordResetEmail({ name, account, link, minutes, requestedAt = new Date(), lang = 'vi' }) {
  const t = RESET_TEXT[lang] || RESET_TEXT.vi;
  const htmlLang = RESET_TEXT[lang] ? lang : 'vi';
  const displayName = name || account;
  const requested = new Date(requestedAt);
  const expires = new Date(requested.getTime() + minutes * 60 * 1000);
  const requestedText = `${formatTime(requested)} (GMT+7)`;
  const expiresText = `${formatTime(expires)} (GMT+7)`;

  let site = appUrl();
  try { site = new URL(link).origin; } catch { /* giữ APP_URL */ }
  const siteLabel = site.replace(/^https?:\/\//, '');
  const safeLink = escapeHtml(link);
  const year = new Date().getFullYear();
  // Ký tự ẩn đệm sau dòng xem trước, để hộp thư không chèn nội dung email vào đó.
  const preheaderPad = '&#847;&zwnj;&nbsp;'.repeat(40);

  const html = `<!DOCTYPE html>
<html lang="${htmlLang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(t.subject)}</title>
<!--[if mso]><style>table,td,p,a,span,h1{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:separate;}
  @media only screen and (max-width:620px){
    .outer{padding:20px 10px !important;}
    .card-pad{padding:28px 22px 26px !important;}
    .title{font-size:22px !important;}
    .btn-table{width:100% !important;}
    .btn-link{display:block !important;padding-left:12px !important;padding-right:12px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${C.canvas};">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.canvas};">${escapeHtml(t.preheader(account, minutes))}${preheaderPad}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.canvas};">
    <tr>
      <td class="outer" align="center" style="padding:36px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Thương hiệu -->
          <tr>
            <td style="padding:0 4px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="40" height="40" align="center" valign="middle" style="width:40px;height:40px;background-color:${C.primary};border-radius:11px;font-family:${FONT};font-size:20px;line-height:40px;font-weight:700;color:#ffffff;">M</td>
                  <td style="padding-left:12px;font-family:${FONT};">
                    <div style="font-size:17px;line-height:1.25;font-weight:700;color:${C.ink};">MathInsight <span style="color:${C.primary};">AI</span></div>
                    <div style="font-size:12.5px;line-height:1.4;color:${C.muted};">${escapeHtml(t.tagline)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thẻ nội dung -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid ${C.line};border-radius:16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td height="6" style="height:6px;line-height:6px;font-size:0;background-color:${C.primary};border-radius:15px 0 0 0;">&nbsp;</td>
                        <td width="76" height="6" style="width:76px;height:6px;line-height:6px;font-size:0;background-color:${C.insight};border-radius:0 15px 0 0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="card-pad" style="padding:34px 40px 32px;font-family:${FONT};">

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;background-color:${C.primaryLight};border-radius:14px;font-size:24px;line-height:52px;">&#128272;</td>
                      </tr>
                    </table>

                    <h1 class="title" style="margin:22px 0 12px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${C.ink};">${escapeHtml(t.title)}</h1>
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:${C.ink2};">${escapeHtml(t.hello(displayName))}</p>
                    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${C.ink2};">${escapeHtml(t.intro)}</p>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.subtle};border:1px solid ${C.line};border-radius:12px;">
                      ${infoRow(t.account, escapeHtml(account), { breakAll: true })}
                      ${infoRow(t.requestedAt, timeHtml(requested))}
                      ${infoRow(t.expiresAt, `${timeHtml(expires)}<br><span style="font-size:12.5px;font-weight:400;color:${C.muted};">${escapeHtml(t.expiresNote(minutes))}</span>`, { last: true })}
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="padding:28px 0 6px;">
                          <table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="${C.primary}" style="background-color:${C.primary};border-radius:12px;mso-padding-alt:15px 40px;">
                                <a class="btn-link" href="${safeLink}" target="_blank" rel="noopener" style="display:inline-block;padding:15px 40px;font-family:${FONT};font-size:16px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${escapeHtml(t.button)} &rarr;</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr><td style="padding:26px 0 0;border-bottom:1px solid ${C.line};font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>

                    <p style="margin:22px 0 8px;font-size:13px;line-height:1.6;color:${C.muted};">${escapeHtml(t.fallback)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:11px 14px;background-color:${C.subtle};border:1px solid ${C.line};border-radius:10px;font-family:Consolas,'Courier New',monospace;font-size:12.5px;line-height:1.55;word-break:break-all;">
                          <a href="${safeLink}" target="_blank" rel="noopener" style="color:${C.primary};text-decoration:underline;word-break:break-all;">${safeLink}</a>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:22px 0 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="padding:14px 16px;background-color:#fff8eb;border:1px solid #f7e0b5;border-left:4px solid ${C.insight};border-radius:10px;font-family:${FONT};">
                                <p style="margin:0 0 4px;font-size:14px;line-height:1.5;font-weight:700;color:#7a4a06;">${escapeHtml(t.notYouTitle)}</p>
                                <p style="margin:0;font-size:13.5px;line-height:1.6;color:#6e5530;">${escapeHtml(t.notYouText)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:26px 0 0;font-size:14.5px;line-height:1.6;color:${C.ink2};">${escapeHtml(t.signOff)}<br><strong style="color:${C.ink};">${escapeHtml(t.team)}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Chân email -->
          <tr>
            <td align="center" style="padding:24px 20px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.faint};">
              ${escapeHtml(t.footerAuto)}<br>${escapeHtml(t.footerHelp)}<br>
              <a href="${escapeHtml(site)}" target="_blank" rel="noopener" style="color:${C.muted};text-decoration:underline;">${escapeHtml(siteLabel)}</a> &middot; &copy; ${year} MathInsight AI
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Bản chữ thuần cho hộp thư không hiển thị HTML (và giúp ít bị vào Spam).
  const text = [
    `MathInsight AI - ${t.title}`,
    '',
    t.hello(displayName),
    '',
    t.intro,
    '',
    t.textOpen,
    link,
    '',
    `${t.account}: ${account}`,
    `${t.requestedAt}: ${requestedText}`,
    `${t.expiresAt}: ${expiresText} - ${t.expiresNote(minutes)}`,
    '',
    `${t.notYouTitle} ${t.notYouText}`,
    '',
    t.signOff,
    t.team,
    site,
  ].join('\n');

  return { subject: t.subject, html, text };
}

async function sendPasswordResetEmail({ to, name, account, link, minutes, requestedAt, lang = 'vi' }) {
  const { subject, html, text } = buildPasswordResetEmail({
    name, account: account || to, link, minutes, requestedAt, lang,
  });
  return sendMail({ to, subject, html, text, tags: [{ name: 'category', value: 'password_reset' }] });
}

module.exports = {
  isConfigured,
  missingConfig,
  describeConfig,
  appUrl,
  buildPasswordResetEmail,
  sendPasswordResetEmail,
};
