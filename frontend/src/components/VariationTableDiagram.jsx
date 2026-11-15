import { Fragment } from 'react';
import { renderMath } from '../utils/mathRender';

// Tự dựng bảng biến thiên bằng CSS Grid từ dữ liệu có cấu trúc AI cung cấp
// (points, signs, values) - không phải ảnh, nên luôn sắc nét và chính xác
// tuyệt đối theo đúng dữ liệu, khác hẳn việc nhờ AI "vẽ" ra 1 tấm ảnh.
// Dùng Grid (không dùng <table>) vì mũi tên lên/xuống của hàng y cần nằm
// trong 1 CỘT NỐI riêng giữa 2 mốc giá trị - <table> không cho phép 1 ô
// "kéo dài" ra ngoài ranh giới ô của chính nó nên mũi tên sẽ luôn bị cắt.
export default function VariationTableDiagram({ points, signs, values }) {
  if (
    !Array.isArray(points) || !Array.isArray(signs) || !Array.isArray(values) ||
    points.length < 2 || values.length !== points.length || signs.length !== points.length - 1
  ) {
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
        ⚠️ Dữ liệu bảng biến thiên không hợp lệ.
      </div>
    );
  }

  const POINT_COL = 64;
  const GAP_COL = 58;
  const LABEL_COL = 40;

  // Cột: [nhãn] [mốc0] [nối0] [mốc1] [nối1] ... [mốcN-1]
  const templateColumns = [`${LABEL_COL}px`, ...points.flatMap((_, i) => (i < points.length - 1 ? [`${POINT_COL}px`, `${GAP_COL}px`] : [`${POINT_COL}px`]))].join(' ');

  const borderColor = '#1e293b';
  const rowStyle = { display: 'grid', gridTemplateColumns: templateColumns };
  const cellBase = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30, fontSize: 14 };

  return (
    <div style={{ overflowX: 'auto', margin: '12px 0', display: 'flex', justifyContent: 'center' }}>
      <div style={{ border: `1.5px solid ${borderColor}`, background: '#ffffff', borderRadius: 4 }}>
        {/* Hàng x */}
        <div style={{ ...rowStyle, borderBottom: `1.5px solid ${borderColor}` }}>
          <div style={{ ...cellBase, fontWeight: 700, background: '#f8fafc' }} dangerouslySetInnerHTML={{ __html: renderInlineMath('x') }} />
          {points.map((p, i) => (
            <Fragment key={i}>
              <div style={cellBase} dangerouslySetInnerHTML={{ __html: renderInlineMath(p) }} />
              {i < points.length - 1 && <div style={cellBase} />}
            </Fragment>
          ))}
        </div>

        {/* Hàng y' (dấu đạo hàm) */}
        <div style={{ ...rowStyle, borderBottom: `1.5px solid ${borderColor}` }}>
          <div style={{ ...cellBase, fontWeight: 700, background: '#f8fafc' }} dangerouslySetInnerHTML={{ __html: renderInlineMath("y'") }} />
          {points.map((_, i) => (
            <Fragment key={i}>
              <div style={{ ...cellBase, fontWeight: 700 }}>
                {i > 0 && i < points.length - 1 ? <span dangerouslySetInnerHTML={{ __html: renderInlineMath('0') }} /> : null}
              </div>
              {i < points.length - 1 && (
                <div style={{ ...cellBase, fontWeight: 800, color: signs[i] === '+' ? '#166534' : '#991b1b' }}>
                  {signs[i] === '+' ? '+' : '−'}
                </div>
              )}
            </Fragment>
          ))}
        </div>

        {/* Hàng y (giá trị + mũi tên lên/xuống) */}
        <div style={rowStyle}>
          <div style={{ ...cellBase, fontWeight: 700, background: '#f8fafc', minHeight: 54 }} dangerouslySetInnerHTML={{ __html: renderInlineMath('y') }} />
          {points.map((v, i) => (
            <Fragment key={i}>
              <div style={{ ...cellBase, minHeight: 54 }} dangerouslySetInnerHTML={{ __html: renderInlineMath(v) }} />
              {i < points.length - 1 && (
                <div style={{ ...cellBase, minHeight: 54, padding: 0 }}>
                  <VariationArrow up={signs[i] === '+'} width={GAP_COL} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderInlineMath(text) {
  const looksLikeMath = /\\infty|\\/.test(text) || /^-?\d+(\.\d+)?$/.test(String(text).trim());
  const wrapped = looksLikeMath ? `$${text}$` : text;
  return renderMath(wrapped).replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');
}

// Mũi tên chéo lên/xuống nối 2 giá trị y liên tiếp, đặt gọn trong đúng 1
// cột nối - hướng lên khi khoảng đó có y' dương (hàm đồng biến), hướng
// xuống khi y' âm (nghịch biến).
function VariationArrow({ up, width }) {
  const h = 40;
  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <defs>
        <marker id={`arrow-${up ? 'up' : 'down'}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#1e293b" />
        </marker>
      </defs>
      <line
        x1={6}
        y1={up ? h - 6 : 6}
        x2={width - 6}
        y2={up ? 6 : h - 6}
        stroke="#1e293b"
        strokeWidth="1.4"
        markerEnd={`url(#arrow-${up ? 'up' : 'down'})`}
      />
    </svg>
  );
}
