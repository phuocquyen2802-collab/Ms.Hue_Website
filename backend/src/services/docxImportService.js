// Đọc file Word (.docx) chứa đề trắc nghiệm và tách thành danh sách câu hỏi
// nháp để giáo viên kiểm tra/chỉnh sửa trước khi lưu vào đề thi thật.
//
// Đặc điểm của đề Toán THPT thường gặp: công thức được chèn bằng Equation
// Editor/MathType cũ, lưu dưới dạng ảnh WMF (trình duyệt không hiển thị
// được) - cần chuyển sang PNG bằng LibreOffice (wmfConvertService). Ảnh
// khác (đồ thị, bảng biến thiên) thường là PNG/JPEG, giữ nguyên.
//
// Cấu trúc thường gặp trong file nguồn:
//   <p><strong>CHỦ ĐỀ 1: ...</strong></p>              -> tiêu đề chủ đề/tag
//   <p><strong>Câu 1.</strong> nội dung câu hỏi...</p>  -> bắt đầu 1 câu hỏi
//   <p><strong>A.</strong> ... <strong>B.</strong> ...  -> 1 hoặc nhiều dòng
//    <strong>C.</strong> ... <strong>D.</strong> ...</p>   chứa 4 đáp án

const crypto = require('crypto');
const JSZip = require('jszip');
const mammoth = require('mammoth');
const sharp = require('sharp');
const wmfConvertService = require('./wmfConvertService');

function md5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

// Bước 1: mở file .docx (là 1 file zip) để lấy trước toàn bộ ảnh WMF gốc,
// chuyển đổi hàng loạt 1 lần (nhanh hơn nhiều so với gọi LibreOffice riêng
// lẻ cho từng ảnh), rồi map lại theo hash nội dung để ghép đúng ảnh khi
// mammoth xử lý từng ảnh trong lúc dựng HTML.
async function buildWmfPngMap(docxBuffer) {
  const zip = await JSZip.loadAsync(docxBuffer);
  const mediaFiles = Object.keys(zip.files).filter((name) => {
    const low = name.toLowerCase();
    return low.startsWith('word/media/') && (low.endsWith('.wmf') || low.endsWith('.emf'));
  });

  const wmfItems = [];
  const hashesInOrder = [];
  for (const name of mediaFiles) {
    // eslint-disable-next-line no-await-in-loop
    const buf = await zip.files[name].async('nodebuffer');
    const ext = name.toLowerCase().endsWith('.emf') ? 'emf' : 'wmf';
    wmfItems.push({ buffer: buf, ext });
    hashesInOrder.push(md5(buf));
  }

  const pngResults = await wmfConvertService.convertWmfBuffersToPng(wmfItems);

  const hashToPng = {};
  hashesInOrder.forEach((hash, i) => {
    if (pngResults[i]) hashToPng[hash] = pngResults[i];
  });

  return hashToPng;
}

// Trả về { class, style } cho thẻ <img> - kích thước hiển thị (style) được
// TỰ HIỆU CHỈNH riêng cho từng ảnh ngay trong wmfConvertService (dựa theo
// cấu trúc dải mực thật của chính ảnh đó), không còn dùng chung 1 bộ class
// cỡ cố định (dễ sai khi các ảnh có độ phân giải gốc khác nhau).
function getFormulaAttrs(pngInfo) {
  if (!pngInfo) return { class: 'formula-img', style: 'height:1.8em;vertical-align:-0.35em;' };
  if (pngInfo.isDiagram) return { class: 'diagram-img', style: '' };
  const h = pngInfo.displayHeightEm != null ? pngInfo.displayHeightEm : 1.8;
  const v = pngInfo.verticalAlignEm != null ? pngInfo.verticalAlignEm : -0.35;
  return { class: 'formula-img', style: `height:${h}em;vertical-align:${v}em;` };
}

