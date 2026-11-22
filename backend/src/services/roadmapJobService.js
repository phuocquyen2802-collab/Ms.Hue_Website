// Hàng đợi sinh "nhận xét + lộ trình ôn tập + bài tập tương tự" bằng AI cho
// từng bài nộp, chạy NGẦM trên máy chủ:
// - Gemini mất 15 giây tới vài phút; trước đây giáo viên phải giữ nguyên trang
//   chờ 1 request duy nhất, tải lại trang / chuyển trang là mất trạng thái và
//   phải bấm sinh lại từ đầu. Giờ việc sinh là 1 "job" lưu ngay trên bài nộp
//   (submission.aiJob), trang nào mở lại cũng đọc được tiến độ, và máy chủ
//   khởi động lại thì job đang dở được chạy tiếp (resumePending).
// - Đề thi bật chế độ tự động (exam.aiRoadmapMode = 'auto', mặc định cho đề
//   giáo viên tạo): học sinh nộp bài có câu sai là AI tự sinh và GỬI THẲNG lộ
//   trình cho học sinh, không cần giáo viên duyệt; học sinh nhận thông báo
//   qua chuông thông báo khi xong.
//
// submission.aiJob = { status: 'queued' | 'running' | 'done' | 'failed',
//   mode: 'auto' | 'manual', requestedAt, startedAt, finishedAt, attempts,
//   error, proposalId }

const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('./weaknessAnalysisService');
const geminiService = require('./geminiService');
const { slugify } = require('../utils/slugify');

// Số bài được phân tích cùng lúc - tránh cả lớp nộp bài một lượt làm Gemini
// từ chối vì quá giới hạn tần suất. Các bài còn lại xếp hàng chờ.
const CONCURRENCY = Math.max(1, Number(process.env.AI_ROADMAP_CONCURRENCY) || 2);
// Chế độ tự động không có ai bấm "thử lại" nên tự thử thêm 1 lần nếu lỗi.
const AUTO_MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 20 * 1000;
const ACTIVE_STATUSES = ['queued', 'running'];

const queue = []; // submissionId theo thứ tự chờ
const waiting = new Set(); // đang chờ trong hàng (kể cả chờ thử lại)
const running = new Set();

// Chế độ gửi lộ trình của 1 đề. Đề cũ (chưa có trường này) mặc định tự
// động; riêng đề luyện tập do AI sinh thì mặc định chờ duyệt để không tự đẻ
// ra chuỗi đề luyện tập nối tiếp nhau.
function roadmapModeOf(exam) {
  if (!exam) return 'review';
  if (exam.aiRoadmapMode === 'auto' || exam.aiRoadmapMode === 'review') return exam.aiRoadmapMode;
  return exam.isAiGenerated ? 'review' : 'auto';
}

function roadmapExercisesOf(exam) {
  return !exam || exam.aiRoadmapExercises !== false;
}

function isActive(job) {
  return Boolean(job && ACTIVE_STATUSES.includes(job.status));
}

// Phần trạng thái job gửi cho giao diện.
function publicJob(job) {
  if (!job) return null;
  const { status, mode, requestedAt, startedAt, finishedAt, error, attempts } = job;
  return { status, mode, requestedAt, startedAt, finishedAt, error: error || null, attempts: attempts || 0 };
}

function getJob(submissionId) {
  const submission = dataAccess.findById('submissions', submissionId);
  return submission ? submission.aiJob || null : null;
}

function getActiveJob(submissionId) {
  const job = getJob(submissionId);
  return isActive(job) ? job : null;
}

function setJob(submissionId, changes) {
  const submission = dataAccess.findById('submissions', submissionId);
  if (!submission) return null;
  const job = { ...(submission.aiJob || {}), ...changes };
  dataAccess.updateById('submissions', submissionId, { aiJob: job });
  return job;
}

