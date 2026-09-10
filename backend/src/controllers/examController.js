const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('../services/weaknessAnalysisService');

// Tạo đề thi mới (có thể kèm danh sách học sinh được giao ngay)
function createExam(req, res) {
  const { title, description, durationMinutes, assignedTo, status } = req.body;

  if (!title || !durationMinutes) {
    return res.status(400).json({ message: 'Thiếu title hoặc durationMinutes' });
  }

  const assignedStudentIds = Array.isArray(assignedTo) ? assignedTo : [];
  const initialStatus = status || (assignedStudentIds.length > 0 ? 'assigned' : 'draft');

  const exam = {
    id: `e-${uuidv4()}`,
    title,
    description: description || '',
    createdBy: req.user.id,
    assignedTo: assignedStudentIds,
    durationMinutes: Number(durationMinutes),
    status: initialStatus,
    createdAt: new Date().toISOString(),
  };

  dataAccess.insert('exams', exam);
  return res.status(201).json(exam);
}

// Lấy danh sách đề thi do giáo viên hiện tại tạo (kèm số lượng câu hỏi thực tế)
function listMyExams(req, res) {
  const exams = dataAccess.findMany('exams', { createdBy: req.user.id });
  const allQuestions = dataAccess.findAll('questions');

  const enriched = exams.map((exam) => {
    const questionsCount = allQuestions.filter((q) => q.examId === exam.id).length;
    return {
      ...exam,
      questionsCount,
    };
  });

  return res.json(enriched);
}

// Lấy chi tiết 1 đề thi kèm danh sách câu hỏi (chỉ chủ sở hữu đề mới xem được)
function getExamDetail(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
  }

  const questions = dataAccess.findMany('questions', { examId: exam.id });
  return res.json({ ...exam, questions });
}

// Cập nhật thông tin đề thi (tiêu đề, mô tả, thời gian, trạng thái)
function updateExam(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đề thi này' });
  }

  const { title, description, durationMinutes, status } = req.body;
  const changes = {};

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ message: 'Tên đề thi không được để trống' });
    changes.title = title.trim();
  }
  if (description !== undefined) {
    changes.description = description;
  }
  if (durationMinutes !== undefined) {
    const mins = Number(durationMinutes);
    if (isNaN(mins) || mins < 1) return res.status(400).json({ message: 'Thời gian làm bài không hợp lệ' });
    changes.durationMinutes = mins;
  }
  if (status !== undefined) {
    if (!['draft', 'assigned'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái đề thi không hợp lệ (draft hoặc assigned)' });
    }
    changes.status = status;
  }

  const updated = dataAccess.updateById('exams', exam.id, changes);
  return res.json(updated);
}

// Xoá đề thi và toàn bộ dữ liệu liên quan (câu hỏi, bài nộp của học sinh)
function deleteExam(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xoá đề thi này' });
  }

  // 1. Xoá toàn bộ câu hỏi của đề
  const questions = dataAccess.findMany('questions', { examId: exam.id });
  questions.forEach((q) => dataAccess.removeById('questions', q.id));

  // 2. Xoá toàn bộ bài nộp và chi tiết câu trả lời thuộc đề thi này
  const submissions = dataAccess.findMany('submissions', { examId: exam.id });
  const affectedStudentIds = [...new Set(submissions.map((s) => s.studentId))];
  submissions.forEach((submission) => {
    dataAccess
      .findMany('submission_answers', { submissionId: submission.id })
      .forEach((answer) => dataAccess.removeById('submission_answers', answer.id));
    dataAccess.removeById('submissions', submission.id);
  });

  // 2b. Tính lại thống kê điểm yếu tổng hợp (student_topic_stats) của các
  // học sinh vừa bị xoá bài nộp, để trang "Chuẩn đoán điểm yếu" của học
  // sinh không còn hiện dữ liệu "ma" từ đề đã xoá.
  weaknessAnalysisService.recomputeStudentTopicStats(affectedStudentIds);

  // 3. Xoá mọi đề xuất AI/lộ trình có nguồn gốc phân tích TỪ đề này (mỗi đề
  // có lộ trình riêng - xoá đề thì xoá luôn lộ trình sinh ra từ đề đó).
  dataAccess
    .findMany('generated_exercises', { sourceExamId: exam.id })
    .forEach((proposal) => dataAccess.removeById('generated_exercises', proposal.id));

  // 4. Nếu đề này CHÍNH LÀ đề bài tập được tạo ra từ việc duyệt 1 đề xuất
  // AI (đề "con"), xoá luôn đề xuất đó vì tài liệu đại diện cho nó không
  // còn tồn tại.
  const asApprovedResultOf = dataAccess.findOne('generated_exercises', { examId: exam.id });
  if (asApprovedResultOf) {
    dataAccess.removeById('generated_exercises', asApprovedResultOf.id);
  }

  // 5. Xoá đề thi
  dataAccess.removeById('exams', exam.id);

  return res.status(204).send();
}

