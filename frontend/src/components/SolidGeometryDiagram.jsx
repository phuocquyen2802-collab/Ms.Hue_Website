import { renderMath } from '../utils/mathRender';

// Tự vẽ hình học không gian cơ bản (chóp/lăng trụ) bằng SVG THUẦN TUÝ từ dữ
// liệu có cấu trúc AI cung cấp (shape, baseLabels, apexLabel, extraPoints) -
// GIỐNG cách làm với FunctionGraphChart/VariationTableDiagram: AI không tự
// vẽ hay chèn mã SVG/ảnh tuỳ ý (rủi ro bảo mật + không chính xác), mà chỉ mô
// tả HÌNH DẠNG cần vẽ bằng vài trường đơn giản, hệ thống tự tính toạ độ và
// vẽ lại - luôn sắc nét, đúng quy ước sách giáo khoa (mặt đáy vẽ hình bình
// hành để gợi phối cảnh, cạnh khuất vẽ nét đứt).
//
// Cấu trúc `diagram` hỗ trợ:
//   { type: 'solid-geometry', shape: 'pyramid3'|'pyramid4'|'prism3'|'prism4',
//     baseLabels: ['A','B','C'] hoặc ['A','B','C','D'],
//     apexLabel: 'S' (bắt buộc với pyramid3/pyramid4),
//     topLabels: ['A1','B1',...] (tuỳ chọn, mặc định thêm dấu ' vào baseLabels, dùng cho prism3/prism4),
//     extraPoints: [
//       { name: 'M', type: 'midpoint', points: ['A','D'] },
//       { name: 'O', type: 'intersection', points: ['A','C','B','D'] } // giao 2 đường chéo AC và BD
//     ] }

const VIEW_W = 240;
const VIEW_H = 210;

// Đáy 4 cạnh: vẽ hình bình hành (gợi phối cảnh nhìn từ trên-trước xuống),
// đỉnh D là đỉnh "khuất" phía sau - các cạnh chạm D vẽ nét đứt.
const BASE4 = { A: { x: 40, y: 180 }, B: { x: 175, y: 180 }, C: { x: 210, y: 130 }, D: { x: 75, y: 130 } };
const BASE4_HIDDEN_VERTEX = 'D';

// Đáy 3 cạnh: tam giác thường, không có cạnh khuất (luôn vẽ nét liền cho đơn giản, dễ nhìn).
const BASE3 = { A: { x: 40, y: 180 }, B: { x: 200, y: 180 }, C: { x: 150, y: 95 } };

function buildVertexMap(shape, baseLabels, apexLabel, topLabels) {
  const isTriangleBase = shape === 'pyramid3' || shape === 'prism3';
  const baseCoords = isTriangleBase ? BASE3 : BASE4;
  const genericKeys = isTriangleBase ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];

  const map = {};
  const base = {};
  genericKeys.forEach((k, i) => {
    const label = baseLabels[i] || k;
    base[label] = baseCoords[k];
    map[label] = baseCoords[k];
  });

  let apex = null;
  if (shape === 'pyramid3' || shape === 'pyramid4') {
    const xs = Object.values(base).map((p) => p.x);
    const ys = Object.values(base).map((p) => p.y);
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const topY = Math.min(...ys);
    apex = { x: cx, y: topY - 85 };
    map[apexLabel] = apex;
  }

  let top = null;
  if (shape === 'prism3' || shape === 'prism4') {
    const dy = -125;
    top = {};
    genericKeys.forEach((k, i) => {
      const label = baseLabels[i] || k;
      const topLabel = (topLabels && topLabels[i]) || `${label}'`;
      top[topLabel] = { x: base[label].x, y: base[label].y + dy };
      map[topLabel] = top[topLabel];
    });
  }

  return { map, base, apex, top, isTriangleBase };
}

function resolveExtraPoint(ep, map) {
  if (!ep || !ep.name || !Array.isArray(ep.points)) return null;
  if (ep.type === 'midpoint' && ep.points.length === 2) {
    const [p1, p2] = ep.points.map((n) => map[n]);
    if (!p1 || !p2) return null;
    return { name: ep.name, x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }
  if (ep.type === 'intersection' && ep.points.length === 4) {
    const [a, b, c, d] = ep.points.map((n) => map[n]);
    if (!a || !b || !c || !d) return null;
    // Giao điểm 2 đoạn thẳng AB và CD (công thức đại số tuyến tính chuẩn, không dùng eval).
    const denom = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denom) < 1e-6) return null;
    const t = ((a.x - c.x) * (c.y - d.y) - (a.y - c.y) * (c.x - d.x)) / denom;
    return { name: ep.name, x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  }
  return null;
}