function buildCacheKey(submissionId, weakTags) {
  const sortedTagSlugs = weakTags
    .map((t) => t.tag)
    .sort()
    .map(slugify);
  return `submission-${submissionId}_${sortedTagSlugs.join('_')}`;
}

// Các câu học sinh làm sai trong 1 bài nộp, kèm dữ liệu câu hỏi gốc để AI
// phân tích lỗi sai và sinh bài tương tự.
function collectWrongQuestions(submissionId) {
  const answers = dataAccess.findMany('submission_answers', { submissionId });
  return answers
    .filter((a) => !a.isCorrect)
    .map((ans) => {
      const q = dataAccess.findById('questions', ans.questionId);
      return {
        id: ans.questionId,
        content: q ? q.content : '',
        options: q ? q.options : [],
        correctAnswer: q ? q.correctAnswer : '',
        // Field lưu trong 'submission_answers' tên là 'selectedAnswer', KHÔNG
        // phải 'selectedOption' (nhầm tên khiến luôn hiển thị "Chưa chọn").
        selectedOption: ans.selectedAnswer,
        tags: q && q.tags ? q.tags : ans.tags,
        // Hình vẽ gốc (nếu có) để Gemini vẽ hình TƯƠNG TỰ cho bài sinh thêm.
        diagram: q ? q.diagram || null : null,
      };
    });
}

// Gửi đề xuất cho học sinh: LUÔN gửi phần văn bản (nhận xét + lộ trình).
// Nếu `includeExercises`, tạo thêm 1 đề luyện tập thật từ "exercises" và giao
// ngay cho học sinh đó (đề "con" của đề nguồn). Dùng chung cho giáo viên bấm
// duyệt và chế độ AI tự gửi.
function approveProposal(record, {
  includeExercises = true,
  roadmap = record.roadmap,
  exercises = record.exercises,
  weakTags = record.weakTags,
  creatorId,
  reviewerId = null,
  autoApproved = false,
} = {}) {
  let exam = null;
  if (includeExercises && exercises && exercises.length > 0) {
    const student = dataAccess.findById('users', record.studentId);
    const sourceExam = record.sourceExamId ? dataAccess.findById('exams', record.sourceExamId) : null;

    exam = {
      id: `e-${uuidv4()}`,
      title: `Bài tập tiếp theo${sourceExam ? ` cho đề "${sourceExam.title}"` : ''} - ${student ? student.name : record.studentId}`,
      description: `Đề tự động sinh dựa trên các chủ đề yếu: ${weakTags.join(', ')}`,
      createdBy: creatorId,
      assignedTo: [record.studentId],
      durationMinutes: exercises.length * 2,
      status: 'assigned',
      createdAt: new Date().toISOString(),
      // Nhóm hiển thị như "thư mục con" của đề gốc.
      sourceExamId: record.sourceExamId || null,
      isAiGenerated: true,
      // Đề luyện tập không tự sinh tiếp lộ trình (tránh chuỗi đề vô hạn).
      aiRoadmapMode: 'review',
      aiRoadmapExercises: true,
    };
    dataAccess.insert('exams', exam);

    exercises.forEach((exercise) => {
      dataAccess.insert('questions', {
        id: `q-${uuidv4()}`,
        examId: exam.id,
        content: exercise.content,
        options: exercise.options,
        correctAnswer: exercise.correctAnswer,
        tags: exercise.tags && exercise.tags.length > 0 ? exercise.tags : weakTags,
        difficulty: 'medium',
        diagram: exercise.diagram || null,
        createdAt: new Date().toISOString(),
      });
    });
  }

  const updated = dataAccess.updateById('generated_exercises', record.id, {
    roadmap,
    exercises,
    weakTags,
    status: 'approved',
    reviewedBy: reviewerId,
    reviewedAt: new Date().toISOString(),
    autoApproved,
    examId: exam ? exam.id : null,
  });

  return { generatedExercise: updated, createdExam: exam };
}

