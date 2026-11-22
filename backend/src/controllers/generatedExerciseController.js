const dataAccess = require('../models/dataAccess');
const weaknessAnalysisService = require('../services/weaknessAnalysisService');
const roadmapJobService = require('../services/roadmapJobService');

// [Giáo viên] Sinh nhận xét + lộ trình + bài tập tương tự cho MỘT bài nộp
// (mỗi đề có lộ trình riêng). Việc gọi AI chạy NGẦM trên máy chủ
// (roadmapJobService) nên trả về ngay 202 + trạng thái job; giáo viên tải lại
// trang hay chuyển sang trang khác thì AI vẫn chạy tiếp, mở lại trang là thấy
// tiến độ / kết quả, không phải bấm sinh lại từ đầu.
function generateForSubmission(req, res) {
  const submission = dataAccess.findById('submissions', req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ message: 'Không tìm thấy bài nộp' });
  }
  const exam = dataAccess.findById('exams', submission.examId);
  if (!exam || exam.createdBy !== req.user.id) {
    return res.status(403).json({ message: 'Bạn không có quyền thao tác trên bài nộp này' });
  }

  const weakTags = weaknessAnalysisService.getWeakTagsForSubmission(submission.id);
  if (weakTags.length === 0) {
    return res.status(400).json({
      message: 'Học sinh không có câu nào sai trong đề này, chưa cần sinh lộ trình ôn tập',
    });
  }

  // AI đang phân tích bài này rồi (do giáo viên bấm trước đó hoặc chế độ tự
  // động) -> trả lại job đang chạy, không gọi AI trùng.
  const activeJob = roadmapJobService.getActiveJob(submission.id);
  if (activeJob) {
    return res.status(202).json({ job: roadmapJobService.publicJob(activeJob) });
  }

  const force = req.query.force === 'true' || req.body?.force === true;
  if (force) {
    // Xoá các bản đề xuất cũ của bài nộp này để sinh bản mới hoàn toàn
    dataAccess.removeMany('generated_exercises', (r) => r.sourceSubmissionId === submission.id);
  } else {
    const cacheKey = roadmapJobService.buildCacheKey(submission.id, weakTags);
    const cached = dataAccess.findOne('generated_exercises', { cacheKey, status: 'pending_review' })
      || dataAccess.findOne('generated_exercises', { cacheKey, status: 'approved' });
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  const job = roadmapJobService.enqueue(submission.id, 'manual', { priority: true });
  return res.status(202).json({ job: roadmapJobService.publicJob(job) });
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

  const result = roadmapJobService.approveProposal(record, {
    includeExercises: req.body.includeExercises !== false, // mặc định true nếu không truyền
    roadmap: req.body.roadmap || record.roadmap,
    exercises: req.body.exercises || record.exercises,
    weakTags: req.body.weakTags || record.weakTags,
    creatorId: req.user.id,
    reviewerId: req.user.id,
  });
  return res.json(result);
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

