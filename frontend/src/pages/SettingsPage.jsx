import { useEffect, useState } from 'react';
import api from '../services/api';
import UiIcon from '../components/UiIcon';

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);

  // Password
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Email khôi phục mật khẩu
  const [recoveryForm, setRecoveryForm] = useState({ recoveryEmail: '', currentPassword: '' });
  const [recoveryError, setRecoveryError] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);

  async function loadInitialData() {
    try {
      const res = await api.get('/me');
      setProfile(res.data);
      setRecoveryForm({ recoveryEmail: res.data.recoveryEmail || '', currentPassword: '' });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới nhập lại không khớp');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Đổi mật khẩu thành công!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveRecovery(e) {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess('');
    setSavingRecovery(true);
    try {
      const { data } = await api.put('/me/recovery-email', {
        recoveryEmail: recoveryForm.recoveryEmail.trim(),
        currentPassword: recoveryForm.currentPassword,
      });
      const fallback = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ? profile.email : null;
      setProfile({ ...profile, recoveryEmail: data.recoveryEmail, effectiveRecoveryEmail: data.recoveryEmail || fallback });
      setRecoveryForm({ recoveryEmail: data.recoveryEmail || '', currentPassword: '' });
      setRecoverySuccess(data.recoveryEmail ? 'Đã lưu email khôi phục.' : 'Đã xoá email khôi phục.');
    } catch (err) {
      setRecoveryError(err.response?.data?.message || 'Lưu email khôi phục thất bại');
    } finally {
      setSavingRecovery(false);
    }
  }

  if (!profile) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải cài đặt…</div>
        </div>
      </div>
    );
  }

  const isTeacher = profile.role === 'teacher';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Cài đặt</h1>
          <p className="page-subtitle">Quản lý thông tin cá nhân và tài khoản</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Thông tin tài khoản</h2>
        </div>
        <div className="table-responsive" style={{ border: 'none' }}>
          <table>
            <tbody>
              <tr>
                <td className="nowrap" style={{ color: 'var(--text-muted)', width: 160, fontWeight: 600 }}>Họ và tên</td>
                <td style={{ fontWeight: 600 }}>{profile.name}</td>
              </tr>
              <tr>
                <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Email / Tên đăng nhập</td>
                <td>{profile.email}</td>
              </tr>
              <tr>
                <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Vai trò</td>
                <td>
                  <span className={`status-pill ${isTeacher ? 'approved' : 'assigned'}`}>
                    {isTeacher ? 'Giáo viên' : 'Học sinh'}
                  </span>
                </td>
              </tr>
              {profile.className && (
                <tr>
                  <td className="nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Lớp</td>
                  <td>
                    <span className="tag-badge">Lớp {profile.className}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Email khôi phục mật khẩu</h2>
        </div>
        <form className="form-panel" onSubmit={handleSaveRecovery} style={{ maxWidth: 420 }}>
          <p className="field-hint recovery-intro">
            Khi quên mật khẩu hoặc nhập sai mật khẩu 5 lần liên tiếp, đường dẫn đặt lại mật khẩu sẽ được gửi tới email này.
          </p>
          {profile.effectiveRecoveryEmail ? (
            <div className="notice is-success recovery-status">
              <UiIcon name="mail" size={18} />
              <div className="notice-body">
                Đang nhận link khôi phục qua <strong translate="no">{profile.effectiveRecoveryEmail}</strong>
              </div>
            </div>
          ) : (
            <div className="notice is-warning recovery-status">
              <UiIcon name="alert" size={18} />
              <div className="notice-body">Tài khoản chưa có email khôi phục nên không tự lấy lại được mật khẩu khi quên.</div>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="recovery-email">Email (Gmail)</label>
            <input
              id="recovery-email"
              type="email"
              inputMode="email"
              placeholder="ten@gmail.com"
              value={recoveryForm.recoveryEmail}
              onChange={(e) => setRecoveryForm({ ...recoveryForm, recoveryEmail: e.target.value })}
              autoComplete="email"
              spellCheck={false}
            />
          </div>
          <div className="form-group">
            <label htmlFor="recovery-current-password">Mật khẩu hiện tại</label>
            <input
              id="recovery-current-password"
              type="password"
              value={recoveryForm.currentPassword}
              onChange={(e) => setRecoveryForm({ ...recoveryForm, currentPassword: e.target.value })}
              autoComplete="current-password"
              required
            />
            <p className="field-hint">Nhập mật khẩu để xác nhận đúng là bạn đang đổi email.</p>
          </div>

          {recoveryError && (
            <p className="error-text" role="alert" aria-live="polite">
              <span aria-hidden="true">⚠️</span> {recoveryError}
            </p>
          )}
          {recoverySuccess && (
            <p className="success-text" role="status" aria-live="polite">
              <span aria-hidden="true">✓</span> {recoverySuccess}
            </p>
          )}

          <button className="btn" type="submit" disabled={savingRecovery} style={{ marginTop: 6 }}>
            {savingRecovery ? 'Đang lưu…' : 'Lưu email khôi phục'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Đổi mật khẩu</h2>
        </div>
        <form className="form-panel" onSubmit={handleChangePassword} style={{ maxWidth: 420 }}>
          <div className="form-group">
            <label htmlFor="current-password">Mật khẩu hiện tại</label>
            <input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">Mật khẩu mới</label>
            <input
              id="new-password"
              type="password"
              placeholder="Tối thiểu 6 ký tự…"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
            <input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          {passwordError && (
            <p className="error-text" role="alert" aria-live="polite">
              <span aria-hidden="true">⚠️</span> {passwordError}
            </p>
          )}
          {passwordSuccess && (
            <p className="success-text" role="status" aria-live="polite">
              <span aria-hidden="true">✓</span> {passwordSuccess}
            </p>
          )}

          <button className="btn" type="submit" disabled={savingPassword} style={{ marginTop: 6 }}>
            {savingPassword ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
          </button>
        </form>
      </div>
    </div>
  );
}
