# Hệ thống đánh giá & roadmap ôn tập trắc nghiệm Toán 12

Đề tài KHKT: Đánh giá chất lượng bài làm trắc nghiệm của học sinh khối 12, từ
đó đưa ra roadmap ôn tập và bài tập tương tự cho những phần học sinh hay sai
nhất.

Chi tiết tiến trình xây dựng và quyết định kỹ thuật: xem [docs/STEP_BY_STEP.md](docs/STEP_BY_STEP.md).
Chi tiết cấu trúc dữ liệu: xem [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md).
Hướng dẫn lấy Google Gemini API key (miễn phí): xem [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md).

## Cấu trúc dự án

```
backend/    Node.js + Express API
frontend/   React (Vite) SPA
data/       Dữ liệu lưu dạng file JSON (thay cho SQL database)
docs/       Tài liệu thiết kế + nhật ký tiến trình
```

## Yêu cầu môi trường

- **Node.js** bản 18 trở lên (đã bao gồm `npm`). Kiểm tra bằng `node -v`.
- Không cần cài đặt database gì thêm (dữ liệu lưu dạng file JSON trong `data/`).
- (Tuỳ chọn) Google Gemini API key nếu muốn dùng tính năng sinh roadmap AI
  thật - xem [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md) để lấy key miễn
  phí. Không có key vẫn chạy được toàn bộ các tính năng còn lại bình thường.

## Hướng dẫn build & chạy thử (lần đầu)

Dự án gồm 2 phần chạy độc lập: **backend** (cổng 5000) và **frontend** (cổng
5173). Cần mở 2 cửa sổ terminal, mỗi terminal chạy 1 phần.

### Bước 1 - Chạy Backend (terminal 1)

```bash
cd backend
npm install
```

Tạo file cấu hình `.env` từ file mẫu:

```bash
# Windows PowerShell
copy .env.example .env

# macOS / Linux / Git Bash
cp .env.example .env
```

Mở file `backend/.env` vừa tạo, chỉnh 2 dòng:

```
JWT_SECRET=doi_thanh_1_chuoi_bat_ky_it_nhat_16_ky_tu
GEMINI_API_KEY=dan_key_that_vao_day_neu_co
```

(Nếu chưa có `GEMINI_API_KEY`, cứ để nguyên giá trị mẫu - chỉ tính năng
"Sinh roadmap AI" sẽ báo lỗi, các tính năng khác vẫn chạy bình thường.)

Khởi động backend:

```bash
npm run dev
```

Thấy dòng `Server đang chạy tại http://localhost:5000` là backend đã sẵn
sàng. Kiểm tra nhanh bằng cách mở trình duyệt vào
`http://localhost:5000/api/health`, phải thấy `{"ok":true}`.

### Bước 2 - Chạy Frontend (terminal 2, mở terminal mới, giữ terminal 1 chạy)

```bash
cd frontend
npm install
npm run dev
```

Thấy dòng `Local: http://localhost:5173/` là frontend đã sẵn sàng. Mở
trình duyệt vào **http://localhost:5173** để dùng thử.

### Bước 3 - Đăng nhập thử

Dùng tài khoản giáo viên mặc định bên dưới để đăng nhập, sau đó tự tạo tài
khoản học sinh trong mục "Thêm học sinh".

### Dừng chạy

Bấm `Ctrl + C` trong từng terminal để dừng backend/frontend.

## Build bản production (tuỳ chọn, không bắt buộc khi demo)

```bash
cd frontend
npm run build      # sinh ra thư mục frontend/dist (file tĩnh HTML/CSS/JS)
npm run preview    # xem thử bản build tại http://localhost:4173
```

Backend không cần build, chạy thẳng bằng `npm start` (giống `npm run dev`
nhưng không tự khởi động lại khi sửa code).

## Xử lý sự cố thường gặp

- **Lỗi `EADDRINUSE` (cổng 5000/5173 đang bị chiếm)**: có tiến trình cũ
  chưa tắt hẳn. Trên Windows, tìm và tắt bằng:
  ```powershell
  netstat -ano | findstr :5000
  taskkill /PID <số_PID_tìm_được> /F
  ```
