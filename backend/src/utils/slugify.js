// Chuyển chuỗi tiếng Việt có dấu thành dạng không dấu, dùng để tạo cacheKey
// ổn định cho generated_exercises (không cần "đẹp", chỉ cần nhất quán cho
// cùng 1 tag).
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh (kết hợp Unicode)
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { slugify };
