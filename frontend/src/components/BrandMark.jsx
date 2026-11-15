// Logo MathInsight AI: đồ thị hàm bậc ba y = x³ − 3x trên nền xanh, điểm
// cực tiểu tô màu hổ phách tượng trưng cho "insight" - chỗ hệ thống chỉ ra
// học sinh cần ôn lại. Dùng chung cho sidebar, trang đăng nhập và favicon.
const CURVE = (() => {
  const pts = [];
  const n = 28;
  for (let i = 0; i <= n; i += 1) {
    const x = -2.1 + (4.2 * i) / n;
    const y = x * x * x - 3 * x;
    pts.push(`${i ? 'L' : 'M'}${(16 + x * 5).toFixed(2)} ${(16 - y * 3.1).toFixed(2)}`);
  }
  return pts.join(' ');
})();

export default function BrandMark({ size = 32, className = '' }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="var(--primary, #2952d9)" />
      <path d="M6 16h20M16 6v20" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      <path d={CURVE} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="21" cy="22.2" r="2.7" fill="var(--insight, #f2a33a)" stroke="var(--primary, #2952d9)" strokeWidth="1.2" />
    </svg>
  );
}
