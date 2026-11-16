// Định dạng thời gian dùng cho trang làm bài và trang kết quả.

// Đồng hồ đếm ngược: 905000 ms -> "15:05", 3725000 ms -> "1:02:05"
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Thời gian làm bài: 452 -> "7 phút 32 giây", 45 -> "45 giây"
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
  if (m > 0) return s > 0 ? `${m} phút ${s} giây` : `${m} phút`;
  return `${s} giây`;
}

// Lý do bài được nộp tự động (trường submitReason của bài nộp)
export const AUTO_SUBMIT_TEXT = {
  timeout: 'Hết giờ, bài được nộp tự động',
  violations: 'Rời màn hình quá số lần cho phép, bài được nộp tự động',
};