- **Frontend gọi API báo lỗi mạng/CORS**: kiểm tra backend đã chạy ở cổng
  5000 chưa, hoặc kiểm tra file `frontend/.env` (nếu có tạo) có
  `VITE_API_URL` trỏ đúng `http://localhost:5000/api` không.
- **Lỗi liên quan `GEMINI_API_KEY`**: chỉ ảnh hưởng tính năng sinh roadmap
  AI, xem lại [docs/GEMINI_SETUP.md](docs/GEMINI_SETUP.md).

## Phân quyền tài khoản

- Trang **Đăng ký** (`/register`) chỉ tạo được tài khoản **giáo viên**.
- Tài khoản **học sinh** không tự đăng ký được - giáo viên tạo trong mục
  "Thêm tài khoản học sinh" ở dashboard, và có thể sửa (họ tên, lớp) hoặc
  xoá tài khoản học sinh tại đó (mục "Danh sách học sinh"). Xoá học sinh sẽ
  xoá luôn toàn bộ bài nộp, thống kê và đề xuất AI liên quan.

## Tài khoản giáo viên mặc định

| Tên đăng nhập | Mật khẩu |
|---|---|
| `admin` | `admin123` |

Tài khoản học sinh chưa có sẵn - đăng nhập bằng tài khoản trên rồi vào mục
"Thêm học sinh" trên dashboard giáo viên để tạo. Tên đăng nhập không bắt
buộc phải là địa chỉ email, có thể dùng tên thường (VD: `hocsinh01`).

## Chuông thông báo

Icon 🔔 cố định góc phải trên cùng mọi trang. Badge đỏ đếm số thông báo
chưa đọc; bấm vào chuông xem danh sách, bấm vào 1 thông báo sẽ đánh dấu đã
đọc (chuyển nền trắng) và điều hướng thẳng tới trang liên quan.

- **Giáo viên**: mỗi bài học sinh nộp là 1 thông báo, dẫn tới trang quản lý
  đề thi đó.
- **Học sinh**: mỗi đề được giao mà chưa làm là 1 thông báo, dẫn thẳng tới
  trang làm bài.

## Tải đề thi từ file Word (.docx)

Vào 1 đề thi -> tab "Danh sách câu hỏi" -> "Thêm câu hỏi mới" -> chọn "Tải
từ file Word". Hệ thống tự tách câu hỏi, 4 đáp án và gợi ý tag chủ đề theo
từng "CHỦ ĐỀ ..." trong file.

**Tự động điền sẵn đáp án đúng (tuỳ chọn)**: nếu file có sẵn bảng đáp án ở
cuối, hệ thống sẽ tự nhận diện và điền sẵn, giáo viên chỉ cần xác nhận lại
thay vì chọn tay từng câu. Cách soạn: thêm 1 đoạn có tiêu đề chứa chữ
**"ĐÁP ÁN"** ở cuối file (sau toàn bộ câu hỏi), liệt kê theo đúng **thứ tự
câu hỏi xuất hiện trong file**, dạng:

```
ĐÁP ÁN

1-A  2-C  3-B  4-D  5-A ...
```

Dấu nối giữa số và chữ chấp nhận `-`, `.`, `:` hoặc `)`. Số thứ tự không
cần khớp với số ghi trong từng "Câu N" ở phần đề (vì nhiều đề tự đánh số
lại từ 1 theo mỗi chủ đề) - hệ thống ghép theo đúng thứ tự xuất hiện. Nếu
số lượng đáp án tìm được không khớp số câu hỏi tách được, hệ thống sẽ
KHÔNG tự đoán mà báo cảnh báo để giáo viên tự chọn tay (tránh gán nhầm hàng
loạt).

Dù có hay không có bảng đáp án, giáo viên luôn xem lại và có thể đổi đáp án
ở bước kiểm tra trước khi lưu vào đề - hệ thống không tự lưu mà không qua
xác nhận.
