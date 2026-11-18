const express = require('express');
const multer = require('multer');
const { verifyToken, requireRole } = require('../middleware/auth');
const { listStudents, getStudentStats, getClassWeakTopics, listAllSubmissions } = require('../controllers/statsController');
const {
  generateForSubmission,
  listGeneratedExercises,
  getGeneratedExerciseDetail,
  approveGeneratedExercise,
  rejectGeneratedExercise,
  deleteGeneratedExercise,
  updateGeneratedExercise,
} = require('../controllers/generatedExerciseController');
const { createStudent, updateStudent, deleteStudent } = require('../controllers/studentAccountController');
const { listGroups, createGroup, updateGroup, deleteGroup } = require('../controllers/studentGroupController');
const {
  listBanks, createBank, renameBank, deleteBank, getBankQuestions,
} = require('../controllers/questionBankController');
const { listStudentGameHistory, getStudentGameHistoryDetail } = require('../controllers/gameHistoryController');

const router = express.Router();

router.use(verifyToken, requireRole('teacher'));

router.get('/students', listStudents);
router.post('/students', createStudent);
router.put('/students/:studentId', updateStudent);
router.delete('/students/:studentId', deleteStudent);
router.get('/students/:studentId/stats', getStudentStats);
router.get('/students/:studentId/game-history', listStudentGameHistory);
router.get('/students/:studentId/game-history/:historyId', getStudentGameHistoryDetail);
router.get('/groups', listGroups);
router.post('/groups', createGroup);
router.put('/groups/:groupId', updateGroup);
router.delete('/groups/:groupId', deleteGroup);

router.get('/class-weak-topics', getClassWeakTopics);
router.get('/submissions', listAllSubmissions);

router.post('/submissions/:submissionId/generate-roadmap', generateForSubmission);
router.get('/generated-exercises', listGeneratedExercises);
router.get('/generated-exercises/:id', getGeneratedExerciseDetail);
router.put('/generated-exercises/:id', updateGeneratedExercise);
router.put('/generated-exercises/:id/approve', approveGeneratedExercise);
router.put('/generated-exercises/:id/reject', rejectGeneratedExercise);
router.delete('/generated-exercises/:id', deleteGeneratedExercise);

// Ngân hàng đề cho trò chơi của học sinh (mỗi file Word = 1 chủ đề)
const bankUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
router.get('/question-banks', listBanks);
router.post('/question-banks', bankUpload.single('file'), createBank);
router.put('/question-banks/:bankId', renameBank);
router.delete('/question-banks/:bankId', deleteBank);
router.get('/question-banks/:bankId/questions', getBankQuestions);

module.exports = router;
