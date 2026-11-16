import FunctionGraphChart from './FunctionGraphChart';
import VariationTableDiagram from './VariationTableDiagram';
import SolidGeometryDiagram from './SolidGeometryDiagram';
import OxyzDiagram from './OxyzDiagram';
import RoundSolidDiagram from './RoundSolidDiagram';

// Điểm gọi DUY NHẤT để hiển thị hình minh hoạ cho 1 câu hỏi (nếu có) - AI
// (Gemini) chỉ trả về DỮ LIỆU có cấu trúc (công thức hàm số / bảng số liệu),
// hình được HỆ THỐNG TỰ VẼ LẠI chính xác từ dữ liệu đó, không phải ảnh do
// AI tạo ra. Component này chọn đúng loại hình để render theo `diagram.type`.
// Hình vẽ toán luôn vẽ bằng bảng màu sáng (.light-scope). Ở chế độ tối, cả
// khối hình được đảo màu bằng CSS (.diagram-figure) để nét vẽ thành màu sáng
// trên nền tối mà vẫn giữ sắc màu của các nét tô đỏ/tím.
export default function QuestionDiagram({ diagram }) {
  const figure = renderDiagram(diagram);
  return figure ? <div className="diagram-figure light-scope">{figure}</div> : null;
}

function renderDiagram(diagram) {
  if (!diagram || !diagram.type) return null;

  if (diagram.type === 'function-graph' && diagram.expression) {
    return <FunctionGraphChart expression={diagram.expression} domain={diagram.domain} />;
  }

  if (diagram.type === 'variation-table') {
    return <VariationTableDiagram points={diagram.points} signs={diagram.signs} values={diagram.values} />;
  }

  if (diagram.type === 'solid-geometry' && diagram.shape) {
    return (
      <SolidGeometryDiagram
        shape={diagram.shape}
        baseLabels={diagram.baseLabels}
        apexLabel={diagram.apexLabel}
        topLabels={diagram.topLabels}
        extraPoints={diagram.extraPoints}
      />
    );
  }

  if (diagram.type === 'oxyz') {
    return <OxyzDiagram points={diagram.points} vectors={diagram.vectors} plane={diagram.plane} />;
  }

  if (diagram.type === 'round-solid' && diagram.shape) {
    return (
      <RoundSolidDiagram
        shape={diagram.shape}
        radiusLabel={diagram.radiusLabel}
        heightLabel={diagram.heightLabel}
        apexLabel={diagram.apexLabel}
        centerLabel={diagram.centerLabel}
      />
    );
  }

  return null;
}
