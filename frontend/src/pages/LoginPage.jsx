import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { LOGOUT_REASON_KEY } from '../services/api';
import AuthLayout, { AuthAlert, PasswordField } from '../components/AuthLayout';
import { usePreferences } from '../context/PreferencesContext';
import { LOGIN_TEXT } from '../i18n/publicText';

// Trang đăng nhập, gồm 3 màn trong cùng một thẻ:
// - login:  đăng nhập. Sai mật khẩu 5 lần liên tiếp thì máy chủ tạm khoá và
//           trang tự chuyển sang màn "forgot".
// - forgot: nhập tên đăng nhập + email đã đăng ký để nhận link đặt lại mật khẩu
//           (mở bằng nút "Quên mật khẩu?" hoặc /login?forgot=1).
// - sent:   báo đã gửi, nhắc kiểm tra hộp thư.
// Link trong email mở trang /reset-password (ResetPasswordPage), đổi xong tự
// quay lại đây kèm thông báo đã đổi mật khẩu.

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { lang } = usePreferences();
  const t = LOGIN_TEXT[lang];

  const [mode, setMode] = useState(() => (new URLSearchParams(location.search).has('forgot') ? 'forgot' : 'login'));
  const [resetDone] = useState(() => Boolean(location.state?.resetDone));
  // Bị đăng xuất vì giáo viên đã xoá tài khoản (services/api.js ghi lại lý do).
  const [accountDeleted] = useState(() => {
    try {
      return sessionStorage.getItem(LOGOUT_REASON_KEY) === 'deleted';
    } catch {
      return false;
    }
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [recovery, setRecovery] = useState({ username: '', email: '' });
  const [locked, setLocked] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMinutes, setSentMinutes] = useState(30);

  // Bỏ cờ "vừa đổi mật khẩu" khỏi lịch sử để tải lại trang không hiện lại thông báo.
  useEffect(() => {
    try {
      sessionStorage.removeItem(LOGOUT_REASON_KEY);
    } catch {
      // bỏ qua
    }
    if (location.state?.resetDone) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openForgot({ username = email, wasLocked = false } = {}) {
    setRecovery({ username: username.trim(), email: '' });
    setLocked(wasLocked);
    setRecoveryError('');
    setError('');
    setMode('forgot');
  }

  function backToLogin() {
    setMode('login');
    setRecoveryError('');
    setLocked(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      const data = err.response?.data;
      if (!err.response) setError(t.errorNetwork);
      else if (err.response.status === 423 || data?.code === 'LOGIN_LOCKED') {
        setPassword('');
        openForgot({ username: email, wasLocked: true });
      } else if (data?.code === 'LOGIN_WRONG' && typeof data.attemptsLeft === 'number') {
        setError(`${t.errorWrong} ${t.attemptsLeft(data.attemptsLeft)}`);
      } else {
        // Thông báo của máy chủ viết bằng tiếng Việt - xem bằng tiếng Anh thì dùng câu tiếng Anh.
        setError(lang === 'en' ? t.errorWrong : data?.message || t.errorWrong);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    setRecoveryError('');
    setSending(true);
    try {
      const { data } = await api.post('/auth/forgot-password', {
        username: recovery.username.trim(),
        email: recovery.email.trim(),
        lang,
      });
      setSentMinutes(data?.minutes || 30);
      setMode('sent');
    } catch (err) {
      const code = err.response?.data?.code;
      if (!err.response) setRecoveryError(t.errorNetwork);
      else if (code === 'MAIL_DISABLED') setRecoveryError(t.mailDisabled);
      else if (code === 'INVALID_EMAIL') setRecoveryError(t.invalidEmail);
      else setRecoveryError(t.mailFailed);
    } finally {
      setSending(false);
    }
  }

  const homeLink = (
    <Link to="/" className="auth-back">
      <span aria-hidden="true">←</span> {t.back}
    </Link>
  );
  const loginLink = (
    <button type="button" className="auth-back" onClick={backToLogin}>
      <span aria-hidden="true">←</span> {t.backToLogin}
    </button>
  );

  if (mode === 'sent') {
    return (
      <AuthLayout back={loginLink}>
        <div className="auth-brand">
          <span className="auth-status-icon is-success" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m3.5 7 8.5 6 8.5-6" />
            </svg>
          </span>
          <h2>{t.sentTitle}</h2>
          <p className="auth-subtitle">{t.sentText(recovery.email.trim(), sentMinutes)}</p>
        </div>
        <AuthAlert tone="warning">{t.sentSpam}</AuthAlert>
        <div className="auth-actions">
          <button type="button" className="btn auth-submit" onClick={backToLogin}>{t.backToLogin}</button>
          <button type="button" className="btn secondary auth-submit" onClick={() => setMode('forgot')}>{t.resend}</button>
        </div>
      </AuthLayout>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout back={loginLink}>
        <div className="auth-brand">
          <h2>{t.forgotTitle}</h2>
          <p className="auth-subtitle">{t.forgotSubtitle}</p>
        </div>

        {locked && <AuthAlert tone="warning">{t.lockedNotice}</AuthAlert>}

        <form onSubmit={handleForgot}>
          <div className="form-group">
            <label htmlFor="recovery-username">{t.username}</label>
            <input
              id="recovery-username"
              type="text"
              placeholder={t.usernamePlaceholder}
              value={recovery.username}
              onChange={(e) => setRecovery({ ...recovery, username: e.target.value })}
              autoComplete="username"
              spellCheck={false}
              autoFocus={!recovery.username}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="recovery-email">{t.recoveryEmail}</label>
            <input
              id="recovery-email"
              type="email"
              inputMode="email"
              placeholder={t.recoveryEmailPlaceholder}
              value={recovery.email}
              onChange={(e) => setRecovery({ ...recovery, email: e.target.value })}
              autoComplete="email"
              spellCheck={false}
              autoFocus={Boolean(recovery.username)}
              required
            />
          </div>

          {recoveryError && <AuthAlert>{recoveryError}</AuthAlert>}

          <button className="btn auth-submit" type="submit" disabled={sending}>
            {sending ? t.sending : t.sendLink}
          </button>
        </form>

        <p className="auth-help">{t.forgotHelp}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout back={homeLink}>
      <div className="auth-brand">
        <h2>{t.title}</h2>
        <p className="auth-subtitle">{t.subtitle}</p>
      </div>

      {resetDone && <AuthAlert tone="success">{t.resetDone}</AuthAlert>}
      {accountDeleted && <AuthAlert>{t.accountDeleted}</AuthAlert>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="login-email">{t.account}</label>
          <input
            id="login-email"
            type="text"
            placeholder={t.accountPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            autoComplete="username"
            spellCheck={false}
            required
          />
        </div>
        <div className="form-group">
          <div className="label-row">
            <label htmlFor="login-password">{t.password}</label>
            <button type="button" className="text-btn" onClick={() => openForgot()}>
              {t.forgotLink}
            </button>
          </div>
          <PasswordField
            id="login-password"
            placeholder={t.passwordPlaceholder}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            autoComplete="current-password"
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <button className="btn auth-submit" type="submit" disabled={loading}>
          {loading ? t.submitting : t.submit}
        </button>
      </form>

      <p className="auth-help">{t.help}</p>
    </AuthLayout>
  );
}
