require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const meRoutes = require('./routes/meRoutes');
const examRoutes = require('./routes/examRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const chatRoutes = require('./routes/chatRoutes');
const aiRoutes = require('./routes/ai');
const announcementRoutes = require('./routes/announcementRoutes');

const app = express();

app.use(cors());
// Tăng giới hạn payload JSON (mặc định 100kb) vì câu hỏi nhập từ Word có
// thể chứa nhiều ảnh công thức nhúng dạng base64, dung lượng lớn hơn bình
// thường.
app.use(express.json({ limit: '25mb' }));

// Dữ liệu API luôn là bản mới nhất: không cho trình duyệt (nhất là trình
// duyệt trong ứng dụng trên điện thoại) dùng lại bản lưu tạm cũ, nếu không
// thông báo / bài đăng mới chỉ hiện sau khi tải lại trang. File tải về
// (res.download/sendFile) tự đặt lại header riêng.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/announcements', announcementRoutes);

// 404 riêng cho các API không tồn tại - đặt TRƯỚC phần phục vụ frontend bên
// dưới để không bị catch-all "*" của React Router nuốt mất, trả nhầm về
// index.html thay vì báo lỗi 404 JSON đúng nghĩa.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Không tìm thấy endpoint' });
});

// Phục vụ luôn bản build tĩnh của frontend (frontend/dist) từ CHÍNH backend
// này - giúp chỉ cần 1 tunnel ngrok duy nhất trỏ vào port backend là user có
// thể dùng được toàn bộ web (không cần chạy riêng Vite dev server). Chạy
// `npm run build` trong thư mục frontend TRƯỚC khi khởi động backend để tạo
// thư mục dist này; nếu chưa build thì bỏ qua, giữ nguyên hành vi API-only
// (không lỗi) để không ảnh hưởng lúc đang phát triển bằng Vite dev server.
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Xử lý lỗi tập trung
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
});

module.exports = app;
