// Tiện ích dùng chung để giáo viên chỉnh tay cỡ hiển thị của 1 hoặc nhiều ảnh công thức
// (khi cỡ tự động lúc import chưa vừa ý) - dùng ở cả màn hình "Tạo đề thi mới"
// (TeacherExamsPage.jsx, đang ở bước xem trước) và màn hình "Soạn câu hỏi" (ExamEditorPage.jsx).

export const FORMULA_SIZE_PRESETS = [
  { label: 'Nhỏ', heightEm: 1.3 },
  { label: 'Vừa (1 dòng)', heightEm: 1.8 },
  { label: 'Phân số', heightEm: 3.0 },
  { label: 'Lớn (nhiều tầng)', heightEm: 4.2 },
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

// Thay style height/vertical-align của đúng ảnh công thức thứ `targetIndex`
export function applyFormulaSize(html, targetIndex, heightEm, vAlignEm) {
  return applyFormulaSizeToIndices(html, [targetIndex], heightEm, vAlignEm);
}

// Thay style cho tất cả thẻ formula-img trong đoạn HTML
export function applyFormulaSizeToAll(html, heightEm, vAlignEm) {
  if (!html) return html;
  const imgs = listFormulaImgTags(html);
  if (imgs.length === 0) return html;
  const newStyle = `height:${heightEm}em;vertical-align:${vAlignEm}em;`;

  let result = '';
  let lastEnd = 0;
  imgs.forEach((target) => {
    result += html.slice(lastEnd, target.start);
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
  const newStyle = `height:${heightEm}em;vertical-align:${vAlignEm}em;`;

  let result = '';
  let lastEnd = 0;
  imgs.forEach((target) => {
    result += html.slice(lastEnd, target.start);
    if (targetSet.has(target.index)) {
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
