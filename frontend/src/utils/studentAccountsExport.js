// Xuất file Excel danh sách tài khoản học sinh (Họ tên, Lớp, Tài khoản,
// Mật khẩu) để giáo viên gửi cho lớp. Mật khẩu lấy từ máy chủ (lưu mã hoá
// hai chiều - xem backend/src/utils/passwordVault.js).

// Mật khẩu ngẫu nhiên 8 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/l/I).
export function generatePassword(length = 8) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}

function slug(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Tên trang tính Excel: tối đa 31 ký tự, không chứa [ ] : * ? / \
function sheetName(className) {
  const name = className ? `Lớp ${className}` : 'Tài khoản học sinh';
  return name.replace(/[[\]:*?/\\]/g, '-').slice(0, 31);
}

// Xuất file .xlsx gồm: STT, Họ và tên, Lớp, Tài khoản / Email, Mật khẩu.
// `className`: lớp đang xuất ('' nếu xuất tất cả) - dùng cho tên file.
export async function exportAccountsToXlsx(accounts, className = '') {
  // Chỉ tải thư viện khi thật sự xuất file để trang không nặng thêm.
  const { default: writeExcelFile } = await import('write-excel-file/browser');

  const header = ['STT', 'Họ và tên', 'Lớp', 'Tài khoản / Email', 'Mật khẩu'].map((value) => ({
    value,
    fontWeight: 'bold',
  }));
  const rows = accounts.map((a, idx) => [
    { value: idx + 1 },
    { value: a.name || '' },
    { value: a.className || '', format: '@' },
    { value: a.email || '', format: '@' },
    // Định dạng chữ ('@') để Excel không biến mật khẩu toàn số thành số.
    { value: a.password || '', format: '@' },
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `tai-khoan-${className ? `lop-${slug(className)}` : 'hoc-sinh'}-${date}.xlsx`;

  await writeExcelFile([header, ...rows], {
    sheet: sheetName(className),
    columns: [{ width: 6 }, { width: 30 }, { width: 10 }, { width: 32 }, { width: 16 }],
  }).toFile(fileName);

  return fileName;
}
