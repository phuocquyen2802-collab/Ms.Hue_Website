// Lịch sử chơi trò chơi "Đường đua Toán học" của học sinh.
//
// Mỗi lượt chơi có 1 phiên (game_sessions) tạo lúc bấm "Bắt đầu chơi". Mỗi
// lần chấm 1 câu (/check), máy chủ tự ghi lại câu trả lời ĐẦU TIÊN của câu đó,
// nên kết quả trong lịch sử do máy chủ chấm: học sinh không sửa được điểm, và
// trả lời lại 1 câu cũng không đổi được kết quả câu đó.
// Trả lời xong câu cuối cùng thì phiên thành 1 dòng trong game_history (giữ
// nguyên id) và bị xoá khỏi game_sessions. Bỏ dở (bấm Thoát, đóng trang) thì
// không tính; phiên bỏ dở tự bị xoá sau SESSION_TTL_HOURS giờ để file
// game_sessions luôn nhỏ (file này được đọc/ghi lại sau mỗi câu trả lời).
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');

const SESSIONS = 'game_sessions';
const HISTORY = 'game_history';
const BANKS = 'question_banks';
const BANK_QUESTIONS = 'bank_questions';
const SESSION_TTL_HOURS = 6;
const MAX_OPEN_SESSIONS_PER_STUDENT = 3;
// Mã nhân vật do giao diện gửi lên (frontend/src/components/GameCharacters.jsx).
const CHARACTER_RE = /^[a-z0-9-]{1,32}$/;

const percentOf = (correct, total) => (total ? Math.round((correct / total) * 100) : 0);
const lastActive = (session) => Date.parse(session.lastActivityAt || session.startedAt) || 0;

// Xoá phiên quá hạn của mọi người, và chỉ giữ vài phiên mới nhất của học sinh
// này (chừa chỗ cho phiên sắp tạo) - VD mở nhiều tab rồi bỏ dở.
function pruneSessions(studentId, now) {
  const cutoff = now - SESSION_TTL_HOURS * 60 * 60 * 1000;
  const sessions = dataAccess.findAll(SESSIONS);
  const stale = sessions.filter((s) => lastActive(s) < cutoff);
  const extra = sessions
    .filter((s) => s.studentId === studentId && lastActive(s) >= cutoff)
    .sort((a, b) => lastActive(b) - lastActive(a))
    .slice(MAX_OPEN_SESSIONS_PER_STUDENT - 1);
  const ids = new Set([...stale, ...extra].map((s) => s.id));
  if (ids.size) dataAccess.removeMany(SESSIONS, (s) => ids.has(s.id));
}

function createSession({ studentId, bank, questionIds, characterId }) {
  const now = Date.now();
  pruneSessions(studentId, now);
  const iso = new Date(now).toISOString();
  const session = {
    id: `gs-${uuidv4()}`,
    studentId,
    bankId: bank.id,
    bankTitle: bank.title,
    characterId: CHARACTER_RE.test(String(characterId || '')) ? characterId : null,
    questionIds,
    answers: [],
    startedAt: iso,
    lastActivityAt: iso,
  };
  dataAccess.insert(SESSIONS, session);
  return session;
}

