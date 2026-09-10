// Service phân tích điểm yếu của học sinh dựa trên student_topic_stats.
// Đây là logic dùng chung cho: API xem thống kê của giáo viên/học sinh,
// và sẽ là đầu vào để gọi Gemini sinh roadmap ở Bước 7.

const dataAccess = require('../models/dataAccess');
const { MIN_QUESTIONS_THRESHOLD } = require('../config/constants');

// Lấy toàn bộ thống kê theo tag của 1 học sinh, sắp xếp tỷ lệ sai giảm dần
function getStudentTopicStats(studentId) {
  return dataAccess
    .findMany('student_topic_stats', { studentId })
    .sort((a, b) => b.wrongRate - a.wrongRate);
}

// Xác định các chủ đề yếu nhất của 1 học sinh.
// Chỉ xét các tag đã làm đủ số câu tối thiểu (MIN_QUESTIONS_THRESHOLD) để
// tránh kết luận sai lệch khi học sinh mới làm 1-2 câu thuộc tag đó.
function getWeakTags(studentId, { limit = 3 } = {}) {
  const eligibleStats = dataAccess
    .findMany('student_topic_stats', { studentId })
    .filter((stat) => stat.totalAnswered >= MIN_QUESTIONS_THRESHOLD && stat.wrongRate > 0);

  return eligibleStats
    .sort((a, b) => b.wrongRate - a.wrongRate || b.totalWrong - a.totalWrong)
    .slice(0, limit);
}

// Thống kê điểm yếu chung của cả lớp: gộp totalAnswered/totalWrong theo tag
// trên tất cả học sinh được truyền vào (dùng cho giáo viên xem tổng quan).
function getClassWeakTopics(studentIds, { limit = 5 } = {}) {
  const allStats = studentIds.flatMap((studentId) =>
    dataAccess.findMany('student_topic_stats', { studentId })
  );

  const tagTotals = {}; // { [tag]: { totalAnswered, totalWrong, studentCount } }
  allStats.forEach((stat) => {
    if (!tagTotals[stat.tag]) {
      tagTotals[stat.tag] = { tag: stat.tag, totalAnswered: 0, totalWrong: 0, studentCount: 0 };
    }
    tagTotals[stat.tag].totalAnswered += stat.totalAnswered;
    tagTotals[stat.tag].totalWrong += stat.totalWrong;
    tagTotals[stat.tag].studentCount += 1;
  });

  return Object.values(tagTotals)
    .filter((t) => t.totalAnswered >= MIN_QUESTIONS_THRESHOLD)
    .map((t) => ({ ...t, wrongRate: Math.round((t.totalWrong / t.totalAnswered) * 100) / 100 }))
    .sort((a, b) => b.wrongRate - a.wrongRate)
    .slice(0, limit);
}

// Xác định chủ đề yếu dựa trên MỘT bài nộp cụ thể (1 đề thi), không gộp
// chung với các đề khác - dùng cho luồng "mỗi đề có 1 lộ trình AI riêng".
// Không áp dụng MIN_QUESTIONS_THRESHOLD như getWeakTags() vì phạm vi đã
// hẹp sẵn (chỉ trong 1 đề), thường mỗi tag chỉ có 1-2 câu - chỉ cần trả lời
// sai là đủ tín hiệu để đưa vào lộ trình ôn tập ngay sau bài thi đó.
function getWeakTagsForSubmission(submissionId, { limit = 3 } = {}) {
  const answers = dataAccess.findMany('submission_answers', { submissionId });

  const tagTally = {}; // { [tag]: { totalAnswered, totalWrong } }
  answers.forEach((answer) => {
    answer.tags.forEach((tag) => {
      if (!tagTally[tag]) tagTally[tag] = { tag, totalAnswered: 0, totalWrong: 0 };
      tagTally[tag].totalAnswered += 1;
      if (!answer.isCorrect) tagTally[tag].totalWrong += 1;
    });
  });

  return Object.values(tagTally)
    .filter((t) => t.totalWrong > 0)
    .map((t) => ({ ...t, wrongRate: Math.round((t.totalWrong / t.totalAnswered) * 100) / 100 }))
    .sort((a, b) => b.wrongRate - a.wrongRate || b.totalWrong - a.totalWrong)
    .slice(0, limit);
}

// Tính toán LẠI TỪ ĐẦU thống kê điểm yếu tổng hợp của các học sinh được
// truyền vào, dựa trên toàn bộ bài nộp HIỆN CÒN TỒN TẠI. Dùng khi xoá đề
// thi (làm mất một số submission_answers) để "student_topic_stats" không
// còn giữ số liệu ma từ đề đã xoá - xoá hết bản ghi cũ rồi cộng lại từ đầu
// thay vì trừ dần (an toàn hơn, tránh lệch số/âm do trừ sai).
function recomputeStudentTopicStats(studentIds) {
  studentIds.forEach((studentId) => {
    dataAccess
      .findMany('student_topic_stats', { studentId })
      .forEach((stat) => dataAccess.removeById('student_topic_stats', stat.id));

    const submissions = dataAccess.findMany('submissions', { studentId });
    const tagTally = {}; // { [tag]: { totalAnswered, totalWrong } }

    submissions.forEach((submission) => {
      dataAccess.findMany('submission_answers', { submissionId: submission.id }).forEach((answer) => {
        answer.tags.forEach((tag) => {
          if (!tagTally[tag]) tagTally[tag] = { totalAnswered: 0, totalWrong: 0 };
          tagTally[tag].totalAnswered += 1;
          if (!answer.isCorrect) tagTally[tag].totalWrong += 1;
        });
      });
    });

    const now = new Date().toISOString();
    Object.entries(tagTally).forEach(([tag, { totalAnswered, totalWrong }]) => {
      dataAccess.insert('student_topic_stats', {
        id: `${studentId}_${tag}`,
        studentId,
        tag,
        totalAnswered,
        totalWrong,
        wrongRate: Math.round((totalWrong / totalAnswered) * 100) / 100,
        lastUpdated: now,
      });
    });
  });
}

// Lấy thống kê tỷ lệ làm sai theo từng chuyên đề của RIÊNG 1 bài nộp (1 đợt làm)
function getTopicStatsForSubmission(submissionId) {
  const answers = dataAccess.findMany('submission_answers', { submissionId });
  const tagTally = {};
  answers.forEach((answer) => {
    const tags = (answer.tags && answer.tags.length > 0) ? answer.tags : ['Kiến thức chung'];
    tags.forEach((tag) => {
      if (!tagTally[tag]) tagTally[tag] = { tag, totalAnswered: 0, totalWrong: 0, totalCorrect: 0 };
      tagTally[tag].totalAnswered += 1;
      if (!answer.isCorrect) tagTally[tag].totalWrong += 1;
      else tagTally[tag].totalCorrect += 1;
    });
  });

  return Object.values(tagTally)
    .map((t) => ({
      ...t,
      wrongRate: t.totalAnswered > 0 ? Math.round((t.totalWrong / t.totalAnswered) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.wrongRate - a.wrongRate);
}

module.exports = {
  getStudentTopicStats,
  getWeakTags,
  getClassWeakTopics,
  getWeakTagsForSubmission,
  getTopicStatsForSubmission,
  recomputeStudentTopicStats,
};
