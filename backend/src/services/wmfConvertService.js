// Chuyển đổi ảnh công thức Toán dạng WMF (định dạng cũ của Windows
// Equation Editor/MathType, trình duyệt KHÔNG hiển thị được) sang PNG bằng
// LibreOffice chạy chế độ headless (--headless --convert-to png).
//
// Yêu cầu: máy chạy backend phải cài LibreOffice (miễn phí,
// https://www.libreoffice.org/download/download/). Nếu chưa cài, các câu
// hỏi có công thức sẽ thiếu ảnh và cần giáo viên tự chèn công thức lại
// bằng tay ở bước kiểm tra sau khi tải lên.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const sharp = require('sharp');
const wmfFontParser = require('./wmfFontParser');

// Tăng kích thước lô để giảm số lần khởi động LibreOffice, tăng tốc xử lý x3-x5 lần
const BATCH_SIZE = 100;
// Thời gian chờ tối đa cho 1 lần gọi LibreOffice.
const SOFFICE_TIMEOUT_MS = 60000;

// Các đường dẫn cài đặt mặc định của LibreOffice trên Windows/macOS/Linux
const CANDIDATE_PATHS = [
  process.env.LIBREOFFICE_PATH,
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
  'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  'soffice', // dựa vào PATH nếu có
].filter(Boolean);

let cachedSofficePath = null;
let sofficeChecked = false;

function findSofficePath() {
  if (sofficeChecked) return cachedSofficePath;
  sofficeChecked = true;
  for (const candidate of CANDIDATE_PATHS) {
    if (candidate === 'soffice' || fs.existsSync(candidate)) {
      cachedSofficePath = candidate;
      break;
    }
  }
  return cachedSofficePath;
}

function isLibreOfficeAvailable() {
  return Boolean(findSofficePath());
}

// ---- 2 tầng tính kích thước hiển thị (Bước 31) ----
//
// TẦNG 1 (chính xác nhất, ưu tiên dùng khi có): dựa vào CỠ CHỮ THẬT (point
// size) đọc trực tiếp từ file WMF/EMF gốc qua `wmfFontParser` - đây là dữ
// liệu GỐC do MathType ghi ra, không phải suy đoán qua ảnh đã raster hoá.
//   - `EM_PER_PT`: quy đổi 1pt cỡ chữ MathType sang em hiển thị cho 1 DÒNG
//     công thức đơn (không tính phần tầng cao thêm do phân số/hệ pt) - hằng
//     số này KHÔNG đổi theo nội dung, chỉ đổi theo cỡ chữ thật giáo viên đã
//     gõ, nên phản ánh ĐÚNG ý định của người soạn (công thức nào giáo viên
//     gõ chữ to hơn thì hiển thị to hơn thật, không còn "ép đồng nhất" kiểu
//     Bước 28 hay "đoán qua pixel" kiểu Bước 24-27/30 nữa).
//   - `pxPerPt` (hiệu chỉnh riêng cho TỪNG LƯỢT import, xem
//     `calibratePxPerPt`): ước lượng "1pt cỡ chữ MathType tương ứng bao
//     nhiêu pixel gốc" bằng cách lấy trung vị (median) tỉ lệ
//     (chiều cao ảnh gốc / cỡ chữ pt) trên toàn bộ ảnh công thức của CHÍNH
//     file Word đang import - vì đa số công thức trong 1 đề là công thức 1
//     dòng, trung vị này xấp xỉ đúng "1 dòng cao bao nhiêu px ứng với 1pt"
//     tại độ phân giải LibreOffice xuất ra, KHÔNG cần biết trước DPI chính
//     xác của LibreOffice (tự hiệu chỉnh theo từng lượt chuyển đổi).
//   - Từ đó suy ra "hệ số tầng" (stackFactor) = chiều cao ảnh gốc / (cỡ chữ
//     pt × pxPerPt) - xấp xỉ 1 với công thức 1 dòng, xấp xỉ 2+ với phân số/
//     hệ phương trình nhiều tầng - nhân thêm vào cỡ hiển thị cơ sở để phân
//     số/hệ phương trình vẫn cao hơn hẳn công thức 1 dòng như mong đợi.
//
// TẦNG 2 (dự phòng): nếu KHÔNG đọc được cỡ chữ thật (file không có
// Placeable Header, định dạng lạ, EMF thiếu thông tin DPI...) - quay lại
// cách quy đổi tuyến tính thuần theo pixel như Bước 30, đảm bảo luôn có kết
// quả hợp lý dù không phân tích được font.
// Xuất PNG ở độ phân giải CAO HƠN mặc định của LibreOffice (qua tham số
// PixelWidth/PixelHeight của draw_png_Export) từng được thử (x2, x3) để ảnh
// công thức nét hơn - đã TẮT vì tốc độ đổi lấy được không đáng: x2 mất
// ~112s, x3 mất ~172s cho 1 đề ~143 công thức, so với mặc định NHANH HƠN
// NHIỀU LẦN - ưu tiên tốc độ theo yêu cầu, giữ lại PNG_RENDER_SCALE=1 (dùng
// đúng độ phân giải mặc định của LibreOffice, không đổi filter xuất ảnh) để
// dễ bật lại sau này nếu cần (chỉ cần đổi số này) mà không phải viết lại các
// hằng số PX_TO_EM/PX_PER_PT phụ thuộc bên dưới.
const PNG_RENDER_SCALE = 1;
const PNG_EXPORT_FILTER = PNG_RENDER_SCALE === 1
  ? 'png'
  : `png:draw_png_Export:{"PixelWidth":{"type":"long","value":"${992 * PNG_RENDER_SCALE}"},"PixelHeight":{"type":"long","value":"${1403 * PNG_RENDER_SCALE}"}}`;

const EM_PER_PT = 0.135; // 1pt cỡ chữ MathType -> bao nhiêu em cho 1 dòng công thức
// Các hằng số dưới đây đo bằng PIXEL THẬT trên ảnh xuất ra - phải nhân theo
// đúng PNG_RENDER_SCALE ở trên để khớp với độ phân giải mới, nếu không toàn
// bộ ngưỡng phân loại "hình vẽ" / cỡ chữ dự phòng sẽ tính sai theo tỉ lệ 3
// lần đã tăng lên.
const GLOBAL_PX_TO_EM = 0.043 / PNG_RENDER_SCALE; // dự phòng (Tầng 2): 1px chiều cao gốc -> bao nhiêu em
const MIN_FORMULA_HEIGHT_EM = 1.1;
const MAX_FORMULA_HEIGHT_EM = 4.8;
const DEFAULT_FORMULA_HEIGHT_EM = 1.55; // dùng khi không đo được kích thước gốc (ảnh lỗi/thiếu)
const DEFAULT_FORMULA_VALIGN_EM = -0.3;
const DEFAULT_PX_PER_PT = 3.8 * PNG_RENDER_SCALE; // dùng khi 1 lượt import không có đủ mẫu để tự hiệu chỉnh

function clampHeightEm(raw) {
  return Math.min(MAX_FORMULA_HEIGHT_EM, Math.max(MIN_FORMULA_HEIGHT_EM, raw));
}