function labelOffset(point, center) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const dist = Math.hypot(dx, dy) || 1;
  return { dx: (dx / dist) * 16, dy: (dy / dist) * 16 };
}

function renderLabel(text) {
  return renderMath(`$${text}$`).replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
}

export default function SolidGeometryDiagram({ shape, baseLabels, apexLabel, topLabels, extraPoints }) {
  const validShapes = ['pyramid3', 'pyramid4', 'prism3', 'prism4'];
  const isTriangleBase = shape === 'pyramid3' || shape === 'prism3';
  const expectedBaseCount = isTriangleBase ? 3 : 4;

  if (!validShapes.includes(shape) || !Array.isArray(baseLabels) || baseLabels.length !== expectedBaseCount) {
    return (
      <div
        style={{
          padding: '10px 14px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 8,
          color: '#991b1b',
          fontSize: 12.5,
          margin: '10px 0',
        }}
      >
        ⚠️ Dữ liệu hình học không gian không hợp lệ.
      </div>
    );
  }

  const { map, base, apex, top } = buildVertexMap(shape, baseLabels, apexLabel, topLabels);
  const hiddenVertex = !isTriangleBase ? baseLabels[['A', 'B', 'C', 'D'].indexOf(BASE4_HIDDEN_VERTEX)] : null;

  const baseKeys = Object.keys(base);
  const baseEdges = baseKeys.map((k, i) => [k, baseKeys[(i + 1) % baseKeys.length]]);

  const center = {
    x: Object.values(map).reduce((s, p) => s + p.x, 0) / Object.values(map).length,
    y: Object.values(map).reduce((s, p) => s + p.y, 0) / Object.values(map).length,
  };

  const isHiddenEdge = ([p1, p2]) => hiddenVertex && (p1 === hiddenVertex || p2 === hiddenVertex);

  const solidLines = [];
  const dashedLines = [];

  baseEdges.forEach((edge) => (isHiddenEdge(edge) ? dashedLines : solidLines).push(edge));

  if (apex) {
    baseKeys.forEach((k) => {
      (k === hiddenVertex ? dashedLines : solidLines).push([apexLabel, k]);
    });
  }

  if (top) {
    const topKeys = Object.keys(top);
    const topEdges = topKeys.map((k, i) => [k, topKeys[(i + 1) % topKeys.length]]);
    const hiddenTopVertex = hiddenVertex ? topKeys[baseKeys.indexOf(hiddenVertex)] : null;
    topEdges.forEach((edge) => {
      const hidden = hiddenTopVertex && (edge[0] === hiddenTopVertex || edge[1] === hiddenTopVertex);
      (hidden ? dashedLines : solidLines).push(edge);
    });
    baseKeys.forEach((k, i) => {
      const vEdge = [k, topKeys[i]];
      (k === hiddenVertex ? dashedLines : solidLines).push(vEdge);
    });
  }

  const resolvedExtraPoints = (extraPoints || []).map((ep) => resolveExtraPoint(ep, map)).filter(Boolean);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0' }}>
      <svg width={VIEW_W} height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ overflow: 'visible' }}>
        {solidLines.map(([p1, p2], i) => (
          <line
            key={`s-${i}`}
            x1={map[p1].x} y1={map[p1].y} x2={map[p2].x} y2={map[p2].y}
            stroke="#1e293b" strokeWidth="1.6"
          />
        ))}
        {dashedLines.map(([p1, p2], i) => (
          <line
            key={`d-${i}`}
            x1={map[p1].x} y1={map[p1].y} x2={map[p2].x} y2={map[p2].y}
            stroke="#1e293b" strokeWidth="1.6" strokeDasharray="5,4"
          />
        ))}

        {resolvedExtraPoints.map((p) => (
          <circle key={p.name} cx={p.x} cy={p.y} r="2.6" fill="#1e293b" />
        ))}

        {Object.entries(map).map(([name, p]) => {
          const { dx, dy } = labelOffset(p, center);
          return (
            <foreignObject key={name} x={p.x + dx - 14} y={p.y + dy - 12} width="28" height="24" style={{ overflow: 'visible' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: renderLabel(name) }} />
            </foreignObject>
          );
        })}

        {resolvedExtraPoints.map((p) => {
          const { dx, dy } = labelOffset(p, center);
          return (
            <foreignObject key={`${p.name}-lbl`} x={p.x + dx - 14} y={p.y + dy - 12} width="28" height="24" style={{ overflow: 'visible' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', textAlign: 'center' }} dangerouslySetInnerHTML={{ __html: renderLabel(p.name) }} />
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
