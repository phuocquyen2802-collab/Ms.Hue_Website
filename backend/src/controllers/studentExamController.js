const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('../services/weaknessAnalysisService');

// Danh sách đề thi đã được giao cho học sinh hiện tại
function listAssignedExams(req, res) {
  const exams = dataAccess
    .findMany('exams', { status: 'assigned' })
    .filter((exam) => exam.assignedTo.includes(req.user.id));
  return res.json(exams);
}

// Xem chi tiết đề để làm bài - KHÔNG trả về correctAnswer để tránh lộ đáp án
function getExamToDo(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (!exam.assignedTo.includes(req.user.id)) {
    return res.status(403).json({ message: 'Đề thi này không được giao cho bạn' });
  }

  const questions = dataAccess
    .findMany('questions', { examId: exam.id })
    .map(({ correctAnswer, ...rest }) => rest); // ẩn đáp án đúng

  // Lấy lịch sử các lần nộp bài trước đó của học sinh với đề thi này
  const previousSubmissions = dataAccess
    .findMany('submissions', { examId: exam.id, studentId: req.user.id })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return res.json({ ...exam, questions, previousSubmissions });
}

// Nộp bài làm - cho phép làm lại nhiều lần và lưu lịch sử từng đợt
function submitExam(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (!exam.assignedTo.includes(req.user.id)) {
    return res.status(403).json({ message: 'Đề thi này không được giao cho bạn' });
  }

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: 'answers phải là một mảng' });
  }

  const questions = dataAccess.findMany('questions', { examId: exam.id });
  if (questions.length === 0) {
    return res.status(400).json({ message: 'Đề thi chưa có câu hỏi' });
  }

  // Đếm số lần học sinh đã làm đề này trước đó để đánh số đợt làm (attempt)
  const prevSubmissions = dataAccess.findMany('submissions', {
    examId: exam.id,
    studentId: req.user.id,
  });
  const attempt = prevSubmissions.length + 1;

  // Map questionId -> câu trả lời học sinh chọn (nếu có)
  const answerMap = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]));

  let correctCount = 0;
  const submissionId = `s-${uuidv4()}`;
  const now = new Date().toISOString();

  const answerRecords = [];

  questions.forEach((question) => {
    const selectedAnswer = answerMap.has(question.id) ? answerMap.get(question.id) : null;
    const isCorrect = selectedAnswer === question.correctAnswer;
    if (isCorrect) correctCount += 1;

    answerRecords.push({
      id: `sa-${uuidv4()}`,
      submissionId,
      questionId: question.id,
      selectedAnswer,
      isCorrect,
      tags: question.tags,
    });
  });

  const totalQuestions = questions.length;
  const score = Math.round((correctCount / totalQuestions) * 10 * 10) / 10; // thang điểm 10, làm tròn 1 chữ số thập phân

  const submission = {
    id: submissionId,
    examId: exam.id,
    studentId: req.user.id,
    totalQuestions,
    correctCount,
    score,
    attempt,
    status: 'graded',
    submittedAt: now,
  };

  dataAccess.insert('submissions', submission);
  answerRecords.forEach((record) => dataAccess.insert('submission_answers', record));

  // Tái tính toán lại thống kê điểm yếu chính xác theo toàn bộ bài nộp hiện có
  weaknessAnalysisService.recomputeStudentTopicStats([req.user.id]);

  return res.status(201).json({ ...submission, answers: answerRecords });
}

// Danh sách các lượt nộp bài của học sinh hiện tại (sắp xếp mới nhất trước)
function listMySubmissions(req, res) {
  const submissions = dataAccess.findMany('submissions', { studentId: req.user.id });
  const exams = dataAccess.findAll('exams');

  const enriched = submissions
    .map((s) => {
      const exam = exams.find((e) => e.id === s.examId);
      return {
        ...s,
        examTitle: exam?.title || s.examId,
      };
    })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return res.json(enriched);
}

// Chi tiết 1 lượt nộp bài, kèm đáp án đúng/sai từng câu và lịch sử các đợt làm của đề này
function getSubmissionDetail(req, res) {
  const submission = dataAccess.findById('submissions', req.params.submissionId);
  if (!submission || submission.studentId !== req.user.id) {
    return res.status(404).json({ message: 'Không tìm thấy bài nộp' });
  }

  const exam = dataAccess.findById('exams', submission.examId);
  const answers = dataAccess.findMany('submission_answers', { submissionId: submission.id });
  const questions = dataAccess.findMany('questions', { examId: submission.examId });

  // Lấy tất cả các lần làm của đề thi này bởi học sinh này để hiển thị lịch sử / tiến trình điểm số
  const historySubmissions = dataAccess
    .findMany('submissions', { examId: submission.examId, studentId: req.user.id })
    .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));

  const detailedAnswers = questions.map((question) => {
    const answer = answers.find((a) => a.questionId === question.id);
    return {
      ...(answer || {}),
      questionId: question.id,
      selectedAnswer: answer ? answer.selectedAnswer : null,
      isCorrect: answer ? answer.isCorrect : false,
      correctAnswer: question.correctAnswer,
      content: question.content,
      options: question.options || [],
      tags: question.tags || [],
    };
  });

  // Tính thống kê tỷ lệ làm sai theo từng chuyên đề của RIÊNG đề thi này
  const topicMap = {};
  detailedAnswers.forEach((ans) => {
    const tags = (ans.tags && ans.tags.length > 0) ? ans.tags : ['Kiến thức chung'];
    tags.forEach((tag) => {
      if (!topicMap[tag]) {
        topicMap[tag] = { tag, totalAnswered: 0, totalWrong: 0, totalCorrect: 0 };
      }
      topicMap[tag].totalAnswered += 1;
      if (!ans.isCorrect) {
        topicMap[tag].totalWrong += 1;
      } else {
        topicMap[tag].totalCorrect += 1;
      }
    });
  });

  const examTopicStats = Object.values(topicMap).map((t) => ({
    ...t,
    wrongRate: t.totalAnswered > 0 ? t.totalWrong / t.totalAnswered : 0,
  })).sort((a, b) => b.wrongRate - a.wrongRate);

  const examWeakTopics = examTopicStats.filter((t) => t.totalWrong > 0);

  // Tìm lộ trình AI tương ứng với chính xác đợt nộp này (chỉ khi giáo viên đã duyệt đúng đợt này)
  const candidateRoadmaps = dataAccess.findMany('generated_exercises', (r) => r.sourceSubmissionId === submission.id);
  candidateRoadmaps.sort((a, b) => {
    if (a.status === 'approved' && b.status !== 'approved') return -1;
    if (b.status === 'approved' && a.status !== 'approved') return 1;
    return new Date(b.reviewedAt || b.generatedAt || 0) - new Date(a.reviewedAt || a.generatedAt || 0);
  });
  const roadmapRecord = candidateRoadmaps[0] || null;

  return res.json({
    ...submission,
    examTitle: exam?.title || submission.examId,
    examDescription: exam?.description || '',
    durationMinutes: exam?.durationMinutes || 45,
    answers: detailedAnswers,
    historySubmissions,
    examTopicStats,
    examWeakTopics,
    roadmap: roadmapRecord && roadmapRecord.status === 'approved' ? roadmapRecord : null,
    roadmapStatus: roadmapRecord ? roadmapRecord.status : 'none',
  });
}

module.exports = {
  listAssignedExams,
  getExamToDo,
  submitExam,
  listMySubmissions,
  getSubmissionDetail,
};