function valignForHeight(heightEm) {
  return Math.max(-1.5, Math.min(-0.15, -(heightEm * 0.27)));
}

function finalizeSize(displayHeightEmRaw) {
  const displayHeightEm = clampHeightEm(displayHeightEmRaw);
  return {
    displayHeightEm: Number(displayHeightEm.toFixed(3)),
    verticalAlignEm: Number(valignForHeight(displayHeightEm).toFixed(3)),
  };
}

// Tầng 2 (dự phòng, không có cỡ chữ thật) - dùng cho nhánh ảnh PNG/JPEG
// nhúng thẳng (không phải WMF/EMF nên không đọc được LOGFONT), hoặc khi
// không đọc được cỡ chữ từ WMF/EMF. Cũng áp dụng cổng `hasMultipleBands`
// tương tự Tầng 1: nội dung 1 dòng thật (dù khung bao có bị phồng do đặc
// thù font) luôn quy về 1 chiều cao chuẩn nhỏ, không suy ra tỉ lệ trực tiếp
// từ pixel nữa (vốn là nguồn gốc mọi sai lệch trước đây).
function computeFormulaSize(nativeHeightPx, hasMultipleBands) {
  if (!nativeHeightPx || nativeHeightPx <= 0) {
    return { displayHeightEm: DEFAULT_FORMULA_HEIGHT_EM, verticalAlignEm: DEFAULT_FORMULA_VALIGN_EM };
  }
  if (!hasMultipleBands) return finalizeSize(DEFAULT_FORMULA_HEIGHT_EM);
  return finalizeSize(nativeHeightPx * GLOBAL_PX_TO_EM);
}

// Đếm số "dải mực" (band) theo chiều dọc để xác nhận có THẬT SỰ nhiều tầng
// (phân số/hệ phương trình) hay chỉ là 1 dòng công thức đơn. Dùng làm CỔNG
// XÁC NHẬN cho stackFactor: chỉ khi bandCount >= 2 mới cho phép ảnh cao hơn
// "1 dòng chuẩn" - nếu không, dù khung bao WMF có bị "phồng" do đặc thù font
// (số đơn, biểu thức ngắn) vẫn luôn quy về đúng 1 cỡ chuẩn.
//
// MẤU CHỐT (Bước 33, sửa lỗi nhận nhầm): phân biệt "hàng có mực" và "hàng
// khoảng ngăn" phải dựa vào ĐỘ ĐẬM (giá trị pixel tối nhất trong hàng đó),
// KHÔNG dựa vào MẬT ĐỘ (tỉ lệ % số điểm ảnh tối trên cả hàng) như bản đầu.
// Lý do: nhiều ký tự Toán có NÉT VẼ MẢNH nhưng THẬT SỰ ĐEN (VD: nét chéo
// trong số "4", nét dọc mảnh của chữ "π") - dù chỉ chiếm 5-10% bề rộng
// hàng đó (mật độ thấp), các điểm ảnh đó vẫn ĐEN TUYỆT ĐỐI (giá trị gần 0)
// - nếu dùng ngưỡng mật độ sẽ bị coi nhầm là "khoảng ngăn" dù thực chất là
// 1 phần của CÙNG 1 ký tự, tách nhầm 1 dòng công thức thành 2 "dải" ảo.
// Ngược lại, khoảng ngăn THẬT giữa tử số/mẫu số dù có dính chút màu xám mờ
// do khử răng cưa (anti-alias) ở độ phân giải thấp thì độ đậm của những
// điểm ảnh đó vẫn RẤT NHẠT (gần trắng, không có điểm nào thật sự đen) - đây
// mới là tín hiệu phân biệt đáng tin cậy: hàng có ít nhất 1 điểm ảnh ĐEN
// THẬT (dưới ngưỡng tối) luôn được coi là "có mực", bất kể chiếm bao nhiêu %
// bề rộng.
async function countInkBands(pngBuffer, width, height) {
  const { data } = await sharp(pngBuffer).greyscale().raw().toBuffer({ resolveWithObject: true });
  const TRUE_INK_THRESHOLD = 140; // điểm ảnh tối hơn ngưỡng này coi là "nét vẽ thật", không phải nhiễu khử răng cưa

  const inkRows = new Array(height).fill(false);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    let minVal = 255;
    for (let x = 0; x < width; x += 1) {
      const v = data[rowOffset + x];
      if (v < minVal) minVal = v;
    }
    inkRows[y] = minVal < TRUE_INK_THRESHOLD;
  }

  if (!inkRows.some(Boolean)) return 0;

  // Ngưỡng gộp khoảng ngăn "quá hẹp" (nhiễu/răng cưa) - GIỚI HẠN TRẦN cố định (6px), KHÔNG
  // để tỉ lệ 8% chiều cao tăng vô hạn theo ảnh càng cao: hệ phương trình 2-3 dòng (ngoặc
  // nhọn) thường xếp dòng khá SÁT nhau (khoảng ngăn thật giữa các dòng chỉ ~5-8px dù ảnh
  // tổng thể cao 150-200px do có 3 dòng) - nếu để ngưỡng tỉ lệ theo % chiều cao TOÀN ẢNH như
  // trước (8% của 150-200px = 12-16px), khoảng ngăn thật giữa các dòng bị coi là "quá hẹp"
  // rồi gộp nhầm thành 1 dải mực liên tục, khiến hệ 3 dòng bị tính nhầm thành "1 dòng đơn"
  // và hiển thị nhỏ sai (dù đúng là có xếp tầng thật).
  const MIN_GAP_HEIGHT = Math.min(6, Math.max(2, Math.round(height * 0.08)));

  // Gộp các khoảng ngăn quá hẹp (nhiễu/răng cưa 1-2 hàng) lại thành "có
  // mực", chỉ giữ khoảng ngăn đủ cao làm ranh giới tầng thật.
  let y = 0;
  while (y < height) {
    if (!inkRows[y]) {
      let gapEnd = y;
      while (gapEnd < height && !inkRows[gapEnd]) gapEnd += 1;
      if (gapEnd - y < MIN_GAP_HEIGHT) {
        for (let k = y; k < gapEnd; k += 1) inkRows[k] = true;
      }
      y = gapEnd;
    } else {
      y += 1;
    }
  }

  let bandCount = 0;
  let inBand = false;
  for (let i = 0; i < height; i += 1) {
    if (inkRows[i] && !inBand) {
      inBand = true;
      bandCount += 1;
    } else if (!inkRows[i] && inBand) {
      inBand = false;
    }
  }
  return bandCount;
}

// Tầng 1 (chính xác, có cỡ chữ thật từ WMF/EMF) - stackFactor phản ánh ảnh
// này cao gấp bao nhiêu lần "1 dòng chuẩn" của đúng cỡ chữ đó, nhưng CHỈ
// được phép > 1 khi `hasMultipleBands` xác nhận thật sự có từ 2 tầng mực
// tách rời trở lên (phân số/hệ phương trình) - nếu không, luôn coi là 1
// dòng chuẩn (loại bỏ hoàn toàn ảnh hưởng của khung bao bị "phồng" giả tạo
// do đặc thù font MathType với nội dung ngắn/đơn lẻ).
function computeFormulaSizeFromFont(nativeHeightPx, fontSizePt, pxPerPt, hasMultipleBands) {
  const baseEm = fontSizePt * EM_PER_PT;
  if (!hasMultipleBands) return finalizeSize(baseEm);

  const expectedSingleLineHeightPx = fontSizePt * pxPerPt;
  const stackFactor = expectedSingleLineHeightPx > 0
    ? Math.max(1, nativeHeightPx / expectedSingleLineHeightPx)
    : 1;
  return finalizeSize(baseEm * Math.min(stackFactor, 4));
}

