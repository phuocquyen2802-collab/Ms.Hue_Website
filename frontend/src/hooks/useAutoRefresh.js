import { useEffect, useRef } from 'react';

// Tự tải lại dữ liệu của trang mà không cần bấm tải lại trình duyệt:
// - định kỳ mỗi `intervalMs` khi tab đang hiển thị (tab ẩn thì tạm dừng),
// - ngay khi người dùng quay lại tab / cửa sổ,
// - khi có sự kiện 'app:refresh-notifications' (VD vừa nộp bài).
// `refresh` nên tải NGẦM (không bật trạng thái "Đang tải") để màn hình không
// nháy và không mất thao tác đang làm dở.
export default function useAutoRefresh(refresh, intervalMs = 15000) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    let running = false;
    const run = async () => {
      if (document.hidden || running) return;
      running = true;
      try {
        await refreshRef.current();
      } catch {
        // Lỗi mạng tạm thời: lần sau thử lại.
      } finally {
        running = false;
      }
    };
    const onVisible = () => {
      if (!document.hidden) run();
    };

    const timer = setInterval(run, intervalMs);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('app:refresh-notifications', run);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('app:refresh-notifications', run);
    };
  }, [intervalMs]);
}

// Chỉ cập nhật state khi dữ liệu thật sự đổi (tránh vẽ lại cả trang mỗi lần tải ngầm).
export function setIfChanged(setter, next) {
  setter((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
}
