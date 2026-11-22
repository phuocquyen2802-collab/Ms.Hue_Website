const app = require('./app');
const wmfConvertService = require('./services/wmfConvertService');
const mailService = require('./services/mailService');
const roadmapJobService = require('./services/roadmapJobService');

const PORT = process.env.PORT || 5000;

// Một số hàm controller là `async function` nhưng lại được dùng trực tiếp
// làm route handler mà không có try/catch bao quanh toàn bộ thân hàm (VD:
// nếu lỗi xảy ra ở một bước xử lý file/LibreOffice nào đó). Express 4 KHÔNG
// tự bắt được Promise bị reject từ route handler - và từ Node 15+, một
// unhandled rejection sẽ làm SẬP TOÀN BỘ tiến trình Node theo mặc định. Hậu
// quả thực tế đã gặp: giáo viên bấm "Tạo & giao đề", việc tạo đề/giao đề đã
// thành công, nhưng 1 bước phụ sau đó ném lỗi async không được catch -> cả
// server sập giữa chừng -> request treo mãi mãi (không có phản hồi, không
// timeout) -> nút bấm kẹt ở "Đang tạo..." dù đề đã giao xong. Bắt các lỗi
// này ở đây để LOG thay vì làm sập server, giữ server luôn phản hồi được.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection (đã chặn không cho sập server):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception (đã chặn không cho sập server):', err);
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`[Email] ${mailService.describeConfig()}`);
  // Chạy tiếp các bài AI đang phân tích dở trước khi máy chủ khởi động lại.
  roadmapJobService.resumePending();
  // Khởi động sẵn LibreOffice ở chế độ nền để lần tải file Word đầu tiên
  // không phải chờ khởi động lạnh (xem wmfConvertService.warmUp).
  setTimeout(() => {
    wmfConvertService.warmUp().catch((err) => console.error('Không khởi động sẵn được LibreOffice:', err.message));
  }, 1500);
});
