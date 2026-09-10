const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const { importExamFromDocx } = require('../services/docxImportService');

// [Giáo viên] Tải file .docx lên để bóc tách câu hỏi xem trước (không cần examId trước)
async function previewImportStandalone(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Thiếu file .docx' });
  }

  try {
    const result = await importExamFromDocx(req.file.buffer);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: `Không đọc được file Word: ${err.message}` });
  }
}

// [Giáo viên] Tải file .docx lên, trả về danh sách câu hỏi NHÁP để xem
// trước và chỉnh sửa - CHƯA lưu vào đề thi. Việc lưu thật diễn ra ở
// addQuestionsBulk sau khi giáo viên xác nhận từng câu.
async function previewImport(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền sửa đề thi này' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'Thiếu file .docx' });
  }

  try {
    const result = await importExamFromDocx(req.file.buffer);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: `Không đọc được file Word: ${err.message}` });
  }
}

// [Giáo viên] Thêm nhiều câu hỏi cùng lúc vào đề (dùng sau khi giáo viên đã
// kiểm tra/chỉnh sửa danh sách câu hỏi nháp từ previewImport).
function addQuestionsBulk(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền sửa đề thi này' });
  }

  const { questions } = req.body;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'questions phải là mảng khác rỗng' });
  }

  const errors = [];
  questions.forEach((q, index) => {
    if (!q.content || !Array.isArray(q.options) || q.options.length < 2 || !q.correctAnswer) {
      errors.push(`Câu ${index + 1}: thiếu content, options hoặc correctAnswer`);
      return;
    }
    if (!q.options.some((o) => o.key === q.correctAnswer)) {
      errors.push(`Câu ${index + 1}: correctAnswer không khớp key nào trong options`);
      return;
    }
    if (!Array.isArray(q.tags) || q.tags.length === 0) {
      errors.push(`Câu ${index + 1}: thiếu tag chủ đề`);
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Một số câu hỏi không hợp lệ', errors });
  }

  const created = questions.map((q) => {
    const question = {
      id: `q-${uuidv4()}`,
      examId: exam.id,
      content: q.content,
      options: q.options,
      correctAnswer: q.correctAnswer,
      tags: q.tags,
      difficulty: q.difficulty || 'medium',
      createdAt: new Date().toISOString(),
    };
    dataAccess.insert('questions', question);
    return question;
  });

  return res.status(201).json({ created: created.length, questions: created });
}

module.exports = { previewImportStandalone, previewImport, addQuestionsBulk };
