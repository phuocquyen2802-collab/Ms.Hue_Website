const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  downloadAttachment,
  addComment,
  updateComment,
  deleteComment,
} = require('../controllers/announcementController');

const router = express.Router();

// Ảnh/tệp đính kèm thông báo lưu thẳng ra đĩa (data/announcement_uploads),
// chấp nhận mọi loại tệp ("và mọi thứ" - không giới hạn chỉ ảnh), tối đa
// 30MB/tệp, tối đa 10 tệp/lần đăng.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../data/announcement_uploads')),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Route xem/tải ảnh & tệp đính kèm CÔNG KHAI (không cần đăng nhập) - đặt
// TRƯỚC middleware verifyToken bên dưới để thẻ <img> hiển thị trực tiếp
// được (trình duyệt không tự gắn header xác thực khi tải qua <img src>).
router.get('/:id/attachments/:filename', downloadAttachment);

// Cả giáo viên và học sinh đều cần đăng nhập để xem/bình luận
router.use(verifyToken);

router.get('/', listAnnouncements);
router.post('/', requireRole('teacher'), upload.array('files', 10), createAnnouncement);
router.put('/:id', requireRole('teacher'), upload.array('files', 10), updateAnnouncement);
router.delete('/:id', requireRole('teacher'), deleteAnnouncement);

router.post('/:id/comments', addComment);
router.put('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

module.exports = router;
