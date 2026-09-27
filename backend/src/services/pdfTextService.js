// Đọc VĂN BẢN THUẦN từ file PDF - dùng cho việc SO KHỚP đơn giản (ví dụ đếm
// xem file đáp án chi tiết có đủ "Câu N" cho từng câu hỏi hay không), KHÔNG
// dùng để tách câu hỏi/công thức Toán từ PDF (đã bỏ tính năng đó - PDF không
// giữ lại được công thức MathType/Equation Editor dưới dạng ảnh như Word,
// đã kiểm chứng bằng dữ liệu thật: vùng công thức trong PDF là hình vẽ
// vector thuần tuý, không có bất kỳ ký tự văn bản nào để đọc).
//
// LƯU Ý: PDF lưu văn bản dưới dạng từng đoạn ký tự rời kèm toạ độ (x, y)
// trên trang - thứ tự các đoạn này TRONG FILE không nhất thiết đúng thứ tự
// đọc thực tế (thường gặp với tiếng Việt: dấu thanh/dấu mũ bị tách riêng và
// dồn ra cuối dòng). Ở đây dùng thẳng pdfjs-dist để lấy toạ độ từng đoạn ký
// tự rồi TỰ SẮP XẾP LẠI theo đúng vị trí thật (nhóm theo dòng bằng toạ độ y,
// trong 1 dòng sắp theo toạ độ x tăng dần) trước khi ghép thành văn bản.

// pdfjs-dist chỉ phát hành dạng ESM (.mjs) - dùng import() động ngay trong
// module CommonJS này, không cần chuyển cả dự án sang ESM chỉ vì 1 thư viện.
async function loadPdfjs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extractOrderedTextFromPdf(pdfBuffer) {
  const pdfjsLib = await loadPdfjs();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const lines = [];

  for (let p = 1; p <= doc.numPages; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await doc.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    const items = content.items.filter((it) => it.str && it.str.length > 0);

    const lineMap = new Map();
    items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push(it);
    });

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const Y_TOLERANCE = 2;
    const mergedLines = [];
    sortedYs.forEach((y) => {
      const lastGroup = mergedLines[mergedLines.length - 1];
      if (lastGroup && Math.abs(lastGroup.y - y) <= Y_TOLERANCE) {
        lastGroup.items.push(...lineMap.get(y));
      } else {
        mergedLines.push({ y, items: [...lineMap.get(y)] });
      }
    });

    mergedLines.forEach((group) => {
      group.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineText = group.items.map((it) => it.str).join('');
      if (lineText.trim()) lines.push(lineText);
    });
  }

  return lines.join('\n');
}

module.exports = { extractOrderedTextFromPdf };
