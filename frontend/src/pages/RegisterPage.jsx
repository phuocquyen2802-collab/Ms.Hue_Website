import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ ...form, role: 'teacher' });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">∑</div>
          <h2>Đăng ký Giáo viên</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Họ và tên Giáo viên</label>
            <input
              type="text"
              placeholder="VD: Thầy Nguyễn Văn A"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email đăng nhập</label>
            <input
              type="email"
              placeholder="VD: teacher@school.edu.vn"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Mật khẩu</label>
            <input
              type="password"
              placeholder="Tối thiểu 6 ký tự"
              value={form.password}
              onChange={(e) => updateField('password', e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && <p className="error-text">⚠️ {error}</p>}
          {success && <p className="success-text">✓ Đăng ký thành công! Đang chuyển đến đăng nhập...</p>}

          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border-light)', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ fontWeight: 700 }}>
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
