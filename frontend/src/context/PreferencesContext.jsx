import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { setUiLanguage } from '../i18n/domTranslator';

// Tuỳ chọn hiển thị của người xem, lưu trong trình duyệt:
// - theme: 'light' | 'dark' (chế độ tối), gắn vào <html data-theme="...">.
//   index.html đọc sẵn giá trị đã lưu trước khi React chạy để không bị nháy sáng.
// - lang: 'vi' | 'en'. Trang giới thiệu và trang đăng nhập tự đổi chữ theo
//   lang; các trang bên trong được dịch bởi i18n/domTranslator.js.

const THEME_KEY = 'mi-theme';
const LANG_KEY = 'mi-lang';
const THEME_COLOR = { light: '#2952d9', dark: '#0e1525' };

function readSetting(key, allowed, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Trình duyệt chặn lưu (chế độ ẩn danh...) - vẫn đổi được trong phiên này.
  }
}

// Tắt hiệu ứng chuyển màu trong khoảnh khắc đổi theme, để mọi thứ đổi cùng
// lúc thay vì chỗ đổi ngay, chỗ đổi dần (các nút có transition riêng).
function withoutTransitions(apply) {
  const root = document.documentElement;
  root.classList.add('theme-switching');
  apply();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.remove('theme-switching'));
  });
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(() =>
    readSetting(THEME_KEY, ['light', 'dark'], document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  );
  const [lang, setLangState] = useState(() => readSetting(LANG_KEY, ['vi', 'en'], 'vi'));

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme !== theme) withoutTransitions(() => { root.dataset.theme = theme; });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
  }, [theme]);

  // useLayoutEffect: dịch xong trước khi trình duyệt vẽ, không nháy chữ Việt.
  useLayoutEffect(() => {
    document.documentElement.lang = lang;
    setUiLanguage(lang);
  }, [lang]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    saveSetting(THEME_KEY, next);
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    saveSetting(LANG_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, lang, setLang }), [theme, setTheme, lang, setLang]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences phải dùng bên trong PreferencesProvider');
  return ctx;
}
