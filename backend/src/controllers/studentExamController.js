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

// ---------------------------------------------------------------------------
// Phiên làm bài (exam_sessions): đồng hồ đếm ngược tính theo giờ MÁY CHỦ từ lúc
// học sinh bấm "Bắt đầu làm bài", nên tải lại trang không làm lại được giờ.
// Mỗi phiên lưu: giờ bắt đầu, hạn nộp, đáp án đã chọn (tự lưu) và các lần
// rời khỏi màn hình làm bài.
// ---------------------------------------------------------------------------

// Rời màn hình làm bài tới lần thứ MAX_EXAM_VIOLATIONS thì bài tự động nộp.
const MAX_EXAM_VIOLATIONS = 3;
// Cho phép trễ một chút vì độ trễ mạng khi bài tự nộp lúc hết giờ.
const SESSION_GRACE_MS = 30 * 1000;
// Tải lại / đóng trang thường đã bị ghi 1 lần "chuyển tab" hoặc "mất focus"
// ngay lúc rời đi - khi quay lại trong khoảng này không tính thêm lần nữa.
const RESUME_DEDUPE_MS = 15 * 1000;
const UNLOAD_VIOLATION_TYPES = ['tab-hidden', 'window-blur'];
const VIOLATION_TYPES = ['mouse-leave', 'tab-hidden', 'window-blur', 'fullscreen-exit', 'navigate', 'resume'];
const SUBMIT_REASONS = ['manual', 'timeout', 'violations'];

function findActiveSession(examId, studentId) {
  return dataAccess.findOne(
    'exam_sessions',
    (s) => s.examId === examId && s.studentId === studentId && s.status === 'in_progress'
  );
}

function sessionEndMs(session) {
  return new Date(session.endsAt).getTime();
}

function isSessionExpired(session, now = Date.now()) {
  return now > sessionEndMs(session) + SESSION_GRACE_MS;
}

function publicSession(session) {
  return {
    id: session.id,
    startedAt: session.startedAt,
    endsAt: session.endsAt,
    serverNow: new Date().toISOString(),
    answers: session.answers || {},
    violationCount: (session.violations || []).length,
    maxViolations: MAX_EXAM_VIOLATIONS,
  };
}

// Chỉ giữ các cặp {questionId: "A"} hợp lệ của đề này.
function sanitizeAnswerMap(raw, questions) {
  const result = {};
  if (!raw || typeof raw !== 'object') return result;
  questions.forEach((q) => {
    const key = raw[q.id];
    if (typeof key !== 'string') return;
    if ((q.options || []).some((o) => o.key === key)) result[q.id] = key;
  });
  return result;
}

function answerArrayToMap(answers) {
  const map = {};
  (answers || []).forEach((a) => {
    if (a && typeof a.questionId === 'string') map[a.questionId] = a.selectedAnswer;
  });
  return map;
}

function examPublicInfo(exam) {
  const { assignedTo, ...info } = exam;
  return info;
}

