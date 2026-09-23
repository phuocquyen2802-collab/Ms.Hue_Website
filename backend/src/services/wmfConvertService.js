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
const { execFile } = require('child_process');
const sharp = require('sharp');
const wmfFontParser = require('./wmfFontParser');

const BATCH_SIZE = 100; // Tăng kích thước lô để giảm số lần khởi động LibreOffice, tăng tốc xử lý x3-x5 lần

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
const EM_PER_PT = 0.135; // 1pt cỡ chữ MathType -> bao nhiêu em cho 1 dòng công thức
const GLOBAL_PX_TO_EM = 0.043; // dự phòng (Tầng 2): 1px chiều cao gốc -> bao nhiêu em
const MIN_FORMULA_HEIGHT_EM = 1.1;
const MAX_FORMULA_HEIGHT_EM = 4.8;
const DEFAULT_FORMULA_HEIGHT_EM = 1.55; // dùng khi không đo được kích thước gốc (ảnh lỗi/thiếu)
const DEFAULT_FORMULA_VALIGN_EM = -0.3;
const DEFAULT_PX_PER_PT = 3.8; // dùng khi 1 lượt import không có đủ mẫu để tự hiệu chỉnh

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

// ---- TẦNG 0 (mới, chính xác NHẤT - ưu tiên cao nhất khi có): đo kích thước
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

// Chuyển 1 lô WMF/EMF sang SVG chỉ để ĐO kích thước (không dùng SVG để hiển
// thị - font nhúng trong SVG do LibreOffice xuất là "SVG Font", định dạng cũ
// trình duyệt hiện đại không còn hỗ trợ render, nên ảnh hiển thị thật cho
// học sinh vẫn luôn là PNG như trước). Nếu LibreOffice lỗi hoặc file nào đó
// không đọc được BoundingBox, trả về null cho đúng vị trí đó - nơi gọi sẽ tự
// rơi về Tầng 1/2 dự phòng, không có gì bị "vỡ".
async function measureSvgMetrics(wmfItems) {
  if (!isLibreOfficeAvailable() || wmfItems.length === 0) {
    return wmfItems.map(() => null);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmf-svg-'));
  const profileDir = path.join(tmpDir, 'profile').replace(/\\/g, '/');
  const results = new Array(wmfItems.length).fill(null);

  try {
    for (let batchStart = 0; batchStart < wmfItems.length; batchStart += BATCH_SIZE) {
      const batch = wmfItems.slice(batchStart, batchStart + BATCH_SIZE);
      const filePaths = batch.map((item, i) => {
        const ext = (item && item.ext) ? item.ext : 'wmf';
        return path.join(tmpDir, `eq-${batchStart + i}.${ext}`);
      });

      batch.forEach((item, i) => {
        const buf = (item && item.buffer) ? item.buffer : item;
        fs.writeFileSync(filePaths[i], buf);
      });

      try {
        await runSoffice([
          `-env:UserInstallation=file:///${profileDir}`,
          '--headless',
          '--convert-to',
          'svg',
          '--outdir',
          tmpDir,
          ...filePaths,
        ]);
      } catch (err) {
        console.error('LibreOffice (đo SVG) lỗi, dùng lại cách ước lượng cũ:', err.message);
        continue;
      }

      filePaths.forEach((fPath, i) => {
        const svgPath = fPath.replace(/\.(wmf|emf)$/i, '.svg');
        if (!fs.existsSync(svgPath)) return;
        try {
          const svgText = fs.readFileSync(svgPath, 'utf8');
          results[batchStart + i] = parseSvgBoundingBoxMetrics(svgText);
        } catch {
          results[batchStart + i] = null;
        }
      });
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return results;
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
    const trimmed = await sharp(pngBuffer)
      .trim({ background: '#ffffff', threshold: 10 })
      .extend({ top: 1, bottom: 1, left: 2, right: 2, background: '#ffffff' })
      .png()
      .toBuffer();

    const meta = await sharp(trimmed).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;

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
    const isDiagram = Boolean(
      (w >= 150 && h >= 100) ||
      (w * h >= 40000)
    );
    const bandCount = !isDiagram && w > 0 && h > 0 ? await countInkBands(trimmed, w, h) : 0;

    return {
      base64: trimmed.toString('base64'),
      isDiagram,
      width: w,
      height: h,
      bandCount,
    };
  } catch (err) {
    console.error('Lỗi cắt ảnh công thức:', err.message);
    return {
      base64: pngBuffer.toString('base64'),
      isDiagram: false,
      width: 0,
      height: 0,
      bandCount: 0,
    };
  }
}

function runSoffice(args) {
  return new Promise((resolve, reject) => {
    const sofficePath = findSofficePath();
    execFile(sofficePath, args, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`LibreOffice lỗi: ${err.message}\n${stderr}`));
      resolve(stdout);
    });
  });
}