// [Giáo viên] Xem kết quả từng học sinh đã nộp đề này, kèm chủ đề yếu được
// phân tích RIÊNG cho đề này (không gộp với các đề khác) và trạng thái đề
// xuất AI (nếu đã sinh) - dùng cho luồng "mỗi đề có 1 lộ trình ôn tập riêng".
function getExamSubmissions(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
  }

  const submissions = dataAccess.findMany('submissions', { examId: exam.id });
  const allProposals = dataAccess.findMany('generated_exercises', { sourceExamId: exam.id });

  const enriched = submissions.map((submission) => {
    const student = dataAccess.findById('users', submission.studentId);
    const weakTags = weaknessAnalysisService.getWeakTagsForSubmission(submission.id);
    const proposal = allProposals.find((p) => p.sourceSubmissionId === submission.id) || null;

    // Lấy toàn bộ các lần làm của học sinh này trên đề thi này để đo lường tiến bộ
    const studentExamSubs = submissions
      .filter((s) => s.studentId === submission.studentId)
      .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));
    const attemptsCount = studentExamSubs.length;
    const firstScore = studentExamSubs[0]?.score ?? submission.score;
    const latestScore = studentExamSubs[studentExamSubs.length - 1]?.score ?? submission.score;
    const maxScore = Math.max(...studentExamSubs.map((s) => s.score ?? 0));
    const scoreDiff = Math.round((latestScore - firstScore) * 10) / 10;

    return {
      submissionId: submission.id,
      studentId: submission.studentId,
      studentName: student ? student.name : submission.studentId,
      studentClassName: student ? student.className : null,
      score: submission.score,
      correctCount: submission.correctCount,
      totalQuestions: submission.totalQuestions,
      submittedAt: submission.submittedAt,
      attempt: submission.attempt || 1,
      attemptsCount,
      firstScore,
      latestScore,
      maxScore,
      scoreDiff,
      weakTags,
      proposal: proposal
        ? {
            id: proposal.id,
            status: proposal.status,
            roadmap: proposal.roadmap,
            exercisesCount: proposal.exercises.length,
            hasExam: Boolean(proposal.examId),
          }
        : null,
    };
  });

  return res.json(enriched);
}

// [Giáo viên] Xem chi tiết TỪNG CÂU của 1 bài nộp cụ thể (học sinh chọn gì,
// đáp án đúng là gì, đúng/sai) - trước đây giáo viên chỉ thấy điểm tổng và
// chủ đề yếu, không xem được bài làm thật của học sinh.
function getSubmissionDetailForTeacher(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền xem đề thi này' });
  }

  const submission = dataAccess.findById('submissions', req.params.submissionId);
  if (!submission || submission.examId !== exam.id) {
    return res.status(404).json({ message: 'Không tìm thấy bài nộp trong đề thi này' });
  }

  const answers = dataAccess.findMany('submission_answers', { submissionId: submission.id });
  const questions = dataAccess.findMany('questions', { examId: exam.id });

  const detailedAnswers = questions.map((q) => {
    const ans = answers.find((a) => a.questionId === q.id);
    return {
      questionId: q.id,
      content: q.content,
      options: q.options,
      correctAnswer: q.correctAnswer,
      selectedAnswer: ans ? ans.selectedAnswer : null,
      isCorrect: ans ? ans.isCorrect : false,
      tags: q.tags || [],
    };
  });

  const student = dataAccess.findById('users', submission.studentId);
  const weakTags = weaknessAnalysisService.getWeakTagsForSubmission(submission.id);
  const allProposals = dataAccess.findMany('generated_exercises', { sourceSubmissionId: submission.id });
  allProposals.sort((a, b) => new Date(b.generatedAt || 0) - new Date(a.generatedAt || 0));
  const proposal = allProposals[0] || null;

  // Lấy lịch sử tất cả các đợt làm bài của học sinh này trên đề thi này
  const historySubmissions = dataAccess
    .findMany('submissions', { examId: exam.id, studentId: submission.studentId })
    .sort((a, b) => (a.attempt || 1) - (b.attempt || 1));

  return res.json({
    ...submission,
    studentName: student ? student.name : submission.studentId,
    studentClassName: student ? student.className : null,
    examTitle: exam.title,
    weakTags,
    proposal,
    answers: detailedAnswers,
    historySubmissions,
  });
}

