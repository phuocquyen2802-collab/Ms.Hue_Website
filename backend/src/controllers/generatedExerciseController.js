const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('../services/weaknessAnalysisService');
const geminiService = require('../services/geminiService');
const { slugify } = require('../utils/slugify');

function buildCacheKey(submissionId, weakTags) {
  const sortedTagSlugs = weakTags
    .map((t) => t.tag)
    .sort()
    .map(slugify);
  return `submission-${submissionId}_${sortedTagSlugs.join('_')}`;
}

// [Giáo viên] Sinh roadmap + bài tập tương tự dựa trên điểm yếu của MỘT bài
// nộp cụ thể (1 đề thi) - mỗi đề có lộ trình riêng, không gộp chung điểm
// yếu từ các đề khác của học sinh đó.
async function generateForSubmission(req, res) {
  const submission = dataAccess.findById('submissions', req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ message: 'Không tìm thấy bài nộp' });
  }
  const exam = dataAccess.findById('exams', submission.examId);
  if (!exam || exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền thao tác trên bài nộp này' });
  }
  const student = dataAccess.findById('users', submission.studentId);

  const weakTags = weaknessAnalysisService.getWeakTagsForSubmission(submission.id);
  if (weakTags.length === 0) {
    return res.status(400).json({
      message: 'Học sinh không có câu nào sai trong đề này, chưa cần sinh lộ trình ôn tập',
    });
  }

  // Trích xuất danh sách các câu hỏi học sinh làm sai thực tế
  const answers = dataAccess.findMany('submission_answers', { submissionId: submission.id });
  const wrongAnswers = answers.filter((a) => !a.isCorrect);
  const wrongQuestions = wrongAnswers.map((ans) => {
    const q = dataAccess.findById('questions', ans.questionId);
    return {
      id: ans.questionId,
      content: q ? q.content : '',
      options: q ? q.options : [],
      correctAnswer: q ? q.correctAnswer : '',
      // Field lưu trong 'submission_answers' tên là 'selectedAnswer' (xem
      // studentExamController.js:submitExam), KHÔNG phải 'selectedOption' -
      // nhầm tên field khiến giá trị luôn undefined, hiển thị sai thành
      // "Chưa chọn" dù học sinh đã chọn đáp án.
      selectedOption: ans.selectedAnswer,
      tags: q && q.tags ? q.tags : ans.tags,
      // Dữ liệu hình vẽ GỐC (nếu câu này có) - gửi kèm để Gemini vẽ hình
      // TƯƠNG TỰ chính xác (cùng loại + cùng cấu trúc dữ liệu) cho bài tập
      // sinh thêm, thay vì phải đoán loại hình chỉ dựa vào chữ trong đề bài.
      diagram: q ? q.diagram || null : null,
    };
  });

  const force = req.query.force === 'true' || req.body?.force === true;
  const cacheKey = buildCacheKey(submission.id, weakTags);
  if (force) {
    // Xóa toàn bộ các bản đề xuất cũ của submission này để sinh bản mới hoàn toàn
    const existing = dataAccess.findMany('generated_exercises', (r) => r.sourceSubmissionId === submission.id);
    existing.forEach((rec) => dataAccess.removeById('generated_exercises', rec.id));
  } else {
    const cached = dataAccess.findOne('generated_exercises', { cacheKey, status: 'pending_review' })
      || dataAccess.findOne('generated_exercises', { cacheKey, status: 'approved' });
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  let aiResult;
  try {
    aiResult = await geminiService.generateRoadmapAndExercises(
      student ? student.name : submission.studentId,
      weakTags,
      wrongQuestions
    );
  } catch (err) {
    return res.status(502).json({ message: `Lỗi khi gọi Gemini API: ${err.message}` });
  }

  const record = {
    id: `ge-${uuidv4()}`,
    studentId: submission.studentId,
    sourceExamId: exam.id,
    sourceSubmissionId: submission.id,
    examId: null, // sẽ được điền khi giáo viên duyệt, trỏ tới đề bài tập tiếp theo được tạo ra
    weakTags: weakTags.map((t) => t.tag),
    cacheKey,
    roadmap: { summary: aiResult.summary, steps: aiResult.steps },
    exercises: aiResult.exercises,
    // Phân tích riêng từng câu học sinh làm sai (vì sao chọn nhầm + lời giải
    // đúng chi tiết cho chính câu đó) - kèm luôn câu hỏi gốc để hiển thị đối
    // chiếu, vì "questionIndex" AI trả về chỉ là số thứ tự trong danh sách
    // gửi lên, không phải id câu hỏi thật.
    questionAnalyses: aiResult.questionAnalyses || [],
    wrongQuestions,
    status: 'pending_review',
    reviewedBy: null,
    generatedAt: new Date().toISOString(),
  };

  dataAccess.insert('generated_exercises', record);
  return res.status(201).json({ ...record, fromCache: false });
}

