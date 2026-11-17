import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import BrandMark from '../components/BrandMark';
import UiIcon from '../components/UiIcon';
import { LanguageSwitch, ThemeSwitch } from '../components/PreferenceSwitches';
import { renderMath } from '../utils/mathRender';
import { APP_NAME, APP_TITLE, PROJECT_CREDITS } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { LANDING_TEXT, SWITCH_TEXT, TAGLINE } from '../i18n/publicText';

// Trang giới thiệu (hiện ở "/" khi chưa đăng nhập). Nút "Đăng nhập" dẫn sang
// /login như cũ. Nội dung chỉ mô tả các tính năng phần mềm đang có thật.
// Chữ trên trang có 2 ngôn ngữ (i18n/publicText.js), đổi bằng công tắc VI/EN
// trên thanh đầu trang.

function scrollToId(id) {
  return (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
}

// Ảnh ghép minh hoạ: các mảnh giao diện thật của phần mềm (thẻ kết quả,
// bước lộ trình có công thức Toán, trạng thái phân tích AI).
function ProductCollage({ text }) {
  const formula = renderMath(String.raw`$a^x = b \Leftrightarrow x = \log_a b$`);
  return (
    <div className="lp-collage" aria-hidden="true">
      <div className="lp-window">
        <div className="lp-window-side">
          <BrandMark size={22} />
          <span className="lp-line is-active" />
          <span className="lp-line" />
          <span className="lp-line" />
          <span className="lp-line" />
        </div>
        <div className="lp-window-main">
          <div className="lp-window-title">{text.title}</div>
          <div className="lp-result">
            <div className="lp-result-score">5.7<small>/10</small></div>
            <div>
              <div className="lp-result-name">{text.exam}</div>
              <div className="lp-result-meta">{text.attempt}</div>
            </div>
          </div>
          {text.topics.map((t, i) => (
            <div key={t.name} className="lp-weak">
              <div className="lp-weak-row"><span>{t.name}</span><b>{t.wrong}</b></div>
              <div className="score-bar"><span className="is-low" style={{ width: i === 0 ? '60%' : '40%' }} /></div>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-float lp-float-step">
        <div className="lp-step-head">
          <span className="lp-step-num">1</span>
          <span>{text.stepTopic}</span>
        </div>
        <div className="lp-step-label"><UiIcon name="book" size={13} /> {text.stepTheory}</div>
        <div className="lp-step-formula" dangerouslySetInnerHTML={{ __html: formula }} />
        <div className="lp-step-mistake"><UiIcon name="alert" size={13} /> {text.stepMistake}</div>
      </div>

      <div className="lp-float lp-float-ai">
        <span className="lp-ai-icon"><UiIcon name="sparkles" size={16} /></span>
        <div>
          <div className="lp-ai-title">{text.aiTitle}</div>
          <div className="lp-ai-sub">{text.aiSub}</div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const year = new Date().getFullYear();
  // Đã đăng nhập: nút chính dẫn thẳng vào trang làm việc thay vì trang đăng nhập.
  const { user } = useAuth();
  const { lang } = usePreferences();
  const t = LANDING_TEXT[lang];
  const sw = SWITCH_TEXT[lang];
  const tagline = TAGLINE[lang];
  const ctaTo = user ? (user.role === 'teacher' ? '/teacher' : '/student') : '/login';
  const ctaLabel = user ? t.ctaDashboard : t.ctaLogin;

  // Hiệu ứng hiện dần khi cuộn tới: phần tử có data-reveal được đánh dấu
  // data-revealed khi lọt vào màn hình (CSS lo phần chuyển động). Máy bật
  // "giảm chuyển động" thì bỏ qua, nội dung hiện ngay.
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!root || reduce || !('IntersectionObserver' in window)) return undefined;
    root.setAttribute('data-animate', '');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-revealed', '');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    root.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Tiêu đề tab trình duyệt theo ngôn ngữ đang chọn; rời trang thì trả lại tên gốc.
  useEffect(() => {
    document.title = t.pageTitle;
    return () => { document.title = APP_TITLE; };
  }, [t.pageTitle]);

  return (
    <div className="lp" lang={lang} ref={rootRef}>
      <header className="lp-header">
        <div className="lp-wrap lp-header-inner">
          <Link to="/" className="lp-logo" aria-label={t.homeLabel}>
            <BrandMark size={32} />
            <span>{APP_NAME}</span>
          </Link>
          <nav className="lp-nav" aria-label={t.navLabel}>
            <a href="#tinh-nang" onClick={scrollToId('tinh-nang')}>{t.nav.features}</a>
            <a href="#cach-hoat-dong" onClick={scrollToId('cach-hoat-dong')}>{t.nav.how}</a>
            <a href="#doi-tuong" onClick={scrollToId('doi-tuong')}>{t.nav.audience}</a>
          </nav>
          <div className="lp-header-tools">
            <LanguageSwitch label={sw.english} title={sw.toOther} />
            <ThemeSwitch label={sw.darkMode} />
            <Link to={ctaTo} className="btn lp-header-cta">{ctaLabel}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Mở đầu */}
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-inner">
            <div className="lp-hero-copy">
              <div className="lp-lockup">
                <BrandMark size={40} />
                <div>
                  <div className="lp-lockup-name">{APP_NAME}</div>
                  <div className="lp-lockup-tag">{tagline}</div>
                </div>
              </div>
              <h1>{t.heroTitle}</h1>
              <p>{t.heroText}</p>
              <div className="lp-hero-actions">
                <Link to={ctaTo} className="btn btn-lg">{ctaLabel}</Link>
                <a href="#cach-hoat-dong" className="btn btn-lg secondary" onClick={scrollToId('cach-hoat-dong')}>
                  {t.heroSecondary}
                </a>
              </div>
            </div>
            <ProductCollage text={t.collage} />
          </div>

          <div className="lp-explore">
            <a href="#tinh-nang" className="lp-explore-btn" onClick={scrollToId('tinh-nang')}>
              {t.explore} <UiIcon name="chevron-down" size={16} />
            </a>
          </div>
        </section>

        {/* Tính năng */}
        <section id="tinh-nang" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head" data-reveal="">
              <h2>{t.featuresTitle}</h2>
              <p>{t.featuresText}</p>
            </div>
            <div className="lp-features">
              {t.features.map((f, i) => (
                <div key={f.icon} className="lp-feature" data-reveal="" style={{ '--reveal-delay': `${(i % 3) * 90}ms` }}>
                  <span className="lp-feature-icon"><UiIcon name={f.icon} size={20} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cách hoạt động */}
        <section id="cach-hoat-dong" className="lp-section is-tinted">
          <div className="lp-wrap">
            <div className="lp-section-head" data-reveal="">
              <h2>{t.howTitle}</h2>
              <p>{t.howText}</p>
            </div>
            <ol className="lp-steps">
              {t.steps.map((s, i) => (
                <li key={i} className="lp-step" data-reveal="" style={{ '--reveal-delay': `${i * 140}ms` }}>
                  <span className="lp-step-dot">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Giáo viên và học sinh */}
        <section id="doi-tuong" className="lp-section">
          <div className="lp-wrap lp-audience">
            <div className="lp-audience-col" data-reveal="left">
              <span className="lp-audience-icon"><UiIcon name="users" size={20} /></span>
              <h2>{t.forTeachersTitle}</h2>
              <ul>
                {t.forTeachers.map((item) => (
                  <li key={item}><UiIcon name="check" size={16} /> {item}</li>
                ))}
              </ul>
            </div>
            <div className="lp-audience-col" data-reveal="right" style={{ '--reveal-delay': '120ms' }}>
              <span className="lp-audience-icon is-student"><UiIcon name="user" size={20} /></span>
              <h2>{t.forStudentsTitle}</h2>
              <ul>
                {t.forStudents.map((item) => (
                  <li key={item}><UiIcon name="check" size={16} /> {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Lời mời */}
        <section className="lp-cta">
          <div className="lp-wrap">
            <div className="lp-cta-inner" data-reveal="zoom">
              <div>
                <h2>{t.ctaTitle}</h2>
                <p>{user ? t.ctaSignedIn(user.name) : t.ctaGuest}</p>
              </div>
              <Link to={ctaTo} className="btn btn-lg lp-cta-btn">{ctaLabel}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-inner">
            <div className="lp-logo is-footer">
              <BrandMark size={26} />
              <span>{APP_NAME}</span>
            </div>
            <span>{tagline}</span>
            <span className="lp-footer-copy">© {year} {APP_NAME}</span>
          </div>
          <div className="lp-credits">
            <p className="lp-credit">
              <span className="lp-credit-label">{t.creditTeacher}:</span>
              <span className="lp-credit-names">{PROJECT_CREDITS.teacher}</span>
            </p>
            <p className="lp-credit">
              <span className="lp-credit-label">{t.creditStudents}:</span>
              <span className="lp-credit-names">{PROJECT_CREDITS.students.join(', ')}</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
