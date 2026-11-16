const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { chatWithGemini } = require('../services/geminiService');

// POST /api/ai/chat
// Trao đổi trực tiếp với Gemini AI về các chủ đề Toán học
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { messages = [], lang } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Danh sách tin nhắn không hợp lệ' });
    }

    const userContext = {
      name: req.user.name,
      role: req.user.role,
      className: req.user.className,
      // Người dùng đang xem giao diện tiếng Anh thì AI trả lời bằng tiếng Anh.
      lang: lang === 'en' ? 'en' : 'vi',
    };

    const reply = await chatWithGemini(messages, userContext);

    return res.json({
      reply,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AI Chat Error]:', err.message);
    return res.status(500).json({
      message: err.message || 'Lỗi khi xử lý phản hồi từ Gemini AI',
    });
  }
});

module.exports = router;