// [Giáo viên] Danh sách đề xuất AI, có thể lọc theo studentId / sourceExamId
// / status (mặc định chỉ lấy 'pending_review' nếu không truyền status)
function listGeneratedExercises(req, res) {
  const { studentId, sourceExamId, status } = req.query;
  let records = dataAccess.findAll('generated_exercises');
  if (studentId) records = records.filter((r) => r.studentId === studentId);
  if (sourceExamId) records = records.filter((r) => r.sourceExamId === sourceExamId);
  if (status) {
    records = records.filter((r) => r.status === status);
  } else if (!req.query.allStatus) {
    records = records.filter((r) => r.status === 'pending_review');
  }

  // Kèm tên đề nguồn để hiển thị rõ "đề xuất này sinh ra từ đề nào"
  const enriched = records.map((r) => {
    const sourceExam = r.sourceExamId ? dataAccess.findById('exams', r.sourceExamId) : null;
    return { ...r, sourceExamTitle: sourceExam ? sourceExam.title : null };
  });

  return res.json(enriched);
}

function getGeneratedExerciseDetail(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất' });
  }
  return res.json(record);
}

// [Giáo viên] Duyệt đề xuất: LUÔN gửi phần văn bản (tóm tắt + lộ trình) cho
// học sinh. Nếu `includeExercises` là true (mặc định), tạo thêm 1 đề thi
// thật (bài tập tiếp theo) từ "exercises" và giao ngay cho học sinh đó,
// tái sử dụng luồng giao đề bình thường - đề mới này được coi là "con" của
// đề nguồn (sourceExamId). Nếu giáo viên bỏ chọn, chỉ duyệt phần văn bản,
// không tạo đề/câu hỏi trắc nghiệm đi kèm.
// [Giáo viên] Chỉnh sửa đề xuất (nhận xét, các bước lộ trình, câu hỏi bài tập) trước khi duyệt
function updateGeneratedExercise(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất' });
  }

  const updates = {};
  if (req.body.roadmap) updates.roadmap = req.body.roadmap;
  if (req.body.exercises) updates.exercises = req.body.exercises;
  if (req.body.weakTags) updates.weakTags = req.body.weakTags;

  const updated = dataAccess.updateById('generated_exercises', record.id, updates);
  return res.json(updated);
}

