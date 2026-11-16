const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { chatWithGemini, streamChatWithGemini } = require('../services/geminiService');

function chatContext(req) {
  return {
    name: req.user.name,
    role: req.user.role,
    className: req.user.className,
    // Người dùng đang xem giao diện tiếng Anh thì AI trả lời bằng tiếng Anh.
    lang: req.body.lang === 'en' ? 'en' : 'vi',
  };
}

function validMessages(messages) {
  return Array.isArray(messages) && messages.length > 0;
}

// POST /api/ai/chat
// Trao đổi trực tiếp với Gemini AI về các chủ đề Toán học (chờ đủ câu trả lời)
router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { messages = [] } = req.body;
    if (!validMessages(messages)) {
      return res.status(400).json({ message: 'Danh sách tin nhắn không hợp lệ' });
    }

    const reply = await chatWithGemini(messages, chatContext(req));

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

// POST /api/ai/chat/stream
// Như /chat nhưng trả lời dạng Server-Sent Events để chữ hiện dần:
//   event: delta  data: {"text": "..."}   - từng đoạn chữ
//   event: done   data: {"text": "..."}   - toàn bộ câu trả lời đã chuẩn hoá công thức
//   event: error  data: {"message": "..."}
router.post('/chat/stream', verifyToken, async (req, res) => {
  const { messages = [] } = req.body;
  if (!validMessages(messages)) {
    return res.status(400).json({ message: 'Danh sách tin nhắn không hợp lệ' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // không để proxy gom lại rồi mới gửi
  });
  res.write(': ok\n\n');

  // Người dùng đóng trang / bấm đoạn chat mới giữa chừng: dừng gọi Gemini.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) controller.abort();
  });
  const send = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const text = await streamChatWithGemini(messages, chatContext(req), (delta) => send('delta', { text: delta }), controller.signal);
    send('done', { text, timestamp: new Date().toISOString() });
  } catch (err) {
    if (!controller.signal.aborted) {
      console.error('[AI Chat Stream Error]:', err.message);
      send('error', { message: err.message || 'Lỗi khi xử lý phản hồi từ Gemini AI' });
    }
  }
  return res.end();
});

module.exports = router;