// Bước 2: dùng mammoth để dựng HTML, thay ảnh WMF/EMF bằng PNG đã chuyển đổi
// (tra theo hash), ảnh khác giữ nguyên dạng base64 nhúng thẳng vào HTML.
async function convertDocxToHtml(docxBuffer, hashToPng) {
  const result = await mammoth.convertToHtml(
    { buffer: docxBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const raw = await image.read();
        const contentType = (image.contentType || '').toLowerCase();

        if (contentType.includes('wmf') || contentType.includes('emf')) {
          const hash = md5(raw);
          const pngInfo = hashToPng[hash];
          if (pngInfo) {
            const b64 = pngInfo.base64 || pngInfo;
            const attrs = getFormulaAttrs(pngInfo);
            return {
              src: `data:image/png;base64,${b64}`,
              class: attrs.class,
              style: attrs.style,
            };
          }

          // Dự phòng: chuyển đổi trực tiếp nếu chưa có trong map
          try {
            const ext = contentType.includes('emf') ? 'emf' : 'wmf';
            const fallbackRes = await wmfConvertService.convertWmfBuffersToPng([{ buffer: raw, ext }]);
            if (fallbackRes && fallbackRes[0]) {
              const b64 = fallbackRes[0].base64 || fallbackRes[0];
              const attrs = getFormulaAttrs(fallbackRes[0]);
              return {
                src: `data:image/png;base64,${b64}`,
                class: attrs.class,
                style: attrs.style,
              };
            }
          } catch (e) {
            console.error('Lỗi chuyển đổi công thức:', e.message);
          }

          return { src: '', 'data-missing-formula': 'true' };
        }

        // Ảnh KHÔNG phải WMF/EMF (thường là PNG/JPEG nhúng thẳng) - có thể là
        // đồ thị/bảng biến thiên thật, nhưng cũng có thể là 1 công thức/số
        // đơn được MathType lưu kèm bản xem trước PNG thay vì WMF (tuỳ phiên
        // bản Word). Trước đây nhánh này không gán kích thước gì cả, dựa vào
        // CSS `max-height` cố định theo class - từ khi CSS đó bị bỏ (đổi
        // sang gán style riêng từng ảnh, Bước 26) nhánh này bị "lọt lưới",
        // hiển thị ĐÚNG KÍCH THƯỚC GỐC không giới hạn - đây chính là nguyên
        // nhân số/ký hiệu đơn bị to bất thường dù đã có cỡ cố định cho nhánh
        // WMF. Sửa bằng cách áp DỤNG CÙNG QUY TẮC như nhánh WMF: đo kích
        // thước thật bằng sharp, ảnh lớn (đồ thị thật) -> `diagram-img`,
        // ảnh nhỏ (công thức/số) -> cùng 1 cỡ cố định như mọi công thức khác.
        const base64 = raw.toString('base64');
        try {
          const meta = await sharp(raw).metadata();
          const w = meta.width || 0;
          const h = meta.height || 0;
          // Ngưỡng đồng bộ với `wmfConvertService.js` (xem giải thích chi tiết ở đó): cần CẢ 2
          // chiều đủ lớn mới coi là hình vẽ thật, tránh nhận nhầm công thức cao/rộng 1 chiều
          // (vectơ, toạ độ điểm) thành hình vẽ rồi hiển thị không giới hạn kích thước.
          const isDiagram = (w >= 150 && h >= 100) || (w * h >= 40000);
          const bandCount = isDiagram ? 0 : await wmfConvertService.countInkBands(raw, w, h);
          const size = isDiagram ? null : wmfConvertService.computeFormulaSize(h, bandCount >= 2);
          const attrs = getFormulaAttrs({
            isDiagram,
            displayHeightEm: size ? size.displayHeightEm : undefined,
            verticalAlignEm: size ? size.verticalAlignEm : undefined,
          });
          return {
            src: `data:${image.contentType};base64,${base64}`,
            class: attrs.class,
            style: attrs.style,
          };
        } catch (e) {
          console.error('Lỗi đo kích thước ảnh nhúng:', e.message);
          return { src: `data:${image.contentType};base64,${base64}`, class: 'formula-img', style: 'height:1.8em;vertical-align:-0.35em;' };
        }
      }),
    }
  );
  return result.value;
}