// ---- CÁCH TÍNH CHÍNH (Bước 34): theo CỠ CHỮ THẬT + DÒNG CHÂN CHỮ đọc từ SVG ----
//
// Vì sao các cách cũ bên dưới cho cỡ "chữ to chữ nhỏ": chúng ép MỌI công
// thức 1 dòng về cùng 1 chiều cao cố định (1.55em). Nhưng ảnh PNG đã được cắt
// sát nét mực, nên chiều cao ảnh phụ thuộc NỘI DUNG: số "1" chỉ cao bằng
// chữ hoa (bị phóng to gấp đôi chữ thường), còn "S=(2/3;3)" có phân số trong
// ngoặc lớn (ngoặc nối liền nên đếm mực ra 1 dải) bị ép nhỏ xíu. Ngoài ra
// LibreOffice còn tự PHÓNG TO những công thức nhỏ hơn 1 inch (số đơn lẻ có
// thể bị vẽ to gấp 3 lần công thức dài) nên số pixel không so sánh được
// giữa các ảnh.
//
// Cách mới: SVG do LibreOffice xuất cho CHÍNH công thức đó dùng CÙNG bố cục
// trang với PNG (A4, công thức đặt giữa trang, cùng tỉ lệ phóng) và ghi rõ
// từng đoạn chữ: font, cỡ chữ, toạ độ dòng chân chữ (baseline). Từ đó:
//   - cỡ chữ chính (px trên ảnh PNG) = cỡ lớn nhất của các font chữ/biến số
//     (bỏ qua font ký hiệu như Symbol vì MathType phóng to chúng để vẽ ngoặc
//     lớn) -> chiều cao hiển thị = chiều cao ảnh / cỡ chữ chính, tính bằng em.
//     Nhờ vậy chữ trong MỌI công thức luôn cùng cỡ với chữ của câu hỏi, còn
//     phân số/hệ phương trình tự cao hơn đúng theo thực tế.
//   - dòng chân chữ = toạ độ y của nhóm chữ cỡ chính có nhiều ký tự nhất ->
//     vertical-align để chữ trong công thức nằm đúng hàng với chữ xung quanh.
//     Không xác định được (VD: chỉ có 1 phân số) thì canh tâm ảnh theo trục
//     giữa dòng chữ, giống cách TeX canh phân số.
// FORMULA_EM_SCALE: chữ Times New Roman của MathType có phần thân thấp hơn
// font giao diện, nhân 1.2 để chữ số/chữ cái trong công thức cao bằng chữ
// thường xung quanh (đã so trực quan với các mức 1.1/1.2/1.3).
const FORMULA_EM_SCALE = 1.2;
const SYMBOL_FONT_RE = /symbol|extra|wingdings|webdings|marlett|system/i;
const DECORATION_FONT_RE = /extra/i;
const MATH_AXIS_EM = 0.27; // trục giữa dòng chữ (ngang dấu "=") cao hơn chân chữ ~0.27em

// Font Symbol được LibreOffice xuất ra vùng mã riêng U+F0xx (byte thấp = mã
// ký tự gốc trong font Symbol); 0xE6-0xFE là các mảnh ghép ngoặc/ngoặc nhọn.
function isBracketPieceRun(run) {
  if (!SYMBOL_FONT_RE.test(run.family) || !run.text) return false;
  return [...run.text].every((ch) => {
    const code = ch.codePointAt(0) & 0xff;
    return code >= 0xe6 && code <= 0xfe;
  });
}

function parseSvgFormulaLayout(svgText) {
  const vb = svgText.match(/<svg[^>]*\sviewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!vb) return null;
  const viewBoxWidth = parseFloat(vb[1]);
  const viewBoxHeight = parseFloat(vb[2]);
  if (!viewBoxWidth || !viewBoxHeight) return null;

  const runs = [];
  const re = /<tspan class="TextPosition" x="(-?[\d.]+)" y="(-?[\d.]+)"><tspan font-family="([^"]*)" font-size="([\d.]+)px"[^>]*>([^<]*)/g;
  let m;
  while ((m = re.exec(svgText))) {
    runs.push({ y: parseFloat(m[2]), family: m[3], size: parseFloat(m[4]), text: m[5] });
  }
  return { viewBoxWidth, viewBoxHeight, runs };
}

// `png`: { rawHeight } = chiều cao trang PNG gốc LibreOffice xuất (chưa cắt),
// `inkTop` = toạ độ y (px trên trang) của mép trên nét mực, `height` = chiều
// cao ảnh đã cắt (gồm 1px đệm trên + 1px đệm dưới, xem trimWhitespace).
function computeFormulaSizeFromLayout(layout, png) {
  if (!layout || !layout.runs || layout.runs.length === 0) return null;
  if (!png || !png.rawHeight || !png.height || png.inkTop == null) return null;

  const pxPerUnit = png.rawHeight / layout.viewBoxHeight;
  const { runs } = layout;
  const textRuns = runs.filter((r) => !SYMBOL_FONT_RE.test(r.family));
  let mainSize;
  if (textRuns.length > 0) {
    mainSize = Math.max(...textRuns.map((r) => r.size));
  } else {
    const sizes = runs.map((r) => r.size).sort((a, b) => a - b);
    mainSize = sizes[Math.floor(sizes.length / 2)];
  }
  const mainPx = mainSize * pxPerUnit;
  if (!(mainPx > 2)) return null;

  const imgTop = png.inkTop - 1; // 1px đệm phía trên
  const heightRatio = png.height / mainPx;
  if (!Number.isFinite(heightRatio) || heightRatio <= 0 || heightRatio > 15) return null;

  // Nhóm các đoạn chữ cỡ chính theo dòng chân chữ, trọng số = số ký tự. Bỏ
  // qua các MẢNH NGOẶC (MathType ghép ngoặc/ngoặc nhọn lớn từ nhiều ký tự
  // Symbol mã 0xE6-0xFE xếp chồng, toạ độ y của chúng không phải chân chữ).
  // Bỏ cả font "Extra" (MT Extra, Euclid Extra): MathType dùng chúng để vẽ
  // ký hiệu trang trí NẰM TRÊN chữ - mũi tên vectơ (ghép từ nhiều ký tự,
  // VD "uuur" cho mỗi mũi tên), dấu mũ, dấu phẩy trên - nhiều ký tự hơn cả
  // chữ cái nên sẽ bị chọn nhầm làm dòng chính.
  const fullSizeRuns = runs.filter(
    (r) => r.size >= mainSize * 0.85
      && r.size <= mainSize * 1.15
      && !isBracketPieceRun(r)
      && !DECORATION_FONT_RE.test(r.family)
  );
  const tolerance = mainSize * 0.08;
  const groups = [];
  fullSizeRuns.forEach((r) => {
    const weight = Math.max(1, [...r.text].length);
    const g = groups.find((gg) => Math.abs(gg.y - r.y) <= tolerance);
    if (g) g.weight += weight;
    else groups.push({ y: r.y, weight });
  });

  // Dòng chính = "trung vị theo số ký tự" của các dòng, xếp từ trên xuống:
  // tử số nằm trên, mẫu số nằm dưới, dòng chính (chứa dấu =, <, ...) nằm
  // giữa. Chia đôi đúng bằng nhau (VD phân số đơn 2/3) thì không có dòng
  // chính -> canh tâm ảnh theo trục giữa dòng chữ.
  groups.sort((a, b) => a.y - b.y);
  const totalWeight = groups.reduce((sum, g) => sum + g.weight, 0);
  let mainGroup = null;
  let cumulative = 0;
  for (const g of groups) {
    const before = cumulative;
    cumulative += g.weight;
    if (cumulative > totalWeight / 2) {
      mainGroup = before === totalWeight / 2 ? null : g;
      break;
    }
  }

  const baselinePx = mainGroup
    ? mainGroup.y * pxPerUnit
    : imgTop + png.height / 2 + MATH_AXIS_EM * mainPx;

  const displayHeightEm = heightRatio * FORMULA_EM_SCALE;
  const descentEm = ((imgTop + png.height - baselinePx) / mainPx) * FORMULA_EM_SCALE;
  const verticalAlignEm = Math.min(0.5, Math.max(-displayHeightEm, -descentEm));
  return {
    displayHeightEm: Number(displayHeightEm.toFixed(3)),
    verticalAlignEm: Number(verticalAlignEm.toFixed(3)),
  };
}

