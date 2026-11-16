import { useEffect, useRef, useState } from 'react';

// Số đếm dần tới giá trị (0 -> 12) cho các thẻ thống kê. Giá trị đổi về sau
// (tự cập nhật dữ liệu) thì đếm tiếp từ số đang hiện. Máy bật "giảm chuyển
// động" thì hiện thẳng giá trị.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CountUp({ value, duration = 900, decimals = 0 }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const currentRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion() || currentRef.current === target) {
      currentRef.current = target;
      setShown(target);
      return undefined;
    }
    const from = currentRef.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (target - from) * eased;
      currentRef.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return decimals ? shown.toFixed(decimals) : String(Math.round(shown));
}