function stripTags(s) {
  return (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// Bóc tách bảng đáp án từ khối HTML (hỗ trợ cả dạng text: 1-D 2-B, 1.D 2.D,
// và dạng bảng table: 1 hàng số/1 hàng chữ hoặc cột xen kẽ).
function parseAnswerKeyFromHtml(blocksHtml) {
  const answerMap = {};
  const answerList = [];

  // 1. Khớp chuỗi trực tiếp: "1-D", "1.D", "1:D", "1) D", "1 D", "Câu 1: D", "Câu 1. D", "Câu 1 - D"
  const pairRegex = /(?:\b(?:Câu\s*)?(\d{1,3})\s*[-.:)]\s*([ABCD])\b|\b(\d{1,3})\s+([ABCD])\b)/gi;
  let match;
  while ((match = pairRegex.exec(blocksHtml)) !== null) {
    const num = parseInt(match[1] || match[3], 10);
    const ans = (match[2] || match[4]).toUpperCase();
    if (!answerMap[num]) {
      answerMap[num] = ans;
    }
  }

  // 2. Bóc tách cấu trúc <table> nếu có
  const tableMatches = blocksHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const tableHtml of tableMatches) {
    const rows = [];
    const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const rHtml of rowMatches) {
      const cellMatches = rHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || [];
      const cells = cellMatches.map((c) => stripTags(c));
      if (cells.length > 0) rows.push(cells);
    }

    for (let r = 0; r < rows.length; r++) {
      const currentRow = rows[r];
      const nextRow = rows[r + 1];

      // Trường hợp bảng 2 hàng ngang (Hàng trên: Câu 1, 2, 3... - Hàng dưới: A, B, C...)
      if (nextRow && currentRow.length === nextRow.length) {
        const tempPairs = [];
        for (let c = 0; c < currentRow.length; c++) {
          const numMatch = currentRow[c].match(/^(?:Câu\s*)?(\d{1,3})$/i);
          const ansMatch = nextRow[c].match(/^(?:Đáp\s*án\s*)?([ABCD])$/i);
          if (numMatch && ansMatch) {
            tempPairs.push({ num: parseInt(numMatch[1], 10), ans: ansMatch[1].toUpperCase() });
          }
        }
        if (tempPairs.length > 0) {
          tempPairs.forEach((p) => {
            if (!answerMap[p.num]) answerMap[p.num] = p.ans;
          });
          r++;
          continue;
        }
      }

      // Trường hợp bảng 2 cột dọc [1, A] hoặc [Câu 1, A]
      if (currentRow.length === 2) {
        const numMatch = currentRow[0].match(/(?:Câu\s*)?(\d{1,3})/i);
        const ansMatch = currentRow[1].match(/^([ABCD])$/i);
        if (numMatch && ansMatch) {
          const num = parseInt(numMatch[1], 10);
          if (!answerMap[num]) answerMap[num] = ansMatch[1].toUpperCase();
          continue;
        }
      }

      // Trường hợp bảng nhiều cột xen kẽ [1, D, 2, B...] hoặc [Câu 1, D, Câu 2, B...]
      if (currentRow.length >= 2 && currentRow.length % 2 === 0) {
        let isAlternating = true;
        const tempPairs = [];
        for (let c = 0; c < currentRow.length; c += 2) {
          const numMatch = currentRow[c].match(/(?:Câu\s*)?(\d{1,3})/i);
          const ansMatch = currentRow[c + 1].match(/^(?:Đáp\s*án\s*)?([ABCD])$/i);
          if (numMatch && ansMatch) {
            tempPairs.push({ num: parseInt(numMatch[1], 10), ans: ansMatch[1].toUpperCase() });
          } else {
            isAlternating = false;
            break;
          }
        }
        if (isAlternating && tempPairs.length > 0) {
          tempPairs.forEach((p) => {
            if (!answerMap[p.num]) answerMap[p.num] = p.ans;
          });
        }
      }
    }
  }

  const keys = Object.keys(answerMap).map(Number).sort((a, b) => a - b);
  keys.forEach((k) => {
    answerList.push(answerMap[k]);
  });

  return { answerMap, answerList };
}

