import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      setError(err.response?.data?.message || 'Sai tài khoản hoặc mật khẩu. Vui lòng kiểm tra lại!');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-mark">∑</div>
        <div className="auth-hero-body">
          <h1>Ôn tập Toán 12 bài bản, đúng lộ trình.</h1>
          <p>
            Làm bài trắc nghiệm và nhận kết quả ngay. Hệ thống phân tích các
            chuyên đề còn yếu và đề xuất lộ trình ôn tập phù hợp trước kỳ thi
            THPT Quốc gia.
          </p>
        </div>
        <div className="auth-hero-foot">Dành cho giáo viên và học sinh lớp 12</div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-brand">
            <h2>Đăng nhập</h2>
            <p className="auth-subtitle">Nhập thông tin tài khoản do giáo viên hoặc nhà trường cấp</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Tài khoản / Email</label>
              <input
                id="login-email"
                type="text"
                placeholder="ten@email.com hoặc tên đăng nhập…"
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
              <label htmlFor="login-password">Mật khẩu</label>
              <div className="auth-password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu…"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 .69-1.92 1.83-3.66 3.31-5.09M9.9 4.24A10.7 10.7 0 0 1 12 4c5 0 9.27 3.11 11 8-.46 1.29-1.12 2.5-1.94 3.57" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error" role="alert" aria-live="polite">
                <span aria-hidden="true" style={{ fontSize: 16 }}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
