require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const meRoutes = require('./routes/meRoutes');
const examRoutes = require('./routes/examRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/ai');

const app = express();

app.use(cors());
// Tăng giới hạn payload JSON (mặc định 100kb) vì câu hỏi nhập từ Word có
// thể chứa nhiều ảnh công thức nhúng dạng base64, dung lượng lớn hơn bình
// thường.
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);

// 404 cho các route không tồn tại
app.use((req, res) => {
  res.status(404).json({ message: 'Không tìm thấy endpoint' });
});

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
});

module.exports = app;