// Gọi Gemini cho 1 bài nộp và lưu đề xuất. Chế độ 'auto' gửi thẳng cho học
// sinh; chế độ 'manual' (giáo viên bấm) để ở trạng thái chờ duyệt.
async function generateProposal(submissionId, mode) {
  const submission = dataAccess.findById('submissions', submissionId);
  if (!submission) return null;
  const exam = dataAccess.findById('exams', submission.examId);
  if (!exam) return null;
  const student = dataAccess.findById('users', submission.studentId);

  const weakTags = weaknessAnalysisService.getWeakTagsForSubmission(submission.id);
  if (weakTags.length === 0) return null;
  const wrongQuestions = collectWrongQuestions(submission.id);

  let aiResult;
  try {
    aiResult = await geminiService.generateRoadmapAndExercises(
      student ? student.name : submission.studentId,
      weakTags,
      wrongQuestions
    );
  } catch (err) {
    throw new Error(`Lỗi khi gọi Gemini API: ${err.message}`);
  }

  // Trong lúc chờ AI, bài nộp / đề có thể đã bị xoá.
  if (!dataAccess.findById('submissions', submission.id)) return null;
  const currentExam = dataAccess.findById('exams', exam.id);
  if (!currentExam) return null;

  const record = {
    id: `ge-${uuidv4()}`,
    studentId: submission.studentId,
    sourceExamId: exam.id,
    sourceSubmissionId: submission.id,
    examId: null, // điền khi duyệt: đề luyện tập được tạo ra
    weakTags: weakTags.map((t) => t.tag),
    cacheKey: buildCacheKey(submission.id, weakTags),
    roadmap: { summary: aiResult.summary, steps: aiResult.steps },
    exercises: aiResult.exercises,
    // Phân tích riêng từng câu sai + câu hỏi gốc để hiển thị đối chiếu.
    questionAnalyses: aiResult.questionAnalyses || [],
    wrongQuestions,
    status: 'pending_review',
    reviewedBy: null,
    generatedAt: new Date().toISOString(),
    generatedBy: mode === 'auto' ? 'auto' : 'teacher',
  };
  dataAccess.insert('generated_exercises', record);

  if (mode === 'auto') {
    const { generatedExercise } = approveProposal(record, {
      includeExercises: roadmapExercisesOf(currentExam),
      creatorId: currentExam.createdBy,
      autoApproved: true,
    });
    return generatedExercise;
  }
  return record;
}

async function runJob(submissionId) {
  const submission = dataAccess.findById('submissions', submissionId);
  if (!submission || !submission.aiJob) return;
  const mode = submission.aiJob.mode === 'auto' ? 'auto' : 'manual';
  const attempts = (submission.aiJob.attempts || 0) + 1;
  const startedMs = Date.now();
  const queuedSeconds = ((startedMs - new Date(submission.aiJob.requestedAt || startedMs).getTime()) / 1000).toFixed(1);
  setJob(submissionId, { status: 'running', startedAt: new Date(startedMs).toISOString(), attempts });

  try {
    const record = await generateProposal(submissionId, mode);
    console.log(`[AI lộ trình] Bài nộp ${submissionId} (${mode}, lần ${attempts}): chờ hàng ${queuedSeconds}s, AI chạy ${((Date.now() - startedMs) / 1000).toFixed(1)}s`);
    setJob(submissionId, {
      status: 'done',
      finishedAt: new Date().toISOString(),
      error: null,
      proposalId: record ? record.id : null,
    });
  } catch (err) {
    const message = err.message || 'Lỗi không xác định khi gọi AI';
    console.error(`[AI lộ trình] Bài nộp ${submissionId} lỗi (lần ${attempts}):`, message);
    const maxAttempts = mode === 'auto' ? AUTO_MAX_ATTEMPTS : 1;
    if (attempts < maxAttempts && setJob(submissionId, { status: 'queued', error: message })) {
      waiting.add(submissionId);
      setTimeout(() => {
        queue.push(submissionId);
        pump();
      }, RETRY_DELAY_MS);
      return;
    }
    setJob(submissionId, { status: 'failed', finishedAt: new Date().toISOString(), error: message });
  }
}

