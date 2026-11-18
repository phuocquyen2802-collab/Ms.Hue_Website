// Giáo viên quản lý tài khoản học sinh: tạo, sửa, xoá. Học sinh KHÔNG được
// tự đăng ký (xem authController.register) - giáo viên là người duy nhất
// tạo tài khoản học sinh, để kiểm soát danh sách lớp và tránh tài khoản ảo.

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');
const { encryptPassword, decryptPassword } = require('../utils/passwordVault');
const loginGuard = require('../services/loginGuard');
const gameHistory = require('../services/gameHistoryService');
const { EMAIL_RE } = require('./passwordResetController');

const SALT_ROUNDS = 10;
const INVALID_RECOVERY_EMAIL = { message: 'Email khôi phục không hợp lệ' };

// Tạo tài khoản học sinh mới
async function createStudent(req, res) {
  const { name, email, password, className } = req.body;
  const recoveryEmail = String(req.body.recoveryEmail || '').trim();

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Thiếu name, email hoặc password' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
  }
  if (recoveryEmail && !EMAIL_RE.test(recoveryEmail)) {
    return res.status(400).json(INVALID_RECOVERY_EMAIL);
  }

  const existing = dataAccess.findOne('users', { email });
  if (existing) {
    return res.status(409).json({ message: 'Email đã được sử dụng' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const student = {
    id: `u-${uuidv4()}`,
    name,
    email,
    passwordHash,
    // Bản mã hoá hai chiều để giáo viên xem lại và xuất file Excel (xem utils/passwordVault.js)
    passwordEnc: encryptPassword(password),
    role: 'student',
    className: className || null,
    // Email nhận link khôi phục mật khẩu khi học sinh quên (không bắt buộc)
    recoveryEmail: recoveryEmail || null,
    createdAt: new Date().toISOString(),
  };

  dataAccess.insert('users', student);

  return res.status(201).json({
    id: student.id,
    name: student.name,
    email: student.email,
    role: student.role,
    className: student.className,
    recoveryEmail: student.recoveryEmail,
    password: decryptPassword(student.passwordEnc),
  });
}

// Sửa thông tin học sinh (họ tên, lớp; đổi email nếu email mới chưa dùng;
// đặt lại mật khẩu nếu giáo viên nhập mật khẩu mới)
async function updateStudent(req, res) {
  const student = dataAccess.findById('users', req.params.studentId);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ message: 'Không tìm thấy học sinh' });
  }

  const { name, className, email, password, recoveryEmail } = req.body;
  const changes = {};

  if (name) changes.name = name;
  if (className !== undefined) changes.className = className || null;
  if (recoveryEmail !== undefined) {
    const value = String(recoveryEmail || '').trim();
    if (value && !EMAIL_RE.test(value)) return res.status(400).json(INVALID_RECOVERY_EMAIL);
    changes.recoveryEmail = value || null;
  }
  if (email && email !== student.email) {
    const emailTaken = dataAccess.findOne('users', { email });
    if (emailTaken) {
      return res.status(409).json({ message: 'Email đã được sử dụng bởi tài khoản khác' });
    }
    changes.email = email;
  }
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }
    changes.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    changes.passwordEnc = encryptPassword(password);
    changes.passwordChangedByStudent = false;
  }

  const updated = dataAccess.updateById('users', student.id, changes);
  // Giáo viên đặt lại mật khẩu: mở khoá luôn nếu học sinh đang bị khoá do nhập sai nhiều lần.
  if (password) loginGuard.clearFailures(updated.email);
  return res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    className: updated.className,
    recoveryEmail: updated.recoveryEmail || null,
    password: decryptPassword(updated.passwordEnc),
  });
}

// Xoá tài khoản học sinh, đồng thời dọn sạch dữ liệu liên quan (bài nộp,
// thống kê, đề xuất AI, và gỡ khỏi danh sách được giao đề) để tránh dữ liệu
// mồ côi tham chiếu tới 1 học sinh không còn tồn tại.
function deleteStudent(req, res) {
  const student = dataAccess.findById('users', req.params.studentId);
  if (!student || student.role !== 'student') {
    return res.status(404).json({ message: 'Không tìm thấy học sinh' });
  }

  const submissions = dataAccess.findMany('submissions', { studentId: student.id });
  submissions.forEach((submission) => {
    dataAccess
      .findMany('submission_answers', { submissionId: submission.id })
      .forEach((answer) => dataAccess.removeById('submission_answers', answer.id));
    dataAccess.removeById('submissions', submission.id);
  });

  dataAccess
    .findMany('student_topic_stats', { studentId: student.id })
    .forEach((stat) => dataAccess.removeById('student_topic_stats', stat.id));

  dataAccess
    .findMany('generated_exercises', { studentId: student.id })
    .forEach((record) => dataAccess.removeById('generated_exercises', record.id));

  gameHistory.removeStudentData(student.id);

  dataAccess.findAll('exams').forEach((exam) => {
    if (exam.assignedTo.includes(student.id)) {
      dataAccess.updateById('exams', exam.id, {
        assignedTo: exam.assignedTo.filter((id) => id !== student.id),
      });
    }
  });

  dataAccess.removeById('users', student.id);

  return res.status(204).send();
}

module.exports = { createStudent, updateStudent, deleteStudent };
