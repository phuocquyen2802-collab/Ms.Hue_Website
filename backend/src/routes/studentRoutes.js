const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  listAssignedExams,
  getExamToDo,
  submitExam,
  listMySubmissions,
  getSubmissionDetail,
} = require('../controllers/studentExamController');
const { getMyWeakTopics } = require('../controllers/statsController');
const { getMyApprovedRoadmaps } = require('../controllers/generatedExerciseController');
const { listMyGroups } = require('../controllers/studentGroupController');

const router = express.Router();

// Toàn bộ route dưới đây chỉ dành cho học sinh
router.use(verifyToken, requireRole('student'));

router.get('/exams', listAssignedExams);
router.get('/exams/:examId', getExamToDo);
router.post('/exams/:examId/submit', submitExam);

router.get('/submissions', listMySubmissions);
router.get('/submissions/:submissionId', getSubmissionDetail);

router.get('/me/weak-topics', getMyWeakTopics);
router.get('/me/roadmaps', getMyApprovedRoadmaps);
router.get('/me/groups', listMyGroups);

module.exports = router;
