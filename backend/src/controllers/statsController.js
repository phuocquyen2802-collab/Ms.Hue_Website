const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('../services/weaknessAnalysisService');

// [Học sinh] Xem các chủ đề yếu nhất của chính mình (kèm theo dữ liệu của từng đề và lộ trình AI)
function getMyWeakTopics(req, res) {
  const studentId = req.user.id;
  const allProposals = dataAccess.findMany('generated_exercises', (r) => r.studentId === studentId);
  const submissions = dataAccess
    .findMany('submissions', { studentId })
    .map((s) => {
      const exam = dataAccess.findById('exams', s.examId);
      const topicStats = weaknessAnalysisService.getTopicStatsForSubmission(s.id);
      const weakTopics = topicStats.filter((t) => t.totalWrong > 0);

      // Chỉ lấy lộ trình AI của chính xác đợt nộp này (không lấy chéo của đợt nộp khác)
      const candidateRoadmaps = allProposals.filter((r) => r.sourceSubmissionId === s.id);
      candidateRoadmaps.sort((a, b) => {
        if (a.status === 'approved' && b.status !== 'approved') return -1;
        if (b.status === 'approved' && a.status !== 'approved') return 1;
        return new Date(b.reviewedAt || b.generatedAt || 0) - new Date(a.reviewedAt || a.generatedAt || 0);
      });
      const roadmapRecord = candidateRoadmaps[0] || null;

      return {
        id: s.id,
        examId: s.examId,
        examTitle: exam ? exam.title : s.examId,
        isAiGenerated: Boolean(exam?.isAiGenerated),
        sourceExamId: exam?.sourceExamId || null,
        attempt: s.attempt || 1,
        score: s.score,
        correctCount: s.correctCount,
        totalQuestions: s.totalQuestions,
        submittedAt: s.submittedAt,
        topicStats,
        weakTopics,
        roadmap: roadmapRecord && roadmapRecord.status === 'approved' ? roadmapRecord : null,
        roadmapStatus: roadmapRecord ? roadmapRecord.status : 'none',
      };
    })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const weakTags = weaknessAnalysisService.getWeakTags(studentId);
  const allTopicStats = weaknessAnalysisService.getStudentTopicStats(studentId);

  return res.json({ weakTags, allTopicStats, submissions });
}

// [Giáo viên] Danh sách học sinh (để chọn xem thống kê hoặc giao đề)
function listStudents(req, res) {
  const students = dataAccess
    .findMany('users', { role: 'student' })
    .map(({ passwordHash, ...rest }) => rest);
  return res.json(students);
}

// [Giáo viên] Thống kê điểm yếu chi tiết của 1 học sinh
function getStudentStats(req, res) {
  const student = dataAccess.findById('users', req.params.studentId);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ message: 'Không tìm thấy học sinh' });
  }

  const allTopicStats = weaknessAnalysisService.getStudentTopicStats(student.id);
  const weakTags = weaknessAnalysisService.getWeakTags(student.id);

  return res.json({
    student: { id: student.id, name: student.name, className: student.className },
    allTopicStats,
    weakTags,
  });
}

// [Giáo viên] Thống kê điểm yếu chung của cả lớp (gộp theo tag)
// Query param tùy chọn: ?studentIds=id1,id2 để chỉ xét 1 nhóm học sinh
function getClassWeakTopics(req, res) {
  let studentIds;
  if (req.query.studentIds) {
    studentIds = req.query.studentIds.split(',').map((s) => s.trim());
  } else {
    studentIds = dataAccess.findMany('users', { role: 'student' }).map((u) => u.id);
  }

  const classWeakTopics = weaknessAnalysisService.getClassWeakTopics(studentIds);
  return res.json({ studentCount: studentIds.length, classWeakTopics });
}

// [Giáo viên] Toàn bộ bài nộp của mọi học sinh, kèm tên học sinh + tên đề,
// sắp xếp mới nhất trước. Dùng để hiển thị thông báo "có bài nộp mới".
function listAllSubmissions(req, res) {
  const submissions = dataAccess.findAll('submissions');
  const students = dataAccess.findMany('users', { role: 'student' });
  const exams = dataAccess.findAll('exams');
  const questions = dataAccess.findAll('questions');

  const enriched = submissions
    .map((s) => {
      const exam = exams.find((e) => e.id === s.examId);
      const examQuestions = exam ? questions.filter((q) => q.examId === exam.id) : [];
      const totalQuestions = s.totalQuestions || (examQuestions.length > 0 ? examQuestions.length : 0);
      const topicStats = weaknessAnalysisService.getTopicStatsForSubmission(s.id);
      const weakTopics = topicStats.filter((t) => t.totalWrong > 0);
      return {
        ...s,
        totalQuestions,
        studentName: students.find((st) => st.id === s.studentId)?.name || s.studentId,
        examTitle: exam?.title || s.examId,
        topicStats,
        weakTopics,
      };
    })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return res.json(enriched);
}

module.exports = { getMyWeakTopics, listStudents, getStudentStats, getClassWeakTopics, listAllSubmissions };
