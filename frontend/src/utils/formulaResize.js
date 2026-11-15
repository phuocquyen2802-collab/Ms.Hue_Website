// Tiện ích dùng chung để giáo viên chỉnh tay cỡ hiển thị của 1 hoặc nhiều ảnh công thức
// (khi cỡ tự động lúc import chưa vừa ý) - dùng ở cả màn hình "Tạo đề thi mới"
// (TeacherExamsPage.jsx, đang ở bước xem trước) và màn hình "Soạn câu hỏi" (ExamEditorPage.jsx).

// Các mức theo thang cỡ tự động mới (Bước 34, wmfConvertService): chữ trong
// công thức cao bằng chữ thường khi công thức 1 dòng không chỉ số cao ~0.9em,
// có chỉ số trên/dưới ~1.3em, phân số ~2.5em, hệ 2-3 dòng ~3.6em trở lên.
export const FORMULA_SIZE_PRESETS = [
  { label: 'Nhỏ', heightEm: 0.9 },
  { label: 'Vừa (1 dòng)', heightEm: 1.3 },
  { label: 'Phân số', heightEm: 2.5 },
  { label: 'Lớn (nhiều tầng)', heightEm: 3.6 },
];

export function valignForHeightEm(heightEm) {
  return Math.max(-1.5, Math.min(-0.15, -(heightEm * 0.27)));
}

// Liệt kê các thẻ <img class="formula-img" ...> (không tính diagram-img)
// trong 1 đoạn HTML, kèm vị trí bắt đầu/kết thúc để có thể thay thế đúng
// thẻ đó khi giáo viên chỉnh cỡ tay.
export function listFormulaImgTags(html) {
  if (!html) return [];
  const results = [];
  const re = /<img\b[^>]*>/gi;
  let m;
  let idx = 0;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (/class="[^"]*\bformula-img\b[^"]*"/.test(tag)) {
      results.push({ index: idx, start: m.index, end: m.index + tag.length, tag });
      idx += 1;
    }
  }
  return results;
}

export function countFormulaImgs(html) {
  if (!html) return 0;
  return listFormulaImgTags(html).length;
}

// Bóc tách cỡ chiều cao (em) từ chuỗi style hoặc thẻ <img>
export function extractFormulaSize(tagOrStyle) {
  if (!tagOrStyle) return 1.8;
  const m = String(tagOrStyle).match(/height:\s*([\d.]+)em/i);
  return m ? parseFloat(m[1]) : 1.8;
}

// Style mới cho 1 thẻ ảnh khi đổi cỡ: nếu ảnh đã có sẵn vertical-align (do
// lúc import tính theo đúng dòng chân chữ của công thức) thì co giãn nó theo
// cùng tỉ lệ để chữ vẫn nằm đúng hàng; chỉ dùng `fallbackValignEm` khi ảnh
// chưa có thông tin này.
function buildSizedStyle(tag, heightEm, fallbackValignEm) {
  const oldH = String(tag).match(/height:\s*([\d.]+)em/i);
  const oldV = String(tag).match(/vertical-align:\s*(-?[\d.]+)em/i);
  let valign = fallbackValignEm;
  if (oldH && oldV && parseFloat(oldH[1]) > 0) {
    valign = (parseFloat(oldV[1]) * heightEm) / parseFloat(oldH[1]);
  }
  return `height:${heightEm}em;vertical-align:${Number(valign.toFixed(3))}em;`;
}

// Thay style height/vertical-align của đúng ảnh công thức thứ `targetIndex`
export function applyFormulaSize(html, targetIndex, heightEm, vAlignEm) {
  return applyFormulaSizeToIndices(html, [targetIndex], heightEm, vAlignEm);
}

// Thay style cho tất cả thẻ formula-img trong đoạn HTML
export function applyFormulaSizeToAll(html, heightEm, vAlignEm) {
  if (!html) return html;
  const imgs = listFormulaImgTags(html);
  if (imgs.length === 0) return html;

  let result = '';
  let lastEnd = 0;
  imgs.forEach((target) => {
    result += html.slice(lastEnd, target.start);
    const newStyle = buildSizedStyle(target.tag, heightEm, vAlignEm);
    let newTag = target.tag;
    if (/style="[^"]*"/.test(newTag)) {
      newTag = newTag.replace(/style="[^"]*"/, `style="${newStyle}"`);
    } else {
      newTag = newTag.replace(/\/?>$/, ` style="${newStyle}" />`);
    }
    result += newTag;
    lastEnd = target.end;
  });
  result += html.slice(lastEnd);
  return result;
}

// Thay style cho các ảnh có chỉ số nằm trong Set/Mảng `targetIndices`
export function applyFormulaSizeToIndices(html, targetIndices, heightEm, vAlignEm) {
  if (!html || !targetIndices) return html;
  const targetSet = targetIndices instanceof Set ? targetIndices : new Set(targetIndices);
  if (targetSet.size === 0) return html;

  const imgs = listFormulaImgTags(html);
  if (imgs.length === 0) return html;

  let result = '';
  let lastEnd = 0;
  imgs.forEach((target) => {
    result += html.slice(lastEnd, target.start);
    if (targetSet.has(target.index)) {
      const newStyle = buildSizedStyle(target.tag, heightEm, vAlignEm);
      let newTag = target.tag;
      if (/style="[^"]*"/.test(newTag)) {
        newTag = newTag.replace(/style="[^"]*"/, `style="${newStyle}"`);
      } else {
        newTag = newTag.replace(/\/?>$/, ` style="${newStyle}" />`);
      }
      result += newTag;
    } else {
      result += target.tag;
    }
    lastEnd = target.end;
  });
  result += html.slice(lastEnd);
  return result;
}