// Bước 3: tách chuỗi HTML thành từng chủ đề, mỗi chủ đề gồm các câu hỏi bắt đầu từ Câu 1
// cùng bộ đáp án tương ứng của chủ đề đó.
function parseQuestionsFromHtml(html) {
  const blockRegex = /<(p|table|h[1-6]|div|ul|ol)[^>]*>[\s\S]*?<\/\1>/gi;
  const rawBlocks = html.match(blockRegex) || [];

  const isAnswerKeyHeader = (text) =>
    /BẢNG\s*ĐÁP\s*ÁN|ĐÁP\s*ÁN|HƯỚNG\s*DẪN\s*GIẢI|LỜI\s*GIẢI/i.test(text);

  const isQuestionStart = (block, text) => {
    if (block.startsWith('<table')) return false;
    return /^[.\s]*Câu\s*\d+/i.test(text);
  };

  const sections = [];
  let currentSection = {
    topic: 'Kiến thức chung',
    questions: [],
    answerKeyBlocks: [],
    inAnswerKey: false,
  };

  function finishCurrentSection() {
    if (currentSection.questions.length > 0 || currentSection.answerKeyBlocks.length > 0) {
      sections.push(currentSection);
    }
  }

  for (const block of rawBlocks) {
    const text = stripTags(block);
    if (!text && !block.includes('<img') && !block.includes('<table')) continue;

    // 1. Tiêu đề chủ đề / chuyên đề / dạng toán
    const topicHeadingMatch = text.match(/^(?:CHỦ\s*ĐỀ|CHUYÊN\s*ĐỀ|DẠNG\s*TOÁN|DẠNG|PHẦN|BÀI)\s*\d*\s*[:.-]?\s*(.*)/i);
    if (topicHeadingMatch && !isQuestionStart(block, text)) {
      const extracted = topicHeadingMatch[1].trim() || text;
      if (currentSection.questions.length > 0) {
        finishCurrentSection();
        currentSection = {
          topic: extracted || 'Kiến thức chung',
          questions: [],
          answerKeyBlocks: [],
          inAnswerKey: false,
        };
      } else {
        currentSection.topic = extracted || 'Kiến thức chung';
      }
      continue;
    }

    // 2. Tiêu đề bảng đáp án
    if (isAnswerKeyHeader(text) && !isQuestionStart(block, text)) {
      currentSection.inAnswerKey = true;
      currentSection.answerKeyBlocks.push(block);
      continue;
    }

    // 3. Bắt đầu câu hỏi mới (ví dụ: Câu 1., Câu 2:...)
    if (isQuestionStart(block, text)) {
      const qNumMatch = text.match(/^[.\s]*Câu\s*(\d+)/i);
      const qNum = qNumMatch ? parseInt(qNumMatch[1], 10) : (currentSection.questions.length + 1);

      // Nếu đang ở phần đáp án của chủ đề trước, hoặc câu hỏi đánh số quay lại Câu 1
      if (currentSection.inAnswerKey || (qNum === 1 && currentSection.questions.length > 0)) {
        finishCurrentSection();
        currentSection = {
          topic: currentSection.topic,
          questions: [],
          answerKeyBlocks: [],
          inAnswerKey: false,
        };
      }

      currentSection.inAnswerKey = false;
      currentSection.questions.push({ qNum, blocks: [block] });
      continue;
    }

    // 4. Đang trong chế độ bảng đáp án
    if (currentSection.inAnswerKey) {
      currentSection.answerKeyBlocks.push(block);
      continue;
    }

    // 5. Nội dung tiếp theo của câu hỏi hiện tại
    if (currentSection.questions.length > 0) {
      const inlineTopicMatch = text.match(/^(?:chủ\s*đề|chuyên\s*đề|dạng\s*toán|dạng|tag)[\s.:]+(.*)/i);
      if (inlineTopicMatch && inlineTopicMatch[1].trim()) {
        currentSection.topic = inlineTopicMatch[1].trim();
      }
      const lastQ = currentSection.questions[currentSection.questions.length - 1];
      lastQ.blocks.push(block);
    }
  }
  finishCurrentSection();

  // Đa số đáp án A/B/C/D được in đậm trong file gốc, nhưng một số phần lại
  // gõ dạng chữ thường - thử nhận diện kiểu in đậm trước, nếu không đủ 4 thì thử chữ thường.
  const OPTION_MARKER_STRICT = /<strong>\s*([ABCD])\s*[.:)]\s*<\/strong>/g;
  const OPTION_MARKER_LOOSE = /(?<=^|[\s>])([ABCD])\s*[.:)](?=\s|<)/g;
  const CAU_PREFIX_RE = /^(<p[^>]*>)?[.\s]*(?:<strong>)?\s*Câu\s*\d+\s*[.:]?\s*(?:<\/strong>)?/i;

  function findMarkers(groupHtml, regex) {
    regex.lastIndex = 0;
    const found = [];
    let m;
    while ((m = regex.exec(groupHtml)) !== null) {
      found.push({ key: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
    }
    return found;
  }

  const finalQuestions = [];
  let globalIndex = 0;

  for (const section of sections) {
    const sectionAnswerKeyHtml = section.answerKeyBlocks.join(' ');
    const { answerMap, answerList } = parseAnswerKeyFromHtml(sectionAnswerKeyHtml);

    section.questions.forEach((rq, qIdx) => {
      const groupHtml = rq.blocks.join(' ');
      const warnings = [];

      let markers = findMarkers(groupHtml, OPTION_MARKER_STRICT);
      if (markers.length < 4) {
        const looseMarkers = findMarkers(groupHtml, OPTION_MARKER_LOOSE);
        if (looseMarkers.length > markers.length) markers = looseMarkers;
      }

      let contentHtml = groupHtml;
      const options = [];

      if (markers.length >= 4) {
        // Nội dung câu hỏi là phần trước marker đáp án đầu tiên
        contentHtml = groupHtml.slice(0, markers[0].start);
        contentHtml = contentHtml.replace(CAU_PREFIX_RE, '');

        const seenKeys = new Set();
        markers.forEach((marker, i) => {
          const nextStart = i + 1 < markers.length ? markers[i + 1].start : groupHtml.length;
          let optionHtml = groupHtml.slice(marker.end, nextStart).trim();
          optionHtml = optionHtml.replace(/^[.\s]+/, '').replace(/[.\s]+$/, (m) => (m.includes('<') ? m : ''));
          if (!seenKeys.has(marker.key)) {
            seenKeys.add(marker.key);
            options.push({ key: marker.key, html: optionHtml });
          }
        });

        if (options.length !== 4) {
          warnings.push('Số đáp án tách được khác 4, vui lòng kiểm tra lại.');
        }
      } else {
        contentHtml = contentHtml.replace(CAU_PREFIX_RE, '');
        warnings.push('Không tách được đủ 4 đáp án A/B/C/D, vui lòng nhập tay.');
      }

      if (groupHtml.includes('data-missing-formula')) {
        warnings.push('Có công thức chưa chuyển đổi được (thiếu LibreOffice hoặc lỗi chuyển đổi) - vui lòng chèn lại công thức.');
      }

      // Khớp đáp án theo số thứ tự câu trong chủ đề này (rq.qNum)
      let suggestedAnswer = answerMap[rq.qNum] || null;
      if (!suggestedAnswer && answerList.length > qIdx) {
        suggestedAnswer = answerList[qIdx];
      }

      if (answerList.length > 0 && answerList.length !== section.questions.length && !suggestedAnswer) {
        warnings.push(
          `Bảng đáp án chủ đề có ${answerList.length} đáp án nhưng tách được ${section.questions.length} câu hỏi.`
        );
      }

      finalQuestions.push({
        tempId: `import-${globalIndex}`,
        tag: section.topic || 'Kiến thức chung',
        topic: section.topic || 'Kiến thức chung',
        qNum: rq.qNum || (qIdx + 1),
        contentHtml: contentHtml.trim(),
        options:
          options.length === 4
            ? options
            : ['A', 'B', 'C', 'D'].map((key) => options.find((o) => o.key === key) || { key, html: '' }),
        suggestedAnswer: suggestedAnswer || null,
        warnings,
      });

      globalIndex++;
    });
  }

  return finalQuestions;
}

// Hàm chính: nhận buffer file .docx, trả về danh sách câu hỏi nháp.
async function importExamFromDocx(docxBuffer) {
  const hashToPng = await buildWmfPngMap(docxBuffer);
  const html = await convertDocxToHtml(docxBuffer, hashToPng);
  const questions = parseQuestionsFromHtml(html);

  return {
    questions,
    libreOfficeAvailable: wmfConvertService.isLibreOfficeAvailable(),
  };
}

module.exports = { importExamFromDocx, parseQuestionsFromHtml };