function pump() {
  while (running.size < CONCURRENCY && queue.length > 0) {
    const submissionId = queue.shift();
    waiting.delete(submissionId);
    if (running.has(submissionId)) continue;
    running.add(submissionId);
    runJob(submissionId)
      .catch((err) => {
        console.error(`[AI lộ trình] Job ${submissionId} dừng bất thường:`, err);
        setJob(submissionId, { status: 'failed', finishedAt: new Date().toISOString(), error: err.message });
      })
      .finally(() => {
        running.delete(submissionId);
        pump();
      });
  }
}

// Xếp 1 bài nộp vào hàng chờ phân tích. Bài đang chờ/đang chạy thì trả lại
// job hiện có, không tạo job trùng. `priority`: giáo viên bấm tay được chen
// lên đầu hàng.
function enqueue(submissionId, mode, { priority = false } = {}) {
  const submission = dataAccess.findById('submissions', submissionId);
  if (!submission) return null;
  if (isActive(submission.aiJob) && (waiting.has(submissionId) || running.has(submissionId))) {
    return submission.aiJob;
  }

  const job = setJob(submissionId, {
    status: 'queued',
    mode: mode === 'auto' ? 'auto' : 'manual',
    requestedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    attempts: 0,
    error: null,
    proposalId: null,
  });
  waiting.add(submissionId);
  if (priority) queue.unshift(submissionId);
  else queue.push(submissionId);
  pump();
  return job;
}

// Gọi ngay sau khi chấm xong 1 bài nộp (nộp tay, hết giờ, rời màn hình...).
function onSubmissionGraded(exam, submission) {
  if (!exam || !submission) return;
  if (roadmapModeOf(exam) !== 'auto') return;
  if (submission.correctCount >= submission.totalQuestions) return; // không có câu sai
  enqueue(submission.id, 'auto');
}

// Khi máy chủ khởi động lại: chạy tiếp các job còn dở (đang chờ/đang chạy).
function resumePending() {
  const pending = dataAccess.findMany('submissions', (s) => isActive(s.aiJob));
  pending
    .sort((a, b) => new Date(a.aiJob.requestedAt || 0) - new Date(b.aiJob.requestedAt || 0))
    .forEach((s) => enqueue(s.id, s.aiJob.mode));
  if (pending.length > 0) {
    console.log(`[AI lộ trình] Chạy tiếp ${pending.length} bài đang phân tích dở`);
  }
}

// Lộ trình hiển thị cho học sinh của 1 bài nộp: bản đã gửi (approved) nếu có,
// trạng thái 'generating' khi AI đang soạn, 'pending_review' khi chờ giáo
// viên duyệt, 'none' nếu chưa có gì.
function studentRoadmapView(submission, proposals) {
  const candidates = (proposals || dataAccess.findMany('generated_exercises', { sourceSubmissionId: submission.id }))
    .filter((r) => r.sourceSubmissionId === submission.id)
    .sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (b.status === 'approved' && a.status !== 'approved') return 1;
      return new Date(b.reviewedAt || b.generatedAt || 0) - new Date(a.reviewedAt || a.generatedAt || 0);
    });
  const record = candidates[0] || null;
  if (record && record.status === 'approved') {
    return { roadmap: record, roadmapStatus: 'approved' };
  }
  if (isActive(submission.aiJob)) {
    return { roadmap: null, roadmapStatus: 'generating' };
  }
  return { roadmap: null, roadmapStatus: record ? record.status : 'none' };
}

module.exports = {
  roadmapModeOf,
  roadmapExercisesOf,
  publicJob,
  getJob,
  getActiveJob,
  buildCacheKey,
  approveProposal,
  enqueue,
  onSubmissionGraded,
  resumePending,
  studentRoadmapView,
};
