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

module.exports = { extractFontSizePt };