// Chuyển 1 file Word (.doc/.docx) bất kỳ sang PDF bằng LibreOffice - dùng để
// giáo viên "xem trước trên web" file đáp án chi tiết dạng Word (trình duyệt
// không tự hiển thị được .docx, nhưng hiển thị PDF trực tiếp qua <iframe>
// rất tốt). Trả về Buffer PDF, hoặc null nếu không có LibreOffice/lỗi.
async function convertDocumentToPdfBuffer(fileBuffer, originalExt) {
  if (!isLibreOfficeAvailable()) return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc2pdf-'));
  const profileDir = path.join(tmpDir, 'profile').replace(/\\/g, '/');
  const ext = (originalExt || 'docx').replace(/^\./, '');
  const srcPath = path.join(tmpDir, `doc.${ext}`);
  try {
    fs.writeFileSync(srcPath, fileBuffer);
    await runSoffice([
      `-env:UserInstallation=file:///${profileDir}`,
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      tmpDir,
      srcPath,
    ]);
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

// Chuyển 1 mảng buffer WMF/EMF thành mảng { base64, isDiagram, displayHeightEm,
// verticalAlignEm } (giữ nguyên thứ tự đầu vào). Chạy song song:
//   A) Đo kích thước THẬT qua SVG (Tầng 0, xem `measureSvgMetrics` phía
//      trên) - chính xác nhất, ưu tiên dùng cho mọi ảnh đo được.
//   B) Chuyển đổi sang PNG để hiển thị (ảnh thật gửi cho học sinh/giáo viên
//      xem) + đọc cỡ chữ thật qua LOGFONT làm dự phòng (Tầng 1/2) cho những
//      ảnh Tầng 0 không đo được (LibreOffice lỗi, định dạng lạ...).
async function convertWmfBuffersToPng(wmfItems) {
  if (!isLibreOfficeAvailable()) {
    return wmfItems.map(() => null);
  }
  if (wmfItems.length === 0) return [];

  const svgMetricsPromise = measureSvgMetrics(wmfItems);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmf-convert-'));
  const profileDir = path.join(tmpDir, 'profile').replace(/\\/g, '/');
  const results = new Array(wmfItems.length).fill(null);

  try {
    for (let batchStart = 0; batchStart < wmfItems.length; batchStart += BATCH_SIZE) {
      const batch = wmfItems.slice(batchStart, batchStart + BATCH_SIZE);
      const filePaths = batch.map((item, i) => {
        const ext = (item && item.ext) ? item.ext : 'wmf';
        return path.join(tmpDir, `eq-${batchStart + i}.${ext}`);
      });

      batch.forEach((item, i) => {
        const buf = (item && item.buffer) ? item.buffer : item;
        fs.writeFileSync(filePaths[i], buf);
      });

      try {
        await runSoffice([
          `-env:UserInstallation=file:///${profileDir}`,
          '--headless',
          '--convert-to',
          'png',
          '--outdir',
          tmpDir,
          ...filePaths,
        ]);
      } catch (err) {
        console.error('LibreOffice run error:', err.message);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        filePaths.map(async (fPath, i) => {
          const pngPath = fPath.replace(/\.(wmf|emf)$/i, '.png');
          if (fs.existsSync(pngPath)) {
            const raw = fs.readFileSync(pngPath);
            const trimmed = await trimWhitespace(raw);
            const item = batch[i];
            const ext = (item && item.ext) ? item.ext : 'wmf';
            const srcBuf = (item && item.buffer) ? item.buffer : item;
            const fontSizePt = wmfFontParser.extractFontSizePt(srcBuf, ext);
            results[batchStart + i] = { ...trimmed, fontSizePt };
          }
        })
      );
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Chỉ hiệu chỉnh pxPerPt dựa trên các ảnh XÁC NHẬN LÀ 1 DÒNG THẬT
  // (bandCount<=1) - loại các ảnh phân số/nhiều tầng ra khỏi mẫu hiệu chỉnh
  // để không làm lệch tỉ lệ "1pt tương ứng bao nhiêu px cho 1 dòng".
  const singleLineSamples = results
    .filter((r) => r && !r.isDiagram && r.bandCount <= 1)
    .map((r) => ({ heightPx: r.height, fontSizePt: r.fontSizePt }));
  const pxPerPt = calibratePxPerPt(
    singleLineSamples.length > 0
      ? singleLineSamples
      : results.filter(Boolean).map((r) => ({ heightPx: r.height, fontSizePt: r.fontSizePt }))
  );

  // Chờ kết quả đo SVG (Tầng 0) chạy song song ở trên xong.
  const svgMetricsList = await svgMetricsPromise;

  return results.map((r, idx) => {
    if (!r) return null;
    if (r.isDiagram) {
      const { fontSizePt, bandCount, ...rest } = r;
      return rest;
    }

    const svgMetrics = svgMetricsList[idx];
    const hasMultipleBands = r.bandCount >= 2;
    let size = computeFormulaSizeFromSvgRatio(svgMetrics, hasMultipleBands);
    if (!size) {
      // Tầng 1/2 (dự phòng): SVG đo lỗi cho đúng ảnh này -> quay lại cách
      // cũ (font-parse WMF/EMF hoặc ước lượng thuần theo pixel).
      size = r.fontSizePt
        ? computeFormulaSizeFromFont(r.height, r.fontSizePt, pxPerPt, hasMultipleBands)
        : computeFormulaSize(r.height, hasMultipleBands);
    }

    const { fontSizePt, bandCount, ...rest } = r;
    return { ...rest, displayHeightEm: size.displayHeightEm, verticalAlignEm: size.verticalAlignEm };
  });
}

module.exports = {
  isLibreOfficeAvailable,
  convertWmfBuffersToPng,
  convertDocumentToPdfBuffer,
  trimWhitespace,
  computeFormulaSize,
  computeFormulaSizeFromFont,
  calibratePxPerPt,
  countInkBands,
};
