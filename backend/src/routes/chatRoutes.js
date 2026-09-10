const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { verifyToken } = require('../middleware/auth');

// Route tải tệp / ảnh công khai qua URL
router.get('/download/:filename', chatController.downloadFile);

// Tất cả các route chat còn lại đều yêu cầu đăng nhập
router.use(verifyToken);

// Heartbeat cập nhật trạng thái online
router.post('/heartbeat', chatController.heartbeat);

// Đặt trạng thái offline khi đăng xuất
router.post('/offline', chatController.setOffline);

// Lấy danh sách liên hệ kèm trạng thái online và tin nhắn mới nhất
router.get('/contacts', chatController.getContacts);

// Lấy lịch sử hội thoại với một người dùng cụ thể
router.get('/messages/:partnerId', chatController.getConversation);

// Upload tệp đính kèm (ảnh, word, pdf...)
router.post('/upload', chatController.upload.single('file'), chatController.uploadFile);

// Gửi tin nhắn mới
router.post('/messages', chatController.sendMessage);

// Đánh dấu đã đọc toàn bộ tin nhắn từ người dùng này
router.put('/messages/read/:partnerId', chatController.markConversationAsRead);

// Xóa toàn bộ lịch sử tin nhắn với người dùng này
router.delete('/messages/:partnerId', chatController.clearConversation);

module.exports = router;
