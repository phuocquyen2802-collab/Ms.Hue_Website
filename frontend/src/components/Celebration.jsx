import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { launchConfetti } from '../utils/confetti';

// Màn chúc mừng khi làm bài xuất sắc: cúp vàng + lời chúc + pháo giấy màu.
// Đóng bằng nút, bấm ra ngoài hoặc phím Esc.

function Trophy() {
  return (
    <svg className="celebrate-cup" viewBox="0 0 160 170" aria-hidden="true">
      <defs>
        <linearGradient id="cup-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.35" stopColor="#ffd23f" />
          <stop offset="0.75" stopColor="#f2a705" />
          <stop offset="1" stopColor="#c97a00" />
        </linearGradient>
        <linearGradient id="cup-gold-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9a300" />
          <stop offset="1" stopColor="#a86200" />
        </linearGradient>
        <clipPath id="cup-clip">
          <path d="M40 22h80v18c0 28-16 50-40 54-24-4-40-26-40-54Z" />
        </clipPath>
      </defs>
      {/* tay cầm */}
      <path d="M42 34H24c0 26 12 40 30 42" fill="none" stroke="url(#cup-gold-dark)" strokeWidth="9" strokeLinecap="round" />
      <path d="M118 34h18c0 26-12 40-30 42" fill="none" stroke="url(#cup-gold-dark)" strokeWidth="9" strokeLinecap="round" />
      {/* thân cúp */}
      <path d="M40 22h80v18c0 28-16 50-40 54-24-4-40-26-40-54Z" fill="url(#cup-gold)" />
      <rect x="36" y="16" width="88" height="10" rx="5" fill="url(#cup-gold-dark)" />
      {/* vệt sáng lướt qua */}
      <g clipPath="url(#cup-clip)">
        <rect className="celebrate-shine" x="-30" y="0" width="22" height="120" fill="#ffffff" opacity="0.55" transform="skewX(-20)" />
      </g>
      {/* ngôi sao */}
      <path d="M80 36l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L80 64.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8Z" fill="#fff8d6" />
      {/* chân và đế */}
      <path d="M72 93h16l3 22H69Z" fill="url(#cup-gold-dark)" />
      <rect x="56" y="114" width="48" height="10" rx="4" fill="url(#cup-gold)" />
      <path d="M46 124h68l6 22H40Z" fill="url(#cup-gold-dark)" />
      <rect x="58" y="130" width="44" height="9" rx="3" fill="#fff1a8" opacity="0.85" />
    </svg>
  );
}

export default function Celebration({ title, message, highlight, actionLabel = 'Xem kết quả', onClose }) {
  const canvasRef = useRef(null);
  const buttonRef = useRef(null);
  // Giữ hàm đóng mới nhất mà không bắn lại pháo giấy mỗi khi trang cha vẽ lại.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const stop = reduce ? () => {} : launchConfetti(canvasRef.current);
    buttonRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      stop();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return createPortal(
    <div className="celebrate" role="dialog" aria-modal="true" aria-labelledby="celebrate-title" onClick={() => closeRef.current()}>
      <canvas ref={canvasRef} className="celebrate-confetti" aria-hidden="true" />
      <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
        <div className="celebrate-trophy">
          <span className="celebrate-rays" aria-hidden="true" />
          <Trophy />
          <span className="celebrate-sparkle s1" aria-hidden="true" />
          <span className="celebrate-sparkle s2" aria-hidden="true" />
          <span className="celebrate-sparkle s3" aria-hidden="true" />
        </div>
        <h2 id="celebrate-title" className="celebrate-title">{title}</h2>
        <p className="celebrate-message">{message}</p>
        {highlight && <div className="celebrate-highlight">{highlight}</div>}
        <button ref={buttonRef} type="button" className="btn btn-lg celebrate-btn" onClick={() => closeRef.current()}>
          {actionLabel}
        </button>
      </div>
    </div>,
    document.body
  );
}
