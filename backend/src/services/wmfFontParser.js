// Đọc trực tiếp cỡ chữ THẬT (point size) mà giáo viên đã gõ trong MathType,
// bằng cách phân tích cấu trúc nhị phân của file WMF/EMF - đây là dữ liệu
// GỐC do MathType ghi vào file, không phải suy đoán qua ảnh đã raster hoá
// (khác hẳn cách làm ở các bước trước, vốn luôn có sai số vì ảnh xuất ra từ
// LibreOffice không giữ lại thông tin cỡ chữ một cách trực tiếp/đáng tin cậy).
//
// WMF (Windows Metafile - phiên bản cũ MathType hay dùng nhất) là định dạng
// VECTOR: bên trong luôn có ít nhất 1 bản ghi META_CREATEFONTINDIRECT chứa
// cấu trúc LOGFONT, trong đó trường lfHeight chính là cỡ chữ (đơn vị logic).
// Để quy đổi ra point (pt) thật, cần biết thêm "Inch" (số đơn vị logic ứng
// với 1 inch) - trường này chỉ có khi file có "Placeable Metafile Header"
// (rất phổ biến với WMF do OLE/MathType xuất ra).
//
// EMF (Enhanced Metafile - MathType/Equation mới hơn cũng có thể dùng) là
// bản 32-bit hiện đại hơn: bản ghi tương ứng là EMR_EXTCREATEFONTINDIRECTW,
// và độ phân giải quy đổi lấy từ chính EMF Header (szlDevice/szlMillimeters).
//
// Nếu không phân tích được (file không có Placeable Header, định dạng lạ,
// dữ liệu hỏng...) hàm trả về null - nơi gọi sẽ tự động dùng lại cách ước
// lượng qua pixel như cũ (không có gì bị "vỡ", chỉ là kém chính xác hơn).

const APM_KEY = 0x9ac6cdd7;
const META_EOF = 0x0000;
const META_CREATEFONTINDIRECT = 0x02fb;
const EMR_EXTCREATEFONTINDIRECTW = 82;

function parseWmfFontSizePt(buffer) {
  try {
    if (buffer.length < 22) return null;

    let offset = 0;
    let unitsPerInch = null;

    if (buffer.readUInt32LE(0) === APM_KEY) {
      unitsPerInch = buffer.readUInt16LE(14);
      offset = 22; // sau Placeable Metafile Header, tới WMF Header chuẩn
    } else {
      // Không có Placeable Header -> không biết tỉ lệ quy đổi ra inch thật,
      // không thể tính point size đáng tin cậy.
      return null;
    }

    if (!unitsPerInch || unitsPerInch <= 0) return null;
    if (offset + 18 > buffer.length) return null;

    offset += 18; // bỏ qua WMF Header chuẩn (18 byte), tới danh sách record

    let bestAbsHeight = 0;

    while (offset + 6 <= buffer.length) {
      const sizeWords = buffer.readUInt32LE(offset); // kích thước record tính theo WORD (2 byte)
      if (sizeWords < 3) break; // record tối thiểu phải đủ chứa Size+Function
      const sizeBytes = sizeWords * 2;
      const func = buffer.readUInt16LE(offset + 4);

      if (func === META_EOF) break;
      if (offset + sizeBytes > buffer.length) break;

      if (func === META_CREATEFONTINDIRECT && sizeBytes >= 6 + 2) {
        const lfHeight = buffer.readInt16LE(offset + 6);
        const absHeight = Math.abs(lfHeight);
        if (absHeight > bestAbsHeight) bestAbsHeight = absHeight;
      }

      offset += sizeBytes;
    }

    if (bestAbsHeight <= 0) return null;
    const pointSize = (bestAbsHeight / unitsPerInch) * 72;
    if (!Number.isFinite(pointSize) || pointSize <= 0 || pointSize > 400) return null;
    return pointSize;
  } catch (err) {
    return null;
  }
}