// ---- TẦNG 0 cũ (nay là dự phòng): đo kích thước
// THẬT bằng cách chuyển đổi CHÍNH ảnh WMF/EMF đó sang SVG. LibreOffice khi
// convert-to svg vẫn bọc cả trang A4 xung quanh (giống PNG), nhưng bên trong
// luôn ghi kèm 1 thẻ <rect class="BoundingBox" x=".." y=".." width=".."
// height=".."/> - đây là khung bao SÁT nội dung công thức (kể cả phân số,
// hệ phương trình nhiều tầng), tính theo đúng đơn vị của viewBox, quy đổi
// thẳng ra mm rồi ra pt qua tỉ lệ width="Xmm" so với viewBox. Đây là số đo
// HÌNH HỌC THẬT do LibreOffice tự tính, không phải suy đoán qua mật độ điểm
// ảnh (ink band) hay dò byte LOGFONT trong file WMF như Tầng 1/2 bên dưới -
// nên chính xác tuyệt đối với MỌI loại công thức (1 dòng, phân số, hệ nhiều
// tầng...) mà không cần phân biệt trường hợp bằng heuristic nữa.
// LƯU Ý QUAN TRỌNG (phát hiện thực tế khi test với đề thi thật): cỡ chữ ghi
// trong file WMF/EMF ĐÔI KHI không phản ánh đúng kích thước hiển thị giáo
// viên thật sự muốn - vì Word cho phép kéo thu nhỏ/phóng to khung công thức
// bằng tay SAU KHI gõ xong (chỉ đổi kích thước hiển thị trong Word, không
// ghi đè lại metadata font gốc bên trong WMF). Vì vậy TUYỆT ĐỐI KHÔNG được
// dùng trực tiếp `bboxHeightPt` (số đo tuyệt đối) hay `fontSizePt` (số đo
// tuyệt đối) làm cỡ hiển thị - mà phải dùng TỈ LỆ giữa 2 số đo đó
// (bboxHeightPt / fontSizePt): tỉ lệ này KHÔNG đổi dù cả khối công thức có
// bị Word scale to/nhỏ bao nhiêu (vì cả tử và mẫu cùng scale theo 1 hệ số),
// nên vẫn phân biệt CHÍNH XÁC "1 dòng đơn" (tỉ lệ ~1.1-1.3) và "phân số/hệ
// nhiều tầng thật" (tỉ lệ vượt hẳn ~1.6 trở lên) bất kể font-size tuyệt đối
// ghi trong file lớn hay nhỏ thế nào.
function parseSvgBoundingBoxMetrics(svgText) {
  const pageMatch = svgText.match(
    /<svg[^>]*\swidth="([\d.]+)mm"\s+height="[\d.]+mm"\s+viewBox="0 0 ([\d.]+) [\d.]+"/
  );
  const boxMatch = svgText.match(/<rect class="BoundingBox"[^>]*\/>/);
  if (!pageMatch || !boxMatch) return null;

  const pageWidthMm = parseFloat(pageMatch[1]);
  const viewBoxWidth = parseFloat(pageMatch[2]);
  if (!pageWidthMm || !viewBoxWidth) return null;
  const mmPerUnit = pageWidthMm / viewBoxWidth;

  const heightAttr = boxMatch[0].match(/\sheight="([\d.]+)"/);
  if (!heightAttr) return null;
  const heightUnits = parseFloat(heightAttr[1]);
  if (!heightUnits) return null;

  const fontSizeMatches = [...svgText.matchAll(/font-size="([\d.]+)px"/g)].map((m) => parseFloat(m[1]));
  if (fontSizeMatches.length === 0) return null;
  const maxFontSizeUnits = Math.max(...fontSizeMatches);
  if (!maxFontSizeUnits) return null;

  return {
    heightPt: (heightUnits * mmPerUnit) / 0.352778, // 1pt = 0.352778mm
    fontSizePt: (maxFontSizeUnits * mmPerUnit) / 0.352778,
  };
}

// Ranh giới tỉ lệ (chiều cao khung bao / cỡ chữ lớn nhất) để phân biệt "1
// dòng công thức đơn" và "thật sự có xếp tầng" (phân số, hệ phương trình).
// Đo thực tế trên hàng chục công thức 1 dòng thật của đề thi mẫu cho tỉ lệ
// ổn định trong khoảng 1.08-1.27; đặt ngưỡng 1.4 để có biên an toàn.
const SINGLE_LINE_RATIO_THRESHOLD = 1.4;
// Tỉ lệ "chuẩn" của đúng 1 dòng, dùng làm mốc quy đổi hệ số phóng to cho
// phần vượt trội khi công thức thật sự nhiều tầng.
const SINGLE_LINE_RATIO_BASELINE = 1.2;

