// Bảng tin "Thông tin chung" kiểu Facebook: CHỈ giáo viên được đăng/sửa/xoá
// thông báo, học sinh chỉ được bình luận (không tự đăng bài). Dữ liệu bình
// luận lưu riêng ở collection 'announcement_comments', gắn theo
// announcementId - xoá bài thì xoá luôn toàn bộ bình luận của bài đó.

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dataAccess = require('../models/dataAccess');

// Thư mục lưu ảnh/tệp đính kèm thông báo - giống cơ chế file đính kèm chat
// (chatController.js): tên file trên đĩa là UUID ngẫu nhiên, tên gốc lưu
// riêng trong dữ liệu để hiển thị/tải về đúng tên thật.
const ATTACHMENT_DIR = path.join(__dirname, '../../../data/announcement_uploads');
if (!fs.existsSync(ATTACHMENT_DIR)) {
  fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
}

function decodeUtf8FileName(str) {
  if (!str) return '';
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
}

function buildAttachmentsFromFiles(files) {
  if (!files || files.length === 0) return [];
  return files.map((f) => ({
    filename: f.filename,
    originalName: decodeUtf8FileName(f.originalname),
    mimeType: f.mimetype,
    isImage: f.mimetype.startsWith('image/'),
  }));
}

// Nhãn hiển thị đối tượng nhận thông báo, VD "Lớp 12A2" hoặc "Nhóm Ôn thi cấp tốc"
function buildAudienceLabel(a) {
  const type = a.audienceType || 'all';
  if (type === 'all') return 'Tất cả';
  if (type === 'class') return `Lớp ${a.audienceValue}`;
  if (type === 'group') {
    const group = dataAccess.findById('student_groups', a.audienceValue);
    return `Nhóm ${group ? group.name : '(đã xoá)'}`;
  }
  return 'Tất cả';
}

function enrichAnnouncement(a, users) {
  const author = users.find((u) => u.id === a.authorId);
  const comments = dataAccess
    .findMany('announcement_comments', { announcementId: a.id })
    .sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt))
    .map((c) => {
      const commentAuthor = users.find((u) => u.id === c.authorId);
      return {
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt || null,
        authorId: c.authorId,
        authorName: commentAuthor ? commentAuthor.name : 'Người dùng đã xoá',
        authorRole: c.authorRole,
      };
    });

  return {
    id: a.id,
    title: a.title || '',
    content: a.content,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt || null,
    authorId: a.authorId,
    authorName: author ? author.name : 'Giáo viên',
    audienceType: a.audienceType || 'all',
    audienceValue: a.audienceValue || null,
    audienceLabel: buildAudienceLabel(a),
    attachments: (a.attachments || []).map((att) => ({
      ...att,
      url: `/api/announcements/${a.id}/attachments/${att.filename}`,
    })),
    commentCount: comments.length,
    comments,
  };
}

// Học sinh này có thuộc đối tượng nhận của thông báo hay không - dựa theo
// audienceType: 'all' (mọi người), 'class' (đúng lớp audienceValue) hoặc
// 'group' (nằm trong nhóm học sinh có id = audienceValue).
function isStudentInAudience(announcement, student) {
  const type = announcement.audienceType || 'all';
  if (type === 'all') return true;
  if (type === 'class') {
    return (student.className || '').trim() === announcement.audienceValue;
  }
  if (type === 'group') {
    const group = dataAccess.findById('student_groups', announcement.audienceValue);
    return !!(group && (group.studentIds || []).includes(student.id));
  }
  return true;
}

// [Giáo viên + Học sinh] Xem bảng tin, mới nhất trước, kèm bình luận. Giáo
// viên xem được TẤT CẢ bài (kể cả bài chỉ nhắm tới lớp/nhóm khác) để quản lý;
// học sinh CHỈ thấy bài đăng cho "Tất cả", đúng lớp mình, hoặc nhóm mình có
// trong danh sách thành viên.
function listAnnouncements(req, res) {
  const users = dataAccess.findAll('users');
  let announcements = dataAccess.findAll('announcements');

  if (req.user.role === 'student') {
    const student = users.find((u) => u.id === req.user.id) || req.user;
    announcements = announcements.filter((a) => isStudentInAudience(a, student));
  }

  const result = announcements
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((a) => enrichAnnouncement(a, users));
  return res.json(result);
}