// Ghi câu trả lời vào phiên chơi. Trả về null nếu không ghi được (phiên đã
// hết hạn, không phải của học sinh này, câu không thuộc lượt chơi...): trò
// chơi vẫn chơi tiếp bình thường, chỉ là lượt đó không vào lịch sử.
function recordAnswer({ sessionId, studentId, bankId, question, answer }) {
  const session = sessionId ? dataAccess.findById(SESSIONS, String(sessionId)) : null;
  if (!session || session.studentId !== studentId || session.bankId !== bankId
    || !session.questionIds.includes(question.id)) {
    return null;
  }

  const earlier = session.answers.find((a) => a.questionId === question.id);
  if (earlier) return { answer: earlier, finished: false };

  const chosen = typeof answer === 'string' && answer ? answer.slice(0, 8) : null;
  const entry = {
    questionId: question.id,
    chosen,
    correct: chosen !== null && chosen === question.correctAnswer,
    // Lưu kèm đáp án đúng: giáo viên xoá chủ đề thì lịch sử vẫn hiện được.
    correctAnswer: question.correctAnswer,
  };
  const answers = [...session.answers, entry];
  const nowIso = new Date().toISOString();

  if (answers.length < session.questionIds.length) {
    dataAccess.updateById(SESSIONS, session.id, { answers, lastActivityAt: nowIso });
    return { answer: entry, finished: false };
  }

  // Câu cuối cùng: chuyển cả lượt chơi sang lịch sử.
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const total = session.questionIds.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const record = {
    id: session.id,
    studentId,
    bankId: session.bankId,
    bankTitle: session.bankTitle,
    characterId: session.characterId,
    totalQuestions: total,
    correctCount,
    percent: percentOf(correctCount, total),
    answers: session.questionIds.map((qid) => byQuestion.get(qid)),
    startedAt: session.startedAt,
    finishedAt: nowIso,
    durationSeconds: Math.max(0, Math.round((Date.parse(nowIso) - Date.parse(session.startedAt)) / 1000)),
  };
  dataAccess.insert(HISTORY, record);
  dataAccess.removeById(SESSIONS, session.id);
  return { answer: entry, finished: true, record };
}

// Học sinh bấm Thoát giữa chừng: bỏ phiên, lượt đó không tính.
function abandonSession(sessionId, studentId) {
  const session = dataAccess.findById(SESSIONS, String(sessionId || ''));
  if (!session || session.studentId !== studentId) return false;
  dataAccess.removeById(SESSIONS, session.id);
  return true;
}

// Thông tin tóm tắt 1 lượt chơi (bỏ chi tiết từng câu).
function summaryOf(record) {
  return {
    id: record.id,
    bankId: record.bankId,
    bankTitle: record.bankTitle,
    characterId: record.characterId,
    totalQuestions: record.totalQuestions,
    correctCount: record.correctCount,
    percent: record.percent,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    durationSeconds: record.durationSeconds,
  };
}

// Các lượt chơi của 1 học sinh, mới nhất trước.
function listHistory(studentId) {
  return dataAccess.findMany(HISTORY, { studentId })
    .slice()
    .sort((a, b) => String(b.finishedAt).localeCompare(String(a.finishedAt)))
    .map(summaryOf);
}

function findRecord(historyId) {
  return dataAccess.findById(HISTORY, String(historyId || ''));
}

// Chi tiết 1 lượt chơi: kèm nội dung câu hỏi và đáp án để xem lại.
// Câu hỏi đã bị xoá khỏi ngân hàng đề thì đánh dấu missing.
function detailOf(record) {
  const questions = new Map(
    dataAccess.findMany(BANK_QUESTIONS, { bankId: record.bankId }).map((q) => [q.id, q]),
  );
  return {
    ...summaryOf(record),
    bankAvailable: Boolean(dataAccess.findById(BANKS, record.bankId)),
    answers: record.answers.map((a, i) => {
      const q = questions.get(a.questionId);
      return {
        number: i + 1,
        questionId: a.questionId,
        chosen: a.chosen,
        correct: a.correct,
        correctAnswer: q ? q.correctAnswer : a.correctAnswer,
        content: q ? q.content : null,
        options: q ? q.options : null,
        missing: !q,
      };
    }),
  };
}

// Xoá học sinh: xoá luôn lịch sử chơi và các phiên đang dở.
function removeStudentData(studentId) {
  dataAccess.removeMany(HISTORY, { studentId });
  dataAccess.removeMany(SESSIONS, { studentId });
}

module.exports = {
  createSession,
  recordAnswer,
  abandonSession,
  listHistory,
  findRecord,
  detailOf,
  removeStudentData,
};