// `hasMultipleBands`: cổng xác nhận bằng đếm dải mực thật (xem `countInkBands`),
// GIỐNG HỆT cơ chế Tầng 1 (`computeFormulaSizeFromFont`) - bắt buộc phải có
// (mặc định coi là true nếu không truyền, để không phá các lệnh gọi cũ/test).
// Lý do bắt buộc: tỉ lệ bboxHeight/fontSize có thể bị "phồng" bởi các yếu tố
// KHÔNG PHẢI xếp tầng thật - ví dụ mũi tên vector phía trên $\vec{u}$, dấu mũ/
// gạch ngang, hoặc phần đệm (padding) riêng của LibreOffice khi render 1 ký
// tự đơn lẻ - khiến 1 dòng công thức thật bị tính nhầm thành "nhiều tầng" và
// phóng to sai. Chỉ khi ĐẾM MỰC xác nhận có >=2 dải mực tách rời (phân số/hệ
// phương trình thật) mới cho phép dùng stackFactor từ tỉ lệ SVG.
function computeFormulaSizeFromSvgRatio(metrics, hasMultipleBands = true) {
  if (!metrics || !metrics.heightPt || !metrics.fontSizePt) return null;
  if (!hasMultipleBands) return finalizeSize(DEFAULT_FORMULA_HEIGHT_EM);
  const ratio = metrics.heightPt / metrics.fontSizePt;
  if (ratio <= SINGLE_LINE_RATIO_THRESHOLD) {
    // 1 dòng đơn - LUÔN dùng cỡ chuẩn, bỏ qua font-size tuyệt đối (có thể
    // không đáng tin do bị Word scale tay như ghi chú ở trên).
    return finalizeSize(DEFAULT_FORMULA_HEIGHT_EM);
  }
  const stackFactor = Math.min(4, ratio / SINGLE_LINE_RATIO_BASELINE);
  return finalizeSize(DEFAULT_FORMULA_HEIGHT_EM * stackFactor);
}

// Trung vị tỉ lệ (chiều cao gốc px / cỡ chữ pt) trên các ảnh ĐÃ ĐỌC ĐƯỢC cỡ
// chữ thật trong cùng 1 lượt import - dùng làm "pxPerPt" hiệu chỉnh riêng
// cho lượt import đó (không cần biết trước DPI của LibreOffice).
function calibratePxPerPt(samples) {
  const ratios = samples
    .map((s) => (s.fontSizePt > 0 ? s.heightPx / s.fontSizePt : null))
    .filter((r) => r && Number.isFinite(r) && r > 0.5 && r < 30);
  if (ratios.length === 0) return DEFAULT_PX_PER_PT;
  ratios.sort((a, b) => a - b);
  const mid = Math.floor(ratios.length / 2);
  return ratios.length % 2 === 0 ? (ratios[mid - 1] + ratios[mid]) / 2 : ratios[mid];
}

// LibreOffice xuất WMF ra PNG kèm cả trang giấy trắng xung quanh (vì coi
// WMF như 1 trang tài liệu), khiến ảnh công thức to gấp hàng chục lần nội
// dung thật. Cắt bỏ phần viền trắng thừa để công thức hiển thị gọn, vừa
// với dòng chữ xung quanh trong câu hỏi. Chỉ trả về kích thước GỐC (đo
// được) - việc quy đổi ra cỡ hiển thị cuối cùng dồn về `convertWmfBuffersToPng`
// vì cần hiệu chỉnh `pxPerPt` dựa trên TOÀN BỘ ảnh trong cùng 1 lượt import.
async function trimWhitespace(pngBuffer) {
  try {
    const rawMeta = await sharp(pngBuffer).metadata();
    // lineArt: ảnh công thức là hình vẽ vector sạch, bỏ bước lọc nhiễu dành
    // cho ảnh chụp - nhanh hơn ~4 lần (48ms -> 11ms/ảnh) và không còn xén mất
    // các nét mảnh 1px nằm sát mép (gạch phân số, dấu mũ...).
    const { data: trimmed, info } = await sharp(pngBuffer)
      .trim({ background: '#ffffff', threshold: 10, lineArt: true })
      .extend({ top: 1, bottom: 1, left: 2, right: 2, background: '#ffffff' })
      .png()
      .toBuffer({ resolveWithObject: true });

    const w = info.width || 0;
    const h = info.height || 0;
    // Vị trí mép trên nét mực trên trang gốc - cần để đối chiếu với toạ độ
    // dòng chân chữ đọc từ SVG (xem computeFormulaSizeFromLayout).
    const inkTop = Number.isFinite(info.trimOffsetTop) ? -info.trimOffsetTop : null;

    // Đồ thị, bảng biến thiên, hình học (kích thước lớn thực sự) - loại này hiển thị theo
    // `diagram-img` (KHÔNG bị giới hạn chiều cao như công thức). Đo thực tế trên các đề mẫu
    // thật: mọi hình vẽ/đồ thị thật đều có CẢ 2 CHIỀU (rộng lẫn cao) từ 150px trở lên (nhỏ nhất
    // gặp: 228x232, 489x154) - trong khi công thức nhiều ký tự xếp dọc (vectơ, toạ độ điểm như
    // "(15;-16;17)", hệ nhiều tầng) có thể cao/rộng vượt 85-100px ở MỘT chiều nhưng KHÔNG BAO
    // GIỜ cả 2 chiều cùng lớn - trước đây chỉ cần 1 điều kiện 1 chiều đạt ngưỡng (đặc biệt
    // `h >= 85` không kèm điều kiện chiều rộng) đã đủ để bị nhận nhầm là "hình vẽ" và hiển thị
    // đúng kích thước pixel gốc không giới hạn, gây ra công thức bị phóng to bất thường (không
    // phải do sai kích thước tính toán, mà do bị nhận NHẦM LOẠI ẢNH). Yêu cầu CẢ 2 chiều đủ lớn
    // (hoặc diện tích thật lớn, cho hình chữ nhật dẹt) mới coi là hình vẽ thật.
    // Ngưỡng gốc đo được ở độ phân giải xuất PNG mặc định (150px/100px/40000px²)
    // - nhân theo PNG_RENDER_SCALE để khớp với ảnh xuất ra ở độ phân giải cao hơn hiện tại.
    const isDiagram = Boolean(
      (w >= 150 * PNG_RENDER_SCALE && h >= 100 * PNG_RENDER_SCALE) ||
      (w * h >= 40000 * PNG_RENDER_SCALE * PNG_RENDER_SCALE)
    );
    const bandCount = !isDiagram && w > 0 && h > 0 ? await countInkBands(trimmed, w, h) : 0;

    return {
      base64: trimmed.toString('base64'),
      isDiagram,
      width: w,
      height: h,
      bandCount,
      rawWidth: rawMeta.width || 0,
      rawHeight: rawMeta.height || 0,
      inkTop,
    };
  } catch (err) {
    console.error('Lỗi cắt ảnh công thức:', err.message);
    return {
      base64: pngBuffer.toString('base64'),
      isDiagram: false,
      width: 0,
      height: 0,
      bandCount: 0,
      rawWidth: 0,
      rawHeight: 0,
      inkTop: null,
    };
  }
}

function runSoffice(args, options = {}) {
  return new Promise((resolve, reject) => {
    const sofficePath = findSofficePath();
    execFile(sofficePath, args, { timeout: SOFFICE_TIMEOUT_MS, cwd: options.cwd }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`LibreOffice lỗi: ${err.message}\n${stderr}`));
      resolve(stdout);
    });
  });
}

