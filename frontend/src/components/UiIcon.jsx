// Bộ icon nét (stroke) 24x24 dùng chung cho các trang - thay cho emoji để
// giao diện đồng nhất trên mọi hệ điều hành. Màu theo `currentColor`.
const PATHS = {
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18.2 14.3A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-up': <path d="m6 15 6-6 6 6" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  sparkles: (
    <>
      <path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7Z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </>
  ),
  'trend-up': (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  'trend-down': (
    <>
      <path d="m3 7 6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" />
      <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19" />
    </>
  ),
  send: (
    <>
      <path d="M21 3 10 14" />
      <path d="m21 3-7 18-4-7-7-4Z" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13h5l2 3h4l2-3h5" />
      <path d="M5.5 5h13l2.5 8v6H3v-6Z" />
    </>
  ),
  chart: (
    <>
      <path d="M3 20.5h18" />
      <rect x="5" y="11" width="3.2" height="7" rx="1" />
      <rect x="10.4" y="5" width="3.2" height="13" rx="1" />
      <rect x="15.8" y="13.5" width="3.2" height="4.5" rx="1" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  message: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4Z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.5v3a1 1 0 0 0 1 1h2.5L13 19V5L7.5 9.5H5a1 1 0 0 0-1 1Z" />
      <path d="M16.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M19.2 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5a8 8 0 1 0-2.4 5.7" />
      <path d="M20 4.5v7h-7" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5Z" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  'arrow-left': <path d="M19 12H5M11 6l-6 6 6 6" />,
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.5l3 2" />
    </>
  ),
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  mouse: (
    <>
      <rect x="6.5" y="3" width="11" height="18" rx="5.5" />
      <path d="M12 7v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="18.5" r="2.3" />
      <circle cx="18" cy="5.5" r="2.3" />
      <path d="M8.3 18.5H16a3.3 3.3 0 0 0 0-6.6H8a3.3 3.3 0 0 1 0-6.6h7.7" />
    </>
  ),
};

export default function UiIcon({ name, size = 18, className = '', strokeWidth = 1.9 }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

// Mức điểm dùng chung để tô màu: từ 8 "tốt", từ 5 "đạt", dưới 5 "yếu".
export function scoreLevel(score) {
  const s = Number(score) || 0;
  if (s >= 8) return 'good';
  if (s >= 5) return 'ok';
  return 'low';
}

// Điểm hiển thị gọn: 8 -> "8", 7.25 -> "7.3"
export function formatScore(score) {
  const s = Number(score) || 0;
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

// Nhãn tăng/giảm điểm giữa lần đầu và lần gần nhất (VD "+1.5", "-0.5").
export function ScoreTrend({ diff }) {
  const d = Number(diff) || 0;
  if (d > 0) {
    return (
      <span className="trend is-up">
        <UiIcon name="trend-up" size={13} />+{formatScore(d)}
      </span>
    );
  }
  if (d < 0) {
    return (
      <span className="trend is-down">
        <UiIcon name="trend-down" size={13} />{formatScore(d)}
      </span>
    );
  }
  return <span className="trend is-flat">Giữ nguyên</span>;
}
