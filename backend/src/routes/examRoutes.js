const express = require('express');
const multer = require('multer');
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
} = require('../controllers/examController');
const { previewImportStandalone, previewImport, addQuestionsBulk } = require('../controllers/importController');

const router = express.Router();

// Lưu file upload tạm trong bộ nhớ (không ghi ra đĩa) - đề thi thường chỉ
// vài MB nên không cần lưu file tạm phức tạp.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Toàn bộ route quản lý đề thi chỉ dành cho giáo viên
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

module.exports = router;
