const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  listAssignedExams,
  getExamToDo,
  startExam,
  updateExamSession,
  submitExam,
  listMySubmissions,
  getSubmissionDetail,
} = require('../controllers/studentExamController');
const { getMyWeakTopics } = require('../controllers/statsController');
const { getMyApprovedRoadmaps } = require('../controllers/generatedExerciseController');
const { listMyGroups } = require('../controllers/studentGroupController');
const {
  listGameBanks, startGame, checkGameAnswer, abandonGame,
} = require('../controllers/questionBankController');
const { listMyGameHistory, getMyGameHistoryDetail } = require('../controllers/gameHistoryController');

const router = express.Router();

// Toàn bộ route dưới đây chỉ dành cho học sinh
router.use(verifyToken, requireRole('student'));

router.get('/exams', listAssignedExams);
router.get('/exams/:examId', getExamToDo);
router.post('/exams/:examId/start', startExam);
router.patch('/exams/:examId/session', updateExamSession);
router.post('/exams/:examId/submit', submitExam);

router.get('/submissions', listMySubmissions);
router.get('/submissions/:submissionId', getSubmissionDetail);

router.get('/me/weak-topics', getMyWeakTopics);
router.get('/me/roadmaps', getMyApprovedRoadmaps);
router.get('/me/groups', listMyGroups);

// Trò chơi "Đường đua Toán học" từ ngân hàng đề
router.get('/games/banks', listGameBanks);
router.post('/games/:bankId/start', startGame);
router.post('/games/:bankId/check', checkGameAnswer);
router.post('/games/sessions/:sessionId/abandon', abandonGame);
// Lịch sử chơi của chính học sinh
router.get('/games/history', listMyGameHistory);
router.get('/games/history/:historyId', getMyGameHistoryDetail);

module.exports = router;
