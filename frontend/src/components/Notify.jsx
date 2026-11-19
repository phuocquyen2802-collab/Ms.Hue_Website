import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import UiIcon from './UiIcon';

// Hộp thoại xác nhận và thông báo nhanh (toast) của website, thay cho hộp
// thoại mặc định của trình duyệt ("... says" của window.confirm / window.alert).
//
//   if (!(await confirmDialog({ title: 'Xoá đề thi?', message: '...', confirmText: 'Xoá', tone: 'danger' }))) return;
//   toast.error('Xoá thất bại');  // toast.success / toast.warning / toast.info
//
// Gọi được ở bất kỳ đâu (không cần hook). <NotifyHost /> gắn 1 lần ở main.jsx.
// Chữ hiển thị bằng React nên chế độ tiếng Anh (i18n/domTranslator.js) tự dịch
// như mọi chữ giao diện khác - thêm bản dịch vào i18n/uiEnglish.js.

const TOAST_MS = { success: 4000, info: 5000, warning: 6000, error: 7000 };
const MAX_TOASTS = 4;

let showDialog = null;
let showToast = null;
let nextId = 0;

// Trả về Promise<boolean>: true khi bấm nút xác nhận, false khi Huỷ / Esc /
// bấm ra ngoài. tone: 'danger' (xoá, nút đỏ) | 'warning' | 'primary'.
export function confirmDialog(options) {
  const opts = typeof options === 'string' ? { title: options } : options;
  if (!showDialog) {
    return Promise.resolve(window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n')));
  }
  return new Promise((resolve) => showDialog({ ...opts, resolve }));
}

function pushToast(tone, message, options = {}) {
  if (!message) return;
  if (!showToast) {
    window.alert(message);
    return;
  }
  showToast({ ...options, tone, message: String(message) });
}

export const toast = {
  success: (message, options) => pushToast('success', message, options),
  info: (message, options) => pushToast('info', message, options),
  warning: (message, options) => pushToast('warning', message, options),
  error: (message, options) => pushToast('error', message, options),
};

// Trên điện thoại, trang có nội dung rộng hơn màn hình làm trình duyệt nới
// rộng khung bố cục (layout viewport): phần tử position: fixed căn theo khung
// đó sẽ nằm ngoài vùng người dùng đang nhìn. Khi đó đặt hộp thoại/toast theo
// visualViewport - đúng vùng đang hiển thị trên màn hình.
function readVisibleBox() {
  const vv = window.visualViewport;
  if (!vv) return null;
  const fits = Math.abs(vv.width - window.innerWidth) < 1 && Math.abs(vv.height - window.innerHeight) < 1
    && vv.offsetLeft === 0 && vv.offsetTop === 0;
  return fits ? null : {
    left: Math.round(vv.offsetLeft), top: Math.round(vv.offsetTop), width: Math.round(vv.width), height: Math.round(vv.height),
  };
}

// Chỉ theo dõi khi đang hiện (active). Trình duyệt nới khung bố cục lúc trang
// vừa vẽ xong bảng rộng (~0,5 giây sau khi tải) mà không phát sự kiện nào,
// nên ngoài các sự kiện còn đo lại định kỳ - chỉ đọc 4 con số, rất nhẹ.
function useVisibleBox(active = true) {
  const [box, setBox] = useState(readVisibleBox);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) return undefined;
    const update = () => setBox((prev) => {
      const next = readVisibleBox();
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    update();
    const timer = setInterval(update, 250);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      clearInterval(timer);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return box;
}

// Ký hiệu nhỏ trong vòng tròn màu của toast và hộp thoại.
const GLYPHS = {
  check: 'm6.5 12.5 3.8 3.8 7.2-8',
  cross: 'M8 8l8 8M16 8l-8 8',
  bang: 'M12 7v6.5M12 17h.01',
  info: 'M12 11v6M12 7.5h.01',
};
const TOAST_GLYPH = { success: 'check', error: 'cross', warning: 'bang', info: 'info' };

function Glyph({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[name]} />
    </svg>
  );
}

function ConfirmView({ dialog, onClose }) {
  const {
    title, message, confirmText = 'Đồng ý', cancelText = 'Huỷ', tone = 'primary',
  } = dialog;
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const box = useVisibleBox();

  useEffect(() => {
    const previous = document.activeElement;
    // Hộp thoại xoá: con trỏ đặt sẵn ở nút Huỷ, lỡ bấm Enter cũng không xoá nhầm.
    (tone === 'danger' ? cancelRef : confirmRef).current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Bắt phím ở pha capture để hộp thoại/trang bên dưới không nhận Esc/Tab.
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const items = [cancelRef.current, confirmRef.current];
        const at = items.indexOf(document.activeElement);
        items[(at + (e.shiftKey ? items.length - 1 : 1)) % items.length]?.focus();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [tone]);

  return (
    <div
      className="notify-overlay"
      style={box ? { inset: 'auto', ...box } : undefined}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}
    >
      <div
        className={`notify-dialog is-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
      >
        <span className="notify-dialog-icon" aria-hidden="true">
          {tone === 'danger' ? <UiIcon name="trash" size={21} /> : <Glyph name={tone === 'warning' ? 'bang' : 'info'} size={28} />}
        </span>
        <div className="notify-dialog-body">
          <h2 id={titleId} className="notify-dialog-title">{title}</h2>
          {message && <p id={messageId} className="notify-dialog-message">{message}</p>}
        </div>
        <div className="notify-dialog-actions">
          <button ref={cancelRef} type="button" className="btn secondary" onClick={() => onClose(false)}>
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn${tone === 'danger' ? ' danger' : ''}`}
            onClick={() => onClose(true)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastView({ item, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Rê chuột vào thì giữ lại, rời chuột thì đếm lại từ đầu.
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => dismissRef.current(), item.duration || TOAST_MS[item.tone] || 5000);
    return () => clearTimeout(timer);
  }, [paused, item.duration, item.tone]);

  return (
    <div
      className={`toast is-${item.tone}`}
      role={item.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="toast-icon" aria-hidden="true"><Glyph name={TOAST_GLYPH[item.tone]} size={15} /></span>
      <div className="toast-body">
        {item.title && <strong className="toast-title">{item.title}</strong>}
        <span className="toast-message">{item.message}</span>
      </div>
      <button type="button" className="toast-close" onClick={onDismiss} aria-label="Đóng thông báo">
        <UiIcon name="close" size={14} />
      </button>
    </div>
  );
}

export default function NotifyHost() {
  const [dialogs, setDialogs] = useState([]);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    showDialog = (d) => setDialogs((queue) => [...queue, { ...d, id: (nextId += 1) }]);
    // Cùng nội dung đang hiện thì thay bằng cái mới (không xếp chồng trùng lặp).
    showToast = (t) => setToasts((list) => [
      ...list.filter((x) => !(x.tone === t.tone && x.message === t.message)).slice(-(MAX_TOASTS - 1)),
      { ...t, id: (nextId += 1) },
    ]);
    return () => {
      showDialog = null;
      showToast = null;
    };
  }, []);

  const dialog = dialogs[0];
  function closeDialog(result) {
    dialog.resolve(result);
    setDialogs((queue) => queue.filter((d) => d.id !== dialog.id));
  }

  // Góc trên bên phải của vùng đang hiển thị (xem readVisibleBox).
  const box = useVisibleBox(toasts.length > 0);
  let regionStyle;
  if (box) {
    const width = Math.min(380, box.width - 24);
    regionStyle = { top: box.top + 70, left: box.left + box.width - width - 12, right: 'auto', width };
  }

  return createPortal(
    <>
      {dialog && <ConfirmView key={dialog.id} dialog={dialog} onClose={closeDialog} />}
      <div className="toast-region" style={regionStyle}>
        {toasts.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => setToasts((list) => list.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </>,
    document.body,
  );
}
