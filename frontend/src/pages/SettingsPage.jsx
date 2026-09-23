import { useEffect, useState } from 'react';
import api from '../services/api';

export default function SettingsPage() {
  const [profile, setProfile] = useState(null);

  // Password
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function loadInitialData() {
    try {
      const res = await api.get('/me');
      setProfile(res.data);
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
