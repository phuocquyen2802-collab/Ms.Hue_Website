import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import AuthLayout, { AuthAlert, PasswordField } from '../components/AuthLayout';
import { usePreferences } from '../context/PreferencesContext';
import { LOGIN_TEXT } from '../i18n/publicText';

// Trang mở từ đường dẫn trong email khôi phục: /reset-password?token=...
// Kiểm tra link -> nhập mật khẩu mới -> đổi xong tự quay về trang đăng nhập.
const REDIRECT_SECONDS = 3;

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { lang } = usePreferences();
  const t = LOGIN_TEXT[lang];

  // checking | ready | invalid | done
  const [status, setStatus] = useState(token ? 'checking' : 'invalid');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    api.post('/auth/reset-password/check', { token })
      .then(({ data }) => {
        if (cancelled) return;
        setAccount(data.account || '');
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response) setStatus('invalid');
        else { setStatus('ready'); setError(t.errorNetwork); }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Đổi xong: đếm ngược rồi tự chuyển về trang đăng nhập.
  useEffect(() => {
    if (status !== 'done') return undefined;
    if (countdown <= 0) {
      navigate('/login', { replace: true, state: { resetDone: true } });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, countdown, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError(t.tooShort); return; }
    if (password !== confirm) { setError(t.mismatch); return; }
    setSaving(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setStatus('done');
    } catch (err) {
      const code = err.response?.data?.code;
      if (!err.response) setError(t.errorNetwork);
      else if (code === 'TOKEN_INVALID') setStatus('invalid');
      else if (code === 'WEAK_PASSWORD') setError(t.tooShort);
      else setError(t.resetFailed);
    } finally {
      setSaving(false);
    }
  }

  const back = (
    <Link to="/login" className="auth-back">
      <span aria-hidden="true">←</span> {t.backToLogin}
    </Link>
  );

  if (status === 'checking') {
    return (
      <AuthLayout back={back}>
        <div className="auth-brand">
          <h2>{t.resetTitle}</h2>
          <p className="auth-subtitle">{t.checking}</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'invalid') {
    return (
      <AuthLayout back={back}>
        <div className="auth-brand">
          <h2>{t.invalidTitle}</h2>
          <p className="auth-subtitle">{t.invalidText}</p>
        </div>
        <Link to="/login?forgot=1" className="btn auth-submit">{t.requestNew}</Link>
      </AuthLayout>
    );
  }

  if (status === 'done') {
    return (
      <AuthLayout back={back}>
        <div className="auth-brand">
          <span className="auth-status-icon is-success" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 12.5 4 4 8-9" />
            </svg>
          </span>
          <h2>{t.doneTitle}</h2>
          <p className="auth-subtitle" role="status" aria-live="polite">{t.doneText(countdown)}</p>
        </div>
        <Link to="/login" replace state={{ resetDone: true }} className="btn auth-submit">{t.loginNow}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout back={back}>
      <div className="auth-brand">
        <h2>{t.resetTitle}</h2>
        {account && (
          <p className="auth-subtitle">
            {t.resetAccount}: <strong translate="no">{account}</strong>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="reset-password">{t.newPassword}</label>
          <PasswordField
            id="reset-password"
            placeholder={t.newPasswordPlaceholder}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
            autoComplete="new-password"
            minLength={6}
            autoFocus
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </div>
        <div className="form-group">
          <label htmlFor="reset-confirm">{t.confirmPassword}</label>
          <PasswordField
            id="reset-confirm"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); if (error) setError(''); }}
            autoComplete="new-password"
            minLength={6}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <button className="btn auth-submit" type="submit" disabled={saving}>
          {saving ? t.saving : t.savePassword}
        </button>
      </form>
    </AuthLayout>
  );
}