// Chấm điểm và lưu 1 lượt nộp bài. `answerMap`: {questionId: đáp án đã chọn}.
// `meta`: thông tin phiên làm bài (thời gian làm, số lần rời màn hình...).
function gradeAndSaveSubmission(exam, studentId, questions, answerMap, meta = {}) {
  // Đếm số lần học sinh đã làm đề này trước đó để đánh số đợt làm (attempt)
  const prevSubmissions = dataAccess.findMany('submissions', { examId: exam.id, studentId });
  const attempt = prevSubmissions.length + 1;

  let correctCount = 0;
  const submissionId = `s-${uuidv4()}`;
  const now = new Date().toISOString();
  const answerRecords = [];

  questions.forEach((question) => {
    const selectedAnswer = Object.prototype.hasOwnProperty.call(answerMap, question.id)
      ? answerMap[question.id] ?? null
      : null;
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
    studentId,
    totalQuestions,
    correctCount,
    score,
    attempt,
    status: 'graded',
    submittedAt: now,
    ...meta,
  };

  dataAccess.insert('submissions', submission);
  answerRecords.forEach((record) => dataAccess.insert('submission_answers', record));

  // Tái tính toán lại thống kê điểm yếu chính xác theo toàn bộ bài nộp hiện có
  weaknessAnalysisService.recomputeStudentTopicStats([studentId]);

  return { submission, answerRecords };
}

// Kết thúc 1 phiên: chấm bài với `answerMap` (mặc định là đáp án đã tự lưu
// trên máy chủ) rồi đóng phiên lại.
function finalizeSession(exam, session, reason, answerMap = session.answers || {}) {
  const questions = dataAccess.findMany('questions', { examId: exam.id });
  const now = Date.now();
  const endMs = sessionEndMs(session);
  const startMs = new Date(session.startedAt).getTime();
  const meta = {
    startedAt: session.startedAt,
    timeSpentSeconds: Math.max(0, Math.round((Math.min(now, endMs) - startMs) / 1000)),
    durationMinutes: session.durationMinutes,
    violationCount: (session.violations || []).length,
    submitReason: reason,
  };
  const result = gradeAndSaveSubmission(exam, session.studentId, questions, answerMap, meta);
  dataAccess.updateById('exam_sessions', session.id, {
    status: 'submitted',
    submissionId: result.submission.id,
    finishedAt: new Date(now).toISOString(),
  });
  return result;
}

function loadAssignedExam(req, res) {
  const exam = dataAccess.findById('exams', req.params.examId);
  if (!exam) {
    res.status(404).json({ message: 'Không tìm thấy đề thi' });
    return null;
  }
  if (!exam.assignedTo.includes(req.user.id)) {
    res.status(403).json({ message: 'Đề thi này không được giao cho bạn' });
    return null;
  }
  return exam;
}

// Thông tin đề trước khi làm bài (màn hình "Bắt đầu làm bài"). Câu hỏi CHỈ
// được gửi khi học sinh bấm bắt đầu (startExam) để không xem trước được đề.
function getExamToDo(req, res) {
  const exam = loadAssignedExam(req, res);
  if (!exam) return null;

  // Lượt làm dở đã quá giờ (VD học sinh đóng trang rồi quay lại sau) -> nộp
  // luôn với các đáp án đã tự lưu.
  const session = findActiveSession(exam.id, req.user.id);
  if (session && isSessionExpired(session)) {
    const { submission } = finalizeSession(exam, session, 'timeout');
    return res.json({ ...examPublicInfo(exam), finalizedSubmissionId: submission.id, finalizedReason: 'timeout' });
  }

  const questionCount = dataAccess.findMany('questions', { examId: exam.id }).length;

  // Lịch sử các lần nộp bài trước đó của học sinh với đề thi này
  const previousSubmissions = dataAccess
    .findMany('submissions', { examId: exam.id, studentId: req.user.id })
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  return res.json({
    ...examPublicInfo(exam),
    questionCount,
    previousSubmissions,
    maxViolations: MAX_EXAM_VIOLATIONS,
    activeSession: session ? publicSession(session) : null,
  });
}

// Học sinh bấm "Bắt đầu làm bài": tạo phiên mới (hoặc tiếp tục phiên đang làm
// dở) và trả về câu hỏi - KHÔNG kèm correctAnswer để tránh lộ đáp án.
function startExam(req, res) {
  const exam = loadAssignedExam(req, res);
  if (!exam) return null;

  const questions = dataAccess.findMany('questions', { examId: exam.id });
  if (questions.length === 0) {
    return res.status(400).json({ message: 'Đề thi chưa có câu hỏi' });
  }

  let session = findActiveSession(exam.id, req.user.id);
  if (session && isSessionExpired(session)) {
    const { submission } = finalizeSession(exam, session, 'timeout');
    return res.json({ finalizedSubmissionId: submission.id, finalizedReason: 'timeout' });
  }

  let resumed = false;
  const nowIso = new Date().toISOString();
  if (session) {
    // Quay lại sau khi đã rời trang làm bài (tải lại / đóng tab) - tính là 1
    // lần rời màn hình, thời gian vẫn chạy tiếp từ lúc bắt đầu.
    resumed = true;
    const violations = [...(session.violations || [])];
    const last = violations[violations.length - 1];
    const countedOnLeave = last
      && UNLOAD_VIOLATION_TYPES.includes(last.type)
      && Date.now() - new Date(last.at).getTime() <= RESUME_DEDUPE_MS;
    if (!countedOnLeave) violations.push({ type: 'resume', at: nowIso });
    session = dataAccess.updateById('exam_sessions', session.id, { violations, updatedAt: nowIso });
    if (violations.length >= MAX_EXAM_VIOLATIONS) {
      const { submission } = finalizeSession(exam, session, 'violations');
      return res.json({ finalizedSubmissionId: submission.id, finalizedReason: 'violations' });
    }
  } else {
    const durationMinutes = Number(exam.durationMinutes) > 0 ? Number(exam.durationMinutes) : 45;
    session = dataAccess.insert('exam_sessions', {
      id: `es-${uuidv4()}`,
      examId: exam.id,
      studentId: req.user.id,
      status: 'in_progress',
      durationMinutes,
      startedAt: nowIso,
      endsAt: new Date(Date.now() + durationMinutes * 60 * 1000).toISOString(),
      answers: {},
      violations: [],
      updatedAt: nowIso,
    });
  }

  return res.json({
    resumed,
    exam: examPublicInfo(exam),
    questions: questions.map(({ correctAnswer, ...rest }) => rest), // ẩn đáp án đúng
    session: publicSession(session),
  });
}

// Trong lúc làm bài: tự lưu đáp án và/hoặc ghi nhận 1 lần rời màn hình.
// Body: { answers?: {questionId: "A"}, violation?: { type } }
function updateExamSession(req, res) {
  const exam = loadAssignedExam(req, res);
  if (!exam) return null;

  const session = findActiveSession(exam.id, req.user.id);
  if (!session) {
    return res.status(404).json({ message: 'Không có lượt làm bài nào đang diễn ra' });
  }
  if (isSessionExpired(session)) {
    const { submission } = finalizeSession(exam, session, 'timeout');
    return res.json({ finalizedSubmissionId: submission.id, finalizedReason: 'timeout' });
  }

  const nowIso = new Date().toISOString();
  const changes = { updatedAt: nowIso };
  const { answers, violation } = req.body || {};

  if (answers && typeof answers === 'object') {
    const questions = dataAccess.findMany('questions', { examId: exam.id });
    changes.answers = sanitizeAnswerMap(answers, questions);
  }
  if (violation) {
    const type = VIOLATION_TYPES.includes(violation.type) ? violation.type : 'other';
    changes.violations = [...(session.violations || []), { type, at: nowIso }];
  }

  const updated = dataAccess.updateById('exam_sessions', session.id, changes);
  const violationCount = (updated.violations || []).length;

  if (violationCount >= MAX_EXAM_VIOLATIONS) {
    const { submission } = finalizeSession(exam, updated, 'violations');
    return res.json({ finalizedSubmissionId: submission.id, finalizedReason: 'violations', violationCount });
  }

  return res.json({
    violationCount,
    maxViolations: MAX_EXAM_VIOLATIONS,
    endsAt: updated.endsAt,
    serverNow: nowIso,
  });
}

// Nộp bài làm - cho phép làm lại nhiều lần và lưu lịch sử từng đợt.
// Body: { answers: [{ questionId, selectedAnswer }], reason?: 'manual' | 'timeout' | 'violations' }
function submitExam(req, res) {
  const exam = loadAssignedExam(req, res);
  if (!exam) return null;

  const { answers, reason } = req.body || {};
  const session = findActiveSession(exam.id, req.user.id);

  if (!session) {
    // Phiên vừa được máy chủ tự nộp (hết giờ / rời màn hình quá số lần) ngay
    // trước đó -> trả lại đúng bài đã nộp, không tạo thêm 1 lượt mới.
    const recent = dataAccess
      .findMany(
        'exam_sessions',
        (s) => s.examId === exam.id && s.studentId === req.user.id && s.status === 'submitted' && s.submissionId
      )
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0];
    if (recent && Date.now() - new Date(recent.finishedAt).getTime() < 5 * 60 * 1000) {
      const submission = dataAccess.findById('submissions', recent.submissionId);
      if (submission) return res.json(submission);
    }
  }

  if (!session && !Array.isArray(answers)) {
    return res.status(400).json({ message: 'answers phải là một mảng' });
  }

  const questions = dataAccess.findMany('questions', { examId: exam.id });
  if (questions.length === 0) {
    return res.status(400).json({ message: 'Đề thi chưa có câu hỏi' });
  }

  if (session) {
    const now = Date.now();
    // Nộp quá hạn (đã hết cả thời gian chờ) -> chỉ chấm các đáp án đã tự lưu
    // trước khi hết giờ, bỏ qua đáp án gửi kèm.
    const late = isSessionExpired(session, now);
    const answerMap = !late && Array.isArray(answers)
      ? sanitizeAnswerMap(answerArrayToMap(answers), questions)
      : session.answers || {};
    let submitReason = SUBMIT_REASONS.includes(reason) ? reason : 'manual';
    if (now >= sessionEndMs(session)) submitReason = 'timeout';
    const { submission, answerRecords } = finalizeSession(exam, session, submitReason, answerMap);
    return res.status(201).json({ ...submission, answers: answerRecords });
  }

  // Không có phiên làm bài (phiên bản giao diện cũ) - chấm như trước đây.
  const { submission, answerRecords } = gradeAndSaveSubmission(
    exam,
    req.user.id,
    questions,
    answerArrayToMap(answers)
  );
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
      diagram: question.diagram || null,
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
  startExam,
  updateExamSession,
  submitExam,
  listMySubmissions,
  getSubmissionDetail,
};
