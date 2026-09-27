import { renderMath } from '../utils/mathRender';

// Vẽ minh hoạ hệ trục toạ độ Oxyz (điểm, vectơ, mặt phẳng) bằng SVG thuần tuý
// từ dữ liệu có cấu trúc AI cung cấp - GIỐNG nguyên lý SolidGeometryDiagram:
// AI chỉ mô tả toạ độ, hệ thống tự chiếu trục đo (axonometric) và vẽ lại.
//
// Cấu trúc `diagram` hỗ trợ:
//   { type: 'oxyz',
//     points: [{ name: 'A', coords: [1, 2, 3] }, ...],   // tối đa ~6 điểm
//     vectors: [{ from: 'O', to: 'A' }, ...],             // vẽ mũi tên, from/to là tên điểm đã khai báo ở 'points' hoặc 'O' (gốc toạ độ)
//     plane: ['A', 'B', 'C'],                             // tuỳ chọn: tô mờ mặt phẳng qua các điểm này (3 hoặc 4 điểm)
//   }

const VIEW_W = 260;
const VIEW_H = 230;
const ORIGIN = { x: 130, y: 150 };
const SCALE = 26;
// Góc chiếu trục đo kiểu SGK: Ox chếch xuống-trái, Oy chếch xuống-phải, Oz thẳng đứng
const ANGLE_X = (200 * Math.PI) / 180;
const ANGLE_Y = (340 * Math.PI) / 180;

function project([x, y, z]) {
  const px = ORIGIN.x + x * SCALE * Math.cos(ANGLE_X) + y * SCALE * Math.cos(ANGLE_Y);
  const py = ORIGIN.y + x * SCALE * Math.sin(ANGLE_X) + y * SCALE * Math.sin(ANGLE_Y) - z * SCALE;
  return { x: px, y: py };
}

function renderLabel(text) {
  return renderMath(`$${text}$`).replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
}

export default function OxyzDiagram({ points, vectors, plane }) {
  const safePoints = Array.isArray(points) ? points.filter((p) => p && p.name && Array.isArray(p.coords) && p.coords.length === 3) : [];

  if (safePoints.length === 0) {
    return (
      <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: 12.5, margin: '10px 0' }}>
        ⚠️ Dữ liệu hệ trục Oxyz không hợp lệ.
      </div>
    );
  }

  const pointMap = { O: [0, 0, 0] };
  safePoints.forEach((p) => { pointMap[p.name] = p.coords; });

  const axisLen = 4.2;
  const axes = [
    { to: project([axisLen, 0, 0]), label: 'x' },
    { to: project([0, axisLen, 0]), label: 'y' },
    { to: project([0, 0, axisLen]), label: 'z' },
  ];
  const originP = project([0, 0, 0]);

  const safeVectors = (vectors || [])
    .filter((v) => v && pointMap[v.from] && pointMap[v.to])
    .map((v) => ({ from: project(pointMap[v.from]), to: project(pointMap[v.to]), fromName: v.from, toName: v.to }));

  const safePlanePoints = Array.isArray(plane) && plane.length >= 3
    ? plane.filter((n) => pointMap[n]).map((n) => project(pointMap[n]))
    : [];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
      <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ overflow: 'visible' }}>
        <defs>
          <marker id="oxyz-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#1e293b" />
          </marker>
          <marker id="oxyz-vec-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" />
          </marker>
        </defs>

        {/* Trục toạ độ */}
        {axes.map((ax) => (
          <line key={ax.label} x1={originP.x} y1={originP.y} x2={ax.to.x} y2={ax.to.y} stroke="#1e293b" strokeWidth="1.4" markerEnd="url(#oxyz-arrow)" />
        ))}
        {axes.map((ax) => (
          <foreignObject key={`${ax.label}-lbl`} x={ax.to.x + (ax.label === 'x' ? -18 : 4)} y={ax.to.y + (ax.label === 'z' ? -18 : 2)} width="20" height="18" style={{ overflow: 'visible' }}>
            <div style={{ fontSize: 13, fontWeight: 700, fontStyle: 'italic', color: '#1e293b' }} dangerouslySetInnerHTML={{ __html: renderLabel(ax.label) }} />
          </foreignObject>
        ))}
        <foreignObject x={originP.x - 16} y={originP.y + 4} width="18" height="16" style={{ overflow: 'visible' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }} dangerouslySetInnerHTML={{ __html: renderLabel('O') }} />
        </foreignObject>

        {/* Mặt phẳng tô mờ (nếu có) */}
        {safePlanePoints.length >= 3 && (
          <polygon
            points={safePlanePoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="#8b5cf6"
            fillOpacity="0.15"
            stroke="#8b5cf6"
            strokeWidth="1.3"
            strokeDasharray="4,3"
          />
        )}

        {/* Vectơ (mũi tên đỏ) */}
        {safeVectors.map((v, i) => (
          <line key={i} x1={v.from.x} y1={v.from.y} x2={v.to.x} y2={v.to.y} stroke="#dc2626" strokeWidth="1.6" markerEnd="url(#oxyz-vec-arrow)" />
        ))}

        {/* Điểm + nhãn */}
        {safePoints.map((p) => {
          const proj = project(p.coords);
          return (
            <g key={p.name}>
              <circle cx={proj.x} cy={proj.y} r="2.8" fill="#2563eb" />
              <foreignObject x={proj.x + 6} y={proj.y - 18} width="60" height="18" style={{ overflow: 'visible' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }} dangerouslySetInnerHTML={{ __html: renderLabel(`${p.name}(${p.coords.join(';')})`) }} />
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