// Thêm câu hỏi vào đề thi, mỗi câu hỏi bắt buộc phải gắn ít nhất 1 tag chủ đề
function addQuestion(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền sửa đề thi này' });
  }

  const { content, options, correctAnswer, tags, difficulty } = req.body;

  if (!content || !Array.isArray(options) || options.length < 2 || !correctAnswer) {
    return res.status(400).json({ message: 'Thiếu content, options (>=2 lựa chọn) hoặc correctAnswer' });
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: 'Câu hỏi phải có ít nhất 1 tag chủ đề' });
  }
  const validKeys = options.map((o) => o.key);
  if (!validKeys.includes(correctAnswer)) {
    return res.status(400).json({ message: 'correctAnswer phải trùng với 1 key trong options' });
  }

  const question = {
    id: `q-${uuidv4()}`,
    examId: exam.id,
    content,
    options,
    correctAnswer,
    tags,
    difficulty: difficulty || 'medium',
    createdAt: new Date().toISOString(),
  };

  dataAccess.insert('questions', question);
  return res.status(201).json(question);
}

// Sửa 1 câu hỏi đã tồn tại trong đề (vẫn phải thuộc đề của giáo viên này)
function updateQuestion(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền sửa đề thi này' });
  }

  const question = dataAccess.findById('questions', req.params.questionId);
  if (!question || question.examId !== exam.id) {
    return res.status(404).json({ message: 'Không tìm thấy câu hỏi trong đề thi này' });
  }

  const { content, options, correctAnswer, tags, difficulty } = req.body;
  const changes = {};
  if (content) changes.content = content;
  if (options) changes.options = options;
  if (correctAnswer) changes.correctAnswer = correctAnswer;
  if (tags) changes.tags = tags;
  if (difficulty) changes.difficulty = difficulty;

  const updated = dataAccess.updateById('questions', question.id, changes);
  return res.json(updated);
}

// Xoá 1 câu hỏi khỏi đề
function deleteQuestion(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền sửa đề thi này' });
  }

  const question = dataAccess.findById('questions', req.params.questionId);
  if (!question || question.examId !== exam.id) {
    return res.status(404).json({ message: 'Không tìm thấy câu hỏi trong đề thi này' });
  }

  dataAccess.removeById('questions', question.id);
  return res.status(204).send();
}

// Giao đề cho danh sách học sinh (thay thế toàn bộ assignedTo hiện tại)
function assignExam(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    return res.status(404).json({ message: 'Không tìm thấy đề thi' });
  }
  if (exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền giao đề thi này' });
  }

  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ message: 'studentIds phải là mảng khác rỗng' });
  }

  const questionCount = dataAccess.findMany('questions', { examId: exam.id }).length;
  if (questionCount === 0) {
    return res.status(400).json({ message: 'Đề thi chưa có câu hỏi, không thể giao' });
  }

  // Kiểm tra tất cả id đều là học sinh hợp lệ
  const invalidIds = studentIds.filter((id) => {
    const user = dataAccess.findById('users', id);
    return !user || user.role !== 'student';
  });
  if (invalidIds.length > 0) {
    return res.status(400).json({ message: `Các id sau không phải học sinh hợp lệ: ${invalidIds.join(', ')}` });
  }

  const updated = dataAccess.updateById('exams', exam.id, {
    assignedTo: studentIds,
    status: 'assigned',
  });
  return res.json(updated);
}

module.exports = {
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
};
