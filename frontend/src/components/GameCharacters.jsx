// Nhân vật của trò chơi "Đường đua Toán học" - bộ linh vật riêng của
// MathInsight AI (vẽ bằng SVG, không dùng nhân vật có bản quyền). Mỗi nhân vật
// có 3 biểu cảm: neutral (bình thường), happy (trả lời đúng), sad (trả lời sai).

export const CHARACTERS = [
  { id: 'pi', name: 'Mèo Pi', motto: 'Lanh lợi, mê lượng giác', main: '#f6a04d', belly: '#ffe3c2', dark: '#c9721f', symbol: 'π' },
  { id: 'sigma', name: 'Gấu Sigma', motto: 'Chậm mà chắc, giỏi tính tổng', main: '#b07a52', belly: '#f1d9bf', dark: '#7f5233', symbol: 'Σ' },
  { id: 'delta', name: 'Thỏ Delta', motto: 'Nhanh nhẹn, thích biến thiên', main: '#f4eef9', belly: '#ffffff', dark: '#b9a5cf', symbol: 'Δ' },
  { id: 'log', name: 'Cú Logarit', motto: 'Thông thái, nhìn xa trông rộng', main: '#7c6cf2', belly: '#e5e0ff', dark: '#4f3fc8', symbol: 'log' },
  { id: 'vector', name: 'Robot Vectơ', motto: 'Luôn đúng hướng, đúng độ dài', main: '#3bb3a6', belly: '#d7f5f0', dark: '#21857a', symbol: '→' },
  { id: 'func', name: 'Khủng long Hàm số', motto: 'Mạnh mẽ, đạo hàm siêu tốc', main: '#5cc46a', belly: '#dff7d9', dark: '#36924a', symbol: 'f(x)' },
];

const INK = '#1f2433';

