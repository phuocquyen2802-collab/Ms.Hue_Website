import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { LanguageSwitch, ThemeSwitch } from '../components/PreferenceSwitches';
import { APP_NAME } from '../config/brand';
import { usePreferences } from '../context/PreferencesContext';
import { LOGIN_TEXT, SWITCH_TEXT, TAGLINE } from '../i18n/publicText';

// Hình minh hoạ bên trái: đồ thị y = x³ − 3x trên giấy kẻ ô, đánh dấu điểm
// cực đại (CĐ) và cực tiểu (CT). Toạ độ màn hình: gốc O tại (280; 170),
// 1 đơn vị trục x = 80px, 1 đơn vị trục y = 40px, ô lưới 40px.
const O = { x: 280, y: 170 };
const UX = 80;
const UY = 40;
const toX = (x) => O.x + x * UX;
const toY = (y) => O.y - y * UY;

const CURVE = (() => {
  const pts = [];
  const n = 90;
  for (let i = 0; i <= n; i += 1) {
    const x = -2.15 + (4.3 * i) / n;
    const y = x * x * x - 3 * x;
    pts.push(`${i ? 'L' : 'M'}${toX(x).toFixed(1)} ${toY(y).toFixed(1)}`);
  }
  return pts.join(' ');
})();

const GRID_X = Array.from({ length: 15 }, (_, i) => i * 40);
const GRID_Y = Array.from({ length: 9 }, (_, i) => 10 + i * 40);

function CubicPlot({ text }) {
  const max = { x: toX(-1), y: toY(2) };
  const min = { x: toX(1), y: toY(-2) };

  return (
    <figure className="auth-plot" aria-label={text.plotLabel}>
      <svg viewBox="0 0 560 340" role="img" aria-hidden="true">
        <g className="auth-plot-grid">
          {GRID_X.map((x) => (
            <line key={`gx${x}`} x1={x} y1="0" x2={x} y2="340" />
          ))}
          {GRID_Y.map((y) => (
            <line key={`gy${y}`} x1="0" y1={y} x2="560" y2={y} />
          ))}
        </g>

        <g className="auth-plot-axis">
          <line x1="12" y1={O.y} x2="546" y2={O.y} />
          <line x1={O.x} y1="332" x2={O.x} y2="8" />
          <path d={`M546 ${O.y} l-8 -4 v8 Z`} />
          <path d={`M${O.x} 8 l-4 8 h8 Z`} />
          <text x="540" y={O.y + 20}>x</text>
          <text x={O.x + 10} y="20">y</text>
          <text x={O.x - 14} y={O.y + 18}>O</text>
          {[-2, -1, 1, 2].map((t) => (
            <text key={`tx${t}`} x={toX(t)} y={t === 1 ? O.y - 8 : O.y + 18} textAnchor="middle">
              {t < 0 ? `−${-t}` : t}
            </text>
          ))}
          <text x={O.x + 10} y={max.y + 5}>2</text>
          <text x={O.x - 10} y={min.y + 5} textAnchor="end">−2</text>
        </g>

        <g className="auth-plot-guides">
          <path d={`M${max.x} ${max.y} V${O.y} M${max.x} ${max.y} H${O.x}`} />
          <path d={`M${min.x} ${min.y} V${O.y} M${min.x} ${min.y} H${O.x}`} />
          <path d={`M${min.x} ${min.y} L${min.x + 18} ${min.y + 22}`} className="auth-plot-leader" />
        </g>

        <path className="auth-plot-curve" d={CURVE} pathLength="1" />

        <g className="auth-plot-points">
          <circle cx={max.x} cy={max.y} r="6" className="auth-plot-point" />
          <text x={max.x} y={max.y - 16} textAnchor="middle" className="auth-plot-label">{text.plotMax}</text>
          <circle cx={min.x} cy={min.y} r="7" className="auth-plot-point insight" />
          <text x={min.x} y={min.y - 16} textAnchor="middle" className="auth-plot-label">{text.plotMin}</text>
          <text x="24" y="40" className="auth-plot-eq">y = x³ − 3x</text>
        </g>
      </svg>

      <figcaption className="auth-plot-note">
        <span className="auth-plot-note-dot" aria-hidden="true" />
        <span>
          <strong>{text.noteTitle}</strong>
          {text.noteText}
        </span>
      </figcaption>
    </figure>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { lang } = usePreferences();
  const t = LOGIN_TEXT[lang];
  const sw = SWITCH_TEXT[lang];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    } catch (err) {
      // Thông báo lỗi của máy chủ viết bằng tiếng Việt - khi xem bằng tiếng Anh
      // thì dùng câu tiếng Anh tương ứng.
      if (!err.response) setError(t.errorNetwork);
      else if (lang === 'en') setError(t.errorWrong);
      else setError(err.response.data?.message || t.errorWrong);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" lang={lang}>
      <section className="auth-hero">
        <Link to="/" className="auth-hero-brand" title={t.backToHome}>
          <BrandMark size={40} />
          <div>
            <div className="auth-hero-name">{APP_NAME}</div>
            <div className="auth-hero-tagline">{TAGLINE[lang]}</div>
          </div>
        </Link>

        <div className="auth-hero-body">
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
        </div>

        <CubicPlot text={t} />

        <div className="auth-hero-foot">{t.heroFoot}</div>
      </section>

      <main className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-top">
            <Link to="/" className="auth-back">
              <span aria-hidden="true">←</span> {t.back}
            </Link>
            <div className="auth-prefs">
              <LanguageSwitch label={sw.english} title={sw.toOther} />
              <ThemeSwitch label={sw.darkMode} />
            </div>
          </div>
          <div className="auth-brand">
            <h2>{t.title}</h2>
            <p className="auth-subtitle">{t.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit}>
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
              <label htmlFor="login-password">{t.password}</label>
              <div className="auth-password-field">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t.passwordPlaceholder}
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
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  aria-pressed={showPassword}
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
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M12 7.5v5.5M12 16.5h.01" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button className="btn auth-submit" type="submit" disabled={loading}>
              {loading ? t.submitting : t.submit}
            </button>
          </form>

          <p className="auth-help">
            {t.help}
          </p>
        </div>
      </main>
    </div>
  );
}
