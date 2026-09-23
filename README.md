# Hệ thống đánh giá & roadmap ôn tập trắc nghiệm Toán 12

Đề tài KHKT: Đánh giá chất lượng bài làm trắc nghiệm của học sinh khối 12, từ
đó đưa ra roadmap ôn tập và bài tập tương tự cho những phần học sinh hay sai
nhất.

## Cấu trúc dự án

```
backend/    Node.js + Express API
frontend/   React (Vite) SPA
data/       Dữ liệu lưu dạng file JSON (thay cho SQL database)
docs/       Tài liệu thiết kế + nhật ký tiến trình
```

## Cần cài trước khi chạy ở máy khác

- **Node.js 18+** (kèm `npm`). Kiểm tra: `node -v`.
- **LibreOffice** (bản mới nhất, cài mặc định là được) - dùng để chuyển công
  thức Toán/hình vẽ trong file Word (.docx) sang ảnh, và chuyển file đáp án
  Word sang PDF để xem trước. Thiếu cái này thì tính năng tải đề/đáp án từ
  Word vẫn chạy nhưng thiếu ảnh công thức và không xem trước Word được.
  - Windows/macOS: tải tại https://www.libreoffice.org/download/download/
  - Linux: `sudo apt install libreoffice`
- Không cần cài database (dữ liệu lưu file JSON trong `data/`).
- (Tuỳ chọn) Google Gemini API key nếu muốn dùng tính năng sinh roadmap AI
  thật - xem [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md) để lấy key miễn
  phí. Không có key vẫn chạy được các tính năng còn lại bình thường.

## Hướng dẫn build & chạy

Dự án gồm 2 phần chạy độc lập: **backend** (cổng 5000) và **frontend** (cổng
5173). Mở 2 terminal, mỗi terminal chạy 1 phần.

### 1. Backend

```bash
cd backend
npm install
copy .env.example .env    # Windows PowerShell - macOS/Linux dùng: cp .env.example .env
```

Mở `backend/.env`, chỉnh:

```
JWT_SECRET=doi_thanh_1_chuoi_bat_ky_it_nhat_16_ky_tu
GEMINI_API_KEY=dan_key_that_vao_day_neu_co
```

Chạy:

```bash
npm run dev
```

Sẵn sàng khi thấy `Server đang chạy tại http://localhost:5000`.

### 2. Frontend (terminal khác, giữ terminal 1 đang chạy)

```bash
cd frontend
npm install
npm run dev
```

Sẵn sàng khi thấy `Local: http://localhost:5173/` - mở trình duyệt vào đó.

### Build bản production (frontend)

```bash
cd frontend
npm run build      # sinh ra frontend/dist (file tĩnh HTML/CSS/JS)
npm run preview    # xem thử bản build tại http://localhost:4173
```

Backend không cần build, chạy production bằng `npm start` (thay cho `npm run dev`).

### Dừng chạy

`Ctrl + C` trong từng terminal.

## Tài khoản giáo viên mặc định

| Tên đăng nhập | Mật khẩu |
|---|---|
| `admin` | `admin123` |

Tài khoản học sinh: đăng nhập bằng tài khoản trên rồi tạo trong mục "Thêm
học sinh" trên dashboard giáo viên.

## Xử lý sự cố thường gặp

- **Lỗi `EADDRINUSE` (cổng 5000/5173 đang bị chiếm)**:
  ```powershell
  netstat -ano | findstr :5000
  taskkill /PID <số_PID_tìm_được> /F
  ```
- **Frontend gọi API báo lỗi mạng/CORS**: kiểm tra backend đã chạy ở cổng
  5000 chưa, hoặc `frontend/.env` (nếu có) có `VITE_API_URL` trỏ đúng
  `http://localhost:5000/api` không.
- **Thiếu ảnh công thức Toán / không xem trước được file Word**: chưa cài
  LibreOffice hoặc chưa có trong PATH hệ thống.
- **Lỗi liên quan `GEMINI_API_KEY`**: chỉ ảnh hưởng tính năng sinh roadmap
  AI, xem [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md).

## Tài liệu khác

- [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md) - tiến trình xây dựng
- [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) - cấu trúc dữ liệu
- [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md) - lấy Google Gemini API key
