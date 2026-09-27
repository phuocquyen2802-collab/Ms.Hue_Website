const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  createExam,
  listMyExams,
  getExamDetail,
  updateExam,
  deleteExam,
  getExamSubmissions,
  getSubmissionDetailForTeacher,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  assignExam,
  uploadAnswerKey,
  deleteAnswerKey,
  downloadAnswerKey,
  checkAnswerKeyCoverage,
} = require('../controllers/examController');
const { previewImportStandalone, previewImport, addQuestionsBulk } = require('../controllers/importController');

const router = express.Router();

// Lưu file upload tạm trong bộ nhớ (không ghi ra đĩa) - đề thi thường chỉ
// vài MB nên không cần lưu file tạm phức tạp.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// File đáp án chi tiết lưu thẳng ra đĩa (data/exam_answer_keys) - có thể là
// PDF/ảnh/Word dung lượng lớn hơn 1 chút so với ảnh công thức thông thường.
const answerKeyUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../data/exam_answer_keys')),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Route xem/tải file đáp án chi tiết CÔNG KHAI (không yêu cầu đăng nhập) -
// đặt TRƯỚC middleware requireRole('teacher') bên dưới để học sinh (và ai
// quét mã QR trên điện thoại, có thể chưa đăng nhập trên máy đó) đều xem/tải
// được trực tiếp, giống cơ chế tải file đính kèm chat (chatRoutes.js).
router.get('/:examId/answer-key/download', downloadAnswerKey);

// Toàn bộ route quản lý đề thi còn lại chỉ dành cho giáo viên
router.use(verifyToken, requireRole('teacher'));

router.post('/import-preview', upload.single('file'), previewImportStandalone);
router.post('/', createExam);
router.get('/', listMyExams);
router.get('/:examId', getExamDetail);
router.put('/:examId', updateExam);
router.delete('/:examId', deleteExam);
router.get('/:examId/submissions', getExamSubmissions);
router.get('/:examId/submissions/:submissionId', getSubmissionDetailForTeacher);

router.post('/:examId/questions', addQuestion);
router.post('/:examId/questions/bulk', addQuestionsBulk);
router.put('/:examId/questions/:questionId', updateQuestion);
router.delete('/:examId/questions/:questionId', deleteQuestion);

router.post('/:examId/import-preview', upload.single('file'), previewImport);

router.put('/:examId/assign', assignExam);

router.post('/:examId/answer-key', answerKeyUpload.single('file'), uploadAnswerKey);
router.delete('/:examId/answer-key', deleteAnswerKey);

// So khớp thử đáp án chi tiết với số câu hỏi - đứng độc lập, không cần
// examId (dùng được cả lúc đang tạo đề mới, trước khi đề tồn tại).
router.post('/check-answer-key-coverage', upload.single('file'), checkAnswerKeyCoverage);

module.exports = router;