function parseEmfFontSizePt(buffer) {
  try {
    if (buffer.length < 88) return null;
    const iType = buffer.readUInt32LE(0);
    if (iType !== 1) return null; // record đầu tiên phải là EMR_HEADER

    const deviceCx = buffer.readInt32LE(72);
    const deviceCy = buffer.readInt32LE(76);
    const mmCx = buffer.readInt32LE(80);
    const mmCy = buffer.readInt32LE(84);
    if (!deviceCx || !deviceCy || !mmCx || !mmCy) return null;

    const dpiX = deviceCx / (mmCx / 25.4);
    const dpiY = deviceCy / (mmCy / 25.4);
    const dpi = (dpiX + dpiY) / 2;
    if (!Number.isFinite(dpi) || dpi <= 0) return null;

    let offset = 0;
    let bestAbsHeight = 0;

    while (offset + 8 <= buffer.length) {
      const type = buffer.readUInt32LE(offset);
      const size = buffer.readUInt32LE(offset + 4);
      if (size < 8) break;
      if (offset + size > buffer.length) break;

      if (type === EMR_EXTCREATEFONTINDIRECTW && size >= 12 + 4) {
        const lfHeight = buffer.readInt32LE(offset + 12);
        const absHeight = Math.abs(lfHeight);
        if (absHeight > bestAbsHeight) bestAbsHeight = absHeight;
      }

      offset += size;
    }

    if (bestAbsHeight <= 0) return null;
    const pointSize = (bestAbsHeight / dpi) * 72;
    if (!Number.isFinite(pointSize) || pointSize <= 0 || pointSize > 400) return null;
    return pointSize;
  } catch (err) {
    return null;
  }
}

// Trả về cỡ chữ THẬT (point) đọc trực tiếp từ file WMF/EMF gốc, hoặc null
// nếu không phân tích được (file thiếu thông tin quy đổi, định dạng lạ...).
function extractFontSizePt(buffer, ext) {
  if (!buffer || buffer.length === 0) return null;
  if (ext === 'emf') return parseEmfFontSizePt(buffer);
  return parseWmfFontSizePt(buffer);
}

// ---- Bố cục chữ của công thức WMF (Bước 35) ----
//
// Đọc thẳng từ file WMF các đoạn chữ MathType vẽ ra: font, cỡ chữ và toạ độ
// dòng chân chữ (baseline), rồi quy về CÙNG hệ toạ độ "trang A4" mà
// LibreOffice dùng khi xuất PNG/SVG (đơn vị 0.01mm, giống viewBox SVG) - để
// wmfConvertService.computeFormulaSizeFromLayout dùng được trực tiếp, KHÔNG
// cần chạy thêm 1 lượt LibreOffice xuất SVG chỉ để đo (tiết kiệm ~40% thời
// gian xử lý file). Cách LibreOffice đặt công thức lên trang (đối chiếu với
// SVG trên 488 công thức của các đề mẫu, sai lệch kết quả cuối <= 0.004em):
//   - Trang A4 (210 x 297mm), công thức đặt chính giữa trang.
//   - Kích thước theo khung Placeable Header của WMF; nếu cả 2 cạnh đều nhỏ
//     hơn 1 inch thì phóng to đều cho cạnh dài bằng đúng 1 inch.
// Trả về null nếu file có cấu trúc khác cách MathType thường ghi (không có
// Placeable Header, chữ không căn theo dòng chân chữ, cỡ chữ dạng "chiều
// cao ô"...) - nơi gọi sẽ đo bằng SVG như trước.
const A4_WIDTH_UNITS = 21000;
const A4_HEIGHT_UNITS = 29700;
const UNITS_PER_PT = 2540 / 72;
const MIN_RENDER_SIZE_PT = 72;

const META_SETWINDOWORG = 0x020b;
const META_SETWINDOWEXT = 0x020c;
const META_SELECTOBJECT = 0x012d;
const META_DELETEOBJECT = 0x01f0;
const META_SETTEXTALIGN = 0x012e;
const META_MOVETO = 0x0214;
const META_SAVEDC = 0x001e;
const META_RESTOREDC = 0x0127;
const META_TEXTOUT = 0x0521;
const META_EXTTEXTOUT = 0x0a32;
// Các bản ghi tạo "đối tượng" GDI khác (bút, cọ, bảng màu, vùng...) - cũng
// chiếm 1 ô trong bảng đối tượng nên phải đếm để chỉ số SELECTOBJECT khớp.
const OTHER_OBJECT_RECORDS = new Set([0x02fa, 0x02fc, 0x00f7, 0x01f9, 0x0142, 0x06ff]);
const TA_UPDATECP = 0x0001;
const TA_BASELINE = 0x0018;

