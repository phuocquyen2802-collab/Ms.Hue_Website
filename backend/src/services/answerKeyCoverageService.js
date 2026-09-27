// So khớp "thử" xem file đáp án chi tiết (PDF/Word) có nhắc tới đủ "Câu N"
// cho TỪNG câu hỏi trong đề hay không, trước khi cho giao đề cho học sinh -
// tránh trường hợp giáo viên lỡ up thiếu trang/thiếu câu trong file đáp án.
//
// CHỈ đọc được văn bản thuần từ Word (.docx/.doc) và PDF - ảnh (JPG/PNG) thì
// không có văn bản để đọc, trả về `supported: false` để giáo viên tự kiểm
// tra bằng mắt, không chặn giao đề trong trường hợp đó.

const mammoth = require('mammoth');
const { extractOrderedTextFromPdf } = require('./pdfTextService');

const WORD_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function isPdfFile(mimeType, filename) {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(filename || '');
}

function isWordFile(mimeType, filename) {
  return WORD_MIME_TYPES.includes(mimeType) || /\.docx?$/i.test(filename || '');
}

async function extractTextFromFile(buffer, mimeType, filename) {
  if (isWordFile(mimeType, filename)) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }
  if (isPdfFile(mimeType, filename)) {
    return extractOrderedTextFromPdf(buffer);
  }
  return null; // Ảnh hoặc định dạng khác - không đọc được văn bản
}

// Đếm SỐ LẦN "Câu N" xuất hiện trong văn bản (không phân biệt hoa thường,
// chấp nhận "Câu 1", "Câu 1.", "Câu 1:"...) - CỐ Ý đếm số lần lặp lại (không
// dùng Set khử trùng), vì đề thi thường đánh số lại từ 1 ở MỖI CHỦ ĐỀ (Câu 1,
// 2, 3... hết chủ đề 1 lại quay về Câu 1, 2, 3... cho chủ đề 2) - "Câu 1" vì
// vậy hợp lệ khi xuất hiện NHIỀU LẦN trong cùng 1 file đáp án, mỗi lần ứng
// với 1 chủ đề khác nhau.
function countQuestionNumberOccurrences(text) {
  const counts = new Map();
  const re = /Câu\s*(\d{1,3})\b/gi;
  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return counts;
}

// `topicCounts`: mảng số câu hỏi CỦA TỪNG CHỦ ĐỀ theo đúng thứ tự trong đề
// (VD [10, 15] = chủ đề 1 có 10 câu đánh số 1-10, chủ đề 2 có 15 câu đánh số
// lại từ 1-15) - PHẢN ÁNH ĐÚNG cách đánh số lại theo từng chủ đề của đề thi,
// khác hẳn cách đếm "Câu 1..N" liên tục kiểu cũ (sai với đề nhiều chủ đề).
// Với mỗi chủ đề có N câu, "Câu 1" tới "Câu N" đều cần xuất hiện ÍT NHẤT 1
// lần trong TOÀN BỘ văn bản đáp án ứng với chủ đề đó - vì không tách được
// chính xác ranh giới từng chủ đề trong file đáp án (có thể trình bày khác
// đề gốc), ta gộp lại thành: với mỗi số thứ tự N, tổng SỐ LẦN "Câu N" cần
// xuất hiện = số chủ đề có từ N câu trở lên; nếu số lần thấy được trong file
// đáp án ÍT HƠN mức cần, coi là còn thiếu lời giải cho (mức cần - số lần
// thấy) chủ đề chứa câu N đó.
async function checkAnswerKeyCoverage(buffer, mimeType, filename, topicCounts) {
  const text = await extractTextFromFile(buffer, mimeType, filename);
  if (text === null) {
    return {
      supported: false,
      message: 'Không đọc được nội dung file này để kiểm tra tự động (chỉ hỗ trợ Word/PDF) - vui lòng tự kiểm tra bằng mắt.',
    };
  }

  const totalQuestions = topicCounts.reduce((sum, c) => sum + c, 0);

  // Số lần "Câu N" CẦN xuất hiện (số chủ đề có ít nhất N câu)
  const requiredCounts = new Map();
  topicCounts.forEach((count) => {
    for (let n = 1; n <= count; n += 1) {
      requiredCounts.set(n, (requiredCounts.get(n) || 0) + 1);
    }
  });

  const foundCounts = countQuestionNumberOccurrences(text);

  const missingDetail = [];
  requiredCounts.forEach((requiredCount, n) => {
    const foundCount = foundCounts.get(n) || 0;
    if (foundCount < requiredCount) {
      missingDetail.push({ qNum: n, missingCount: requiredCount - foundCount });
    }
  });
  missingDetail.sort((a, b) => a.qNum - b.qNum);

  const missingNumbers = missingDetail.map((d) => d.qNum);
  const missingTotal = missingDetail.reduce((sum, d) => sum + d.missingCount, 0);

  return {
    supported: true,
    totalQuestions,
    coveredCount: totalQuestions - missingTotal,
    missingNumbers,
    missingDetail,
    isComplete: missingDetail.length === 0,
  };
}

module.exports = { checkAnswerKeyCoverage, countQuestionNumberOccurrences, extractTextFromFile };