// [Giáo viên] Duyệt đề xuất: LUÔN gửi phần văn bản (tóm tắt + lộ trình) cho
// học sinh. Nếu `includeExercises` là true (mặc định), tạo thêm 1 đề thi
// thật (bài tập tiếp theo) từ "exercises" và giao ngay cho học sinh đó.
function approveGeneratedExercise(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất' });
  }
  if (record.status !== 'pending_review') {
    return res.status(409).json({ message: `Đề xuất này đã ở trạng thái '${record.status}', không thể duyệt lại` });
  }

  const includeExercises = req.body.includeExercises !== false; // mặc định true nếu không truyền
  const roadmap = req.body.roadmap || record.roadmap;
  const exercises = req.body.exercises || record.exercises;
  const weakTags = req.body.weakTags || record.weakTags;

  let exam = null;
  if (includeExercises && exercises && exercises.length > 0) {
    const student = dataAccess.findById('users', record.studentId);
    const sourceExam = record.sourceExamId ? dataAccess.findById('exams', record.sourceExamId) : null;

    exam = {
      id: `e-${uuidv4()}`,
      title: `Bài tập tiếp theo${sourceExam ? ` cho đề "${sourceExam.title}"` : ''} - ${student ? student.name : record.studentId}`,
      description: `Đề tự động sinh dựa trên các chủ đề yếu: ${weakTags.join(', ')}`,
      createdBy: req.user.id,
      assignedTo: [record.studentId],
      durationMinutes: exercises.length * 2,
      status: 'assigned',
      createdAt: new Date().toISOString(),
      // Đánh dấu đây là đề AI sinh thêm TỪ 1 đề gốc - dùng để nhóm hiển thị
      // như "thư mục con" của đề gốc trong danh sách đề thi (giáo viên) và
      // "Luyện đề" (học sinh), thay vì hiện tách rời như 1 đề độc lập.
      sourceExamId: record.sourceExamId || null,
      isAiGenerated: true,
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
    reviewedBy: req.user.id,
    reviewedAt: new Date().toISOString(),
    examId: exam ? exam.id : null,
  });

  return res.json({ generatedExercise: updated, createdExam: exam });
}

// [Giáo viên] Từ chối đề xuất (ví dụ câu hỏi AI sinh không đạt chất lượng)
function rejectGeneratedExercise(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất' });
  }
  if (record.status !== 'pending_review') {
    return res.status(409).json({ message: `Đề xuất này đã ở trạng thái '${record.status}'` });
  }

  const updated = dataAccess.updateById('generated_exercises', record.id, {
    status: 'rejected',
    reviewedBy: req.user.id,
  });
  return res.json(updated);
}

// [Giáo viên] Chỉnh sửa nội dung đề xuất AI (roadmap / exercises) trước hoặc sau khi duyệt
function updateGeneratedExercise(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất' });
  }

  const { roadmap, exercises, weakTags, questionAnalyses } = req.body || {};
  const payload = {};
  if (roadmap) payload.roadmap = roadmap;
  if (Array.isArray(exercises)) payload.exercises = exercises;
  if (Array.isArray(questionAnalyses)) payload.questionAnalyses = questionAnalyses;
  if (Array.isArray(weakTags)) payload.weakTags = weakTags;
  payload.updatedAt = new Date().toISOString();

  const updated = dataAccess.updateById('generated_exercises', record.id, payload);
  return res.json(updated);
}

// [Học sinh] Xem các roadmap đã được giáo viên duyệt cho chính mình
function getMyApprovedRoadmaps(req, res) {
  const records = dataAccess
    .findMany('generated_exercises', { studentId: req.user.id, status: 'approved' })
    .map(({ exercises, ...rest }) => {
      const sourceExam = rest.sourceExamId ? dataAccess.findById('exams', rest.sourceExamId) : null;
      const sourceSubmission = rest.sourceSubmissionId ? dataAccess.findById('submissions', rest.sourceSubmissionId) : null;
      return {
        ...rest,
        sourceExamTitle: sourceExam ? sourceExam.title : null,
        attempt: sourceSubmission?.attempt || 1,
        score: sourceSubmission?.score,
        submittedAt: sourceSubmission?.submittedAt,
      };
    })
    .sort((a, b) => new Date(b.reviewedAt || b.generatedAt) - new Date(a.reviewedAt || a.generatedAt));
  return res.json(records);
}

// [Giáo viên] Xóa hoàn toàn bản đề xuất AI (roadmap & exercises)
function deleteGeneratedExercise(req, res) {
  const record = dataAccess.findById('generated_exercises', req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Không tìm thấy đề xuất cần xóa' });
  }
  dataAccess.removeById('generated_exercises', record.id);
  return res.json({ success: true, message: 'Đã xóa bản đề xuất AI thành công' });
}

module.exports = {
  generateForSubmission,
  listGeneratedExercises,
  getGeneratedExerciseDetail,
  approveGeneratedExercise,
  rejectGeneratedExercise,
  deleteGeneratedExercise,
  updateGeneratedExercise,
  getMyApprovedRoadmaps,
};

