// Nhóm học sinh do giáo viên tự đặt (khác với "lớp" là 1 trường có sẵn trên
// tài khoản học sinh) - dùng để giao bài nhanh cho 1 tập học sinh tuỳ ý
// không nhất thiết cùng lớp (VD: nhóm học sinh yếu cần ôn thêm, nhóm đội
// tuyển...). Chỉ lưu danh sách studentId, KHÔNG lưu bản sao dữ liệu học sinh
// để luôn đồng bộ nếu học sinh đổi tên/lớp sau này.

const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');

// [Giáo viên] Danh sách nhóm do chính giáo viên này tạo, kèm số lượng + tên
// từng học sinh (tra cứu trực tiếp từ 'users' để luôn mới nhất).
function listGroups(req, res) {
  const groups = dataAccess.findMany('student_groups', { createdBy: req.user.id });
  const students = dataAccess.findMany('users', { role: 'student' });

  const enriched = groups.map((g) => ({
    ...g,
    students: g.studentIds
      .map((id) => students.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({ id: s.id, name: s.name, className: s.className })),
  }));

  return res.json(enriched);
}

// [Giáo viên] Tạo nhóm mới
function createGroup(req, res) {
  const { name, studentIds } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Thiếu tên nhóm' });
  }
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn ít nhất 1 học sinh cho nhóm' });
  }

  const group = {
    id: `grp-${uuidv4()}`,
    name: name.trim(),
    studentIds,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  dataAccess.insert('student_groups', group);
  return res.status(201).json(group);
}

// [Giáo viên] Sửa tên/danh sách thành viên nhóm
function updateGroup(req, res) {
  const group = dataAccess.findById('student_groups', req.params.groupId);
  if (!group || group.createdBy !== req.user.id) {
    return res.status(404).json({ message: 'Không tìm thấy nhóm' });
  }

  const { name, studentIds } = req.body;
  const changes = {};
  if (typeof name === 'string' && name.trim()) changes.name = name.trim();
  if (Array.isArray(studentIds)) {
    if (studentIds.length === 0) {
      return res.status(400).json({ message: 'Nhóm phải có ít nhất 1 học sinh' });
    }
    changes.studentIds = studentIds;
  }

  const updated = dataAccess.updateById('student_groups', group.id, changes);
  return res.json(updated);
}

// [Giáo viên] Xoá nhóm
function deleteGroup(req, res) {
  const group = dataAccess.findById('student_groups', req.params.groupId);
  if (!group || group.createdBy !== req.user.id) {
    return res.status(404).json({ message: 'Không tìm thấy nhóm' });
  }
  dataAccess.removeById('student_groups', group.id);
  return res.json({ ok: true });
}

// [Học sinh] Danh sách nhóm mà CHÍNH học sinh đang đăng nhập là thành viên -
// kèm danh sách bạn cùng nhóm (để biết nhóm có bao nhiêu bạn) - KHÔNG trả về
// nhóm của học sinh khác hay thông tin giáo viên tạo nhóm.
function listMyGroups(req, res) {
  const allGroups = dataAccess.findAll('student_groups');
  const myGroups = allGroups.filter((g) => g.studentIds.includes(req.user.id));
  const students = dataAccess.findMany('users', { role: 'student' });

  const enriched = myGroups.map((g) => ({
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    memberCount: g.studentIds.length,
    members: g.studentIds
      .map((id) => students.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({ id: s.id, name: s.name, className: s.className, isMe: s.id === req.user.id })),
  }));

  return res.json(enriched);
}

module.exports = { listGroups, createGroup, updateGroup, deleteGroup, listMyGroups };
