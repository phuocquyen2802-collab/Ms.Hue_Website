# Hướng dẫn lấy Google Gemini API Key (miễn phí)

Dùng cho tính năng sinh roadmap ôn tập + bài tập tương tự (Bước 7).

## Các bước lấy key

1. Truy cập **https://aistudio.google.com/apikey** (Google AI Studio).
2. Đăng nhập bằng tài khoản Google (dùng tài khoản cá nhân, không cần tài
   khoản tổ chức/trường học).
3. Bấm nút **"Create API key"**.
   - Nếu được hỏi chọn project Google Cloud: chọn "Create a new project"
     (miễn phí, không cần nhập thẻ thanh toán cho free tier).
4. Copy chuỗi API key vừa tạo (dạng `AIzaSy...`).

## Cấu hình vào dự án

Mở file `backend/.env` (nếu chưa có, copy từ `backend/.env.example`) và điền:

```
GEMINI_API_KEY=AIzaSy...key_bạn_vừa_copy...
```

Lưu file, sau đó khởi động lại backend (`npm run dev` hoặc `npm start`).

## Free tier có giới hạn gì?

Model `gemini-2.0-flash` (mặc định dự án đang dùng, có thể đổi qua biến môi
trường `GEMINI_MODEL` trong `.env`) ở free tier có giới hạn số request/phút
và request/ngày (thường đủ dùng cho việc demo/thử nghiệm của 1 lớp học).
Nếu gặp lỗi 429 (quá giới hạn), đợi 1 phút rồi thử lại, hoặc kiểm tra hạn
mức hiện tại tại https://aistudio.google.com.

Dự án đã có cơ chế **cache** (`data/generated_exercises.json`): nếu 1 học
sinh được xác định cùng một bộ chủ đề yếu như lần trước, hệ thống sẽ trả lại
kết quả cũ thay vì gọi lại Gemini, giúp tiết kiệm hạn mức free tier.

## Kiểm tra key hoạt động

Sau khi điền key, giáo viên đăng nhập và gọi (qua giao diện hoặc Postman/curl):

```
POST /api/teacher/students/:studentId/generate-roadmap
Authorization: Bearer <token giáo viên>
```

Nếu trả về lỗi `Chưa cấu hình GEMINI_API_KEY`, kiểm tra lại file `.env` đã
được lưu đúng thư mục `backend/` và đã khởi động lại server chưa.