// ---- TĂNG TỐC XỬ LÝ FILE (Bước 35) ----
//
// Đo thực tế 1 đề 340 công thức trên máy 8 luồng CPU: trước đây mất ~80
// giây, chủ yếu vì (1) mỗi lần import tạo 1 hồ sơ (profile) LibreOffice MỚI
// -> khởi động lạnh ~7 giây (hồ sơ đã dùng rồi chỉ ~2,5 giây), (2) toàn bộ
// ảnh PNG do đúng 1 tiến trình LibreOffice vẽ tuần tự (~120ms/ảnh), (3) cắt
// viền trắng chỉ bắt đầu sau khi cả lô 100 ảnh vẽ xong. Cách làm hiện tại:
//   - Mỗi tiến trình LibreOffice dùng 1 hồ sơ CỐ ĐỊNH lấy từ "bể" hồ sơ,
//     dùng lại giữa các lần import, và được khởi động sẵn ngay khi bật
//     server (warmUp) để lần import đầu tiên cũng không phải chờ.
//   - Chia ảnh cho nhiều tiến trình LibreOffice vẽ PNG SONG SONG; tiến
//     trình nào vẽ xong phần mình thì cắt viền ngay trong lúc các tiến
//     trình khác vẫn đang chạy.
//   - Cỡ chữ + dòng chân chữ đọc thẳng từ file WMF (wmfFontParser.
//     parseWmfTextLayout) thay vì chạy thêm 1 lượt LibreOffice xuất SVG chỉ
//     để đo - lượt SVG chỉ còn dùng cho file không đọc được (EMF, WMF lạ).
//   - Lưu kết quả từng công thức (theo mã băm nội dung file WMF/EMF) vào bộ
//     nhớ đệm trên đĩa: tải lại cùng file (VD sửa 1 lỗi chính tả rồi tải
//     lên lại) hoặc file khác có công thức trùng thì gần như tức thì.
// Hồ sơ và bộ nhớ đệm nằm trong thư mục tạm của hệ điều hành, KHÔNG nằm
// trong backend/ (nodemon theo dõi file .json trong backend/ và sẽ tự khởi
// động lại server giữa chừng nếu bộ nhớ đệm ghi vào đó).
const WORK_ROOT = path.join(os.tmpdir(), 'khkt-mathinsight');
const PROFILE_PARENT = path.join(WORK_ROOT, 'lo-profiles');
// Theo PID: 2 server chạy cùng lúc (hoặc tiến trình LibreOffice cũ còn sót
// sau khi nodemon khởi động lại) không bao giờ dùng chung 1 hồ sơ.
const PROFILE_ROOT = path.join(PROFILE_PARENT, `pid-${process.pid}`);
// Số tiến trình LibreOffice chạy song song = nửa số luồng CPU, tối đa 4. Đo
// trên máy 8 luồng (4 nhân): 340 ảnh mất 46s với 1 tiến trình, 28s với 2,
// 22s với 3, 18-20s với 4; chạy 6 tiến trình cùng lúc lại CHẬM hơn vì các
// tiến trình tranh nhau CPU.
const MAX_PARALLEL_SOFFICE = Math.max(2, Math.min(4, Math.floor(os.cpus().length / 2)));
// Không chia nhỏ hơn mức này - mỗi tiến trình tốn ~2,5s khởi động cố định.
const MIN_FILES_PER_WORKER = 12;

const profilePool = [];
let profileCounter = 0;

function acquireProfile() {
  let slot = profilePool.find((p) => !p.busy);
  if (!slot) {
    profileCounter += 1;
    slot = { dir: path.join(PROFILE_ROOT, `p${profileCounter}`), busy: false };
    profilePool.push(slot);
  }
  slot.busy = true;
  return slot;
}

// `broken`: tiến trình LibreOffice dùng hồ sơ này bị lỗi/quá thời gian -
// có thể còn sót tiến trình con đang giữ hồ sơ, bỏ hẳn hồ sơ đó cho an toàn.
function releaseProfile(slot, broken = false) {
  slot.busy = false;
  if (!broken) return;
  const idx = profilePool.indexOf(slot);
  if (idx >= 0) profilePool.splice(idx, 1);
  fs.rm(slot.dir, { recursive: true, force: true }, () => {});
}

// pathToFileURL cho đúng dạng URL trên mọi hệ điều hành: Windows ra
// file:///C:/..., Linux (server/Docker) ra file:///tmp/... - cách ghép chuỗi
// cũ sinh ra file:////tmp/... (4 dấu gạch) trên Linux, LibreOffice hiểu sai.
function profileArg(slot) {
  return `-env:UserInstallation=${pathToFileURL(slot.dir).href}`;
}

// Chạy LibreOffice cho 1 nhóm file (tên file tương đối trong `workDir`, giữ
// dòng lệnh ngắn) với 1 hồ sơ riêng, chia lô BATCH_SIZE file/lần gọi.
async function convertWithProfile(format, fileNames, workDir, outDir) {
  const slot = acquireProfile();
  let broken = false;
  try {
    for (let i = 0; i < fileNames.length; i += BATCH_SIZE) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await runSoffice(
          [profileArg(slot), '--headless', '--convert-to', format, '--outdir', outDir, ...fileNames.slice(i, i + BATCH_SIZE)],
          { cwd: workDir }
        );
      } catch (err) {
        broken = true;
        console.error(`LibreOffice (${format}) lỗi:`, err.message);
      }
    }
  } finally {
    releaseProfile(slot, broken);
  }
}

// Chia `items` thành `count` nhóm xen kẽ (công thức đầu/cuối đề thường dài
// ngắn khác nhau - chia xen kẽ để các tiến trình xong gần cùng lúc).
function splitInterleaved(items, count) {
  const groups = Array.from({ length: count }, () => []);
  items.forEach((item, i) => groups[i % count].push(item));
  return groups.filter((g) => g.length > 0);
}

// ---- Bộ nhớ đệm kết quả trên đĩa ----
// Phiên bản bộ nhớ đệm gắn với cách tính cỡ: đổi FORMULA_EM_SCALE hoặc độ
// phân giải xuất ảnh thì kết quả cũ tự động không dùng nữa.
const CACHE_DIR = path.join(WORK_ROOT, 'formula-cache', `b36-s${FORMULA_EM_SCALE}-r${PNG_RENDER_SCALE}`);
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function cacheKeyFor(item) {
  const buf = (item && item.buffer) ? item.buffer : item;
  const ext = (item && item.ext) ? item.ext : 'wmf';
  return crypto.createHash('sha1').update(ext).update(buf).digest('hex');
}