function parseWmfTextLayout(buffer) {
  try {
    if (!buffer || buffer.length < 40 || buffer.readUInt32LE(0) !== APM_KEY) return null;
    const left = buffer.readInt16LE(6);
    const top = buffer.readInt16LE(8);
    const right = buffer.readInt16LE(10);
    const bottom = buffer.readInt16LE(12);
    const unitsPerInch = buffer.readUInt16LE(14);
    if (!unitsPerInch || right <= left || bottom <= top) return null;

    let windowOrg = null;
    let windowExt = null;
    const objects = [];
    const firstFreeSlot = () => {
      let i = 0;
      while (objects[i] !== undefined) i += 1;
      return i;
    };
    let state = { font: null, align: 0, currentY: 0 };
    const savedStates = [];
    const runs = [];

    let offset = 22 + 18; // Placeable Header + WMF Header
    while (offset + 6 <= buffer.length) {
      const sizeBytes = buffer.readUInt32LE(offset) * 2;
      const func = buffer.readUInt16LE(offset + 4);
      if (func === META_EOF || sizeBytes < 6 || offset + sizeBytes > buffer.length) break;
      const p = offset + 6;

      if (func === META_SETWINDOWORG) {
        windowOrg = { y: buffer.readInt16LE(p), x: buffer.readInt16LE(p + 2) };
      } else if (func === META_SETWINDOWEXT) {
        windowExt = { y: buffer.readInt16LE(p), x: buffer.readInt16LE(p + 2) };
      } else if (func === META_CREATEFONTINDIRECT) {
        const height = buffer.readInt16LE(p);
        const face = buffer.slice(p + 18, Math.min(p + 18 + 32, offset + sizeBytes)).toString('latin1').split('\0')[0];
        objects[firstFreeSlot()] = { isFont: true, height, face };
      } else if (OTHER_OBJECT_RECORDS.has(func)) {
        objects[firstFreeSlot()] = { isFont: false };
      } else if (func === META_SELECTOBJECT) {
        const obj = objects[buffer.readUInt16LE(p)];
        if (obj && obj.isFont) state.font = obj;
      } else if (func === META_DELETEOBJECT) {
        objects[buffer.readUInt16LE(p)] = undefined;
      } else if (func === META_SETTEXTALIGN) {
        state.align = buffer.readUInt16LE(p);
      } else if (func === META_MOVETO) {
        state.currentY = buffer.readInt16LE(p);
      } else if (func === META_SAVEDC) {
        savedStates.push({ ...state });
      } else if (func === META_RESTOREDC) {
        const n = buffer.readInt16LE(p);
        for (let k = 0; n < 0 && k < -n - 1; k += 1) savedStates.pop();
        if (savedStates.length > 0) state = savedStates.pop();
      } else if (func === META_TEXTOUT || func === META_EXTTEXTOUT) {
        let y;
        let text;
        if (func === META_TEXTOUT) {
          const count = buffer.readInt16LE(p);
          text = buffer.slice(p + 2, p + 2 + count).toString('latin1');
          y = buffer.readInt16LE(p + 2 + count + (count % 2));
        } else {
          y = buffer.readInt16LE(p);
          const count = buffer.readInt16LE(p + 4);
          const options = buffer.readUInt16LE(p + 6);
          const textStart = p + 8 + ((options & 0x0006) ? 8 : 0); // có kèm hình chữ nhật cắt/tô nền
          text = buffer.slice(textStart, textStart + count).toString('latin1');
        }
        // MathType bật TA_UPDATECP: chữ vẽ tại vị trí bút hiện tại (đặt bởi
        // MOVETO ngay trước đó), toạ độ ghi trong bản ghi bị bỏ qua.
        if (state.align & TA_UPDATECP) y = state.currentY;
        runs.push({ y, text, font: state.font, align: state.align });
      }
      offset += sizeBytes;
    }

    if (runs.length === 0) return null;
    const usable = runs.every(
      (r) => r.font && r.font.height < 0 && (r.align & TA_BASELINE) === TA_BASELINE
    );
    if (!usable) return null;

    const org = windowOrg || { x: left, y: top };
    const ext = windowExt || { x: right - left, y: bottom - top };
    if (!ext.y) return null;

    const widthPt = ((right - left) / unitsPerInch) * 72;
    const heightPt = ((bottom - top) / unitsPerInch) * 72;
    const longest = Math.max(widthPt, heightPt);
    const scale = longest < MIN_RENDER_SIZE_PT ? MIN_RENDER_SIZE_PT / longest : 1;
    const frameHeight = heightPt * scale * UNITS_PER_PT;
    const frameTop = (A4_HEIGHT_UNITS - frameHeight) / 2;
    const unitsPerLogicalY = frameHeight / ext.y;

    return {
      viewBoxWidth: A4_WIDTH_UNITS,
      viewBoxHeight: A4_HEIGHT_UNITS,
      frameTop,
      frameBottom: frameTop + frameHeight,
      runs: runs.map((r) => ({
        y: frameTop + (r.y - org.y) * unitsPerLogicalY,
        family: r.font.face,
        size: Math.abs(r.font.height * unitsPerLogicalY),
        text: r.text,
      })),
    };
  } catch (err) {
    return null;
  }
}

module.exports = { extractFontSizePt, parseWmfTextLayout };
