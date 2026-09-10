const express = require('express');
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

const router = express.Router();

router.use(verifyToken, requireRole('teacher'));

router.get('/students', listStudents);
router.post('/students', createStudent);
router.put('/students/:studentId', updateStudent);
router.delete('/students/:studentId', deleteStudent);
router.get('/students/:studentId/stats', getStudentStats);
router.get('/class-weak-topics', getClassWeakTopics);
router.get('/submissions', listAllSubmissions);

router.post('/submissions/:submissionId/generate-roadmap', generateForSubmission);
router.get('/generated-exercises', listGeneratedExercises);
router.get('/generated-exercises/:id', getGeneratedExerciseDetail);
router.put('/generated-exercises/:id', updateGeneratedExercise);
router.put('/generated-exercises/:id/approve', approveGeneratedExercise);
router.put('/generated-exercises/:id/reject', rejectGeneratedExercise);
router.delete('/generated-exercises/:id', deleteGeneratedExercise);

module.exports = router;
