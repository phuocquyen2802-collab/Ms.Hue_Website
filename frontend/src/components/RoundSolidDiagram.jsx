import { renderMath } from '../utils/mathRender';

// Vẽ minh hoạ khối tròn xoay cơ bản (nón / trụ / cầu) bằng SVG thuần tuý -
// hình vẽ MANG TÍNH MINH HOẠ (không theo đúng tỉ lệ số liệu đề bài), chỉ
// nhằm giúp học sinh hình dung đúng loại khối, có ghi chú bán kính/chiều cao
// bằng nhãn chữ (không phải số cố định) để khớp với MỌI đề bài tương tự.
//
// Cấu trúc `diagram` hỗ trợ:
//   { type: 'round-solid', shape: 'cone' | 'cylinder' | 'sphere',
//     radiusLabel: 'r' (tuỳ chọn, mặc định 'r'),
//     heightLabel: 'h' (tuỳ chọn, mặc định 'h', bỏ qua với sphere),
//     centerLabel: 'O' (tuỳ chọn), apexLabel: 'S' (tuỳ chọn, chỉ cone) }

const VIEW_W = 220;
const VIEW_H = 200;

function renderLabel(text) {
  return renderMath(`$${text}$`).replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
}

function Label({ x, y, text, color = '#1e293b', size = 13 }) {
  return (
    <foreignObject x={x - 14} y={y - 12} width="60" height="20" style={{ overflow: 'visible' }}>
      <div style={{ fontSize: size, fontWeight: 700, color, whiteSpace: 'nowrap' }} dangerouslySetInnerHTML={{ __html: renderLabel(text) }} />
    </foreignObject>
  );
}

function ConeDiagram({ radiusLabel, heightLabel, apexLabel, centerLabel }) {
  const cx = 110, cy = 165, rx = 65, ry = 18, apexY = 30;
  return (
    <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ overflow: 'visible' }}>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#1e293b" strokeWidth="1.4" />
      <path d={`M ${cx - rx} ${cy} A ${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`} fill="none" stroke="#1e293b" strokeWidth="1.4" strokeDasharray="4,3" />
      <line x1={cx} y1={apexY} x2={cx - rx} y2={cy} stroke="#1e293b" strokeWidth="1.4" />
      <line x1={cx} y1={apexY} x2={cx + rx} y2={cy} stroke="#1e293b" strokeWidth="1.4" />
      <line x1={cx} y1={apexY} x2={cx} y2={cy} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
      <line x1={cx} y1={cy} x2={cx + rx} y2={cy} stroke="#dc2626" strokeWidth="1.3" />
      <circle cx={cx} cy={apexY} r="2.6" fill="#1e293b" />
      <circle cx={cx} cy={cy} r="2.2" fill="#1e293b" />
      <Label x={cx} y={apexY - 12} text={apexLabel || 'S'} />
      <Label x={cx - 10} y={cy + 16} text={centerLabel || 'O'} />
      <Label x={(cx + cx + rx) / 2} y={cy + 14} text={radiusLabel || 'r'} color="#dc2626" />
      <Label x={cx + 14} y={(apexY + cy) / 2} text={heightLabel || 'h'} color="#0369a1" />
    </svg>
  );
}

function CylinderDiagram({ radiusLabel, heightLabel, centerLabel }) {
  const cx = 110, rx = 62, ry = 16, topY = 40, botY = 160;
  return (
    <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ overflow: 'visible' }}>
      <ellipse cx={cx} cy={topY} rx={rx} ry={ry} fill="none" stroke="#1e293b" strokeWidth="1.4" />
      <ellipse cx={cx} cy={botY} rx={rx} ry={ry} fill="none" stroke="#1e293b" strokeWidth="1.4" />
      <line x1={cx - rx} y1={topY} x2={cx - rx} y2={botY} stroke="#1e293b" strokeWidth="1.4" />
      <line x1={cx + rx} y1={topY} x2={cx + rx} y2={botY} stroke="#1e293b" strokeWidth="1.4" />
      <path d={`M ${cx - rx} ${botY} A ${rx} ${ry} 0 0 0 ${cx + rx} ${botY}`} fill="none" stroke="#1e293b" strokeWidth="1.4" strokeDasharray="4,3" />
      <line x1={cx} y1={topY} x2={cx} y2={botY} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,3" />
      <line x1={cx} y1={topY} x2={cx + rx} y2={topY} stroke="#dc2626" strokeWidth="1.3" />
      <circle cx={cx} cy={topY} r="2.2" fill="#1e293b" />
      <Label x={cx - 10} y={topY - 12} text={centerLabel || 'O'} />
      <Label x={(cx + cx + rx) / 2} y={topY - 14} text={radiusLabel || 'r'} color="#dc2626" />
      <Label x={cx + 14} y={(topY + botY) / 2} text={heightLabel || 'h'} color="#0369a1" />
    </svg>
  );
}

function SphereDiagram({ radiusLabel, centerLabel }) {
  const cx = 110, cy = 100, r = 70;
  return (
    <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e293b" strokeWidth="1.4" />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.32} fill="none" stroke="#1e293b" strokeWidth="1.1" strokeDasharray="4,3" />
      <line x1={cx} y1={cy} x2={cx + r * 0.72} y2={cy - r * 0.62} stroke="#dc2626" strokeWidth="1.3" />
      <circle cx={cx} cy={cy} r="2.4" fill="#1e293b" />
      <Label x={cx - 10} y={cy + 16} text={centerLabel || 'O'} />
      <Label x={cx + r * 0.4} y={cy - r * 0.42} text={radiusLabel || 'r'} color="#dc2626" />
    </svg>
  );
}

export default function RoundSolidDiagram({ shape, radiusLabel, heightLabel, apexLabel, centerLabel }) {
  const wrapperStyle = { display: 'flex', justifyContent: 'center', margin: '14px 0' };

  if (shape === 'cone') {
    return <div style={wrapperStyle}><ConeDiagram radiusLabel={radiusLabel} heightLabel={heightLabel} apexLabel={apexLabel} centerLabel={centerLabel} /></div>;
  }
  if (shape === 'cylinder') {
    return <div style={wrapperStyle}><CylinderDiagram radiusLabel={radiusLabel} heightLabel={heightLabel} centerLabel={centerLabel} /></div>;
  }
  if (shape === 'sphere') {
    return <div style={wrapperStyle}><SphereDiagram radiusLabel={radiusLabel} centerLabel={centerLabel} /></div>;
  }

  return (
    <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12.5, margin: '10px 0' }}>
      ⚠️ Dữ liệu khối tròn xoay không hợp lệ.
    </div>
  );
}