function Face({ mood, mouthY = 76, beak = false }) {
  if (mood === 'happy') {
    return (
      <g>
        <path d="M43 63 Q48 55 53 63 M67 63 Q72 55 77 63" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        {!beak && (
          <>
            <path d={`M50 ${mouthY - 3} Q60 ${mouthY + 13} 70 ${mouthY - 3} Z`} fill={INK} />
            <path d={`M55 ${mouthY + 3} Q60 ${mouthY + 9} 65 ${mouthY + 3} Q60 ${mouthY + 5} 55 ${mouthY + 3} Z`} fill="#ff7b8a" />
          </>
        )}
        <ellipse cx="39" cy="72" rx="6" ry="3.6" fill="#ff8fa3" opacity="0.7" />
        <ellipse cx="81" cy="72" rx="6" ry="3.6" fill="#ff8fa3" opacity="0.7" />
      </g>
    );
  }
  if (mood === 'sad') {
    return (
      <g>
        <path d="M41 57 L52 53 M79 57 L68 53" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        <ellipse cx="48" cy="64" rx="4" ry="4.4" fill={INK} />
        <ellipse cx="72" cy="64" rx="4" ry="4.4" fill={INK} />
        {!beak && <path d={`M52 ${mouthY + 5} Q60 ${mouthY - 2} 68 ${mouthY + 5}`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}
        <path d="M79 69 Q83.5 75.5 79 79 Q74.5 75.5 79 69 Z" fill="#5ab0ff" />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="48" cy="62" rx="4.2" ry="5" fill={INK} />
      <ellipse cx="72" cy="62" rx="4.2" ry="5" fill={INK} />
      <circle cx="49.4" cy="60.2" r="1.5" fill="#fff" />
      <circle cx="73.4" cy="60.2" r="1.5" fill="#fff" />
      {!beak && <path d={`M53 ${mouthY - 1} Q60 ${mouthY + 5} 67 ${mouthY - 1}`} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}
      <ellipse cx="39" cy="72" rx="5" ry="3" fill="#ff8fa3" opacity="0.5" />
      <ellipse cx="81" cy="72" rx="5" ry="3" fill="#ff8fa3" opacity="0.5" />
    </g>
  );
}

function Arms({ mood, color, outline }) {
  const common = { fill: color, stroke: outline, strokeWidth: outline ? 2 : 0 };
  if (mood === 'happy') {
    return (
      <g>
        <ellipse cx="23" cy="56" rx="7" ry="13" transform="rotate(-28 23 56)" {...common} />
        <ellipse cx="97" cy="56" rx="7" ry="13" transform="rotate(28 97 56)" {...common} />
      </g>
    );
  }
  if (mood === 'sad') {
    return (
      <g>
        <ellipse cx="29" cy="92" rx="6.5" ry="12" transform="rotate(8 29 92)" {...common} />
        <ellipse cx="91" cy="92" rx="6.5" ry="12" transform="rotate(-8 91 92)" {...common} />
      </g>
    );
  }
  return (
    <g>
      <ellipse cx="25" cy="84" rx="7" ry="12" transform="rotate(22 25 84)" {...common} />
      <ellipse cx="95" cy="84" rx="7" ry="12" transform="rotate(-22 95 84)" {...common} />
    </g>
  );
}

function Sparkles() {
  const star = (x, y, s) => `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`;
  return (
    <g fill="#ffcf3f">
      <path d={star(16, 30, 6)} />
      <path d={star(104, 24, 7)} />
      <path d={star(108, 48, 4)} />
    </g>
  );
}

// Phần đặc trưng của từng loài: vẽ phía sau thân (tai, đuôi) và phía trước (râu, mỏ...).
function Back({ c }) {
  switch (c.id) {
    case 'pi':
      return (
        <g>
          <path d="M92 104 Q118 96 108 70" fill="none" stroke={c.main} strokeWidth="9" strokeLinecap="round" />
          <path d="M30 50 L35 16 L56 38 Z M90 50 L85 16 L64 38 Z" fill={c.main} />
          <path d="M36 42 L38.5 25 L49 37 Z M84 42 L81.5 25 L71 37 Z" fill="#ffb3b3" />
        </g>
      );
    case 'sigma':
      return (
        <g>
          <circle cx="33" cy="40" r="13" fill={c.main} />
          <circle cx="87" cy="40" r="13" fill={c.main} />
          <circle cx="33" cy="40" r="6.5" fill="#e8b996" />
          <circle cx="87" cy="40" r="6.5" fill="#e8b996" />
        </g>
      );
    case 'delta':
      return (
        <g stroke={c.dark} strokeWidth="2">
          <ellipse cx="44" cy="22" rx="9" ry="25" transform="rotate(-10 44 22)" fill={c.main} />
          <ellipse cx="76" cy="22" rx="9" ry="25" transform="rotate(10 76 22)" fill={c.main} />
          <ellipse cx="44" cy="24" rx="4" ry="16" transform="rotate(-10 44 24)" fill="#ffc2d1" stroke="none" />
          <ellipse cx="76" cy="24" rx="4" ry="16" transform="rotate(10 76 24)" fill="#ffc2d1" stroke="none" />
        </g>
      );
    case 'log':
      return <path d="M30 48 L27 20 L50 38 Z M90 48 L93 20 L70 38 Z" fill={c.main} />;
    case 'vector':
      return (
        <g>
          <line x1="60" y1="34" x2="60" y2="15" stroke={c.dark} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="60" cy="12" r="6.5" fill="#ff7b6b" />
          <rect x="15" y="54" width="10" height="18" rx="4" fill={c.dark} />
          <rect x="95" y="54" width="10" height="18" rx="4" fill={c.dark} />
        </g>
      );
    case 'func':
      return (
        <g>
          <path d="M90 102 Q116 108 113 86" fill="none" stroke={c.main} strokeWidth="10" strokeLinecap="round" />
          <path d="M42 40 L48 22 L56 37 Z M55 35 L62 17 L69 35 Z M68 37 L77 22 L80 42 Z" fill="#f7c948" />
        </g>
      );
    default:
      return null;
  }
}

function Front({ c, mood }) {
  switch (c.id) {
    case 'pi':
      return (
        <path d="M34 70 L20 67 M34 74 L20 76 M86 70 L100 67 M86 74 L100 76" stroke="#8a5420" strokeWidth="1.6" strokeLinecap="round" />
      );
    case 'sigma':
      return (
        <g>
          <ellipse cx="60" cy="75" rx="14" ry="10" fill={c.belly} />
          <ellipse cx="60" cy="69.5" rx="4.5" ry="3.2" fill={c.dark} />
        </g>
      );
    case 'log':
      return (
        <g>
          <circle cx="48" cy="62" r="11" fill="#fff" stroke="#f7c948" strokeWidth="3" />
          <circle cx="72" cy="62" r="11" fill="#fff" stroke="#f7c948" strokeWidth="3" />
          <path d="M59 62 L61 62" stroke="#f7c948" strokeWidth="3" />
          <path d={mood === 'sad' ? 'M55 75 L65 75 L60 81 Z' : 'M55 73 L65 73 L60 80 Z'} fill="#f7a93b" />
        </g>
      );
    case 'vector':
      return <rect x="35" y="47" width="50" height="38" rx="13" fill="#effcf9" />;
    default:
      return null;
  }
}

export default function GameCharacter({ id, mood = 'neutral', size = 96, className = '' }) {
  const c = CHARACTERS.find((x) => x.id === id) || CHARACTERS[0];
  const outline = c.id === 'delta' ? c.dark : undefined;
  const fontSize = c.symbol.length > 2 ? 13 : 19;

  return (
    <svg
      className={`game-char is-${mood}${className ? ` ${className}` : ''}`}
      width={size}
      height={size * (130 / 120)}
      viewBox="0 0 120 130"
      role="img"
      aria-label={c.name}
    >
      <ellipse cx="60" cy="124" rx="34" ry="5" fill="rgba(21, 32, 58, 0.16)" />
      <Back c={c} />
      <ellipse cx="46" cy="116" rx="11" ry="7" fill={c.dark} />
      <ellipse cx="74" cy="116" rx="11" ry="7" fill={c.dark} />
      {c.id === 'vector' ? (
        <rect x="24" y="34" width="72" height="82" rx="24" fill={c.main} />
      ) : (
        <ellipse cx="60" cy="74" rx="36" ry="41" fill={c.main} stroke={outline} strokeWidth={outline ? 2 : 0} />
      )}
      <Arms mood={mood} color={c.main} outline={outline} />
      <ellipse cx="60" cy="98" rx="20" ry="13" fill={c.belly} stroke={outline} strokeWidth={outline ? 1.5 : 0} />
      <text
        x="60"
        y={98 + fontSize * 0.36}
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="700"
        fontStyle="italic"
        fontFamily="Georgia, 'Times New Roman', serif"
        fill={c.dark}
      >
        {c.symbol}
      </text>
      <Front c={c} mood={mood} />
      <Face mood={mood} beak={c.id === 'log'} mouthY={c.id === 'sigma' ? 77 : 76} />
      {mood === 'happy' && <Sparkles />}
    </svg>
  );
}
