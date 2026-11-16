import { usePreferences } from '../context/PreferencesContext';

// Công tắc chế độ tối và công tắc ngôn ngữ VI/EN (dạng switch bật/tắt).

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" />
    </svg>
  );
}

// withLabel: hiện chữ bên trái công tắc (dùng ở sidebar). Không có chữ thì
// tên của công tắc nằm trong aria-label.
export function ThemeSwitch({ label = 'Chế độ tối', withLabel = false, className = '' }) {
  const { theme, setTheme } = usePreferences();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={withLabel ? undefined : label}
      title={withLabel ? undefined : label}
      className={`theme-switch${withLabel ? ' has-label' : ''}${className ? ` ${className}` : ''}`}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {withLabel && <span className="theme-switch-label">{label}</span>}
      <span className="theme-switch-track" aria-hidden="true">
        <span className="theme-switch-thumb">{dark ? <MoonIcon /> : <SunIcon />}</span>
      </span>
    </button>
  );
}

// Bật = tiếng Anh, tắt = tiếng Việt.
export function LanguageSwitch({ label = 'English', title, className = '' }) {
  const { lang, setLang } = usePreferences();
  const en = lang === 'en';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={en}
      aria-label={label}
      title={title}
      className={`lang-switch${className ? ` ${className}` : ''}`}
      onClick={() => setLang(en ? 'vi' : 'en')}
    >
      <span className="lang-switch-thumb" aria-hidden="true" />
      <span className={`lang-switch-opt${en ? '' : ' is-on'}`} aria-hidden="true">VI</span>
      <span className={`lang-switch-opt${en ? ' is-on' : ''}`} aria-hidden="true">EN</span>
    </button>
  );
}
