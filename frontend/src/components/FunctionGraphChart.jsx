import { useMemo } from 'react';
import { compileExpression } from '../utils/mathExpr';

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = 32;

// Thuật toán chọn mốc trục "số đẹp" (nice numbers) - CÙNG nguyên lý các phần
// mềm vẽ đồ thị thật dùng (Desmos, GeoGebra, D3...): thay vì chia đều 1
// khoảng rồi lấy ra số lẻ (VD 1.8, 0.9), luôn chọn bước nhảy là 1, 2 hoặc 5
// nhân với luỹ thừa của 10 (0.1, 0.2, 0.5, 1, 2, 5, 10, 20...) để mốc trục
// luôn là số tròn, dễ đọc, gần giống hệt các phương án đáp án trắc nghiệm.
function niceNumber(range, round) {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

// Trả về { min, max, step, ticks } đã "làm tròn đẹp" bao trọn khoảng
// [rawMin, rawMax] - min/max mốc trục có thể rộng hơn 1 chút so với dữ liệu
// gốc để luôn chia hết cho step.
function niceTicks(rawMin, rawMax, maxTickCount = 5) {
  if (rawMin === rawMax) {
    rawMin -= 1;
    rawMax += 1;
  }
  const range = niceNumber(rawMax - rawMin, false);
  const step = niceNumber(range / (maxTickCount - 1), true);
  const min = Math.floor(rawMin / step) * step;
  const max = Math.ceil(rawMax / step) * step;
  const ticks = [];
  for (let v = min; v <= max + step / 2; v += step) {
    ticks.push(Math.round(v / step) * step); // khử sai số dấu phẩy động
  }
  return { min, max, step, ticks };
}

function formatTick(value) {
  if (Math.abs(value) < 1e-9) return '0';
  const rounded = Math.round(value * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

// Tự vẽ đồ thị hàm số bằng SVG thuần (không cần thư viện ngoài) - lấy mẫu
// nhiều điểm theo đúng biểu thức AI đã cho, đảm bảo hình vẽ luôn khớp
// CHÍNH XÁC với công thức trong đề bài (không phải AI "vẽ" ra hình).
export default function FunctionGraphChart({ expression, domain }) {
  const result = useMemo(() => {
    try {
      const fn = compileExpression(expression);
      const [rawXMin, rawXMax] = Array.isArray(domain) && domain.length === 2 ? domain : [-5, 5];

      // Lấy mẫu sơ bộ trên khoảng gốc để ước lượng phạm vi y thực tế.
      const SAMPLES = 240;
      const probe = [];
      for (let i = 0; i <= SAMPLES; i += 1) {
        const x = rawXMin + ((rawXMax - rawXMin) * i) / SAMPLES;
        try {
          const y = fn({ x });
          if (Number.isFinite(y)) probe.push(y);
        } catch {
          /* bỏ qua điểm lỗi (ngoài tập xác định) */
        }
      }
      if (probe.length === 0) return { error: 'Không tính được giá trị hàm số trong khoảng đã cho.' };

      const sorted = [...probe].sort((a, b) => a - b);
      const p3 = sorted[Math.floor(sorted.length * 0.03)];
      const p97 = sorted[Math.ceil(sorted.length * 0.97) - 1];
      const rawYMin = Math.min(p3, 0);
      const rawYMax = Math.max(p97, 0);

      // Làm tròn mốc trục cả 2 chiều thành "số đẹp".
      const xTicksInfo = niceTicks(rawXMin, rawXMax);
      const yTicksInfo = niceTicks(rawYMin, rawYMax);
      const xMin = xTicksInfo.min;
      const xMax = xTicksInfo.max;
      const yMin = yTicksInfo.min;
      const yMax = yTicksInfo.max;
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;

      const toSvgX = (x) => PADDING + ((x - xMin) / xRange) * (WIDTH - 2 * PADDING);
      const toSvgY = (y) => HEIGHT - PADDING - ((y - yMin) / yRange) * (HEIGHT - 2 * PADDING);

      // Lấy mẫu lại theo ĐÚNG khoảng trục đã làm tròn (có thể rộng hơn domain gốc 1 chút).
      const rawPoints = [];
      for (let i = 0; i <= SAMPLES; i += 1) {
        const x = xMin + (xRange * i) / SAMPLES;
        let y;
        try {
          y = fn({ x });
        } catch {
          y = null;
        }
        rawPoints.push(y === null || !Number.isFinite(y) ? null : { x, y });
      }

      // Ngắt đoạn path mỗi khi giá trị y nhảy ra ngoài phạm vi hiển thị hợp
      // lý (tiệm cận đứng) để không vẽ 1 đường thẳng đứng giả từ -∞ tới +∞.
      const segments = [];
      let current = [];
      rawPoints.forEach((p) => {
        if (!p || p.y < yMin - yRange * 2 || p.y > yMax + yRange * 2) {
          if (current.length > 1) segments.push(current);
          current = [];
          return;
        }
        current.push(`${toSvgX(p.x).toFixed(1)},${toSvgY(p.y).toFixed(1)}`);
      });
      if (current.length > 1) segments.push(current);

      return {
        segments,
        xAxisY: toSvgY(0),
        yAxisX: toSvgX(0),
        xMin,
        xMax,
        yMin,
        yMax,
        xTicks: xTicksInfo.ticks.filter((v) => v >= xMin - 1e-9 && v <= xMax + 1e-9).map((v) => ({ value: v, svgX: toSvgX(v) })),
        yTicks: yTicksInfo.ticks.filter((v) => v >= yMin - 1e-9 && v <= yMax + 1e-9).map((v) => ({ value: v, svgY: toSvgY(v) })),
      };
    } catch (err) {
      return { error: err.message || 'Không vẽ được đồ thị từ biểu thức này.' };
    }
  }, [expression, domain]);

  if (result.error) {
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
        ⚠️ Không thể vẽ đồ thị: {result.error}
      </div>
    );
  }

  const showXAxis = result.xAxisY >= PADDING && result.xAxisY <= HEIGHT - PADDING;
  const showYAxis = result.yAxisX >= PADDING && result.yAxisX <= WIDTH - PADDING;
  const xLabelY = showXAxis ? result.xAxisY + 14 : HEIGHT - PADDING + 14;
  const yLabelX = showYAxis ? result.yAxisX - 8 : PADDING - 6;

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={`Đồ thị hàm số y = ${expression}`}
        style={{ background: '#fffefb', border: '1px solid var(--paper-line, #e4e0d3)', borderRadius: 8 }}
      >
        {/* Lưới mờ - đúng vị trí các mốc số đẹp */}
        {result.yTicks.map((t, i) => (
          <line key={`gy-${i}`} x1={PADDING} x2={WIDTH - PADDING} y1={t.svgY} y2={t.svgY} stroke="#eee8d8" strokeWidth="1" />
        ))}
        {result.xTicks.map((t, i) => (
          <line key={`gx-${i}`} y1={PADDING} y2={HEIGHT - PADDING} x1={t.svgX} x2={t.svgX} stroke="#eee8d8" strokeWidth="1" />
        ))}

        {/* Trục toạ độ */}
        {showXAxis && (
          <line x1={PADDING} x2={WIDTH - PADDING} y1={result.xAxisY} y2={result.xAxisY} stroke="#94a3b8" strokeWidth="1.3" />
        )}
        {showYAxis && (
          <line x1={result.yAxisX} x2={result.yAxisX} y1={PADDING} y2={HEIGHT - PADDING} stroke="#94a3b8" strokeWidth="1.3" />
        )}
        {showYAxis && <text x={result.yAxisX + 4} y={PADDING + 10} fontSize="10" fill="#94a3b8">y</text>}
        {showXAxis && <text x={WIDTH - PADDING - 8} y={result.xAxisY - 5} fontSize="10" fill="#94a3b8">x</text>}

        {/* Số trên trục hoành (x) - bỏ nhãn "0" nếu trùng gốc toạ độ với trục y để không in đè 2 lần */}
        {result.xTicks.map((t, i) => {
          if (showYAxis && Math.abs(t.value) < 1e-9) return null;
          return (
            <text key={`xt-${i}`} x={t.svgX} y={xLabelY} fontSize="9.5" fill="#64748b" textAnchor="middle">
              {formatTick(t.value)}
            </text>
          );
        })}

        {/* Số trên trục tung (y) */}
        {result.yTicks.map((t, i) => (
          <text key={`yt-${i}`} x={yLabelX} y={t.svgY + 3.5} fontSize="9.5" fill="#64748b" textAnchor="end">
            {formatTick(t.value)}
          </text>
        ))}

        {/* Đồ thị hàm số */}
        {result.segments.map((seg, i) => (
          <polyline key={i} points={seg.join(' ')} fill="none" stroke="var(--gold-text, #8a611f)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}
