// Xem lịch sử chơi trò chơi "Đường đua Toán học".
// Học sinh chỉ xem được lịch sử của mình; giáo viên xem của từng học sinh
// ở trang hồ sơ học sinh. Kết quả được ghi trong lúc chơi - xem
// services/gameHistoryService.js.
const dataAccess = require('../models/dataAccess');
const gameHistory = require('../services/gameHistoryService');

const NOT_FOUND = { message: 'Không tìm thấy lượt chơi' };

// ---------- Học sinh ----------

function listMyGameHistory(req, res) {
  return res.json({ items: gameHistory.listHistory(req.user.id) });
}

function getMyGameHistoryDetail(req, res) {
  const record = gameHistory.findRecord(req.params.historyId);
  if (!record || record.studentId !== req.user.id) return res.status(404).json(NOT_FOUND);
  return res.json(gameHistory.detailOf(record));
}

// ---------- Giáo viên ----------

function findStudent(studentId) {
  const student = dataAccess.findById('users', studentId);
  return student && student.role === 'student' ? student : null;
}

function listStudentGameHistory(req, res) {
  const student = findStudent(req.params.studentId);
  if (!student) return res.status(404).json({ message: 'Không tìm thấy học sinh' });
  return res.json({ items: gameHistory.listHistory(student.id) });
}

function getStudentGameHistoryDetail(req, res) {
  const student = findStudent(req.params.studentId);
  const record = gameHistory.findRecord(req.params.historyId);
  if (!student || !record || record.studentId !== student.id) return res.status(404).json(NOT_FOUND);
  return res.json({ ...gameHistory.detailOf(record), student: { id: student.id, name: student.name } });
}

module.exports = {
  listMyGameHistory,
  getMyGameHistoryDetail,
  listStudentGameHistory,
  getStudentGameHistoryDetail,
};