// [Giáo viên] Đăng thông báo mới - có thể chọn đối tượng nhận: toàn trường
// ('all'), 1 lớp cụ thể ('class' + audienceValue = tên lớp) hoặc 1 nhóm học
// sinh cụ thể ('group' + audienceValue = id nhóm).
function createAnnouncement(req, res) {
  const { title, content, audienceType, audienceValue } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Nội dung thông báo không được để trống' });
  }

  const finalAudienceType = ['all', 'class', 'group'].includes(audienceType) ? audienceType : 'all';
  if (finalAudienceType !== 'all' && !audienceValue) {
    return res.status(400).json({ message: 'Vui lòng chọn lớp hoặc nhóm nhận thông báo' });
  }

  const announcement = {
    id: `ann-${uuidv4()}`,
    authorId: req.user.id,
    title: (title || '').trim(),
    content: content.trim(),
    audienceType: finalAudienceType,
    audienceValue: finalAudienceType === 'all' ? null : audienceValue,
    attachments: buildAttachmentsFromFiles(req.files),
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  dataAccess.insert('announcements', announcement);

  const users = dataAccess.findAll('users');
  return res.status(201).json(enrichAnnouncement(announcement, users));
}

// [Giáo viên] Sửa thông báo do CHÍNH mình đăng
function updateAnnouncement(req, res) {
  const announcement = dataAccess.findById('announcements', req.params.id);
  if (!announcement) {
    return res.status(404).json({ message: 'Không tìm thấy thông báo' });
  }
  if (announcement.authorId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể sửa thông báo do chính mình đăng' });
  }

  const { title, content, removeAttachments, audienceType, audienceValue } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Nội dung thông báo không được để trống' });
  }

  const finalAudienceType = ['all', 'class', 'group'].includes(audienceType) ? audienceType : 'all';
  if (finalAudienceType !== 'all' && !audienceValue) {
    return res.status(400).json({ message: 'Vui lòng chọn lớp hoặc nhóm nhận thông báo' });
  }

  // Gỡ bớt ảnh/tệp cũ nếu giáo viên chọn xoá lúc sửa (danh sách filename cần gỡ)
  const removeSet = new Set(
    Array.isArray(removeAttachments) ? removeAttachments : removeAttachments ? [removeAttachments] : []
  );
  let attachments = (announcement.attachments || []).filter((att) => !removeSet.has(att.filename));
  removeSet.forEach((filename) => {
    const p = path.join(ATTACHMENT_DIR, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  // Thêm ảnh/tệp mới đính kèm thêm (nếu có)
  attachments = [...attachments, ...buildAttachmentsFromFiles(req.files)];

  const updated = dataAccess.updateById('announcements', announcement.id, {
    title: (title || '').trim(),
    content: content.trim(),
    audienceType: finalAudienceType,
    audienceValue: finalAudienceType === 'all' ? null : audienceValue,
    attachments,
    updatedAt: new Date().toISOString(),
  });

  const users = dataAccess.findAll('users');
  return res.json(enrichAnnouncement(updated, users));
}

// [Giáo viên] Xoá thông báo do CHÍNH mình đăng (xoá kèm toàn bộ bình luận + ảnh/tệp đính kèm)
function deleteAnnouncement(req, res) {
  const announcement = dataAccess.findById('announcements', req.params.id);
  if (!announcement) {
    return res.status(404).json({ message: 'Không tìm thấy thông báo' });
  }
  if (announcement.authorId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể xoá thông báo do chính mình đăng' });
  }

  (announcement.attachments || []).forEach((att) => {
    const p = path.join(ATTACHMENT_DIR, att.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });
  dataAccess
    .findMany('announcement_comments', { announcementId: announcement.id })
    .forEach((c) => dataAccess.removeById('announcement_comments', c.id));
  dataAccess.removeById('announcements', announcement.id);

  return res.json({ ok: true });
}

// Xem/tải ảnh hoặc tệp đính kèm - CÔNG KHAI (không cần đăng nhập) để thẻ
// <img> hiển thị trực tiếp được (trình duyệt không tự gắn header xác thực
// khi tải ảnh qua thẻ <img>). An toàn vì tên file trên đĩa là UUID ngẫu
// nhiên, không đoán được nếu không có đúng link.
function downloadAttachment(req, res) {
  const announcement = dataAccess.findById('announcements', req.params.id);
  const attachment = announcement && (announcement.attachments || []).find((a) => a.filename === req.params.filename);
  if (!attachment) {
    return res.status(404).json({ message: 'Không tìm thấy tệp đính kèm' });
  }
  const filePath = path.join(ATTACHMENT_DIR, attachment.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Tệp đã bị xoá khỏi máy chủ' });
  }
  if (attachment.isImage) {
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    return res.sendFile(filePath);
  }
  return res.download(filePath, attachment.originalName || attachment.filename);
}

// [Giáo viên + Học sinh] Bình luận vào 1 thông báo - cả 2 vai trò đều được
// bình luận, chỉ riêng việc ĐĂNG BÀI mới giới hạn cho giáo viên.
function addComment(req, res) {
  const announcement = dataAccess.findById('announcements', req.params.id);
  if (!announcement) {
    return res.status(404).json({ message: 'Không tìm thấy thông báo' });
  }
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
  }

  const comment = {
    id: `cmt-${uuidv4()}`,
    announcementId: announcement.id,
    authorId: req.user.id,
    authorRole: req.user.role,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  dataAccess.insert('announcement_comments', comment);

  const users = dataAccess.findAll('users');
  const author = users.find((u) => u.id === comment.authorId);
  return res.status(201).json({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    authorId: comment.authorId,
    authorName: author ? author.name : 'Người dùng',
    authorRole: comment.authorRole,
  });
}

// [Giáo viên + Học sinh] Sửa nội dung bình luận do CHÍNH mình viết - CHỈ chủ
// bình luận mới được sửa (khác quyền xoá, giáo viên không được sửa hộ bình
// luận của người khác vì sẽ làm sai lệch phát ngôn của họ).
function updateComment(req, res) {
  const comment = dataAccess.findById('announcement_comments', req.params.commentId);
  if (!comment) {
    return res.status(404).json({ message: 'Không tìm thấy bình luận' });
  }
  if (comment.authorId !== req.user.id) {
    return res.status(403).json({ message: 'Bạn chỉ có thể sửa bình luận do chính mình viết' });
  }
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
  }

  const updated = dataAccess.updateById('announcement_comments', comment.id, {
    content: content.trim(),
    updatedAt: new Date().toISOString(),
  });

  const users = dataAccess.findAll('users');
  const author = users.find((u) => u.id === updated.authorId);
  return res.json({
    id: updated.id,
    content: updated.content,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    authorId: updated.authorId,
    authorName: author ? author.name : 'Người dùng',
    authorRole: updated.authorRole,
  });
}

// [Giáo viên + Học sinh] Xoá bình luận - chỉ người viết bình luận đó HOẶC
// giáo viên (quyền kiểm duyệt) mới được xoá.
function deleteComment(req, res) {
  const comment = dataAccess.findById('announcement_comments', req.params.commentId);
  if (!comment) {
    return res.status(404).json({ message: 'Không tìm thấy bình luận' });
  }
  const isOwner = comment.authorId === req.user.id;
  const isTeacher = req.user.role === 'teacher';
  if (!isOwner && !isTeacher) {
    return res.status(403).json({ message: 'Bạn không có quyền xoá bình luận này' });
  }
  dataAccess.removeById('announcement_comments', comment.id);
  return res.json({ ok: true });
}

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  downloadAttachment,
  addComment,
  updateComment,
  deleteComment,
};