async function readCache(key) {
  try {
    return JSON.parse(await fs.promises.readFile(path.join(CACHE_DIR, `${key}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function writeCache(key, value) {
  try {
    await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(value));
  } catch (err) {
    console.error('Không ghi được bộ nhớ đệm công thức:', err.message);
  }
}

function pruneOldFiles(dir, maxAgeMs) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  entries.forEach((entry) => {
    const full = path.join(dir, entry.name);
    try {
      if (now - fs.statSync(full).mtimeMs > maxAgeMs) fs.rmSync(full, { recursive: true, force: true });
    } catch {
      // bỏ qua file đang bị khoá/đã xoá
    }
  });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0); // tín hiệu 0: chỉ kiểm tra tiến trình còn tồn tại, không gửi gì
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // có tồn tại nhưng không đủ quyền
  }
}

// Gọi 1 lần ngay sau khi server khởi động: dọn hồ sơ của các lần chạy
// trước, xoá bộ nhớ đệm quá 30 ngày, rồi khởi động sẵn các hồ sơ LibreOffice
// (chuyển 1 file SVG tí hon) để lần import đầu tiên không phải chờ khởi động
// lạnh. Chạy nền, lỗi gì cũng chỉ ghi log.
async function warmUp() {
  if (!isLibreOfficeAvailable()) return;

  // Chỉ dọn hồ sơ của các tiến trình server ĐÃ TẮT - server khác đang chạy
  // song song (VD 2 backend cùng lúc) vẫn đang dùng hồ sơ của nó.
  try {
    fs.readdirSync(PROFILE_PARENT).forEach((name) => {
      const pid = Number((name.match(/^pid-(\d+)$/) || [])[1]);
      if (!pid || pid === process.pid || isProcessAlive(pid)) return;
      fs.rm(path.join(PROFILE_PARENT, name), { recursive: true, force: true }, () => {});
    });
  } catch {
    // chưa có thư mục hồ sơ nào
  }
  try {
    fs.readdirSync(path.join(WORK_ROOT, 'formula-cache')).forEach((name) => {
      const full = path.join(WORK_ROOT, 'formula-cache', name);
      if (full !== CACHE_DIR) fs.rm(full, { recursive: true, force: true }, () => {});
    });
  } catch {
    // chưa có bộ nhớ đệm
  }
  pruneOldFiles(CACHE_DIR, CACHE_MAX_AGE_MS);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-warm-'));
  try {
    // Mỗi tiến trình 1 file riêng - ghi chung 1 file đầu ra sẽ lỗi khi chạy song song.
    const names = Array.from({ length: MAX_PARALLEL_SOFFICE }, (_, i) => `warm${i}.svg`);
    names.forEach((name) => fs.writeFileSync(
      path.join(tmpDir, name),
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>'
    ));
    const started = Date.now();
    await Promise.all(names.map((name) => convertWithProfile('png', [name], tmpDir, tmpDir)));
    console.log(`LibreOffice đã sẵn sàng (${MAX_PARALLEL_SOFFICE} tiến trình, ${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ĐÃ THỬ (Bước x): ép bảng thay thế font của LibreOffice (Tools > Options >
// Fonts > Bảng thay thế, cấu hình qua registrymodifications.xcu) để gộp các
// font "chữ/biến số thường" khác nhau giữa các file (đo thực tế: file dùng
// lẫn lộn "Times New Roman" và "Palatino Linotype") về chung 1 kiểu, mong
// giảm bất đồng bộ font giữa các công thức. ĐÃ KIỂM CHỨNG TRỰC TIẾP: cấu
// hình này KHÔNG có tác dụng khi convert qua đường Draw-document headless
// dùng ở đây (font gốc trong SVG xuất ra vẫn giữ nguyên "Palatino Linotype"
// dù đã bật "Always" trong bảng thay thế) - có thể bảng thay thế này chỉ áp
// dụng cho luồng mở/hiển thị tài liệu Writer thông thường, không áp dụng cho
// đường import WMF/EMF làm "trang Draw" như wmfConvertService đang dùng. Đã
// GỠ BỎ hướng này (không giữ code không hoạt động) - xem lại đề xuất khác
// (chuẩn hoá font ngay từ khâu soạn thảo, hoặc đổi hẳn sang OMML+KaTeX) nếu
// muốn tiếp tục xử lý vấn đề bất đồng bộ font giữa các công thức.

// Chuyển 1 file Word (.doc/.docx) bất kỳ sang PDF bằng LibreOffice - dùng để
// giáo viên "xem trước trên web" file đáp án chi tiết dạng Word (trình duyệt
// không tự hiển thị được .docx, nhưng hiển thị PDF trực tiếp qua <iframe>
// rất tốt). Trả về Buffer PDF, hoặc null nếu không có LibreOffice/lỗi.
async function convertDocumentToPdfBuffer(fileBuffer, originalExt) {
  if (!isLibreOfficeAvailable()) return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc2pdf-'));
  const ext = (originalExt || 'docx').replace(/^\./, '');
  const srcPath = path.join(tmpDir, `doc.${ext}`);
  try {
    fs.writeFileSync(srcPath, fileBuffer);
    await convertWithProfile('pdf', [`doc.${ext}`], tmpDir, tmpDir);
    const pdfPath = path.join(tmpDir, 'doc.pdf');
    if (!fs.existsSync(pdfPath)) return null;
    return fs.readFileSync(pdfPath);
  } catch (err) {
    console.error('Lỗi chuyển Word sang PDF để xem trước:', err.message);
    return null;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Bố cục đọc từ WMF dựa trên giả định về cách LibreOffice đặt công thức
// lên trang (xem wmfFontParser.parseWmfTextLayout). Kiểm tra chéo với nét
// mực THẬT trên ảnh PNG: khung công thức tính ra phải chứa trọn nét mực -
// lệch (VD bản LibreOffice khác đổi cách đặt trang) thì đo lại bằng SVG.
function wmfLayoutMatchesInk(layout, png) {
  if (!layout || !png || png.inkTop == null || !png.rawHeight) return false;
  const pxPerUnit = png.rawHeight / layout.viewBoxHeight;
  const tolerancePx = 3;
  const inkBottom = png.inkTop + png.height - 2; // bỏ 2px đệm trên/dưới
  return png.inkTop >= layout.frameTop * pxPerUnit - tolerancePx
    && inkBottom <= layout.frameBottom * pxPerUnit + tolerancePx;
}

// Xuất SVG cho các công thức `indices` (chia đều cho `workerCount` tiến
// trình) rồi đọc bố cục chữ từ SVG vào `svgInfos`.
async function measureWithSvg(indices, workerCount, fileNameOf, tmpDir, svgDir, svgInfos) {
  if (indices.length === 0) return;
  await Promise.all(splitInterleaved(indices, workerCount).map(async (group) => {
    await convertWithProfile('svg', group.map(fileNameOf), tmpDir, svgDir);
    await Promise.all(group.map(async (idx) => {
      try {
        const svgText = await fs.promises.readFile(path.join(svgDir, `e${idx}.svg`), 'utf8');
        svgInfos[idx] = {
          metrics: parseSvgBoundingBoxMetrics(svgText),
          layout: parseSvgFormulaLayout(svgText),
        };
      } catch {
        svgInfos[idx] = null; // không có SVG -> dùng tầng dự phòng
      }
    }));
  }));
}

// Chuyển 1 mảng buffer WMF/EMF thành mảng { base64, isDiagram, width, height,
// displayHeightEm, verticalAlignEm } (giữ nguyên thứ tự đầu vào):
//   - Công thức đã có trong bộ nhớ đệm -> lấy ngay, không chạy LibreOffice.
//   - Phần còn lại: nhiều tiến trình LibreOffice vẽ PNG song song (ảnh hiển
//     thị thật cho học sinh/giáo viên); cỡ chữ + dòng chân chữ đọc từ WMF.
//   - Công thức không đọc được bố cục từ WMF (EMF, WMF lạ, kiểm tra chéo
//     không khớp) -> xuất thêm SVG để đo. SVG không dùng để hiển thị vì font
//     nhúng trong đó là "SVG Font" trình duyệt không hỗ trợ.
//   - Không đo được bằng cả 2 cách -> các tầng dự phòng cũ (font đọc từ
//     WMF/EMF, hoặc ước lượng theo pixel).
async function convertWmfBuffersToPng(wmfItems) {
  if (!isLibreOfficeAvailable()) {
    return wmfItems.map(() => null);
  }
  if (wmfItems.length === 0) return [];

  const bufferOf = (idx) => ((wmfItems[idx] && wmfItems[idx].buffer) ? wmfItems[idx].buffer : wmfItems[idx]);
  const extOf = (idx) => (wmfItems[idx] && wmfItems[idx].ext) || 'wmf';

  const keys = wmfItems.map(cacheKeyFor);
  const cached = await Promise.all(keys.map(readCache));
  const results = new Array(wmfItems.length).fill(null);
  const pending = [];
  cached.forEach((hit, idx) => {
    if (hit) results[idx] = hit;
    else pending.push(idx);
  });
  if (pending.length === 0) return results;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmf-convert-'));
  const pngDir = path.join(tmpDir, 'png');
  const svgDir = path.join(tmpDir, 'svg');
  fs.mkdirSync(pngDir);
  fs.mkdirSync(svgDir);
  const raw = new Array(wmfItems.length).fill(null);
  const svgInfos = new Array(wmfItems.length).fill(null);
  const wmfLayouts = new Array(wmfItems.length).fill(null);

  try {
    const fileNameOf = (idx) => `e${idx}.${extOf(idx)}`;
    pending.forEach((idx) => {
      fs.writeFileSync(path.join(tmpDir, fileNameOf(idx)), bufferOf(idx));
      if (extOf(idx) === 'wmf') wmfLayouts[idx] = wmfFontParser.parseWmfTextLayout(bufferOf(idx));
    });
    const needSvg = pending.filter((idx) => !wmfLayouts[idx]);

    // Thường không cần SVG -> dồn hết tiến trình cho PNG; nếu cần thì chia
    // theo tỉ lệ số ảnh (xuất SVG nhanh hơn vẽ PNG ~1,5 lần).
    const workerBudget = Math.min(MAX_PARALLEL_SOFFICE, Math.max(1, Math.ceil(pending.length / MIN_FILES_PER_WORKER)));
    const svgWorkers = needSvg.length === 0
      ? 0
      : Math.max(1, Math.min(workerBudget - 1, Math.round((workerBudget * needSvg.length) / (pending.length * 2.5))));
    const pngWorkers = Math.max(1, workerBudget - svgWorkers);

    const pngJobs = splitInterleaved(pending, pngWorkers).map(async (group) => {
      await convertWithProfile(PNG_EXPORT_FILTER, group.map(fileNameOf), tmpDir, pngDir);
      // Cắt viền ngay khi nhóm này xong, trong lúc các tiến trình khác vẫn chạy.
      await Promise.all(group.map(async (idx) => {
        const pngPath = path.join(pngDir, `e${idx}.png`);
        if (!fs.existsSync(pngPath)) return;
        const trimmed = await trimWhitespace(await fs.promises.readFile(pngPath));
        const fontSizePt = wmfFontParser.extractFontSizePt(bufferOf(idx), extOf(idx));
        raw[idx] = { ...trimmed, fontSizePt };
      }));
    });
    await Promise.all([
      ...pngJobs,
      measureWithSvg(needSvg, Math.max(1, svgWorkers), fileNameOf, tmpDir, svgDir, svgInfos),
    ]);

    // Bố cục WMF không khớp nét mực thật -> đo lại bằng SVG (hiếm gặp).
    const recheck = pending.filter((idx) => (
      wmfLayouts[idx] && raw[idx] && !raw[idx].isDiagram && !wmfLayoutMatchesInk(wmfLayouts[idx], raw[idx])
    ));
    recheck.forEach((idx) => { wmfLayouts[idx] = null; });
    await measureWithSvg(recheck, Math.min(MAX_PARALLEL_SOFFICE, Math.max(1, Math.ceil(recheck.length / MIN_FILES_PER_WORKER))), fileNameOf, tmpDir, svgDir, svgInfos);
  } finally {
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }

  // Chỉ hiệu chỉnh pxPerPt (dùng cho tầng dự phòng) dựa trên các ảnh XÁC
  // NHẬN LÀ 1 DÒNG THẬT (bandCount<=1) - loại ảnh phân số/nhiều tầng ra khỏi
  // mẫu để không làm lệch tỉ lệ "1pt tương ứng bao nhiêu px cho 1 dòng".
  const fresh = pending.map((idx) => raw[idx]).filter(Boolean);
  const singleLineSamples = fresh
    .filter((r) => !r.isDiagram && r.bandCount <= 1)
    .map((r) => ({ heightPx: r.height, fontSizePt: r.fontSizePt }));
  const pxPerPt = calibratePxPerPt(
    singleLineSamples.length > 0
      ? singleLineSamples
      : fresh.map((r) => ({ heightPx: r.height, fontSizePt: r.fontSizePt }))
  );

  const cacheWrites = [];
  pending.forEach((idx) => {
    const r = raw[idx];
    if (!r) return;
    const { fontSizePt, bandCount, rawWidth, rawHeight, inkTop, ...rest } = r;
    if (r.isDiagram) {
      results[idx] = rest;
      cacheWrites.push(writeCache(keys[idx], rest));
      return;
    }

    const svgInfo = svgInfos[idx] || {};
    const hasMultipleBands = bandCount >= 2;
    // Cách chính (Bước 34): cỡ chữ + dòng chân chữ thật (từ WMF, hoặc SVG).
    // Chỉ khi không có mới dùng các tầng cũ.
    let size = computeFormulaSizeFromLayout(wmfLayouts[idx] || svgInfo.layout, r);
    // Chỉ lưu đệm kết quả của cách chính - các tầng dự phòng phụ thuộc vào
    // cả lượt import (pxPerPt) nên không cố định theo từng công thức.
    const cacheable = Boolean(size);
    if (!size) size = computeFormulaSizeFromSvgRatio(svgInfo.metrics, hasMultipleBands);
    if (!size) {
      size = fontSizePt
        ? computeFormulaSizeFromFont(r.height, fontSizePt, pxPerPt, hasMultipleBands)
        : computeFormulaSize(r.height, hasMultipleBands);
    }

    results[idx] = { ...rest, displayHeightEm: size.displayHeightEm, verticalAlignEm: size.verticalAlignEm };
    if (cacheable) cacheWrites.push(writeCache(keys[idx], results[idx]));
  });
  await Promise.all(cacheWrites);

  return results;
}

module.exports = {
  isLibreOfficeAvailable,
  warmUp,
  convertWmfBuffersToPng,
  convertDocumentToPdfBuffer,
  trimWhitespace,
  computeFormulaSize,
  computeFormulaSizeFromFont,
  computeFormulaSizeFromLayout,
  parseSvgFormulaLayout,
  calibratePxPerPt,
  countInkBands,
};
