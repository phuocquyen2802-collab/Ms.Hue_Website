// Dịch chữ giao diện các trang bên trong sang tiếng Anh ngay trên trang.
//
// Khi bật EN: duyệt toàn bộ trang + theo dõi mọi thay đổi (MutationObserver),
// đoạn chữ nào khớp bảng dịch (uiEnglish.js) thì thay bằng tiếng Anh và nhớ
// bản gốc; tắt EN thì trả lại đúng chữ gốc. Mã các trang không phải sửa:
// React vẫn ghi chữ tiếng Việt, lớp này đổi ngay trước khi trình duyệt vẽ.
//
// Chỉ dịch chữ do React tạo ra (chữ giao diện). Nội dung chèn bằng HTML -
// đề bài, đáp án, công thức, lộ trình/nhận xét do AI viết - không do React
// tạo từng nút chữ nên được bỏ qua, giữ nguyên tiếng Việt. Muốn chặn dịch một
// vùng chữ do React tạo (VD tin nhắn người dùng gõ) thì thêm translate="no".
// Trang giới thiệu (.lp) và trang đăng nhập (.auth-page) tự dịch riêng.
import { EXACT, PATTERNS } from './uiEnglish';

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const SKIP = '[translate="no"], .lp, .auth-page, script, style, textarea, [contenteditable="true"], .katex';
// Thuộc tính (placeholder...) của ô nhập nhiều dòng vẫn dịch, chỉ bỏ chữ bên trong.
const SKIP_ATTR = '[translate="no"], .lp, .auth-page, [contenteditable="true"], .katex';
const exact = new Map(Object.entries(EXACT));

// ---- Tra bảng dịch ----

function lookup(core) {
  const hit = exact.get(core);
  if (hit !== undefined) return hit;
  if (!VI.test(core)) return null;
  for (const [re, rep] of PATTERNS) {
    if (re.test(core)) return core.replace(re, rep);
  }
  // "Tiêu đề lỗi: chi tiết" (lỗi ghép thêm thông báo của máy chủ)
  const i = core.indexOf(': ');
  if (i > 0) {
    const head = exact.get(core.slice(0, i + 1));
    if (head) {
      const rest = core.slice(i + 2);
      return `${head} ${lookup(rest) ?? rest}`;
    }
  }
  // "Nhãn (12)" - nhãn kèm số đếm
  const m = core.match(/^(.+?) \((\d+)\)$/);
  if (m) {
    const label = exact.get(m[1]);
    if (label) return `${label} (${m[2]})`;
  }
  return null;
}

// Giữ nguyên khoảng trắng đầu/cuối (chữ đứng cạnh số, tên...).
export function translateText(text) {
  if (!text) return null;
  const core = text.replace(/\s+/g, ' ').trim();
  if (!core) return null;
  const out = lookup(core);
  if (out == null || out === core) return null;
  return text.match(/^\s*/)[0] + out + text.match(/\s*$/)[0];
}

// ---- Nhận biết chữ do React tạo ----

let reactKeys;
function getReactKeys() {
  if (reactKeys !== undefined) return reactKeys;
  const root = document.getElementById('root');
  const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer$'));
  reactKeys = key ? { fiber: `__reactFiber$${key.slice(17)}`, props: `__reactProps$${key.slice(17)}` } : null;
  return reactKeys;
}

function isUiText(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return false;
  const keys = getReactKeys();
  if (!keys) return true;
  if (node[keys.fiber]) return true; // nút chữ React tạo riêng
  const props = parent[keys.props];
  if (!props) return false; // nằm trong HTML chèn sẵn
  if (props.dangerouslySetInnerHTML) return false;
  // Phần tử chỉ có 1 chuỗi con: React ghi thẳng textContent. <option> được
  // React gộp các con thành 1 chuỗi.
  return typeof props.children === 'string' || typeof props.children === 'number' || parent.tagName === 'OPTION';
}

function isUiElement(el) {
  if (el.closest(SKIP_ATTR)) return false;
  const keys = getReactKeys();
  return !keys || !!el[keys.props];
}

// ---- Dịch / trả lại ----

const textState = new WeakMap(); // Text -> { vi, en }
const attrState = new WeakMap(); // Element -> { [attr]: { vi, en } }
let active = false;

function processText(node) {
  const state = textState.get(node);
  const current = node.nodeValue;
  if (state && current === state.en) return; // chính mình vừa đổi
  if (!isUiText(node)) return;
  const en = translateText(current);
  if (en == null) {
    if (state) textState.delete(node);
    return;
  }
  textState.set(node, { vi: current, en });
  node.nodeValue = en;
}

function processAttr(el, name) {
  const value = el.getAttribute(name);
  let states = attrState.get(el);
  if (states?.[name] && value === states[name].en) return;
  if (value == null || !isUiElement(el)) return;
  const en = translateText(value);
  if (en == null) {
    if (states) delete states[name];
    return;
  }
  if (!states) attrState.set(el, (states = {}));
  states[name] = { vi: value, en };
  el.setAttribute(name, en);
}

function processElement(el) {
  for (const name of ATTRS) if (el.hasAttribute(name)) processAttr(el, name);
}

function walk(root, onText, onElement) {
  if (root.nodeType === Node.TEXT_NODE) { onText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.closest(SKIP)) {
    if (root.tagName === 'TEXTAREA') onElement(root);
    return;
  }
  onElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== Node.ELEMENT_NODE || !n.matches(SKIP)) return NodeFilter.FILTER_ACCEPT;
      if (n.tagName === 'TEXTAREA') onElement(n);
      return NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) onText(n);
    else onElement(n);
  }
}

function restoreText(node) {
  const state = textState.get(node);
  if (!state) return;
  if (node.nodeValue === state.en) node.nodeValue = state.vi;
  textState.delete(node);
}

function restoreElement(el) {
  const states = attrState.get(el);
  if (!states) return;
  for (const [name, s] of Object.entries(states)) {
    if (el.getAttribute(name) === s.en) el.setAttribute(name, s.vi);
  }
  attrState.delete(el);
}

const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'characterData') processText(r.target);
    else if (r.type === 'attributes') processAttr(r.target, r.attributeName);
    else r.addedNodes.forEach((n) => walk(n, processText, processElement));
  }
});

// Hộp thoại alert/confirm/prompt của trình duyệt cũng dịch theo.
function wrapDialogs() {
  for (const name of ['alert', 'confirm', 'prompt']) {
    const native = window[name];
    window[name] = function translatedDialog(message, ...rest) {
      const text = active && typeof message === 'string' ? translateText(message) ?? message : message;
      return native.call(window, text, ...rest);
    };
  }
}
if (typeof window !== 'undefined') wrapDialogs();

export function setUiLanguage(lang) {
  if (!observer) return;
  if (lang === 'en' && !active) {
    active = true;
    walk(document.body, processText, processElement);
    observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS,
    });
  } else if (lang !== 'en' && active) {
    active = false;
    observer.disconnect();
    walk(document.body, restoreText, restoreElement);
  }
}
