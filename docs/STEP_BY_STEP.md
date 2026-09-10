# NHẬT KÝ XÂY DỰNG DỰ ÁN

## Mục tiêu dự án

Website hỗ trợ đánh giá chất lượng bài làm trắc nghiệm của học sinh khối 12,
từ đó đưa ra **roadmap ôn tập** và **bài tập tương tự** cho những chủ đề học
sinh hay sai nhất.

Nghiệp vụ chính:
- 2 vai trò: **Giáo viên** (tạo đề, nhập câu hỏi gắn tag chủ đề, giao đề, xem
  thống kê điểm yếu cả lớp) và **Học sinh** (làm bài, nộp bài, được chấm tự
  động).
- Sau khi chấm, hệ thống tự động tổng hợp tỷ lệ sai theo tag, xác định 2-3 chủ
  đề yếu nhất (có ngưỡng số câu tối thiểu để tránh kết luận sai lệch), rồi gọi
  **Google Gemini API (free tier)** để sinh roadmap ôn tập + bài tập tương tự.
  Giáo viên duyệt lại trước khi gửi cho học sinh.

## Kiến trúc & quyết định kỹ thuật

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Frontend | React (Vite) | Dựng nhanh, SPA đơn giản, dễ demo |
| Biểu đồ | Recharts | Dễ tích hợp với React, đủ dùng cho biểu đồ tỷ lệ đúng/sai theo chủ đề |
| Backend | Node.js + Express | Đơn giản, phổ biến, dễ giải trình |
| Lưu trữ dữ liệu | File JSON trong `data/` (qua `lowdb` v1, sync API) | Quy mô đồ án nhỏ (1 lớp, vài chục học sinh) nên không cần DBMS; file JSON dễ debug (mở lên xem được), dễ backup/demo khi thuyết trình. `lowdb` v1 dùng API đồng bộ (sync) nên code dễ hiểu hơn bản v2+ (async), phù hợp trình bày cho ban giám khảo |
| Mật khẩu | `bcryptjs` (pure JS) | Không cần build native module (tránh lỗi cài đặt trên Windows), thay cho `bcrypt` |
| Xác thực | JWT + middleware phân quyền theo role | Chuẩn phổ biến, đơn giản, không cần session server-side |
| AI sinh roadmap/câu hỏi | Google Gemini API (model Flash, free tier) | Miễn phí, đủ khả năng sinh nội dung có cấu trúc (JSON) |
| Cache kết quả AI | Lưu vào `data/generated_exercises.json` | Tránh gọi API lặp lại tốn quota free tier |
| Ghi file JSON an toàn | Data Access Layer tự viết (đọc trước khi ghi) | Không cần transaction/locking phức tạp vì quy mô nhỏ, nhưng vẫn cần tránh ghi đè dữ liệu mất mát ở mức cơ bản |

## Trạng thái hiện tại

- [x] Bước 1: Khởi tạo cấu trúc thư mục + STEP_BY_STEP.md + README
- [x] Bước 2: Thiết kế cấu trúc dữ liệu JSON (`data/*.json` + `docs/DATA_SCHEMA.md`)
- [x] Bước 3: Backend cơ bản (data access layer, đăng ký/đăng nhập, middleware JWT)
- [x] Bước 4: API cho giáo viên (tạo đề, câu hỏi, giao đề)
- [x] Bước 5: API cho học sinh (làm bài, nộp bài, chấm điểm)
- [x] Bước 6: Module phân tích điểm yếu theo tag
- [x] Bước 7: Tích hợp Google Gemini API (roadmap + bài tập tương tự, có cache, có duyệt) — ĐÃ test thành công với API key thật
- [x] Bước 8: Frontend cho các luồng trên + biểu đồ
- [x] Bước 9: Kiểm thử end-to-end + dữ liệu demo mẫu

**Dự án đã hoàn thành đầy đủ 9 bước theo lộ trình đề ra.** Có thể chạy demo
ngay bằng tài khoản mẫu trong README.md.

- [x] Bước 10 (bổ sung ngoài lộ trình): Thiết kế lại giao diện chuyên nghiệp
  hơn - sidebar điều hướng trái, nền trắng đơn giản, trang Cài đặt
- [x] Bước 11 (bổ sung ngoài lộ trình): Siết phân quyền tạo tài khoản học
  sinh - chỉ giáo viên tạo/sửa/xoá được, học sinh không tự đăng ký
- [x] Bước 12 (bổ sung ngoài lộ trình): Tải đề thi từ file Word (.docx) - tự
  tách câu hỏi/đáp án/tag, chuyển đổi công thức Toán (WMF) sang ảnh PNG gọn
  đúng kích thước qua LibreOffice + cắt viền trắng, kèm bước giáo viên kiểm
  tra lại trước khi lưu. Đã test đầy đủ với file thật, công thức hiển thị
  đúng và đẹp.
- [x] Bước 13 (bổ sung ngoài lộ trình): Đổi tài khoản mặc định thành
  `admin`/`admin123` (không dùng định dạng email), thêm badge thông báo số
  lượng trên sidebar cho cả giáo viên và học sinh
- [x] Bước 14 (bổ sung ngoài lộ trình): Sửa 2 lỗi thực tế người dùng gặp -
  ảnh công thức Toán quá to sau khi import, và đề xuất AI bị "mồ côi" khi
  xoá đề thi được tạo từ nó
- [x] Bước 15 (bổ sung ngoài lộ trình, thay đổi kiến trúc quan trọng): Đổi
  mô hình lộ trình AI từ "gộp điểm yếu toàn bộ các đề của học sinh" sang
  "mỗi đề thi có lộ trình AI riêng" - xoá đề nào thì xoá sạch bài nộp + lộ
  trình AI của đề đó luôn, không còn revert/giữ lại
- [x] Bước 16 (bổ sung ngoài lộ trình): 3 cải tiến UX theo phản hồi người
  dùng - đáp án dài tự xuống dòng, gộp "Thêm câu hỏi thủ công" và "Tải từ
  Word" thành 1 tab có lựa chọn, thêm chuông thông báo góc màn hình với
  trạng thái đã đọc/chưa đọc
- [x] Bước 17 (bổ sung ngoài lộ trình): Sửa lỗi tách câu bị dính chữ câu kế
  tiếp khi import Word (do dấu chấm/định dạng không in đậm lạ trong file
  gốc), và giảm thêm kích thước ảnh công thức Toán cho cân đối với cỡ chữ
- [x] Bước 18 (bổ sung ngoài lộ trình): Xác nhận chuông thông báo và sinh
  roadmap AI hoạt động đúng (2 vấn đề người dùng báo hoá ra do chưa có dữ
  liệu/cache trình duyệt, không phải lỗi code), gộp luôn "Giao đề cho học
  sinh" vào chung tab "Danh sách câu hỏi" để soạn xong là giao được ngay
  không cần chuyển tab
- [x] Bước 19 (bổ sung ngoài lộ trình): Mở rộng prompt Gemini để sinh
  roadmap chi tiết, nhiều chữ, dễ hiểu hơn (lý thuyết + lỗi hay gặp + hướng
  dẫn cụ thể cho từng bước), và hiển thị đầy đủ nội dung này ngay trong tab
  "Kết quả & Điểm yếu" trước khi giáo viên duyệt (trước đó chỉ hiện trạng
  thái, không hiện nội dung)
- [x] Bước 20 (bổ sung ngoài lộ trình): Tự động nhận diện bảng "ĐÁP ÁN" ở
  cuối file Word (nếu có) để điền sẵn đáp án đúng khi import, giáo viên chỉ
  cần xác nhận lại thay vì chọn từ đầu cho mỗi câu
- [x] Bước 21 (bổ sung ngoài lộ trình, sửa lỗ hổng nghiệp vụ): Giáo viên giờ
  xem được BÀI LÀM CHI TIẾT của học sinh (từng câu, chọn gì, đúng/sai) ngay
  trong tab "Kết quả & Điểm yếu" - trước đó chỉ thấy điểm số và chủ đề yếu
  tổng hợp, không xem được bài làm thật
- [x] Bước 22 (bổ sung ngoài lộ trình, sửa lỗi dữ liệu "ma"): Xoá đề thi giờ
  tính lại đúng bảng thống kê điểm yếu tổng hợp của học sinh
  (`student_topic_stats`) - trước đó xoá đề không dọn bảng này, khiến trang
  "Chuẩn đoán điểm yếu" của học sinh vẫn hiện điểm yếu từ đề đã bị xoá
- [x] Bước 23 (bổ sung ngoài lộ trình): Thêm checkbox "Kèm gửi bài tập AI" khi
  giáo viên duyệt lộ trình - tick thì tạo đề bài tập tiếp theo giao ngay cho
  học sinh (như cũ), bỏ tick thì chỉ gửi lộ trình văn bản, không tạo đề mới
- [x] Bước 24 (bổ sung ngoài lộ trình, sửa lỗi phân loại ảnh công thức): Phân
  loại ảnh công thức (số đơn/ký hiệu/phân số/công thức nhiều tầng) giờ dựa
  theo cấu trúc thật của ảnh (đếm số "dải mực" liên tục theo chiều dọc) thay
  vì đoán qua kích thước khung bao - sửa đúng lỗi số đáp án đơn lẻ (VD: "4",
  "-4", "27") bị hiển thị to bất thường do bị nhận nhầm là phân số
- [x] Bước 25 (sửa lỗi thật gây ra Bước 24 "không có cải thiện gì"): Phát
  hiện và xoá bỏ 1 đoạn code phía FRONTEND (`normalizeMathImages` trong
  `App.jsx`) âm thầm GHI ĐÈ lại class phân loại công thức của MỌI ảnh ngay
  sau khi backend đã tính đúng ở Bước 24 - đây mới là nguyên nhân thật khiến
  người dùng không thấy cải thiện nào dù backend đã sửa đúng
- [x] Bước 26 (thay hẳn cách tính kích thước công thức, không còn 4 "hộp"
  cỡ cố định): Sau khi xoá được lớp ghi đè ở Bước 25, người dùng vẫn thấy
  nhiều câu công thức lượng giác bị lệch cỡ khá nhiều (câu có cỡ chữ quá
  nhỏ khó đọc, câu có số/ký hiệu bị to bất thường) - nguyên nhân do cách
  phân loại cũ (4 nhóm cỡ cố định symbol/1line/fraction/multiline) vẫn dựa
   vào NGƯỠNG PIXEL, mà độ phân giải gốc của mỗi ảnh công thức trong file
  Word lại không đồng nhất. Đổi hẳn sang cách tính TỰ HIỆU CHỈNH theo tỉ lệ
  cấu trúc dải mực của CHÍNH từng ảnh, không còn ngưỡng pixel cố định nào -
  kết quả đồng bộ tuyệt đối bất kể ảnh gốc to nhỏ khác nhau
- [x] Bước 27 (tinh chỉnh theo phản hồi trên đề thi thật): Tăng cỡ hiển thị
  công thức tổng thể (đọc rõ hơn hẳn so với chữ đề), sửa cách phát hiện
  "khoảng ngăn tử/mẫu" để nhận đúng cả phân số ở độ phân giải thấp (VD:
  kπ/3) thay vì bị gộp nhầm thành 1 dòng, và căn giữa mọi ảnh đồ thị/hình vẽ
  trong đề
- [x] Bước 28 (đổi hẳn chiến lược, theo lựa chọn của người dùng sau khi xem
  ảnh lỗi thật): Sau 3 lần tinh chỉnh liên tiếp (Bước 24, 26, 27) mà thuật
  toán tự tính cỡ chữ theo cấu trúc ảnh vẫn còn ca lệch cỡ mới trên dữ liệu
  thật (số "38"/"33." to hẳn so với "20"/"43" cùng 1 câu) - ngừng dò thêm
  heuristic, chuyển hẳn sang CỠ CỐ ĐỊNH ĐỒNG NHẤT cho mọi công thức, đảm bảo
  đồng bộ tuyệt đối 100%, không còn phụ thuộc bất kỳ ngưỡng đoán pixel nào
- [x] Bước 29 (vá lỗ hổng nhánh code bị bỏ sót): Phát hiện nhánh xử lý ảnh
  KHÔNG PHẢI WMF/EMF trong `docxImportService.js` (PNG/JPEG nhúng thẳng, hay
  gặp với các đáp án số đơn giản) bị bỏ sót không gán cỡ cố định như nhánh
  WMF ở Bước 28 - đây là nguyên nhân thật khiến số đơn vẫn to sau khi đã có
  cỡ cố định; đã đồng bộ cả 2 nhánh dùng chung 1 hàm
- [x] Bước 30 (bỏ cỡ cố định, đổi sang tỉ lệ quy đổi tuyến tính DUY NHẤT):
  Cỡ cố định ở Bước 28 hoá ra gây lỗi khác - nội dung càng NGẮN (số đơn,
  biểu thức ngắn như "x=k2π") càng ít ký tự chia sẻ cùng 1 chiều cao khung
  bao nên từng ký tự trông to hẳn so với công thức dài. Đổi sang 1 hằng số
  quy đổi tuyến tính DUY NHẤT (chiều cao hiển thị = chiều cao gốc × hằng số
  cố định) áp dụng như nhau cho mọi ảnh - giữ được tỉ lệ tương quan tự nhiên
  giữa các công thức thay vì ép cùng 1 khung bao
- [x] Bước 31 (giải pháp gốc rễ, theo yêu cầu người dùng "đưa file lên là
  chuẩn luôn"): Đọc trực tiếp CỠ CHỮ THẬT (point size) mà giáo viên đã gõ
  trong MathType bằng cách phân tích cấu trúc nhị phân file WMF/EMF gốc
  (`wmfFontParser.js`, mới) - đây là dữ liệu GỐC do MathType ghi ra, không
  còn suy đoán qua ảnh đã raster hoá như 5 lần sửa trước (Bước 24-30). Có
  hiệu chỉnh riêng theo từng lượt import (tự ước lượng độ phân giải xuất ra
  của LibreOffice) và luôn có phương án dự phòng nếu không đọc được cỡ chữ
- [x] Bước 32 (chốt lại cỡ chữ công thức): Thêm cổng xác nhận bằng dải mực
  thật (band count) cho cả 2 tầng tính kích thước ở Bước 31 - chỉ cho phép
  công thức cao hơn "1 dòng chuẩn" khi THẬT SỰ có từ 2 tầng mực tách rời trở
  lên (phân số/hệ phương trình); công thức 1 dòng dù khung bao WMF có bị
  "phồng" do đặc thù font (số đơn, biểu thức ngắn như "x=k2π") vẫn luôn quy
  về đúng 1 cỡ chuẩn - hết hẳn tình trạng nội dung ngắn to hơn nội dung dài
- [x] Bước 33 (sửa lỗi thật khiến Bước 32 chưa hết hẳn): "Cổng xác nhận dải
  mực" của Bước 32 tự nó bị lỗi nhận nhầm - đổi từ đếm theo MẬT ĐỘ mực từng
  hàng sang đếm theo ĐỘ ĐẬM (điểm ảnh đen thật) từng hàng, vì nhiều ký tự có
  nét vẽ mảnh nhưng đen tuyệt đối (số "4", chữ "π") từng bị coi nhầm là có
  "khoảng ngăn tầng" ngay trong nội bộ 1 ký tự - nay chỉ còn khoảng ngăn có
  màu THẬT NHẠT (do khử răng cưa) mới được tính là ranh giới tầng thật
- [x] Bước 34 (đổi hướng theo đề xuất, chấp nhận không thể tự động 100%):
  Sau 5 lần tinh chỉnh liên tiếp (Bước 24-33) áp dụng nhiều kỹ thuật khác
  nhau (phân loại theo khung bao, dải mực, cỡ chữ thật đọc từ WMF/EMF...)
  vẫn còn phát sinh ca lệch mới - đề xuất và triển khai theo lựa chọn người
  dùng: thêm NÚT CHỈNH TAY cỡ từng công thức ngay trong màn hình kiểm tra đề
  (chế độ sửa) - giáo viên bấm trực tiếp vào công thức bị lệch, chọn 1 trong
  4 mức cỡ có sẵn (Nhỏ/Vừa/Phân số/Lớn), áp dụng ngay không cần soạn lại
  file Word hay chờ tinh chỉnh thêm ở backend
- [x] Bước 35 (chuyển vị trí + thêm nhập tay theo phản hồi): Chỉnh cỡ công
  thức giờ dùng được NGAY TỪ BƯỚC "Xem trước" sau khi tải file Word lên -
  TRƯỚC KHI nạp câu hỏi vào đề và giao cho học sinh (trước đó chỉ chỉnh
  được SAU KHI câu hỏi đã lưu vào đề, đúng góp ý của người dùng là bất hợp
  lý), đồng thời hiện đầy đủ 4 đáp án A/B/C/D ở bước xem trước (trước đó chỉ
  hiện nội dung câu hỏi). Thêm ô nhập số em tuỳ ý bên cạnh 4 mức cỡ dựng sẵn
- [x] Bước 36 (bổ sung cho đúng màn hình "Tạo đề thi mới"): Bước 35 mới chỉ
  sửa màn hình "Soạn câu hỏi" của đề ĐÃ TỒN TẠI (`ExamEditorPage.jsx`) -
  người dùng chỉ ra tính năng chỉnh cỡ còn thiếu ở đúng màn hình họ dùng
  nhiều nhất: "Tạo đề thi mới" (`TeacherExamsPage.jsx`, luồng tải file Word
  + xem trước + giao đề gộp chung 1 form). Tách logic chỉnh cỡ dùng chung
  ra `utils/formulaResize.js`, áp dụng y hệt cho cả 2 màn hình

## Lịch sử cập nhật

### 2026-09-09 - Thêm chỉnh cỡ công thức vào đúng màn hình "Tạo đề thi mới" (Bước 36)
- Đã làm gì: Người dùng gửi ảnh chụp chỉ rõ: màn hình họ đang dùng để tạo đề
  ("Tạo đề thi mới" - tải file Word, xem trước, đặt tên đề, giao học sinh
  gộp chung trong 1 form) KHÔNG PHẢI là màn hình mình vừa sửa ở Bước 35.
  Kiểm tra lại phát hiện đây là 2 trang React HOÀN TOÀN KHÁC NHAU:
  `ExamEditorPage.jsx` (trang `/teacher/exams/:id`, dùng khi đề ĐÃ TỒN TẠI -
  đã sửa xong ở Bước 34/35) và `TeacherExamsPage.jsx` (trang
  `/teacher/exams`, có form "Tạo đề thi mới" gộp cả tải file + xem trước +
  đặt tên + giao đề trong 1 bước duy nhất, chưa hề có tính năng chỉnh cỡ
  công thức).
  Sửa bằng cách:
  1. Tách toàn bộ logic chỉnh cỡ dùng chung ra file mới
     `frontend/src/utils/formulaResize.js` (`FORMULA_SIZE_PRESETS`,
     `valignForHeightEm`, `listFormulaImgTags`, `applyFormulaSize`) - vì cả
     2 trang cần đúng logic giống hệt nhau, tách ra tránh trùng lặp code và
     đảm bảo luôn đồng bộ khi sửa sau này. `ExamEditorPage.jsx` refactor lại
     để import từ file dùng chung này thay vì định nghĩa cục bộ.
  2. `TeacherExamsPage.jsx`: thêm state `resizeTarget`/`customEmValue`, hàm
     `handleResizeFormula` (cập nhật trực tiếp state `parsedQuestions` -
     màn hình này CHƯA GỌI API lưu gì cả cho tới khi bấm "Tạo bài tập", nên
     chỉnh cỡ ở đây hoàn toàn là thao tác phía trình duyệt, không cần gọi
     API riêng) và `handlePreviewContentClick` (bắt sự kiện click uỷ quyền
     y hệt cơ chế ở `ExamEditorPage.jsx`). Gắn class `formula-editable` +
     `onClick` lên khối nội dung câu hỏi VÀ cả 4 đáp án A/B/C/D trong bước
     xem trước, thêm modal "Chỉnh cỡ công thức" (4 mức dựng sẵn + ô nhập tay
     số em) giống hệt giao diện ở `ExamEditorPage.jsx`.
  Test bằng Playwright: chặn API `/exams/import-preview`, mở form "Tạo đề
  thi mới" (đúng trang trong ảnh chụp của người dùng), tải file giả lên ->
  xác nhận 2 ảnh formula-img xuất hiện đúng vị trí (nội dung câu hỏi + đáp
  án A) -> bấm vào ảnh đáp án A -> modal hiện đúng -> bấm "Phân số" -> xác
  nhận style đổi đúng từ `height:1.62em` sang `height:3em;vertical-align:
  -0.81em` - toàn bộ diễn ra trong CHÍNH form tạo đề, trước khi bấm "Tạo bài
  tập". Không lỗi console. `npm run build` chạy sạch.
- Vì sao làm như vậy: Bỏ sót vì `ExamEditorPage.jsx` (soạn câu hỏi cho đề đã
  tồn tại) và `TeacherExamsPage.jsx` (tạo đề mới) tuy có giao diện xem trước
  câu hỏi/đáp án na ná nhau nhưng là 2 component độc lập hoàn toàn, sửa 1
  bên không tự động áp dụng cho bên kia. Tách logic dùng chung ra file utils
  ngay từ lần bổ sung này để tránh lặp lại tình huống "sửa 1 nơi quên nơi
  kia" nếu còn cần tinh chỉnh thêm cỡ công thức trong tương lai.
- File nào bị ảnh hưởng: `frontend/src/utils/formulaResize.js` (MỚI - logic
  dùng chung), `frontend/src/pages/ExamEditorPage.jsx` (refactor dùng
  import từ file dùng chung, bỏ định nghĩa cục bộ trùng lặp),
  `frontend/src/pages/TeacherExamsPage.jsx` (thêm toàn bộ tính năng chỉnh
  cỡ công thức vào form "Tạo đề thi mới": state, handler, class
  `formula-editable`, hiển thị đáp án A/B/C/D ở preview đã có sẵn từ trước
  nhưng chưa gắn được sự kiện chỉnh cỡ, modal chọn cỡ).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Đề nghị người dùng thử
  lại đúng luồng "Tạo đề thi mới" - tải file Word, chỉnh tay công thức nào
  cần thiết ngay trong bước xem trước, rồi mới đặt tên đề/chọn học sinh và
  bấm "Tạo bài tập".

### 2026-09-09 - Chuyển chỉnh cỡ công thức lên bước "Xem trước", thêm nhập tay số em (Bước 35)
- Đã làm gì: Người dùng phản hồi 2 điểm về tính năng chỉnh tay ở Bước 34:
  (1) "Không hợp lý - chỉnh sửa đề phải ở lúc tạo đề đưa gửi qua học sinh
  chứ không phải gửi xong rồi vô xem đề mới chỉnh sửa được" - vì nút chỉnh
  cỡ trước đó chỉ gắn vào danh sách câu hỏi ĐÃ LƯU vào đề (`exam.questions`),
  không có ở bước "Xem trước" ngay sau khi tải file Word lên (`parsedQuestions`,
  trước khi bấm "Nạp tất cả câu vào đề"); (2) muốn tự nhập số em tuỳ ý thay
  vì chỉ chọn trong 4 mức dựng sẵn.
  Sửa cả 2:
  1. Tổng quát hoá state `resizeTarget` để chấp nhận 2 nguồn: `source:
     'preview'` (câu đang xem trước, chưa lưu - trỏ qua `previewIdx`) và
     `source: 'saved'` (câu đã lưu trong đề, trỏ qua `questionId` như cũ).
     `handleResizeFormula` xử lý khác nhau theo nguồn: `preview` chỉ cập
     nhật `parsedQuestions` ở state trình duyệt (chưa gọi API, vì câu hỏi
     chưa tồn tại trên server), `saved` vẫn gọi API `PUT
     /exams/:examId/questions/:questionId` như cũ.
  2. Bước "Xem trước" (`parsedQuestions.map(...)`) trước đó CHỈ hiện nội
     dung câu hỏi (`q.content`), hoàn toàn KHÔNG hiện 4 đáp án A/B/C/D - bổ
     sung hiển thị đầy đủ đáp án kèm class `formula-editable` + sự kiện
     click y hệt bước đã lưu, để giáo viên chỉnh được NGAY công thức trong
     đáp án (chính là nơi hay bị lệch cỡ nhất theo các lần báo lỗi trước) mà
     không cần đợi nạp vào đề trước.
  3. Thêm ô `<input type="number">` trong modal "Chỉnh cỡ công thức", cho
     phép nhập số em bất kỳ (0.5-10em) thay vì chỉ 4 mức dựng sẵn - bấm "Áp
     dụng" tính `vertical-align` tương ứng theo đúng công thức backend dùng
     (`valignForHeightEm`) rồi áp dụng ngay như các nút preset.
  Test bằng Playwright: chặn (intercept) API `/exams/:id/import-preview` để
  trả về 1 câu hỏi giả lập có ảnh công thức trong cả nội dung và đáp án A,
  tải file giả lên qua UI thật -> xác nhận bước "Xem trước" hiện đủ 4 đáp án
  kèm `formula-editable` (2 ảnh formula-img tìm thấy: 1 trong câu hỏi, 1
  trong đáp án A) -> bấm vào ảnh đáp án A -> modal hiện đúng, nhập tay "2.7"
  vào ô số em -> bấm "Áp dụng" -> xác nhận style đổi ĐÚNG từ
  `height:1.62em` thành `height:2.7em;vertical-align:-0.729em` (khớp công
  thức tính vertical-align) - toàn bộ xảy ra TRƯỚC khi bấm "Nạp tất cả câu
  vào đề", đúng yêu cầu chỉnh ngay lúc soạn đề. Không lỗi console.
  `npm run build` frontend chạy sạch. Đã xoá đề test ngay sau khi xác nhận.
- Vì sao làm như vậy: Góp ý của người dùng hoàn toàn hợp lý - luồng nghiệp
  vụ tự nhiên của giáo viên là "soạn/kiểm tra đề xong xuôi mới giao cho học
  sinh", việc chỉ cho sửa SAU KHI đề đã tồn tại (dù về mặt kỹ thuật vẫn nằm
  trước bước giao đề trên cùng trang) không khớp với kỳ vọng thao tác thực
  tế - phải sửa được NGAY tại bước xem trước, là bước tự nhiên nhất để rà
  soát trước khi quyết định lưu. Thêm nhập tay số em vì 4 mức dựng sẵn không
  thể phủ hết mọi trường hợp thực tế, nhất là khi công thức có độ phức tạp
  trung gian giữa 2 mức.
- File nào bị ảnh hưởng: `frontend/src/pages/ExamEditorPage.jsx` (tổng quát
  hoá `resizeTarget`/`handleResizeFormula`/`handleContentClick` theo
  `source`, thêm hiển thị đáp án + sự kiện click ở bước xem trước, thêm ô
  nhập số em tuỳ ý trong modal, thêm state `customEmValue`).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Đề nghị người dùng tải
  lại file Word, chỉnh tay ngay tại bước "Xem trước" nếu cần, rồi mới bấm
  "Nạp tất cả câu vào đề" và giao cho học sinh.

### 2026-09-09 - Thêm nút chỉnh tay cỡ công thức (Bước 34)
- Đã làm gì: Sau Bước 33, người dùng test lại vẫn còn lệch cỡ, hỏi thẳng "có
  cách nào tốt nhất không" và yêu cầu đề xuất trước khi sửa code. Trả lời
  trung thực: sau 5 lần tinh chỉnh liên tiếp (Bước 24-33) bằng nhiều kỹ
  thuật khác nhau, việc tự động suy đoán 100% chính xác từ ảnh WMF/MathType
  (vốn không giữ đủ dữ liệu gốc đáng tin cậy 100% với mọi trường hợp) khó có
  điểm dừng - đề xuất hướng THỰC TẾ hơn: giữ nguyên cỡ tự động làm mặc định
  (đã khá tốt với đa số trường hợp), nhưng thêm khả năng CHỈNH TAY nhanh cho
  những câu còn lệch, thay vì tiếp tục dò heuristic vô thời hạn. Người dùng
  đồng ý, yêu cầu triển khai.
  Triển khai trong `ExamEditorPage.jsx` (màn hình "Danh sách câu hỏi", chế
  độ "Bật chỉnh sửa đề" đã có sẵn):
  - `listFormulaImgTags(html)`: quét toàn bộ thẻ `<img class="formula-img">`
    (bỏ qua `diagram-img`) trong 1 đoạn HTML, trả về vị trí bắt đầu/kết thúc
    theo đúng thứ tự xuất hiện - dùng để xác định CHÍNH XÁC ảnh nào cần sửa
    khi thay thế lại chuỗi HTML.
  - `applyFormulaSize(html, targetIndex, heightEm, vAlignEm)`: thay thuộc
    tính `style="height:...em;vertical-align:...em;"` của đúng ảnh thứ
    `targetIndex`, giữ nguyên mọi ảnh khác (kể cả ảnh đồ thị) không đổi.
  - Ở chế độ sửa đề, nội dung câu hỏi/đáp án được gắn thêm class
    `formula-editable` + sự kiện click uỷ quyền (event delegation, vì nội
    dung render bằng `dangerouslySetInnerHTML` nên không gắn `onClick` trực
    tiếp lên từng `<img>` được) - bấm vào ĐÚNG ảnh công thức nào sẽ xác định
    chỉ số ảnh đó theo THỨ TỰ DOM thật trong khối nội dung đang bấm (khớp
    chính xác với `listFormulaImgTags`, không dựa vào so khớp chuỗi base64
    vì phần đầu của nhiều ảnh PNG khác nhau có thể trùng nhau).
  - Mở modal "📐 Chỉnh cỡ công thức" với 4 mức cỡ dựng sẵn: Nhỏ (1.3em), Vừa
    - 1 dòng (1.8em), Phân số (3em), Lớn - nhiều tầng (4.2em) - bấm 1 nút là
    áp dụng ngay (gọi API `PUT /exams/:examId/questions/:questionId` sẵn có
    để lưu lại `content`/`options` đã cập nhật, không cần thêm route mới).
  - CSS (`index.css`): công thức trong chế độ sửa có viền chấm nhạt khi rê
    chuột qua + con trỏ tay, gợi ý rõ ràng "bấm được vào đây".
  Test: viết unit test độc lập cho `listFormulaImgTags`/`applyFormulaSize`
  bằng Node trực tiếp (mô phỏng 1 đoạn có cả `diagram-img` lẫn
  `formula-img`) - xác nhận chỉ đúng ảnh `formula-img` bị đổi style, ảnh
  `diagram-img` giữ nguyên hoàn toàn. Test UI đầy đủ bằng Playwright: tạo đề
  tạm 1 câu hỏi có ảnh công thức, bật chế độ sửa, bấm vào ảnh công thức trong
  nội dung câu hỏi -> modal hiện đúng 4 nút cỡ -> bấm "Phân số" -> xác nhận
  `style` của ảnh đổi ĐÚNG từ `height:1.62em` thành `height:3em` (khớp chính
  xác giá trị dựng sẵn), không lỗi console. Đã xoá đề test ngay sau khi xác
  nhận, không đụng dữ liệu thật.
- Vì sao làm như vậy: Sau nhiều lần chứng minh việc suy đoán 100% tự động từ
  ảnh WMF/MathType (không có ground-truth tuyệt đối) khó đạt độ chính xác
  tuyệt đối với MỌI kiểu nội dung do người dùng thật tạo ra, cách tiếp cận
  thực tế và bền vững hơn là "đoán tốt làm mặc định + con người tự sửa nhanh
  khi cần" - giống cách các nền tảng làm đề thi/soạn thảo thực tế xử lý vấn
  đề tương tự. Tận dụng lại chính API cập nhật câu hỏi đã có sẵn (không cần
  thêm route/logic backend mới) giữ thay đổi gọn, ít rủi ro.
- File nào bị ảnh hưởng: `frontend/src/pages/ExamEditorPage.jsx` (thêm
  `listFormulaImgTags`, `applyFormulaSize`, `valignForHeightEm`,
  `FORMULA_SIZE_PRESETS`, state `resizeTarget`, hàm `handleResizeFormula`/
  `handleContentClick`, gắn `onClick` + class `formula-editable` lên khối
  nội dung câu hỏi/đáp án khi ở chế độ sửa, modal chọn cỡ mới),
  `frontend/src/index.css` (style hover/click cho `.formula-editable
  img.formula-img`).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Đề nghị người dùng tải
  lại (re-import) file Word gốc, vào chế độ "Bật chỉnh sửa đề", bấm thử vào
  công thức nào còn lệch cỡ để chỉnh tay ngay - không cần chờ sửa thêm code.

### 2026-09-09 - Sửa lỗi nhận nhầm trong chính "cổng xác nhận dải mực" (Bước 33)
- Đã làm gì: Người dùng test lại sau Bước 32, gửi ảnh chụp cho thấy VẪN còn
  y hệt lỗi cũ: câu 3 phương án C ("x = k2π"), câu 4 phương án B ("x = kπ"),
  câu 6 các đáp án số đơn ("4","-4","-2","2.") vẫn to bất thường - tức cổng
  xác nhận dải mực (bandCount) vừa thêm ở Bước 32 KHÔNG có tác dụng như kỳ
  vọng.
  Điều tra bằng cách viết lại chính xác cách `countInkBands` (Bước 32) tính
  toán trên 1 ảnh mô phỏng THẬT SÁT với 1 ký tự đơn có nét vẽ không đều
  (VD: số "4" có nét chéo MẢNH nhưng ĐEN THẬT xen giữa 2 nét ngang DÀY) -
  phát hiện đúng nguyên nhân: `countInkBands` ở Bước 32 xác định "hàng có
  mực" dựa vào MẬT ĐỘ (tỉ lệ % điểm ảnh tối trên cả bề rộng hàng đó, ngưỡng
  30%) - nét chéo mảnh chỉ chiếm ~7% bề rộng nên bị coi là "hàng không có
  mực" dù các điểm ảnh đó ĐEN TUYỆT ĐỐI (giá trị 0), tách nhầm 1 KÝ TỰ ĐƠN
  thành 2 "dải" giả, kích hoạt nhầm cơ chế phóng to dành cho phân số/hệ
  phương trình - đây chính xác là cơ chế gây ra đúng lỗi người dùng báo (số
  đơn/công thức ngắn có nét vẽ không đều dễ bị tách nhầm).
  Sửa bằng cách đổi tiêu chí "hàng có mực" từ MẬT ĐỘ (đếm số điểm ảnh) sang
  ĐỘ ĐẬM (giá trị điểm ảnh TỐI NHẤT trong hàng đó, ngưỡng 140/255 - đủ đen
  để chắc chắn là nét vẽ thật, không phải nhiễu khử răng cưa): 1 hàng chỉ
  cần CÓ ÍT NHẤT 1 điểm ảnh đen thật là được tính "có mực", bất kể chiếm bao
  nhiêu % bề rộng - phân biệt đúng bản chất: nét vẽ mảnh trong 1 ký tự vẫn
  ĐEN THẬT (chỉ ít điểm ảnh), còn khoảng ngăn thật giữa tử số/mẫu số dù dính
  chút xám mờ do khử răng cưa thì KHÔNG CÓ điểm ảnh nào thật sự đen. Giữ lại
  cơ chế gộp khoảng ngăn quá hẹp (Bước 32, chống nhiễu 1-2 hàng lẻ tẻ).
  Test lại bằng 3 ảnh mô phỏng: (1) ký tự đơn có nét chéo mảnh NHƯNG ĐEN
  THẬT xen giữa 2 nét ngang dày (mô phỏng đúng cấu trúc số "4") -> trước sửa
  ra 2 dải (SAI), sau sửa ra ĐÚNG 1 dải; (2) phân số thật với khoảng ngăn có
  dính xám mờ do khử răng cưa (mô phỏng đúng ca lỗi ở Bước 27) -> vẫn ra
  ĐÚNG 2 dải (không bị hỏng bởi bản sửa mới); (3) phân số có gạch ngang rõ
  ràng -> ra 3 dải (tử số/gạch/mẫu số) hợp lý. Test lại toàn bộ chuỗi tính
  kích thước cuối: "x=k2π" (band=1) và số đơn (band=1) đều ra ĐÚNG 1.62em
  bằng công thức 1 dòng bình thường, phân số thật (band=2) vẫn ra 3.24em
  cao hơn hẳn. `npm run build` frontend chạy sạch, `docxImportService.js`
  load không lỗi cú pháp.
  Kiểm tra `data/questions.json` hiện đang RỖNG nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Cổng xác nhận ở Bước 32 vốn dùng đúng Ý TƯỞNG (chỉ tin
  band count khi thật sự có nhiều tầng), nhưng CÁCH ĐO (mật độ %) lại mắc
  đúng loại lỗi mà nó được sinh ra để giải quyết - vẫn suy đoán qua 1 phép
  đo GIÁN TIẾP (tỉ lệ phần trăm) thay vì tín hiệu TRỰC TIẾP và ĐÁNG TIN CẬY
  hơn (độ đậm tuyệt đối của điểm ảnh tối nhất). Bài học rút ra sau nhiều lần
  sửa liên tiếp: khi 1 heuristic dựa trên ảnh raster vẫn còn sai, cần kiểm
  tra kỹ xem TIÊU CHÍ ĐO có thực sự phản ánh đúng bản chất vật lý cần phân
  biệt hay không (ở đây là "có nét vẽ thật" chứ không phải "chiếm nhiều diện
  tích") - không nên chỉ đơn thuần thêm ngưỡng/bộ lọc chồng lên 1 phép đo
  vốn đã sai bản chất.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (viết
  lại `countInkBands`: đổi tiêu chí "hàng có mực" từ mật độ % sang giá trị
  pixel tối nhất trong hàng, giữ nguyên cơ chế gộp khoảng ngăn hẹp).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc lần nữa để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi
  deploy chính thức.

### 2026-09-09 - Thêm cổng xác nhận dải mực - chốt hẳn cỡ công thức 1 dòng (Bước 32)
- Đã làm gì: Người dùng gửi ảnh chụp sau Bước 31, xác nhận đa số công thức
  đã "chuẩn" nhưng vẫn còn 2 trường hợp to bất thường: phương án C câu 3
  ("x = k2π", nội dung ngắn, 1 dòng thật) to hơn hẳn các phương án A/B/D
  cùng câu; đáp án số đơn câu 6 ("4","-4","-2","2.") vẫn to hơn cỡ chữ bình
  thường xung quanh.
  Xác định nguyên nhân: Bước 31 tính `stackFactor` (hệ số phóng to cho phân
  số/nhiều tầng) dựa vào tỉ lệ `chiều cao ảnh gốc / chiều cao 1 dòng dự
  kiến` - nhưng với nội dung NGẮN/ĐƠN LẺ, MathType/Equation Editor đôi khi
  xuất WMF với khung bao cao hơn cần thiết (đệm baseline đặc thù của font
  khi câu lệnh vẽ chỉ có rất ít glyph), khiến `nativeHeightPx` bị "phồng"
  giả tạo dù nội dung chỉ có ĐÚNG 1 dòng - `stackFactor` vì vậy > 1 dù không
  hề có tầng nào, kéo cỡ hiển thị lên cao hơn mức cần thiết.
  Sửa bằng cách đưa lại "cổng xác nhận" bằng CẤU TRÚC ẢNH THẬT (đếm dải mực
  theo mật độ tương đối, kỹ thuật đã dùng ở Bước 27): `countInkBands` (đưa
  trở lại `wmfConvertService.js`, đã bị bỏ ở Bước 28) - chỉ khi bandCount
  >= 2 (THẬT SỰ có từ 2 tầng mực tách rời, tức phân số/hệ phương trình) mới
  cho phép `stackFactor` > 1; nếu không (bandCount <= 1, xác nhận là 1 dòng
  thật), LUÔN quy về đúng 1 cỡ chuẩn theo cỡ chữ pt (`baseEm`), bất kể khung
  bao WMF có bị phồng bao nhiêu. Áp dụng cổng này cho CẢ 2 tầng tính kích
  thước: `computeFormulaSizeFromFont` (Tầng 1, có cỡ chữ thật) và
  `computeFormulaSize` (Tầng 2, dự phòng khi không đọc được cỡ chữ - dùng
  cho nhánh ảnh PNG/JPEG nhúng thẳng trong `docxImportService.js`). Đồng
  thời lọc mẫu hiệu chỉnh `pxPerPt` (`calibratePxPerPt`) chỉ lấy các ảnh xác
  nhận là 1 dòng thật (bandCount<=1), tránh phân số làm lệch tỉ lệ hiệu
  chỉnh chung.
  Test bằng dữ liệu mô phỏng đúng 2 tình huống người dùng báo: "x=k2π" (12pt,
  khung bao phồng lên 60px, bandCount=1 xác nhận không có tầng) -> 1.62em;
  số đơn "4" (12pt, khung bao phồng lên 76px, bandCount=1) -> 1.62em; công
  thức 1 dòng bình thường cùng cỡ chữ (12pt, 45px, bandCount=1) -> 1.62em -
  CẢ 3 ra ĐÚNG CÙNG 1 giá trị dù khung bao gốc chênh lệch tới 76/45≈1.7 lần;
  trong khi phân số thật (12pt, 90px, bandCount=3) vẫn ra cao hơn hẳn
  (3.24em) như mong đợi. `npm run build` frontend chạy sạch, cả 2 module
  backend load không lỗi cú pháp.
  Kiểm tra `data/questions.json` hiện đang RỖNG nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Cỡ chữ pt (Bước 31) cho biết "nội dung này được gõ to
  cỡ nào" nhưng không tự phân biệt được "khung bao WMF cao là do thật sự có
  nhiều tầng, hay chỉ là quirk đệm baseline của font với nội dung ngắn" -
  đây là 2 nguyên nhân hoàn toàn khác nhau nhưng cùng biểu hiện ra là
  "chiều cao ảnh gốc lớn hơn dự kiến". Cần 1 tín hiệu ĐỘC LẬP để phân biệt 2
  trường hợp này - cấu trúc dải mực thật (đã chứng minh đáng tin cậy để trả
  lời câu hỏi nhị phân "có/không có nhiều tầng" từ Bước 27, dù KHÔNG đáng
  tin cậy để tự suy ra kích thước tuyệt đối như các bước 24-27 từng thử) là
  lựa chọn phù hợp nhất, kết hợp cùng cỡ chữ thật của Bước 31 tạo thành 1 hệ
  thống 2 tín hiệu bổ trợ nhau: cỡ chữ pt quyết định "to bao nhiêu", dải mực
  quyết định "có được phép to hơn 1 dòng chuẩn hay không".
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (thêm
  lại `countInkBands`, thêm tham số `hasMultipleBands` vào
  `computeFormulaSizeFromFont`/`computeFormulaSize`, tính `bandCount` trong
  `trimWhitespace`, lọc mẫu hiệu chỉnh theo `bandCount<=1`, export thêm
  `countInkBands`), `backend/src/services/docxImportService.js` (nhánh
  PNG/JPEG trực tiếp gọi thêm `countInkBands` trước khi tính kích thước).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc lần nữa để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi
  deploy chính thức.

### 2026-09-09 - Đọc cỡ chữ THẬT trực tiếp từ file WMF/EMF, không còn đoán qua ảnh (Bước 31)
- Đã làm gì: Sau khi Bước 30 (tỉ lệ tuyến tính) vẫn còn ca lệch cỡ (đã trao
  đổi trực tiếp với người dùng), người dùng hỏi "có cách nào đưa file lên là
  chuẩn luôn không" - tức muốn 1 giải pháp GỐC RỄ thay vì tiếp tục vá heuristic
  đoán qua pixel như 5 lần sửa trước (Bước 24-30, mỗi lần chỉ xử lý được 1
  vài trường hợp cụ thể rồi lại phát sinh ca sai mới). Đề xuất 2 hướng: (1)
  chuyển hẳn sang công thức dạng văn bản (MathML/LaTeX + KaTeX) - nhưng
  người dùng xác nhận công thức được nhập bằng MathType (lưu dưới dạng ảnh
  OLE, không có văn bản toán học đi kèm) nên hướng này không khả thi; (2)
  đọc trực tiếp cỡ chữ THẬT từ cấu trúc nhị phân file WMF/EMF gốc - người
  dùng chọn hướng này và yêu cầu triển khai.
  Triển khai file mới `backend/src/services/wmfFontParser.js`:
  - WMF (định dạng MathType hay dùng nhất): phân tích "Placeable Metafile
    Header" (magic number `0x9AC6CDD7`) để lấy trường `Inch` (số đơn vị logic
    ứng với 1 inch), sau đó quét tuần tự các bản ghi nhị phân tìm
    `META_CREATEFONTINDIRECT` (mã 0x02FB) - trường đầu tiên trong tham số
    của bản ghi này chính là `lfHeight` (cỡ chữ, đơn vị logic) trong cấu trúc
    `LOGFONT` mà MathType đã ghi khi tạo công thức. Quy đổi: point size =
    |lfHeight| / Inch × 72.
  - EMF (định dạng mới hơn, ít gặp hơn với MathType nhưng vẫn hỗ trợ): đọc
    `EMR_HEADER` (bản ghi đầu tiên) để lấy `szlDevice`/`szlMillimeters` suy
    ra DPI thiết bị tham chiếu, rồi quét tìm bản ghi
    `EMR_EXTCREATEFONTINDIRECTW` (mã 82) lấy `lfHeight` (LONG, 4 byte) trong
    `LOGFONTW`. Quy đổi: point size = |lfHeight| / DPI × 72.
  - Cả 2 hàm đều trả về `null` nếu không phân tích được (file thiếu
    Placeable Header, định dạng lạ, dữ liệu hỏng...) - nơi gọi tự động rơi
    về phương án dự phòng, không có gì "vỡ".
  Sửa `wmfConvertService.js` để dùng cỡ chữ thật này làm CƠ SỞ TÍNH KÍCH
  THƯỚC HIỂN THỊ (thay hẳn cách tuyến tính thuần theo pixel của Bước 30):
  - `EM_PER_PT`: quy đổi 1pt cỡ chữ MathType sang em cho ĐÚNG 1 dòng công
    thức đơn - hằng số này không đổi theo nội dung, chỉ đổi theo cỡ chữ THẬT
    giáo viên đã gõ, nên nếu giáo viên cố ý gõ 1 công thức to hơn thì nó sẽ
    hiển thị to hơn ĐÚNG NHƯ Ý ĐỊNH GỐC, không còn là hiện tượng ngẫu nhiên
    do đặc thù raster nữa.
  - `calibratePxPerPt`: vì vẫn cần biết "1pt tương ứng bao nhiêu pixel gốc"
    ở độ phân giải LibreOffice xuất PNG ra (không cố định, không control
    được trực tiếp), hàm này tự ước lượng bằng TRUNG VỊ tỉ lệ (chiều cao ảnh
    gốc / cỡ chữ pt) trên TOÀN BỘ ảnh công thức đọc được cỡ chữ trong CHÍNH
    lượt import đó - tự hiệu chỉnh theo từng file, không cần biết trước
    thông số LibreOffice.
  - `computeFormulaSizeFromFont`: từ đó suy ra "hệ số tầng" (stackFactor) =
    chiều cao ảnh gốc / (cỡ chữ pt × pxPerPt hiệu chỉnh) - xấp xỉ 1 với công
    thức 1 dòng thật, xấp xỉ 2 trở lên với phân số/hệ phương trình nhiều
    tầng - nhân thêm vào cỡ hiển thị cơ sở (đã tính từ font pt) để giữ được
    "phân số cao hơn công thức 1 dòng" mà không cần đếm dải mực/đoán cấu
    trúc như Bước 24-27 (vốn không ổn định).
  - Ảnh KHÔNG đọc được cỡ chữ (WMF thiếu Placeable Header, hoặc ảnh PNG/JPEG
    nhúng thẳng ở nhánh dự phòng của `docxImportService.js`) tự động rơi về
    `computeFormulaSize` (Tầng 2, tỉ lệ tuyến tính thuần như Bước 30) - đảm
    bảo luôn có kết quả hợp lý dù không phân tích được font.
  - `convertWmfBuffersToPng` giờ chạy 2 lượt: lượt 1 chuyển đổi + đo kích
    thước gốc + đọc `fontSizePt` của TẤT CẢ ảnh; lượt 2 hiệu chỉnh
    `pxPerPt` DÙNG CHUNG cho cả lượt import rồi tính cỡ hiển thị cuối cùng
    cho từng ảnh.
  Test: viết unit test bằng cách TỰ DỰNG buffer WMF/EMF hợp lệ (mô phỏng
  đúng cấu trúc Placeable Header + `META_CREATEFONTINDIRECT` cho WMF,
  `EMR_HEADER` + `EMR_EXTCREATEFONTINDIRECTW` cho EMF) với `lfHeight`/DPI đã
  biết trước - xác nhận `extractFontSizePt` trả về ĐÚNG point size kỳ vọng
  (12pt, 18pt cho WMF; ~24.75pt cho EMF), và trả về `null` đúng khi thiếu
  Placeable Header. Test tiếp `calibratePxPerPt` + `computeFormulaSizeFromFont`
  bằng dữ liệu mô phỏng sát thực tế (nhiều mẫu 1 dòng cùng 12pt, 1 mẫu phân
  số 12pt cao gấp đôi, 1 mẫu số đơn 12pt bị "phồng" do đặc thù baseline của
  Equation Editor): các mẫu 1 dòng cùng cỡ chữ đều ra ĐÚNG CÙNG 1 giá trị em
  (~1.62em, đồng bộ tuyệt đối); phân số ra cao hơn hẳn (~3.1em, đúng cấu
  trúc thật); số đơn bị phồng vẫn còn hơi cao hơn 1 dòng bình thường (~2.62em)
  nhưng đã giảm mạnh so với trước (không còn tính hoàn toàn theo pixel bị
  phồng nữa mà tính chủ yếu từ cỡ chữ thật, phần phồng chỉ còn ảnh hưởng 1
  phần qua hệ số tầng); test riêng biệt cỡ chữ khác nhau (10pt vs 12pt) cho
  ra kích thước hiển thị khác nhau ĐÚNG TỈ LỆ - xác nhận phản ánh đúng ý
  định thật của người soạn thay vì ép đồng nhất giả tạo. `npm run build`
  frontend chạy sạch, `docxImportService.js` load được không lỗi cú pháp.
  Kiểm tra `data/questions.json` hiện đang RỖNG nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Toàn bộ 5 lần sửa trước (Bước 24-30) đều CHỈ suy đoán
  cấu trúc/kích thước công thức qua ẢNH ĐÃ RASTER HOÁ (khung bao, dải mực,
  mật độ mực, tỉ lệ pixel) - về bản chất đây luôn là phỏng đoán gián tiếp,
  không có gì đảm bảo đúng 100% với mọi kiểu nội dung. Cỡ chữ point size lưu
  trong `LOGFONT` của chính file WMF/EMF là dữ liệu GỐC, THẬT, do MathType
  ghi trực tiếp khi giáo viên gõ công thức - đọc thẳng dữ liệu này loại bỏ
  hoàn toàn sự mơ hồ của việc đoán qua ảnh, đúng với yêu cầu "đưa file lên
  là chuẩn luôn" của người dùng. Vẫn giữ phương án dự phòng (Tầng 2) cho các
  trường hợp không đọc được (WMF thiếu Placeable Header, ảnh PNG/JPEG nhúng
  thẳng) để không có tình huống nào bị "vỡ" hoàn toàn.
- File nào bị ảnh hưởng: `backend/src/services/wmfFontParser.js` (MỚI - đọc
  cỡ chữ thật từ WMF/EMF), `backend/src/services/wmfConvertService.js` (thêm
  `computeFormulaSizeFromFont`, `calibratePxPerPt`, tích hợp cỡ chữ thật vào
  `convertWmfBuffersToPng` chạy 2 lượt, giữ `computeFormulaSize` cũ làm
  phương án dự phòng Tầng 2), `backend/src/services/docxImportService.js`
  (không đổi logic, vẫn dùng `pngInfo.displayHeightEm`/`verticalAlignEm` như
  cũ - nay các giá trị này chính xác hơn nhờ Tầng 1 mới).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc lần nữa để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi
  deploy chính thức. Đây là lần sửa dựa trên dữ liệu GỐC (không còn đoán qua
  pixel) nên kỳ vọng ổn định hơn hẳn 5 lần sửa trước - nhưng vẫn có thể còn
  vài trường hợp WMF không có Placeable Header (rơi về dự phòng) hoặc số đơn
  lẻ vẫn hơi cao hơn 1 chút do đặc thù font MathType (đã cải thiện đáng kể,
  không còn "to bất thường").

### 2026-09-09 - Bỏ cỡ cố định, đổi sang tỉ lệ quy đổi tuyến tính DUY NHẤT cho mọi công thức (Bước 30)
- Đã làm gì: Người dùng tải lại đề sau Bước 29 (đã vá nhánh PNG/JPEG), gửi
  thêm ảnh chụp cho thấy VẪN còn lệch cỡ RÕ RỆT: câu 3, trong CÙNG 1 đáp án
  A, phương án C ("x = k2π", nội dung ngắn) hiển thị TO HẲN so với các
  phương án A/B/D (nội dung dài hơn, ví dụ "x = -π/6 + k2π (k∈Z)"); câu 6,
  câu 14 các đáp án số đơn ("4","-4","-2","2.", "1","2","0") vẫn to so với
  phần chữ thường xung quanh ("vô số").
  Xác định nguyên nhân: đây KHÔNG phải lỗi code (style vẫn được gán đúng),
  mà là hệ quả TẤT YẾU của chính thiết kế "cỡ cố định" ở Bước 28 - khi MỌI
  ảnh công thức bị ép về CÙNG 1 chiều cao khung bao (2.3em) bất kể nội dung
  dài hay ngắn, thì nội dung càng NGẮN (số đơn, biểu thức ngắn) càng có ÍT
  ký tự để lấp đầy chiều cao đó, khiến TỪNG KÝ TỰ trông to/đậm hẳn so với
  công thức dài (nhiều ký tự chia sẻ cùng 1 chiều cao nên mỗi ký tự nhỏ
  hơn). Ép cùng 1 khung bao không đồng nghĩa với "đồng bộ cỡ chữ" như người
  dùng mong muốn - phải quy đổi theo tỉ lệ mới giữ được cỡ CHỮ (không phải
  cỡ khung bao) tương đồng.
  Sửa bằng cách bỏ hẳn hằng số cỡ cố định (`FIXED_FORMULA_HEIGHT_EM`), thay
  bằng 1 HẰNG SỐ QUY ĐỔI TUYẾN TÍNH DUY NHẤT (`GLOBAL_PX_TO_EM = 0.043`)
  áp dụng NHƯ NHAU cho mọi ảnh: `chiều cao hiển thị (em) = chiều cao gốc
  (pixel, sau khi cắt viền trắng) × 0.043`, giới hạn trong khoảng [1.3em,
  5.5em]. Vì LibreOffice luôn xuất PNG ở cùng 1 DPI cho mọi ảnh trong cùng 1
  lượt chuyển đổi, chiều cao gốc (pixel) phản ánh khá sát QUY MÔ THẬT của
  nội dung (công thức có tử/mẫu tự nhiên cao hơn 1 dòng thường, nội dung
  ngắn tự nhiên có chiều cao khung bao thấp hơn dù đôi khi vẫn hơi cao hơn
  kỳ vọng do đặc thù font baseline của Equation Editor với nội dung đơn lẻ)
  - nhân với 1 hằng số DUY NHẤT giữ nguyên tỉ lệ tương quan tự nhiên giữa
  các ảnh, không còn ép tất cả về cùng 1 khung bao nữa. Hàm mới
  `computeFormulaSize(nativeHeightPx)` trong `wmfConvertService.js`, dùng
  chung cho CẢ 2 nhánh (WMF và PNG/JPEG trực tiếp) trong
  `docxImportService.js` để đảm bảo nhất quán.
  Test bằng các mốc chiều cao gốc mô phỏng đúng các trường hợp người dùng
  báo: số đơn (76px gốc) -> 3.27em; biểu thức ngắn "x=k2π" (40px gốc) ->
  1.72em (RÕ RÀNG nhỏ hơn số đơn và các công thức dài, đúng như kỳ vọng,
  khác hẳn Bước 28 khi mọi thứ đều ép về 2.3em như nhau); công thức 1 dòng
  dài hơn (45px gốc) -> 1.94em; phân số 2 tầng (75px gốc) -> 3.23em; hệ
  phương trình 3 tầng (95px gốc) -> 4.09em - thứ tự tăng dần hợp lý theo
  đúng độ phức tạp nội dung, không còn tình trạng nội dung ngắn bị đẩy to
  hơn nội dung dài. `npm run build` frontend chạy sạch.
  Kiểm tra `data/questions.json` hiện đang RỖNG nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: "Đồng bộ" mà người dùng mong muốn thực chất là ĐỒNG BỘ
  CỠ CHỮ/NÉT VẼ (visual font size), không phải đồng bộ chiều cao khung bao -
  2 khái niệm này chỉ trùng nhau khi mọi nội dung có MẬT ĐỘ ký tự như nhau,
  điều không đúng với dữ liệu thật (đáp án ngắn dài khác nhau rất nhiều).
  Quy đổi tuyến tính theo đúng 1 tỉ lệ cố định (không đổi theo nội dung, chỉ
  đổi theo kích thước gốc đo được) là cách trung dung nhất: vừa giữ được
  tương quan tự nhiên giữa các loại công thức (đã bị Bước 28 xoá bỏ hoàn
  toàn), vừa không cần đoán cấu trúc nội dung ảnh (đã thất bại nhiều lần ở
  Bước 24-27) - chỉ dựa vào 1 phép đo đơn giản, đáng tin cậy (chiều cao
  pixel sau khi cắt viền) và 1 hằng số áp dụng thống nhất tuyệt đối.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (bỏ
  `FIXED_FORMULA_HEIGHT_EM`/`FIXED_FORMULA_VALIGN_EM`, thêm hàm
  `computeFormulaSize` dùng tỉ lệ tuyến tính, export thêm hàm này),
  `backend/src/services/docxImportService.js` (nhánh PNG/JPEG trực tiếp
  dùng `wmfConvertService.computeFormulaSize` thay vì gọi cỡ cố định cũ, cập
  nhật giá trị mặc định trong `getFormulaAttrs`).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc lần nữa để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi
  deploy chính thức. Lưu ý: số đơn lẻ (VD: "4") vẫn có thể hơi cao hơn 1
  chút so với công thức 1 dòng thông thường do đặc thù font của Equation
  Editor khi render nội dung đơn lẻ (đã giảm đáng kể so với trước, không
  còn là lỗi "to bất thường" nữa) - nếu vẫn chưa vừa ý, có thể gửi thêm ảnh
  cụ thể để tinh chỉnh riêng hằng số `GLOBAL_PX_TO_EM`.

### 2026-09-09 - Vá "lỗ hổng" nhánh ảnh không phải WMF - nguyên nhân thật khiến số đơn vẫn to sau Bước 28 (Bước 29)
- Đã làm gì: Người dùng tải lại đề (sau Bước 28 - cỡ cố định 2.3em) và gửi
  thêm ảnh chụp: công thức lượng giác đầy đủ (câu 4, câu 18) hiển thị đẹp,
  đồng bộ - NHƯNG các đáp án là SỐ ĐƠN LẺ hoặc DÃY SỐ (câu 6: "4","-4","-2",
  "2."; câu 15: "2;0;-2;-4;-5", "7;-4;-1;2;5") vẫn to bất thường, không đồng
  bộ với câu 4/18.
  Xác định nguyên nhân THẬT (khác hẳn mọi lần trước): `docxImportService.js`
  có 2 nhánh xử lý ảnh khi dựng HTML từ file Word - nhánh cho ảnh WMF/EMF
  (công thức MathType/Equation Editor cũ, phải chuyển đổi qua LibreOffice)
  và nhánh DỰ PHÒNG cho ảnh KHÔNG PHẢI WMF/EMF (PNG/JPEG nhúng thẳng, dòng
  110-111 cũ). Nhánh WMF đã được gán `style="height:2.3em;..."` đầy đủ từ
  Bước 28, nhưng nhánh PNG/JPEG trực tiếp thì KHÔNG - trước đây (trước Bước
  26) nhánh này dựa vào 1 rule CSS chung `max-height` theo class, nhưng rule
  đó đã bị XOÁ ở Bước 26 khi chuyển sang gán `style` riêng từng ảnh cho
  nhánh WMF - vô tình bỏ sót nhánh này, khiến nó không còn bất kỳ giới hạn
  kích thước nào, hiển thị ĐÚNG KÍCH THƯỚC PIXEL GỐC không giới hạn. Rất
  nhiều bản Word/MathType khi lưu công thức ĐƠN GIẢN (chỉ 1 số, không có ký
  hiệu Toán đặc biệt) sẽ tự động lưu dưới dạng PNG thường thay vì WMF (vì
  không cần vector phức tạp) - nên các đáp án số đơn hay "sập bẫy" đúng
  nhánh bị bỏ sót này, trong khi công thức lượng giác/hàm số phức tạp luôn
  đi qua nhánh WMF (đã có style đúng) nên hiển thị đẹp.
  Sửa: nhánh PNG/JPEG trực tiếp giờ dùng `sharp` đo kích thước ảnh thật (không
  cần LibreOffice vì không phải WMF, đọc trực tiếp được), áp DỤNG CÙNG QUY
  TẮC như nhánh WMF - đo lớn (>260x100px, đồ thị/hình vẽ thật) thì gán
  `diagram-img`, còn lại (công thức/số đơn) gán CÙNG 1 cỡ cố định
  (`getFormulaAttrs`, tái sử dụng y hệt hàm của nhánh WMF) - đảm bảo CẢ 2
  nhánh giờ luôn cho ra kết quả đồng bộ tuyệt đối như nhau.
  Test: gọi `sharp.metadata()` trực tiếp trên ảnh PNG tổng hợp mô phỏng 2
  trường hợp (nhỏ 40x60 -> đúng không phải diagram; lớn 400x300 -> đúng là
  diagram) - khớp logic mong đợi. `npm run build` frontend chạy sạch.
  Kiểm tra `data/questions.json` hiện đang RỖNG (người dùng lại xoá đề test
  trước khi gửi phản hồi) nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Đây là kiểu lỗi "bỏ sót 1 nhánh code tương tự" - khi
  sửa Bước 26/28 chỉ tập trung vào nhánh WMF (nhánh chính, phổ biến hơn) mà
  quên nhánh dự phòng cũng cần đồng bộ y hệt. Bài học: mọi lần thêm/sửa cách
  hiển thị ảnh công thức về sau PHẢI kiểm tra CẢ 2 nhánh trong
  `docxImportService.js`, không chỉ nhánh WMF - đã gộp chung logic qua cùng
  hàm `getFormulaAttrs` để tránh lặp lại tình huống 2 nhánh lệch nhau này
  trong tương lai.
- File nào bị ảnh hưởng: `backend/src/services/docxImportService.js` (thêm
  `sharp` để đo kích thước ảnh nhúng trực tiếp không qua WMF, áp dụng
  `getFormulaAttrs` cho nhánh này).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc lần nữa để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi
  deploy chính thức.

### 2026-09-09 - Đổi hẳn sang cỡ chữ công thức CỐ ĐỊNH, bỏ hoàn toàn heuristic tự động (Bước 28)
- Đã làm gì: Người dùng gửi thêm ảnh chụp cho thấy cách tính tỉ lệ tự động ở
  Bước 26/27 (dù đã tinh chỉnh thêm) VẪN còn lệch cỡ rõ rệt trên dữ liệu
  thật: câu 17 có đáp án "38" và "33." hiển thị to hẳn so với "20" và "43"
  trong CÙNG 1 câu; câu 16 có "u_n = 3.2^n" to hơn hẳn "u_n = 3-2n" dù cùng
  dạng công thức 1 dòng. Người dùng đề xuất cân nhắc đổi hẳn sang PDF để
  trích xuất dễ hơn.
  Đưa ra 3 lựa chọn cho người dùng quyết định (dùng AskUserQuestion): (1)
  cỡ cố định đồng nhất cho mọi công thức, (2) tiếp tục dò thêm ngưỡng theo
  hướng cũ, (3) chuyển sang PDF. Người dùng chọn phương án (1).
  Lý do phương án (2)/(3) không được chọn: (2) đã thử 3 lần liên tiếp (Bước
  24, 26, 27) vẫn phát sinh ca sai mới mỗi lần gặp dữ liệu thật đa dạng hơn
  - không có dấu hiệu sẽ hội tụ; (3) chuyển sang PDF không giải quyết được
  vấn đề CỐT LÕI (ảnh WMF/MathType được rasterize thành điểm ảnh không mang
  theo thông tin cỡ chữ GỐC đáng tin cậy) vì PDF cũng nhúng công thức dưới
  dạng hình ảnh/vector tương tự, đồng thời phải viết lại toàn bộ pipeline
  trích xuất (mammoth chỉ đọc được .docx, không đọc PDF) - đổi công sức lớn
  mà không chắc hết lỗi.
  Sửa: xoá bỏ HOÀN TOÀN cơ chế đếm dải mực + tính tỉ lệ (`countInkBands`,
  toàn bộ logic `bandCount`/`heightRatio` trong `trimWhitespace` của
  `wmfConvertService.js`), thay bằng 2 hằng số CỐ ĐỊNH áp dụng cho MỌI ảnh
  công thức không phải đồ thị: `FIXED_FORMULA_HEIGHT_EM = 2.3em`,
  `FIXED_FORMULA_VALIGN_EM = -0.55em`. Ảnh đồ thị/hình vẽ (`isDiagram`, xét
  theo khung bao lớn như cũ) vẫn giữ nguyên cách hiển thị riêng
  (`diagram-img`, không dùng 2 hằng số này). `docxImportService.js`
  (`getFormulaAttrs`) cập nhật giá trị mặc định khớp theo.
  Test bằng ảnh tổng hợp: 3 loại nội dung khác nhau hoàn toàn (số đơn cao do
  đệm baseline, phân số 3 tầng, công thức 1 dòng dài độ phân giải thấp) đều
  cho ra ĐÚNG CÙNG 1 giá trị `displayHeightEm: 2.3` - xác nhận đồng bộ tuyệt
  đối, không còn phụ thuộc cấu trúc/độ phân giải ảnh gốc. `npm run build`
  frontend chạy sạch (không đổi CSS/JS frontend, chỉ đổi backend).
  Kiểm tra `data/questions.json` hiện đang RỖNG nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Gốc rễ vấn đề (đã nêu ở Bước 27 nhưng chưa hành động
  triệt để) là ảnh WMF/MathType sau khi rasterize KHÔNG mang theo thông tin
  cỡ chữ gốc đáng tin cậy - độ phân giải xuất ra phụ thuộc cách giáo viên
  gõ công thức ở từng thời điểm, không đồng nhất dù trong cùng 1 câu. Mọi
  heuristic dựa vào cấu trúc pixel (khung bao ở Bước 24, tỉ lệ dải mực ở
  Bước 26/27) chỉ đúng với các ca đã test, chưa bao giờ đúng 100% với dữ
  liệu thật đa dạng - đã chứng minh qua 3 lần sửa liên tiếp. Khi không có
  thông tin gốc đáng tin cậy để suy luận, cách AN TOÀN VÀ CHẮC CHẮN nhất để
  đạt đúng mục tiêu "đồng size" của người dùng là bỏ hẳn suy luận, dùng 1
  giá trị cố định cho tất cả - đánh đổi việc phân số phức tạp không "co
  giãn đúng số tầng" (chấp nhận được, vẫn đọc rõ ở 2.3em) để đổi lấy sự đồng
  bộ tuyệt đối không còn ngoại lệ.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (xoá
  `countInkBands` và toàn bộ logic tỉ lệ, thay bằng 2 hằng số cố định),
  `backend/src/services/docxImportService.js` (cập nhật giá trị mặc định
  trong `getFormulaAttrs` khớp với 2 hằng số mới).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc để tạo đề mới, kiểm tra và chụp ảnh gửi lại xác nhận trước khi deploy
  chính thức. Nếu 2.3em vẫn chưa vừa ý (quá to/quá nhỏ), chỉ cần đổi 1 số
  duy nhất (`FIXED_FORMULA_HEIGHT_EM`) là áp dụng đồng loạt cho mọi công
  thức, không cần dò lại thuật toán.

### 2026-09-09 - Tăng cỡ công thức, nhận đúng phân số độ phân giải thấp, căn giữa ảnh đồ thị (Bước 27)
- Đã làm gì: Người dùng test đề thật sau Bước 26, nhận xét: (1) công thức
  trên đề nhìn chung vẫn nhỏ so với cỡ chữ đề thi, cần tăng lên; (2) đặc
  biệt các công thức có tử/mẫu chứa π (VD: `kπ/3`, `kπ/6`) vẫn nhỏ và CHƯA
  đồng bộ - có câu to có câu nhỏ dù cùng dạng phân số; (3) ảnh đồ thị/hình
  vẽ trong đề cần được căn giữa thay vì lệch trái.
  Sửa cả 3:
  1. Tăng `BASE_LINE_EM` (đơn vị 1 dòng công thức chuẩn) từ 1.15em lên
     1.5em trong `wmfConvertService.js`, tăng trần tối đa từ 4.5em lên 6em
     cho công thức nhiều tầng - mọi công thức giờ hiển thị to, rõ hơn hẳn so
     với bản trước, đồng bộ với cỡ chữ đề thi.
  2. Sửa nguyên nhân khiến 1 số phân số (đặc biệt công thức chứa π ở độ
     phân giải thấp) vẫn bị tính nhầm là "1 dòng" thay vì "phân số": hàm
     `countInkBands` trước đó xác định "hàng có mực" chỉ cần ĐÚNG 1 điểm ảnh
     tối hơn ngưỡng - khi ảnh gốc nhỏ, khoảng trắng ngăn cách tử số/mẫu số
     bị làm mịn (anti-alias) thành màu xám nhạt chứ không còn trắng tuyệt
     đối, khiến thuật toán cũ coi nhầm là "vẫn có mực, không phải khoảng
     ngăn". Đổi sang xét MẬT ĐỘ mực từng hàng (tỉ lệ điểm ảnh tối/tổng bề
     rộng) thay vì chỉ có/không: 1 hàng được coi là "khoảng ngăn cách" nếu
     mật độ của nó thấp hơn 30% mật độ đậm nhất đo được trong CHÍNH ảnh đó
     (ngưỡng tương đối theo từng ảnh, không phải ngưỡng tuyệt đối chung) -
     phát hiện đúng cả khoảng ngăn "nhạt" do ảnh nhỏ mà thuật toán cũ bỏ sót.
  3. Thêm CSS căn giữa cho đoạn văn chỉ chứa 1 ảnh đồ thị/hình vẽ
     (`.question-content p:has(> img.diagram-img)` và tương tự cho
     `.question-card`) - phòng trường hợp `margin: auto` riêng trên ảnh
     không đủ tự căn giữa do đoạn cha bị kéo giãn bởi phần tử khác.
  Test bằng ảnh tổng hợp mô phỏng đúng 2 dạng lỗi: (a) số đơn/công thức 1
  dòng ở nhiều độ phân giải khác nhau - đều cho ra ĐÚNG 1.5em (tăng rõ so
  với 1.15em trước); (b) phân số "mờ" mô phỏng khoảng ngăn tử/mẫu bị làm
  mịn ở độ phân giải thấp - trước đây bị gộp nhầm thành 1 dải (như 1 dòng),
  sau khi sửa nhận đúng 2 dải (phân số), hiển thị ở mức ~3.7em thay vì bị
  gộp về 1.5em như công thức 1 dòng thông thường. `npm run build` frontend
  chạy sạch, không lỗi.
  Kiểm tra `data/questions.json` hiện đang RỖNG (chưa có đề nào được import
  lại kể từ Bước 26) nên không cần vá dữ liệu cũ.
- Vì sao làm như vậy: Phản hồi thực tế trên đề thật cho thấy 2 giới hạn còn
  sót của Bước 26: (1) cỡ chuẩn 1.15em tuy đã ĐỒNG BỘ nhưng bản thân giá trị
  đó vẫn nhỏ so với kỳ vọng đọc thoải mái trên đề thi in/hiển thị màn hình -
  đây là vấn đề THẨM MỸ/ĐỘ DỄ ĐỌC, cần tăng trực tiếp hằng số cơ sở; (2) việc
  phân số bị tính nhầm thành 1 dòng không phải do công thức tỉ lệ sai, mà do
  bước ĐẾM DẢI MỰC đầu vào (`countInkBands`) chưa đủ nhạy với khoảng ngăn
  "nhạt" ở ảnh độ phân giải thấp - phải sửa từ gốc (cách đo mật độ mực) thì
  công thức tỉ lệ ở Bước 26 mới phát huy đúng tác dụng.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (tăng
  `BASE_LINE_EM` 1.15→1.5, trần tối đa 4.5→6em, đổi `countInkBands` sang xét
  mật độ mực tương đối thay vì có/không tuyệt đối), `backend/src/services/docxImportService.js`
  (đồng bộ giá trị mặc định trong `getFormulaAttrs`), `frontend/src/index.css`
  (tăng `max-height` của `diagram-img` 280px→320px, thêm rule căn giữa đoạn
  văn chứa ảnh đồ thị).
- Việc cần làm tiếp theo: Đề nghị người dùng tải lại (re-import) file Word
  gốc để tạo đề mới, chụp ảnh gửi lại xác nhận trước khi deploy chính thức.

### 2026-09-09 - Đổi hẳn sang cách tính kích thước công thức tự hiệu chỉnh theo tỉ lệ, bỏ 4 nhóm cỡ cố định (Bước 26)
- Đã làm gì: Sau khi xoá lớp code frontend ghi đè ở Bước 25, người dùng test
  lại và gửi ảnh chụp cho thấy vẫn còn lệch cỡ khá nhiều: công thức lượng
  giác ở câu 1, 4, 5 (dạng 1 dòng) hiển thị QUÁ NHỎ so với chữ văn bản xung
  quanh (khó đọc), trong khi câu 2, 3 thì vế nghiệm ĐẦU TIÊN trong đáp án
  hiện to đúng (là phân số thật, có tử/mẫu rõ ràng) nhưng vế nghiệm THỨ HAI
  (sau chữ "và", cùng dạng phân số) lại hiện nhỏ hơn hẳn.
  Xác định nguyên nhân gốc: dù Bước 24 đã đổi cách PHÂN LOẠI (dùng số dải
  mực thay vì đoán qua khung bao), nhưng bước SAU CÙNG vẫn map về 1 trong 4
  "hộp" cỡ cố định bằng CSS class (`formula-symbol` = 1.05em, `formula-1line`
  = 1.22em, `formula-fraction` = 3.1em, `formula-multiline` = 3.8em). Vấn đề
  là: các ảnh công thức trong CÙNG 1 file Word không có ĐỘ PHÂN GIẢI GỐC
  đồng nhất (VD: vế nghiệm thứ 2 sau "và" thường được giáo viên gõ/dán với
  cỡ chữ nhỏ hơn trong Word so với vế đầu) - nên dù đã phân loại ĐÚNG LOẠI
  (đều là "phân số 2 tầng"), việc ép cả 2 vào cùng 1 con số cỡ cố định
  (3.1em) vẫn khiến ảnh có độ phân giải gốc nhỏ hơn trông "đặc/nén" hơn
  nhiều so với ảnh còn lại dù đã phóng cùng 1 tỉ lệ em.
  Sửa triệt để bằng cách BỎ HẲN 4 nhóm cỡ cố định, thay bằng công thức TỰ
  HIỆU CHỈNH tính riêng cho từng ảnh ngay lúc import
  (`wmfConvertService.js`, hàm `trimWhitespace`):
  1. Vẫn đếm số "dải mực" (band) như Bước 24 để biết cấu trúc ảnh (1 dòng
     hay có tử/mẫu hay nhiều tầng).
  2. Lấy dải mực CAO NHẤT trong ảnh làm "1 đơn vị dòng chữ" chuẩn của CHÍNH
     ảnh đó (`referenceBandHeight`) - đây là điểm mấu chốt: thay vì so với 1
     ngưỡng pixel TUYỆT ĐỐI dùng chung cho mọi ảnh, giờ mỗi ảnh tự đối chiếu
     với chính nó.
  3. Tính tỉ lệ `heightRatio = tổng_chiều_cao_thật / referenceBandHeight`
     (tổng chiều cao thật = từ đỉnh dải đầu tiên đến đáy dải cuối cùng).
     Công thức 1 dòng (dù là số đơn hay biểu thức dài) luôn CHỈ có 1 dải =>
     tỉ lệ LUÔN BẰNG 1 bất kể ảnh gốc cao 20px hay 90px => hiển thị ĐỒNG BỘ
     TUYỆT ĐỐI = đúng 1.15em (bằng 1 dòng chữ thường). Phân số/công thức
     nhiều tầng có tỉ lệ > 1 tương ứng đúng số tầng thật, không phụ thuộc
     ảnh gốc to hay nhỏ.
  4. Ghi thẳng kết quả (`height:XXem; vertical-align:YYem`) vào thuộc tính
     `style` ngay trên từng thẻ `<img>` lúc import (`docxImportService.js`,
     hàm `getFormulaAttrs` thay cho `getFormulaClass` cũ) - mỗi ảnh tự mang
     theo kích thước riêng của nó, không còn phụ thuộc 1 class CSS dùng
     chung.
  Đồng thời dọn `index.css`: xoá hẳn 5 khối CSS gán `max-height`/`vertical-
  align` cố định theo class (`formula-symbol`, `formula-1line`,
  `formula-fraction`/`formula-2line`, `formula-multiline`, khối "dự phòng")
  vì các khối này dùng `!important` sẽ ĐÈ MẤT `style` riêng mà mỗi ảnh vừa
  tự tính - đây chính là bẫy tương tự Bước 25 (lớp sau ghi đè lớp trước) nếu
  không dọn sạch.
  Test bằng ảnh tổng hợp mô phỏng lại CHÍNH XÁC 2 tình huống người dùng báo:
  (1) 1 ảnh số đơn cao do đệm baseline (23x75px, 1 dải) và 1 ảnh công thức 1
  dòng dài nhưng độ phân giải THẤP hơn nhiều (130x20px, 1 dải) -> cả 2 đều
  cho ra ĐÚNG 1.15em như nhau dù kích thước gốc chênh lệch gần 4 lần - xác
  nhận sửa đúng lỗi câu 1/4/5 bị nhỏ bất thường; (2) 1 ảnh phân số ở độ phân
  giải chuẩn (32x71px, 3 dải) và 1 ảnh CÙNG CẤU TRÚC phân số nhưng thu nhỏ
  còn nửa kích thước (18x36px, vẫn 3 dải) -> cho ra 4.18em và 3.91em, cùng ở
  mức "phân số lớn" nhất quán, không còn chênh lệch rõ rệt như trước - xác
  nhận sửa đúng lỗi vế nghiệm thứ 2 sau "và" ở câu 2/3 bị nhỏ hơn vế đầu.
  Kiểm tra `data/questions.json`/`data/exams.json` hiện đang RỖNG (người
  dùng đã tự xoá đề test trước khi gửi phản hồi lần này) nên không có dữ
  liệu cũ cần vá - bản sửa áp dụng ngay từ lần import file Word tiếp theo.
  `npm run build` (frontend) chạy sạch, không lỗi.
- Vì sao làm như vậy: Sai lầm ở Bước 24 là chỉ sửa PHẦN PHÂN LOẠI (đúng loại
  công thức) mà vẫn giữ nguyên PHẦN QUY ĐỔI SANG CỠ HIỂN THỊ kiểu "4 hộp cỡ
  cố định" - trong khi vấn đề thật không nằm ở việc phân loại sai loại, mà ở
  chỗ các ảnh CÙNG LOẠI vẫn có thể có ĐỘ PHÂN GIẢI GỐC khác nhau (do người
  soạn file Word gõ công thức ở các thời điểm/cỡ chữ khác nhau - hoàn toàn
  bình thường với văn bản do người tự soạn qua nhiều lần chỉnh sửa, đã từng
  gặp vấn đề tương tự ở Bước 17). Cách tự hiệu chỉnh theo tỉ lệ ngay trong
  chính ảnh đó (không so với ngưỡng chung) là cách DUY NHẤT xử lý triệt để
  vấn đề "độ phân giải gốc không đồng nhất" này, thay vì tiếp tục dò thêm
  ngưỡng pixel mới (đã chứng minh qua 2 lần sửa liên tiếp là không bền
  vững).
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (bỏ
  `isSymbol`/`isSingleLine`/`isFraction`/`isMultiLine`, thay bằng
  `displayHeightEm`/`verticalAlignEm` tính theo tỉ lệ dải mực),
  `backend/src/services/docxImportService.js` (đổi `getFormulaClass` thành
  `getFormulaAttrs`, trả kèm `style` ghi thẳng vào thẻ `<img>` lúc dựng
  HTML), `frontend/src/index.css` (xoá 5 khối CSS cỡ cố định theo class,
  chỉ giữ lại khối cỡ cho `diagram-img` và khối chung `max-width`/`object-fit`).
- Việc cần làm tiếp theo: Đề nghị người dùng TẢI LẠI (re-import) file Word
  gốc để tạo đề mới, kiểm tra bằng mắt trên UI thật rồi phản hồi tiếp - nếu
  còn câu nào lệch cỡ, gửi kèm ảnh chụp cụ thể (đã có công cụ đo band/tỉ lệ
  sẵn để tra cứu ngay câu đó, không cần dò lại từ đầu).

### 2026-09-09 - Tìm ra nguyên nhân THẬT: script frontend ghi đè phân loại công thức của backend (Bước 25)
- Đã làm gì: Sau khi sửa xong Bước 24 (backend phân loại đúng theo dải mực),
  người dùng tải lại đề thi thật và báo "không có cải thiện gì cả" kèm ảnh
  chụp y hệt lỗi cũ (số đáp án đơn lẻ như "4", "-4", "-2", "2", "∅", "R"
  vẫn to bất thường; công thức lượng giác câu 1-3 lại NHỎ ĐẾN MỨC KHÓ ĐỌC).
  Điều tra kỹ bằng cách: gọi trực tiếp hàm phân loại mới đã sửa ở Bước 24
  trên chính ảnh PNG lấy ra từ `data/questions.json` của đề thi thật (không
  phải dữ liệu giả lập) - xác nhận backend tính ĐÚNG 100% (VD: ảnh số "4"
  55x76px được backend phân loại đúng `formula-symbol`, ảnh phân số thật
  được phân loại đúng `formula-fraction`, khớp cả bằng script so sánh tự
  động 123 ảnh trong đề, 0 sai lệch). Nhưng khi dùng Playwright đọc DOM thật
  của trang, CHÍNH ẢNH ĐÓ lại mang class `formula-fraction` thay vì
  `formula-symbol` mà backend đã lưu đúng - tức là dữ liệu gửi từ backend bị
  đổi lại ở phía trình duyệt.
  Tìm ra nguyên nhân: `frontend/src/App.jsx` có sẵn 1 hàm
  `normalizeMathImages()` (được thêm từ trước, không rõ ở bước nào do không
  còn trong lịch sử gần đây) chạy ở cấp App - dùng `MutationObserver` theo
  dõi TOÀN BỘ thay đổi DOM của trang, mỗi khi có ảnh nào xuất hiện, hàm này
  tự ý ĐỌC LẠI kích thước khung bao (`naturalWidth`/`naturalHeight`) rồi GHI
  ĐÈ thẳng `img.className` bằng chính CÁCH SUY ĐOÁN QUA KÍCH THƯỚC CŨ mà
  Bước 24 vừa thay thế ở backend (`h >= 48` => `formula-fraction`) - vô hiệu
  hoá hoàn toàn phân loại chính xác (theo dải mực) mà backend gửi xuống,
  trên MỌI trang có ảnh công thức. Đây chính là lý do sửa xong ở backend
  (Bước 24) nhưng người dùng không thấy khác gì cả.
  Xoá hẳn hàm `normalizeMathImages` và `useEffect`/`MutationObserver` gọi nó
  trong `App.jsx` - để trình duyệt tin tưởng hoàn toàn vào class do backend
  tính (chính xác hơn nhiều vì backend phân tích được cấu trúc pixel thật
  của ảnh, còn frontend chỉ có kích thước khung bao).
  Test lại bằng Playwright trên ĐÚNG đề thi thật của người dùng ("ÔN THI
  THPTQG Chuẩn", 25 câu, không đụng dữ liệu): trước khi xoá, đếm được 30+ ảnh
  công thức bị hiển thị sai cỡ (43.4px dù nội dung chỉ là số đơn); sau khi
  xoá, chỉ còn đúng 8 ảnh ở mức 43px - và khi phóng to kiểm tra bằng mắt qua
  ảnh chụp, xác nhận cả 8 ảnh đó đều là PHÂN SỐ THẬT (VD: x = π/12 + k·2π/3)
  - to đúng bản chất, không còn trường hợp số đơn bị phóng to nhầm. Câu 1-3
  (công thức lượng giác 1 dòng) cũng đọc được rõ ràng, không còn bị thu nhỏ
  bất thường.
  Ghi nhận 1 vấn đề phụ còn sót (không phải lỗi mới, mức độ nhẹ hơn nhiều):
  ở các câu có 2 công thức nghiệm nối bằng "và" trong cùng 1 đáp án, công
  thức THỨ HAI đôi khi vẫn hiển thị nhỏ hơn công thức đầu dù cùng là phân số
  - nguyên nhân nhiều khả năng do ảnh gốc trong file Word được nhúng ở độ
  phân giải nhỏ hơn (giáo viên gõ/dán công thức thứ 2 ở cỡ chữ khác trong
  Word), khiến dải mực tử/mẫu bị dính liền thành 1 dải khi ảnh quá nhỏ - cần
  thêm dữ liệu thực tế để tinh chỉnh ngưỡng nếu người dùng thấy cần thiết.
- Vì sao làm như vậy: Có 2 lớp code cùng cố gắng làm 1 việc (phân loại ảnh
  công thức) mà không biết về nhau - backend phân tích chính xác dựa vào nội
  dung pixel thật, còn đoạn code frontend cũ (không rõ nguồn gốc/mục đích
  ban đầu, có thể là bản vá tạm thời từ trước khi có phân loại backend tử
  tế) lại ghi đè bằng cách đoán thô hơn nhiều. Khi 2 lớp xung đột, lớp chạy
  SAU CÙNG (frontend, vì chạy mỗi khi DOM thay đổi) luôn thắng, khiến mọi nỗ
  lực sửa ở lớp trước (backend) trở nên vô nghĩa với người dùng cuối. Xoá
  hẳn lớp trùng lặp, chỉ giữ 1 nguồn sự thật duy nhất (backend) là cách sửa
  đúng gốc rễ, tránh lặp lại tình huống "sửa xong nhưng không thấy gì khác"
  này trong tương lai nếu backend còn được tinh chỉnh thêm.
- File nào bị ảnh hưởng: `frontend/src/App.jsx` (xoá hàm `normalizeMathImages`,
  `useEffect` + `MutationObserver` gọi hàm này, xoá import `useEffect` không
  còn dùng đến).
- Việc cần làm tiếp theo: Không còn việc bắt buộc cho lỗi chính đã báo. Nếu
  người dùng vẫn thấy công thức thứ 2 trong đáp án dạng "... và ..." nhỏ hơn
  công thức thứ nhất, có thể gửi thêm ảnh chụp cụ thể để tinh chỉnh ngưỡng
  đếm dải mực cho ảnh có độ phân giải thấp.

### 2026-09-09 - Phân loại ảnh công thức theo cấu trúc thật, không đoán qua kích thước (Bước 24)
- Đã làm gì: Người dùng gửi ảnh chụp cho thấy 1 số câu hỏi trắc nghiệm có
  đáp án là số đơn lẻ (VD: "4", "-4", "-2", "2", "3", "-1", "27") bị hiển thị
  với cỡ chữ TO BẤT THƯỜNG so với các đáp án khác cùng trang, phá vỡ tính
  đồng bộ hình thức của đề thi. Nguyên nhân gốc: hàm phân loại ảnh công thức
  (`trimWhitespace` trong `wmfConvertService.js`, thêm từ Bước 12/17) trước
  đó CHỈ dựa vào kích thước khung bao (bounding box) sau khi cắt viền trắng
  để đoán loại công thức (`isSymbol`/`isFraction`/`isMultiLine`...) - nhưng
  Windows Equation Editor/MathType khi render 1 SỐ ĐƠN LẺ vẫn xuất ra khung
  bao khá cao (do phần đệm baseline của font, không phải do nội dung có
  nhiều tầng), nên bị đoán nhầm là phân số 2 tầng (`isFraction`, gán CSS
  `max-height: 3.1em` - gấp 3 lần chữ thường).
  Sửa bằng cách thêm bước phân tích cấu trúc ảnh THẬT thay vì suy đoán qua
  kích thước: hàm mới `countInkBands()` quét từng hàng pixel của ảnh (dùng
  `sharp` đọc ảnh ở chế độ grayscale + raw pixel), xác định hàng nào có điểm
  ảnh đủ tối ("có mực"), rồi gộp các hàng có mực LIÊN TIẾP thành 1 "dải".
  Số dải mực đếm được phản ánh đúng bản chất công thức bất kể khung bao cao
  hay thấp:
  - 1 dải mực = số/ký hiệu đơn (nếu hẹp) hoặc công thức 1 dòng liền mạch
    (nếu rộng) - phân biệt 2 trường hợp này CHỈ bằng bề rộng ảnh, KHÔNG dùng
    chiều cao nữa (vì chiều cao của 1 dải mực có thể cao thấp khác nhau tuỳ
    font, không phản ánh độ phức tạp nội dung).
  - 2-3 dải mực = phân số/phân thức thật (có tử số + mẫu số, có thể kèm gạch
    ngang tách thành 1 dải mỏng ở giữa).
  - từ 4 dải mực trở lên = hệ phương trình, ma trận, công thức nhiều tầng.
  - Ảnh đồ thị/bảng biến thiên/hình học (`isDiagram`) vẫn giữ nguyên cách
    xét cũ theo kích thước tuyệt đối (khung lớn hơn 260x100px) vì hình vẽ có
    nội dung phủ kín cả vùng lớn, khác hẳn công thức (dù cao) chỉ có vài dải
    mực mảnh - không cần/không nên áp dụng phân tích dải mực cho trường hợp
    này.
  Test bằng ảnh tổng hợp (synthetic, dựng trực tiếp bằng `sharp` để mô
  phỏng chính xác trường hợp lỗi thật - không cần file Word/LibreOffice):
  1. Số đơn lẻ cao do đệm baseline (khung bao 23x75px, chỉ 1 dải mực liền
     mạch) -> trước đây bị đoán `isFraction` (do `h>=42`), sau khi sửa đúng
     `isSymbol` (đúng bản chất).
  2. Phân số thật (khung bao 32x71px, có 3 dải mực: tử số/gạch ngang/mẫu
     số) -> `isFraction` đúng, không đổi.
  3. Công thức 1 dòng dài (khung bao 130x20px, 1 dải mực rộng) -> `isSingleLine`
     đúng, không đổi.
  4. Hệ phương trình 4 tầng (khung bao 74x85px, 4 dải mực) -> `isMultiLine`
     đúng, không đổi.
  Kiểm tra `data/questions.json` hiện tại đang RỖNG (không có câu hỏi thật
  nào tồn tại ở thời điểm sửa) nên không cần chạy script vá dữ liệu cũ - bản
  sửa này áp dụng ngay từ lần tải file Word tiếp theo.
- Vì sao làm như vậy: Kích thước khung bao (bounding box) của ảnh do
  LibreOffice xuất ra chịu ảnh hưởng bởi cách font Equation Editor tính
  baseline/ascent/descent, KHÔNG phản ánh trung thực độ phức tạp nội dung -
  cùng độ phức tạp "1 số đơn" có thể ra khung bao rất khác nhau tuỳ font
  gốc. Đếm dải mực theo pixel là cách đo TRỰC TIẾP cấu trúc thị giác thật
  của công thức (1 dòng liền mạch vs. có khoảng trắng tách tử/mẫu vs. nhiều
  tầng xếp chồng) - không phụ thuộc đặc thù font, đáng tin cậy hơn hẳn so
  với suy đoán gián tiếp qua kích thước.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (thêm
  `countInkBands`, viết lại toàn bộ logic phân loại trong `trimWhitespace`
  dựa theo `bandCount` thay vì chỉ `width`/`height`, export thêm
  `trimWhitespace` để tiện viết test trực tiếp).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Gợi ý người dùng tải lại
  (re-import) file Word có công thức để kiểm tra bằng mắt trên dữ liệu thật;
  nếu vẫn thấy đáp án nào hiển thị chưa cân đối, có thể gửi lại ảnh chụp cụ
  thể để tinh chỉnh thêm ngưỡng phân loại.

### 2026-09-08 - Checkbox chọn kèm bài tập AI khi duyệt lộ trình (Bước 23)
- Đã làm gì: Người dùng yêu cầu khi duyệt lộ trình AI, thêm 1 checkbox để tự
  quyết định có muốn gửi kèm bài tập trắc nghiệm do AI sinh hay không - tick
  thì gửi cả text lẫn bài tập (tạo đề mới giao ngay), bỏ tick thì chỉ gửi lộ
  trình văn bản, không tạo đề nào cả.
  - Backend: `approveGeneratedExercise` (`generatedExerciseController.js`)
    đọc thêm `req.body.includeExercises` (mặc định `true` nếu không truyền,
    để không phá vỡ hành vi cũ). Nếu `false`, bỏ qua hoàn toàn bước tạo
    `exam`/`questions`, chỉ cập nhật bản ghi đề xuất sang `status: 'approved'`
    với `examId: null`. `getExamSubmissions` (`examController.js`) trả kèm
    `hasExam: Boolean(proposal.examId)` để giao diện phân biệt hiển thị
    "đã duyệt & giao bài tập" hay "đã duyệt (chỉ gửi văn bản)" sau khi duyệt.
  - Frontend: thêm checkbox + nút duyệt đổi nhãn động theo trạng thái tick ở
    CẢ 2 nơi có luồng duyệt đề xuất - `ExamEditorPage.jsx` (tab "Kết quả &
    Điểm yếu", luồng chính theo kiến trúc mới từ Bước 15) và
    `GeneratedExercisesListPage.jsx` (trang duyệt tổng hợp cũ, vẫn còn dùng
    song song). Mặc định checkbox ở trạng thái tick (giữ hành vi quen thuộc
    cũ là mặc định).
  Test qua API thật: tạo học sinh/đề/câu hỏi/bài nộp sai tạm, sinh roadmap
  Gemini thật, gọi duyệt với `{"includeExercises": false}` - xác nhận
  response trả `createdExam: null`, `generatedExercise.examId: null`, tổng số
  đề không tăng, học sinh vẫn lấy được nội dung lộ trình qua
  `GET /api/student/me/roadmaps` (815 ký tự) dù không có đề/bài tập nào được
  tạo. Test UI qua Playwright: vào tab "Kết quả & Điểm yếu" của đề test thứ 2,
  chụp ảnh trạng thái tick (nút "Duyệt & giao bài tập") và bỏ tick (nút đổi
  đúng thành "Duyệt (chỉ gửi lộ trình văn bản)"), xác nhận không lỗi console,
  xem lại ảnh chụp thấy giao diện rõ ràng, dễ hiểu. Đã xoá sạch 2 đề test và
  1 học sinh test tạo trong quá trình kiểm thử, xác nhận dữ liệu thật của
  người dùng (1 học sinh Nguyễn Phước Quyền lớp 12A2, 2 đề "Ôn tập số 1" và
  đề bài tập tiếp theo sinh từ đó) không bị ảnh hưởng.
- Vì sao làm như vậy: Không phải lúc nào giáo viên cũng muốn giao thêm bài
  tập ngay lập tức - có lúc chỉ muốn học sinh đọc lại lý thuyết/lộ trình
  trước, tự luyện tập thêm rồi mới làm bài tập mới sau; ép luôn tạo đề bài
  tập mỗi lần duyệt là cứng nhắc, không linh hoạt theo tình huống thực tế của
  lớp học. Mặc định vẫn tick sẵn để không đổi hành vi quen thuộc của các lần
  duyệt trước đó.
- File nào bị ảnh hưởng:
  `backend/src/controllers/generatedExerciseController.js` (đọc
  `includeExercises`, bỏ qua tạo đề nếu `false`),
  `backend/src/controllers/examController.js` (`getExamSubmissions` trả thêm
  `hasExam`), `frontend/src/pages/ExamEditorPage.jsx` (checkbox + nút duyệt
  đổi nhãn động, hiển thị trạng thái đã duyệt kèm/không kèm bài tập),
  `frontend/src/pages/GeneratedExercisesListPage.jsx` (checkbox + nút duyệt
  đổi nhãn động, đồng bộ với `ExamEditorPage.jsx`).
- Việc cần làm tiếp theo: Không còn việc bắt buộc.

### 2026-09-08 - Sửa dữ liệu "ma": xoá đề phải tính lại thống kê điểm yếu (Bước 22)
- Đã làm gì: Người dùng phát hiện xoá đề bên giáo viên xong, bên học sinh
  trang "Chuẩn đoán điểm yếu của bạn" (`StudentWeakTopicsPage.jsx`) vẫn
  hiện đúng những chủ đề yếu lấy từ đề đã xoá. Nguyên nhân: `deleteExam`
  (`examController.js`) chỉ xoá `questions`, `submissions`,
  `submission_answers` và `generated_exercises` liên quan, nhưng KHÔNG đụng
  tới `student_topic_stats` - bảng thống kê TỔNG HỢP (gộp nhiều đề, dùng
  cho trang chẩn đoán điểm yếu + biểu đồ tổng quan lớp của giáo viên) được
  cộng dồn lúc học sinh nộp bài (Bước 6) nhưng chưa từng có logic trừ lại
  khi dữ liệu nguồn (bài nộp) bị xoá.
  Sửa bằng cách thêm `recomputeStudentTopicStats(studentIds)` vào
  `weaknessAnalysisService.js`: thay vì cố trừ dần con số cũ (dễ lệch/âm
  nếu tính sai), hàm này XOÁ SẠCH thống kê hiện tại của các học sinh được
  truyền vào rồi TÍNH LẠI TỪ ĐẦU bằng cách quét toàn bộ `submissions` +
  `submission_answers` CÒN TỒN TẠI của học sinh đó - đảm bảo chính xác
  tuyệt đối, không phụ thuộc lịch sử thao tác trước đó. Gọi hàm này trong
  `deleteExam` ngay sau bước xoá `submissions`/`submission_answers`, với
  danh sách học sinh lấy từ chính các bài nộp vừa bị xoá.
  Vì bug đã tồn tại từ trước, dữ liệu thật của người dùng đang có sẵn số
  liệu "ma" - đã chạy một lần `recomputeStudentTopicStats` trực tiếp cho 2
  tài khoản học sinh thật hiện có để dọn sạch ngay (xác nhận: trước khi
  chạy có 4 dòng thống kê từ đề đã xoá từ lâu, sau khi chạy về đúng mảng
  rỗng - khớp với việc học sinh đó hiện không còn bài nộp nào tồn tại).
  Test lại bằng kịch bản đầy đủ qua API: tạo học sinh + đề + câu hỏi tạm,
  nộp bài sai -> xác nhận `student_topic_stats` có đúng tag vừa nộp -> xoá
  đề -> gọi lại API thống kê -> xác nhận trả về RỖNG ngay lập tức. Đã xoá
  học sinh test sau khi xác nhận.
- Vì sao làm như vậy: `student_topic_stats` là bảng tổng hợp phái sinh từ
  dữ liệu gốc (`submissions`/`submission_answers`), không phải nguồn sự
  thật - khi dữ liệu gốc bị xoá, bảng phái sinh phải được đồng bộ lại,
  tương tự nguyên tắc đã áp dụng cho `generated_exercises` ở Bước 15
  (nhưng lúc đó chỉ xử lý bảng đề xuất AI, bỏ sót bảng thống kê tổng hợp
  này). Chọn cách "xoá sạch rồi tính lại" thay vì "trừ dần" vì đơn giản hơn
  và không có rủi ro lệch số do làm tròn/trừ nhầm qua nhiều lần thao tác.
- File nào bị ảnh hưởng: `backend/src/services/weaknessAnalysisService.js`
  (thêm `recomputeStudentTopicStats`), `backend/src/controllers/examController.js`
  (gọi hàm này trong `deleteExam`), `data/student_topic_stats.json` (dọn
  sạch dữ liệu ma của 2 tài khoản học sinh thật, một lần duy nhất).
- Việc cần làm tiếp theo: Không còn việc bắt buộc.

### 2026-09-08 - Giáo viên xem được bài làm chi tiết của học sinh (Bước 21)

### 2026-09-08 - Giáo viên xem được bài làm chi tiết của học sinh (Bước 21)
- Đã làm gì: Người dùng chỉ ra lỗ hổng nghiệp vụ hợp lý: sau khi học sinh
  nộp bài, giáo viên chỉ nhận được điểm số + danh sách chủ đề yếu (dữ liệu
  đã qua xử lý để đưa vào AI), mà KHÔNG xem được bài làm gốc của học sinh
  (câu nào chọn gì, đúng/sai ra sao) - giáo viên cần thấy để tự đánh giá,
  không chỉ tin vào kết luận của AI. Thêm:
  - Backend: `getSubmissionDetailForTeacher` trong `examController.js`
    (route mới `GET /api/exams/:examId/submissions/:submissionId`) - giống
    hàm học sinh tự xem bài của mình (`studentExamController.getSubmissionDetail`)
    nhưng kiểm tra quyền theo CHỦ ĐỀ THI (`exam.createdBy === req.user.id`)
    thay vì theo học sinh, và trả kèm cả `options` của từng câu để giáo
    viên xem đầy đủ ngữ cảnh (không chỉ mỗi key đáp án).
  - Frontend: `ExamEditorPage.jsx` tab "Kết quả & Điểm yếu" thêm nút "📄 Xem
    bài làm chi tiết" trên mỗi học sinh - bấm vào tải (và cache lại theo
    `submissionId`, tránh gọi lại API khi đóng/mở nhiều lần) rồi hiện danh
    sách từng câu: nội dung câu hỏi, đáp án học sinh chọn, đáp án đúng, nền
    xanh/đỏ theo đúng/sai (tái sử dụng đúng phong cách màu đã dùng ở trang
    học sinh tự xem kết quả).
  Test qua UI thật: tạo đề 2 câu, học sinh làm đúng 1 sai 1, giáo viên bấm
  "Xem bài làm chi tiết" thấy đúng nội dung từng câu, đúng đáp án đã chọn,
  đúng màu xanh/đỏ tương ứng, không lỗi console. Đã xoá đề/học sinh test.
- Vì sao làm như vậy: Roadmap/điểm yếu là dữ liệu ĐÃ QUA XỬ LÝ (tổng hợp
  theo tag), giáo viên cần xem được dữ liệu GỐC (bài làm thật) để có thể tự
  đối chiếu, phát hiện trường hợp bất thường (VD: học sinh click nhầm chứ
  không thật sự không hiểu bài) trước khi quyết định duyệt đề xuất AI - tin
  tưởng hoàn toàn vào 1 lớp tóm tắt trung gian mà không xem được nguồn là
  rủi ro nghiệp vụ thật sự.
- File nào bị ảnh hưởng: `backend/src/controllers/examController.js` (thêm
  `getSubmissionDetailForTeacher`), `backend/src/routes/examRoutes.js`
  (thêm route), `frontend/src/pages/ExamEditorPage.jsx` (nút + khối hiển
  thị chi tiết bài làm, có cache theo submissionId).
- Việc cần làm tiếp theo: Không còn việc bắt buộc.

### 2026-09-08 - Tự động nhận diện bảng đáp án khi import Word (Bước 20)
- Đã làm gì: Người dùng muốn upload file Word kèm sẵn đáp án để đỡ phải
  chọn tay từng câu ở bước kiểm tra. Thiết kế quy ước: giáo viên thêm 1
  đoạn có tiêu đề chứa chữ "ĐÁP ÁN" ở CUỐI file, liệt kê theo mẫu
  `1-A 2-C 3-B ...` (dấu nối chấp nhận `-`, `.`, `:`, `)`), thứ tự khớp với
  thứ tự câu hỏi xuất hiện trong file (không cần khớp số ghi trong "Câu N"
  vì nhiều đề tự đánh số lại từ 1 theo từng chủ đề).
  Cập nhật `docxImportService.js`:
  - Thêm `splitAnswerKeySection()`: tìm đoạn văn đầu tiên khớp
    `/^ĐÁP ÁN/i`, tách phần TỪ ĐÓ TRỞ VỀ SAU ra khỏi luồng câu hỏi trước
    khi gom nhóm - quan trọng để tránh đoạn đáp án bị dính nhầm vào câu
    hỏi cuối cùng (lỗi tương tự Bước 17 nếu không tách trước).
  - Thêm `parseAnswerKey()`: dùng regex `\d{1,3}\s*[-.:)]\s*[ABCD]` quét
    toàn bộ đoạn đáp án, lấy các chữ cái theo ĐÚNG THỨ TỰ XUẤT HIỆN (không
    dựa vào số ghi kèm, vì số đó có thể không khớp cách hệ thống đánh số
    tuần tự nội bộ).
  - Mỗi câu hỏi tách được giờ có thêm trường `suggestedAnswer`: chỉ điền
    khi số lượng đáp án tìm thấy KHỚP CHÍNH XÁC số câu hỏi tách được (an
    toàn - nếu lệch số lượng thì không đoán mò, chỉ cảnh báo giáo viên tự
    chọn tay để tránh gán sai hàng loạt).
  Frontend (`ExamEditorPage.jsx`): `correctAnswer` của mỗi câu nháp giờ
  khởi tạo từ `suggestedAnswer` thay vì luôn rỗng; thêm dòng chữ xanh "✓ Đã
  tự nhận từ bảng đáp án trong file - vui lòng kiểm tra lại" ngay trên mỗi
  câu được tự động điền, và dòng tóm tắt đầu trang cho biết "X/Y câu đã tự
  động nhận đáp án". Giáo viên vẫn có thể bấm chọn lại đáp án khác bất cứ
  lúc nào (không khoá).
  Test bằng HTML giả lập (không cần LibreOffice, nhanh hơn để kiểm tra
  logic thuần): trường hợp khớp số lượng -> điền đúng theo thứ tự (C, A, D
  cho 3 câu) không cảnh báo; trường hợp thiếu 1 đáp án (2 đáp án cho 3 câu)
  -> đúng như thiết kế, KHÔNG điền gì cả và cảnh báo rõ ràng ở cả 3 câu;
  trường hợp không có "ĐÁP ÁN" -> hoạt động y hệt trước đây, không ảnh
  hưởng nội dung câu cuối. Test hồi quy với file Word thật (không có bảng
  đáp án) qua `docxImportService` trực tiếp: vẫn đúng 27/27 câu, 0 cảnh
  báo - xác nhận không có tác dụng phụ với các file không dùng tính năng
  mới này.
- Vì sao làm như vậy: Nhiều đề thi THPT thật đã có sẵn bảng đáp án riêng ở
  cuối (mẫu chuẩn phổ biến), tận dụng được sẽ tiết kiệm rất nhiều thao tác
  cho giáo viên so với việc phải dò từng câu. Chỉ tự động điền khi số lượng
  khớp tuyệt đối để tránh rủi ro gán nhầm hàng loạt đáp án sai (im lặng
  chọn sai còn nguy hiểm hơn không chọn, vì giáo viên có thể chủ quan không
  kiểm tra lại) - đây là lý do không cố "đoán" khi số lượng lệch, mà báo rõ
  để giáo viên tự xử lý.
- File nào bị ảnh hưởng: `backend/src/services/docxImportService.js`
  (thêm `splitAnswerKeySection`, `parseAnswerKey`, trường `suggestedAnswer`,
  export thêm `parseQuestionsFromHtml` để tiện viết test),
  `frontend/src/pages/ExamEditorPage.jsx` (dùng `suggestedAnswer`, hiển thị
  chỉ báo tự động điền).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Người dùng cần soạn lại
  file Word theo đúng quy ước "ĐÁP ÁN" ở cuối để tận dụng tính năng này ở
  lần import tiếp theo.

### 2026-09-08 - Roadmap AI chi tiết hơn + hiện nội dung trước khi duyệt (Bước 19)
- Đã làm gì: Người dùng phản hồi roadmap AI sinh ra "không thấy text gì
  hết" và muốn nội dung cụ thể/đầy đủ hơn để học sinh tự đọc hiểu được.
  Phát hiện 2 nguyên nhân:
  1. Prompt gửi cho Gemini (`geminiService.js`) trước đó chỉ yêu cầu tóm
     tắt "1-2 câu" và mỗi bước ôn tập cũng chỉ "1-2 câu hành động" - quá
     ngắn để học sinh tự học không có giáo viên giải thích thêm. Đã viết
     lại toàn bộ prompt: đổi giọng văn thành giáo viên nói chuyện trực tiếp
     với học sinh (dùng tên riêng, động viên), yêu cầu "summary" dài 5-7
     câu (giải thích tình trạng, tầm quan trọng trong đề thi THPT, tổng
     quan lộ trình), và tách mỗi bước ôn tập thành 3 trường riêng thay vì
     gộp chung 1 câu: `theory` (nhắc lại lý thuyết trọng tâm, 4-6 câu, có
     công thức/định lý cụ thể), `commonMistake` (lỗi sai phổ biến học sinh
     hay mắc và vì sao, 3-4 câu), `action` (hướng dẫn từng bước cụ thể nên
     ôn gì trước/sau, có mẹo giải, 3-5 câu).
  2. Quan trọng hơn: tab "Kết quả & Điểm yếu" (nơi giáo viên duyệt theo
     luồng mới từ Bước 15) trước đó CHỈ hiện trạng thái "Chờ duyệt" kèm nút
     Duyệt/Từ chối, hoàn toàn KHÔNG hiển thị nội dung roadmap đã sinh ra -
     giáo viên bấm duyệt mà không thấy AI viết gì cả. Nguyên nhân gốc: API
     `GET /api/exams/:examId/submissions` (`examController.js`) trước đó
     chỉ trả `{id, status}` cho mỗi đề xuất, không kèm `roadmap`/`exercises`.
     Sửa: trả kèm đầy đủ `roadmap` và `exercisesCount`; frontend
     (`ExamEditorPage.jsx`) thêm hẳn khối hiển thị tóm tắt + từng bước (lý
     thuyết/lỗi hay gặp/nên làm) ngay tại đây khi trạng thái là
     `pending_review` hoặc `approved`.
  Đồng thời cập nhật cách hiển thị 3 trường mới ở mọi nơi khác có render
  roadmap: `StudentDashboard.jsx` (học sinh xem lộ trình đã duyệt, mỗi bước
  giờ là 1 khối riêng có icon 📘⚠️✅), `TeacherStudentDetailPage.jsx` (lịch
  sử lộ trình theo học sinh), `GeneratedExercisesListPage.jsx` (trang duyệt
  tổng hợp mọi đề xuất) - đều xử lý an toàn khi thiếu `theory`/`commonMistake`
  (dữ liệu cũ sinh trước Bước 19 vẫn hiển thị được, chỉ thiếu 2 mục đó).
  Test bằng cách gọi API thật nhiều lần (xác nhận cache hoạt động, nội dung
  giống hệt lần sau): tóm tắt dài 792 ký tự (trước đó chỉ 1-2 câu ngắn),
  riêng phần lý thuyết bước 1 dài 699 ký tự, nội dung cụ thể (nêu đúng công
  thức, phân biệt khái niệm dễ nhầm, hướng dẫn từng bước rõ ràng kèm gợi ý
  dùng máy tính cầm tay). Test qua UI thật: tab "Kết quả & Điểm yếu" giờ
  hiện đầy đủ tóm tắt + từng bước ngay trước khi bấm duyệt, không lỗi
  console. Đã xoá đề/học sinh tạo tạm, không đụng 2 tài khoản học sinh thật.
- Vì sao làm như vậy: Roadmap là sản phẩm CHO HỌC SINH tự đọc ở nhà, không
  có giáo viên bên cạnh giải thích thêm, nên nội dung phải đủ chi tiết để
  tự hiểu - văn phong "giáo viên nói chuyện trực tiếp" giúp học sinh cảm
  thấy gần gũi hơn là đọc 1 đoạn tóm tắt khô khan. Việc thiếu hiển thị nội
  dung ở bước duyệt là lỗi UX nghiêm trọng hơn cả độ dài văn bản - giáo
  viên không thể duyệt có trách nhiệm nếu không thấy AI viết gì.
- File nào bị ảnh hưởng: `backend/src/services/geminiService.js` (viết lại
  `buildPrompt`), `backend/src/controllers/examController.js`
  (`getExamSubmissions` trả kèm `roadmap`/`exercisesCount`),
  `frontend/src/pages/ExamEditorPage.jsx` (thêm khối hiển thị roadmap đầy
  đủ trước khi duyệt), `frontend/src/pages/StudentDashboard.jsx`,
  `TeacherStudentDetailPage.jsx`, `GeneratedExercisesListPage.jsx` (hiển
  thị 3 trường theory/commonMistake/action dạng khối riêng biệt).
- Việc cần làm tiếp theo: Không còn việc bắt buộc.

### 2026-09-08 - Gộp giao đề vào tab câu hỏi + xác nhận chuông thông báo/roadmap AI (Bước 18)
- Đã làm gì: Người dùng báo 3 vấn đề. Điều tra từng cái:
  1. **"Bên giáo viên chưa có icon thông báo"**: kiểm tra `Layout.jsx` xác
     nhận `NotificationBell` đã được gắn cho mọi trang qua `ProtectedRoute`,
     test bằng Playwright (trình duyệt sạch, không cache) thấy chuông hiện
     đúng ở góc phải. Kết luận: trình duyệt của người dùng đang cache bản
     JS cũ từ trước khi tính năng này được thêm - không phải lỗi code, chỉ
     cần hard refresh (Ctrl+Shift+R).
  2. **"Chưa sinh ra roadmap"**: kiểm tra trực tiếp Gemini API key trong
     `.env` bằng cách gọi thẳng API Google - key vẫn hợp lệ và hoạt động
     tốt. Kiểm tra dữ liệu (`data/exams.json`) thấy KHÔNG có đề thi nào tồn
     tại (người dùng đã tự xoá đề test trước đó) - nghĩa là chưa có bài nộp
     nào để phân tích điểm yếu, nút sinh roadmap chưa có dữ liệu để tác
     động. Không phải lỗi code, chỉ là chưa đủ dữ liệu (thiếu bước: tạo đề
     -> giao đề -> học sinh nộp bài -> mới có gì để sinh roadmap).
  3. **"Tạo bài tập xong phải qua tab riêng mới giao được, rườm rà"**: đây
     là vấn đề thật, đã sửa. Trong `ExamEditorPage.jsx`: xoá tab "Giao đề
     cho học sinh" riêng biệt, chuyển toàn bộ nội dung của nó (chọn học
     sinh, chọn nhanh theo lớp, nút phát hành) vào hiển thị NGAY bên dưới
     danh sách câu hỏi trong cùng tab "Danh sách câu hỏi" - không cần bấm
     chuyển tab nữa, soạn xong câu hỏi là thấy và chọn học sinh giao luôn
     trên cùng 1 màn hình. Nếu đề chưa có câu hỏi nào, hiện gợi ý thêm câu
     hỏi trước thay vì mục chọn học sinh (đề trống không giao được).
  Test lại toàn bộ 3 vấn đề bằng kịch bản thật qua UI (Playwright): tạo đề
  mới, thêm 1 câu hỏi thủ công, xác nhận mục "Chỉ định học sinh làm bài"
  hiện NGAY sau khi lưu câu hỏi (không cần đổi tab) ✓, chọn học sinh và bấm
  phát hành thành công ✓; dùng 1 học sinh tạo tạm (không đụng 2 tài khoản
  học sinh thật hiện có) nộp bài sai, vào tab "Kết quả & Điểm yếu" bấm
  "Sinh lộ trình AI cho đề này" -> gọi Gemini thật thành công, nhận về đề
  xuất ở trạng thái "Chờ duyệt" với nút Duyệt/Từ chối ✓; chuông thông báo
  hiện đúng badge "1" trong toàn bộ quá trình test ✓; không lỗi console. Đã
  xoá sạch đề và học sinh tạo tạm, xác nhận 2 tài khoản học sinh thật của
  người dùng (Nguyễn Phước Quyền, Nguyễn Kim Chi) không bị ảnh hưởng.
- Vì sao làm như vậy: 2/3 báo cáo hoá ra là do trạng thái môi trường (cache
  trình duyệt, thiếu dữ liệu) chứ không phải lỗi code - việc điều tra trực
  tiếp (gọi thẳng API Gemini, kiểm tra file dữ liệu, test bằng trình duyệt
  sạch) giúp xác định đúng nguyên nhân trước khi sửa nhầm chỗ. Vấn đề tạo
  đề rườm rà là góp ý UX hợp lý - gộp 2 bước liền kề nhau (soạn câu hỏi và
  giao đề) vào cùng 1 tab giảm số lần thao tác mà không mất chức năng nào.
- File nào bị ảnh hưởng: `frontend/src/pages/ExamEditorPage.jsx` (gộp tab
  giao đề vào tab danh sách câu hỏi, thêm gợi ý khi đề chưa có câu hỏi).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Nhắc người dùng: quy
  trình đầy đủ để thấy roadmap AI là Tạo đề -> Thêm câu hỏi -> Chọn học
  sinh & giao đề (giờ cùng 1 tab) -> học sinh làm bài -> vào tab "Kết quả &
  Điểm yếu" của đề đó để sinh roadmap.

### 2026-09-08 - Sửa lỗi tách câu dính chữ + giảm cỡ ảnh công thức (Bước 17)
- Đã làm gì: Người dùng phát hiện khi import file Word thật, có 1 câu bị
  tách sai: đáp án D của "Câu 8" bị dính thêm cả phần đầu câu hỏi kế tiếp
  (".Câu 4: Nghiệm của phương trình..."), và công thức vẫn còn to so với
  chữ thường. Debug bằng cách chạy lại `docxImportService.importExamFromDocx`
  trực tiếp trên file gốc, phát hiện 2 lỗi gốc rễ trong hàm
  `parseQuestionsFromHtml`:
  1. Regex nhận diện điểm bắt đầu 1 câu hỏi mới (`/^Câu\s*\d+/i`) không
     khớp với đoạn văn bắt đầu bằng dấu chấm thừa (`.Câu 4:` - lỗi gõ có
     thật trong file gốc) do neo `^` ngay đầu chuỗi đòi hỏi ký tự đầu tiên
     phải là "C". Hậu quả: đoạn ".Câu 4:..." bị coi là phần tiếp nối của
     câu trước đó thay vì bắt đầu câu mới, làm nội dung 2 câu bị nhập
     chung. Sửa: đổi thành `/^[.\s]*Câu\s*\d+/i` (cho phép dấu chấm/khoảng
     trắng thừa phía trước "Câu").
  2. Regex xoá tiền tố "Câu N." khỏi nội dung câu hỏi chỉ khớp khi "Câu N."
     được in đậm (`<strong>Câu N.</strong>`) - một số câu trong file gốc có
     "Câu N:" KHÔNG in đậm (định dạng không nhất quán giữa các phần trong
     file), khiến tiền tố này bị sót lại y nguyên trong nội dung hiển thị
     cho giáo viên. Sửa: viết `CAU_PREFIX_RE` tổng quát hơn, chấp nhận cả
     có/không có `<strong>`, có/không có dấu chấm thừa, có/không có thẻ
     `<p>` bao ngoài.
  Kèm theo giảm `max-height` của `.formula-img` từ 30px xuống 19px và giảm
  phần đệm trắng lúc cắt ảnh (`wmfConvertService.js`, hàm `trimWhitespace`)
  từ 4px xuống 1-2px mỗi cạnh, để công thức cân đối hơn với cỡ chữ văn bản
  xung quanh (chấp nhận rằng số đơn lẻ như "4", "-2" vẫn trông "đầy" hơn
  công thức dài do đặc thù render bằng ảnh, không thể khớp tuyệt đối với
  văn bản thường).
  Test lại bằng cách chạy trực tiếp `docxImportService` trên file Word thật
  (không qua UI, nhanh hơn để lặp lại nhiều lần khi sửa lỗi): số câu tách
  được tăng đúng từ 26 lên **27** (khớp tổng số câu thật trong file), xác
  nhận nội dung câu bị lỗi trước đó giờ tách sạch, không còn dính chữ thừa.
  Test lại qua UI thật (Playwright, dùng đề tạo tạm): import lại toàn bộ
  27 câu, ảnh công thức hiển thị nhỏ gọn hơn hẳn, không câu nào còn cảnh
  báo dính chữ, không lỗi console. Đã xoá đề test, xác nhận không đụng dữ
  liệu thật của người dùng (tài khoản học sinh vẫn nguyên vẹn).
- Vì sao làm như vậy: File Word thật do người dùng tự soạn/chỉnh sửa qua
  nhiều lần nên định dạng không hoàn toàn nhất quán (chỗ in đậm chỗ không,
  chỗ có dấu chấm thừa) - đây là thực tế phổ biến với văn bản do giáo viên
  tự gõ, không phải trường hợp hiếm. Regex nhận diện cần đủ khoan dung để
  xử lý các biến thể này, đồng thời vẫn giữ cảnh báo cho các trường hợp
  thực sự không tách được để giáo viên tự kiểm tra ở bước duyệt.
- File nào bị ảnh hưởng: `backend/src/services/docxImportService.js` (sửa
  2 regex, thêm hằng `CAU_PREFIX_RE`), `backend/src/services/wmfConvertService.js`
  (giảm đệm trắng lúc cắt ảnh), `frontend/src/index.css` (giảm
  `.formula-img` max-height 30px -> 19px).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Vẫn đang chờ người dùng
  cấp lại `GEMINI_API_KEY` thật để test sinh roadmap AI với nội dung thực
  tế (từ Bước 15).

### 2026-09-08 - 3 cải tiến UX: đáp án xuống dòng, gộp tab thêm câu hỏi, chuông thông báo (Bước 16)
- Đã làm gì: Người dùng phản hồi 3 vấn đề sau khi dùng thử với dữ liệu
  thật:
  1. **Đáp án dài bị bó hẹp trong lưới 4 cột** (grid `auto-fit minmax`)
     khiến chữ tràn/xuống dòng xấu. Đổi toàn bộ nơi hiển thị 4 đáp án A/B/C/D
     (danh sách câu hỏi, màn hình kiểm tra khi import Word, và trang duyệt
     đề xuất AI) từ `display: grid` (nhiều cột) sang `display: flex;
     flexDirection: column` (mỗi đáp án 1 dòng riêng, tự xuống dòng tự
     nhiên khi dài) trong `ExamEditorPage.jsx` và
     `GeneratedExercisesListPage.jsx` (trang làm bài `ExamPage.jsx` vốn đã
     đúng kiểu này từ trước).
  2. **Gộp "Thêm câu hỏi mới" và "Tải câu hỏi từ Word"** thành 1 tab duy
     nhất "Thêm câu hỏi" trong `ExamEditorPage.jsx`: thêm state `addMode`
     ('manual' | 'word'), hiển thị 2 nút chọn chế độ ở đầu tab, nội dung
     form thủ công hoặc form import hiện tương ứng bên dưới (gộp 2 khối
     JSX cũ vào chung 1 nhánh `activeTab === 'add'`, bỏ tab "import" riêng).
     Đồng thời thêm nút "Chọn nhanh theo lớp" trong tab "Giao đề cho học
     sinh" (tự động liệt kê các lớp có trong danh sách học sinh, bấm 1 lớp
     là chọn hết học sinh lớp đó) - việc phát hành đề vẫn chỉ cần 1 lần bấm
     "Phát hành đề cho N học sinh" như cũ (không có bước "lưu nháp" thủ công
     nào đang tồn tại phải bỏ - đã xác nhận chuyển trạng thái draft ->
     assigned diễn ra ngay lập tức khi bấm nút này).
  3. **Chuông thông báo góc màn hình** (`components/NotificationBell.jsx`,
     mới): icon 🔔 cố định góc phải trên cùng (hiện trên mọi trang qua
     `Layout.jsx`), badge đỏ đếm số thông báo chưa đọc. Bấm vào mở dropdown
     liệt kê: giáo viên thấy "học sinh X vừa nộp bài đề Y" (nguồn dữ liệu
     `GET /teacher/submissions` có sẵn từ trước), học sinh thấy "bạn được
     giao đề mới: Z" (từ so sánh `/student/exams` với `/student/submissions`).
     Thông báo CHƯA đọc có nền màu nâu nhạt (`#f2e2cf`), đã đọc chuyển nền
     trắng - trạng thái đọc lưu theo từng người dùng trong `localStorage`
     (không cần thêm bảng dữ liệu backend). Bấm vào 1 thông báo sẽ đánh dấu
     đã đọc VÀ điều hướng thẳng tới trang liên quan (giáo viên -> trang
     quản lý đề đó, học sinh -> trang làm đề đó). Đã bỏ hẳn cơ chế badge số
     lượng cũ gắn trực tiếp trên menu sidebar (`Sidebar.jsx`) vì trùng lặp
     chức năng với chuông mới, tránh gây rối cho người dùng.
  Test qua UI thật (Playwright, dùng học sinh/đề/câu hỏi tạo tạm): đáp án
  dài xuống dòng đúng từng dòng riêng ✓, tab "Thêm câu hỏi" gộp đúng với 2
  nút chuyển chế độ ✓, nút "Chọn nhanh theo lớp" xuất hiện đúng ✓, chuông
  thông báo hiện đúng badge "1" + nội dung + nền nâu khi chưa đọc, bấm vào
  điều hướng đúng tới trang đề thi và nền chuyển trắng ngay ✓, không lỗi
  console. Đã dọn sạch dữ liệu test, xác nhận không đụng tới dữ liệu thật
  của người dùng (tài khoản học sinh "Nguyễn Phước Quyền" và đề "ád" vẫn
  giữ nguyên).
- Vì sao làm như vậy: Grid nhiều cột phù hợp với đáp án ngắn nhưng phá vỡ
  bố cục với công thức Toán dài (đặc biệt sau khi thêm ảnh công thức từ
  Bước 12) - xếp dọc luôn nhất quán, dễ đọc hơn với mọi độ dài nội dung.
  Gộp tab giảm số lần click và tránh người dùng bối rối "phải vào tab nào
  trước". Chuông thông báo tập trung mọi thông báo về 1 chỗ duy nhất, có
  ngữ cảnh rõ ràng (thay vì chỉ có số đếm trên menu) và giúp thao tác
  nhanh hơn (bấm là tới thẳng nơi cần xử lý).
- File nào bị ảnh hưởng: `frontend/src/pages/ExamEditorPage.jsx` (options
  dạng flex-column, gộp tab thêm câu hỏi, thêm "Chọn nhanh theo lớp"),
  `frontend/src/pages/GeneratedExercisesListPage.jsx` (options flex-column),
  `frontend/src/components/NotificationBell.jsx` (mới),
  `frontend/src/components/Layout.jsx` (gắn `NotificationBell`),
  `frontend/src/components/Sidebar.jsx` (bỏ logic badge cũ, đơn giản hoá
  lại như trước Bước 13).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Vẫn đang chờ người dùng
  cấp lại `GEMINI_API_KEY` thật (từ Bước 15) để test sinh roadmap AI với
  nội dung thực tế.

### 2026-09-08 - Kiến trúc mới: mỗi đề có lộ trình AI riêng (Bước 15)
- Đã làm gì: Người dùng yêu cầu đổi luồng nghiệp vụ cốt lõi: thay vì AI
  phân tích điểm yếu GỘP từ mọi đề học sinh từng làm (thiết kế cũ từ Bước
  6-7), mỗi đề thi giờ có lộ trình AI riêng biệt, sinh ra ngay từ kết quả
  của chính đề đó - đúng luồng "Đề 1 → học sinh làm → chấm điểm → AI phân
  tích điểm yếu CỦA ĐỀ 1 → sinh bài tập tiếp theo", lặp lại độc lập cho Đề
  2, Đề 3... Đồng thời xoá 1 đề phải xoá sạch mọi thứ thuộc về đề đó (bài
  nộp, đáp án, lộ trình AI) - không giữ lại gì, khác với cách revert-về-
  pending_review vừa làm ở Bước 14 (nay không còn phù hợp với mô hình mới).
  Thay đổi:
  - `weaknessAnalysisService.js`: thêm `getWeakTagsForSubmission(submissionId)`
    - tính điểm yếu CHỈ dựa trên các câu trả lời của 1 bài nộp cụ thể (đọc
    trực tiếp `submission_answers`), KHÔNG dùng `MIN_QUESTIONS_THRESHOLD`
    như hàm `getWeakTags()` cũ (hàm cũ vẫn giữ nguyên, dùng cho thống kê
    tổng quan cả lớp) vì phạm vi đã hẹp sẵn trong 1 đề - sai 1 câu là đủ
    tín hiệu để đưa vào lộ trình ôn ngay sau bài thi đó.
  - `generatedExerciseController.js`: thay `generateForStudent` (dựa vào
    học sinh + thống kê gộp) bằng `generateForSubmission` (dựa vào 1
    `submissionId` cụ thể). Bản ghi `generated_exercises` giờ có thêm
    `sourceExamId` (đề đã phân tích ra lộ trình này) và `sourceSubmissionId`,
    cacheKey đổi sang dựa theo `submissionId`. `approveGeneratedExercise`
    lưu lại `examId` (đề bài tập tiếp theo được tạo ra) để liên kết 2
    chiều, tiêu đề đề mới có ghi rõ tên đề nguồn. `listGeneratedExercises`
    hỗ trợ lọc thêm theo `sourceExamId`, và trả kèm `sourceExamTitle` để
    hiển thị "đề xuất này sinh ra từ đề nào".
  - `examController.js`: thêm `getExamSubmissions` - API mới GET
    `/api/exams/:examId/submissions` trả danh sách học sinh đã nộp đề này
    kèm điểm, chủ đề yếu tính riêng cho đề này, và trạng thái đề xuất AI
    (nếu có). Sửa `deleteExam`: bỏ hẳn logic "revert về pending_review" của
    Bước 14, thay bằng XOÁ HẲN mọi `generated_exercises` có
    `sourceExamId` trỏ tới đề đang xoá (lộ trình sinh ra từ đề này), và xoá
    luôn bản ghi nếu đề đang xoá chính là đề "con" (`examId`) của 1 đề
    xuất khác - đúng yêu cầu "xoá đề thì mất tất cả đáp án + tài liệu + lộ
    trình AI cho đề đó".
  - Route: `POST /api/teacher/students/:studentId/generate-roadmap` (cũ) đổi
    thành `POST /api/teacher/submissions/:submissionId/generate-roadmap`;
    thêm `GET /api/exams/:examId/submissions`.
  - Frontend: `ExamEditorPage.jsx` thêm tab mới "Kết quả & Điểm yếu" - đây
    là nơi chính triển khai luồng mới: xem từng học sinh đã nộp đề này,
    điểm, chủ đề yếu riêng của đề, nút "Sinh lộ trình AI cho đề này", rồi
    duyệt/từ chối ngay tại đây. `TeacherStudentDetailPage.jsx` bỏ hẳn nút
    "Sinh roadmap" kiểu gộp cũ (route đã không còn tồn tại), đổi thành
    trang chỉ xem lịch sử mọi lộ trình AI đã sinh cho học sinh đó (qua các
    đề khác nhau, có ghi rõ "Sinh ra từ đề: ...") + biểu đồ tổng quan tham
    khảo, kèm banner hướng dẫn vào đúng đề cụ thể để sinh lộ trình mới.
  Test đầy đủ qua API (tạo học sinh/đề/câu hỏi/bài nộp sai, gọi
  `getExamSubmissions` xác nhận đúng tag yếu riêng cho đề, giả lập 1 bản
  ghi `generated_exercises` để test duyệt tạo đề liên kết `examId` đúng,
  xoá đề nguồn xác nhận `generated_exercises` bị xoá HẲN (còn 0 bản ghi)
  trong khi đề "con" (bài tập tiếp theo) vẫn còn nguyên vì là đề độc lập)
  và qua UI thật (Playwright): tab "Kết quả & Điểm yếu" hiển thị đúng điểm/
  tag yếu/nút sinh lộ trình, bấm nút gọi đúng API mới (lỗi 502 nhận được là
  do `GEMINI_API_KEY` trong `.env` đang là giá trị mẫu, không phải lỗi
  code - cần người dùng cấp lại key thật). Đã dọn sạch mọi dữ liệu test.
- Vì sao làm như vậy: Mô hình gộp điểm yếu cũ phù hợp cho "bức tranh tổng
  quan cả lớp/học sinh" nhưng không khớp với luồng nghiệp vụ người dùng
  muốn trình bày (mỗi đề là 1 chu trình độc lập: làm - chấm - phân tích -
  luyện lại), và gây ra đúng lỗi Bước 14 vừa sửa (dữ liệu chồng chéo giữa
  các đề). Tách theo `submissionId` làm mọi thứ rõ ràng, dễ giải trình từng
  bước với ban giám khảo, và xoá dữ liệu dứt khoát đúng như người dùng
  mong đợi (không còn trạng thái mồ côi/lửng lơ).
- File nào bị ảnh hưởng: `backend/src/services/weaknessAnalysisService.js`
  (thêm `getWeakTagsForSubmission`),
  `backend/src/controllers/generatedExerciseController.js` (đổi
  `generateForStudent` -> `generateForSubmission`, thêm `sourceExamId`/
  `sourceSubmissionId`/`sourceExamTitle`),
  `backend/src/controllers/examController.js` (thêm `getExamSubmissions`,
  sửa `deleteExam` xoá hẳn thay vì revert),
  `backend/src/routes/examRoutes.js`,
  `backend/src/routes/teacherRoutes.js` (đổi route generate),
  `frontend/src/pages/ExamEditorPage.jsx` (thêm tab "Kết quả & Điểm yếu"),
  `frontend/src/pages/TeacherStudentDetailPage.jsx` (bỏ nút generate cũ,
  đổi thành trang lịch sử).
- Việc cần làm tiếp theo: Người dùng cần cấp lại `GEMINI_API_KEY` thật vào
  `backend/.env` (giá trị hiện tại đang là placeholder mẫu) để test sinh
  roadmap thật với nội dung AI thực tế.

### 2026-09-08 - Sửa lỗi ảnh công thức quá to + đề xuất AI "mồ côi" khi xoá đề (Bước 14)
- Đã làm gì: Người dùng báo 2 lỗi thực tế sau khi dùng thử với dữ liệu thật:
  1. **Công thức Toán hiển thị quá to** (LibreOffice xuất PNG kèm cả trang
     giấy trắng quanh mỗi công thức, dù đã cắt viền ở Bước 12 thì tỷ lệ chữ
     công thức so với chữ thường trên trang vẫn không cân đối). Khắc phục
     bằng cách gắn `class="formula-img"` cho ảnh công thức ngay lúc import
     (`docxImportService.js`), phân biệt với ảnh đồ thị/bảng biến thiên
     (giữ nguyên `<img>` không class), rồi thêm CSS `.formula-img {
     max-height: 30px }` trong `index.css` để công thức thu nhỏ vừa 2 dòng
     chữ. Vì 24 câu hỏi thật của người dùng đã lỡ lưu TRƯỚC khi có class
     này, viết script vá trực tiếp `data/questions.json`: đọc kích thước
     PNG từ header mỗi ảnh, ảnh nào ≤500x200px (đặc trưng công thức đã cắt
     viền) thì gắn thêm `class="formula-img"`, ảnh to hơn (đồ thị) giữ
     nguyên - đã verify đúng 100% qua kiểm tra kích thước thực tế (ảnh đồ
     thị 402x447 không bị đụng, ảnh công thức 119x36 được gắn class đúng).
  2. **Đề xuất AI bị "mất" khi xoá đề thi**: thực chất dữ liệu đề xuất
     (`generated_exercises`) không hề bị xoá (đã kiểm tra file JSON xác
     nhận), nhưng do `approveGeneratedExercise` trước đây không lưu lại
     `examId` của đề đã tạo, nên khi giáo viên xoá đề đó, bản ghi đề xuất
     bị kẹt vĩnh viễn ở trạng thái `approved` mà không có đề thi thật đi
     kèm - không có cách nào giao lại cho học sinh (nhìn như bị mất). Sửa:
     `approveGeneratedExercise` giờ lưu thêm `examId` vào bản ghi đề xuất;
     `deleteExam` (`examController.js`) khi xoá 1 đề, kiểm tra có đề xuất
     AI nào trỏ tới `examId` đó không, nếu có thì tự đưa đề xuất về lại
     trạng thái `pending_review` (xoá `examId`/`reviewedBy`) thay vì để mồ
     côi - giáo viên vào lại mục "Duyệt đề xuất AI" là thấy và duyệt lại
     được ngay, toàn bộ nội dung (roadmap + câu hỏi) vẫn nguyên vẹn. Đã vá
     luôn bản ghi thật đang bị mắc kẹt của người dùng về `pending_review`.
  Test lại qua API + UI thật: duyệt đề xuất -> `examId` lưu đúng -> xoá đề
  -> đề xuất tự quay về `pending_review`, `examId`/`reviewedBy` về `null`,
  đủ 6 câu bài tập + 3 bước roadmap không mất gì -> hiện lại đúng trong
  trang "Duyệt đề xuất AI" của giao diện thật, không lỗi console.
- Vì sao làm như vậy: Ảnh quá to phá vỡ trải nghiệm đọc đề - sửa tại nguồn
  (gắn class lúc import) chính xác hơn là đoán kích thước qua CSS chung cho
  mọi ảnh. Lỗi đề xuất mồ côi là lỗi thiết kế thiếu liên kết 2 chiều giữa
  `generated_exercises` và `exams` - thêm `examId` là cách tối thiểu để
  đồng bộ trạng thái khi 1 trong 2 bên bị xoá, tránh mất dữ liệu logic dù
  dữ liệu vật lý vẫn còn.
- File nào bị ảnh hưởng: `backend/src/services/docxImportService.js` (gắn
  class ảnh công thức), `frontend/src/index.css` (thêm `.formula-img`),
  `backend/src/controllers/generatedExerciseController.js` (lưu `examId`
  lúc duyệt), `backend/src/controllers/examController.js` (reset đề xuất
  về `pending_review` khi xoá đề liên quan), `data/questions.json` (vá
  class cho ảnh công thức đã lưu trước đó), `data/generated_exercises.json`
  (vá bản ghi bị mồ côi của người dùng về `pending_review`).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Cả 2 lỗi đã xác nhận sửa
  đúng qua test thật.

### 2026-09-08 - Tài khoản admin đơn giản + badge thông báo (Bước 13)
- Đã làm gì: Theo yêu cầu người dùng, thay tài khoản demo
  `teacher1@example.com` bằng tài khoản đơn giản `admin`/`admin123` (không
  cần định dạng email) trong `data/users.json`; xoá các tài khoản học sinh
  demo (`student1/2/3@example.com` - vốn người dùng đã tự xoá trước đó khi
  thao tác thật trên hệ thống, xác nhận lại data sạch). Đổi input "Email"
  thành "Tên đăng nhập" kiểu `type="text"` (bỏ validate định dạng email của
  trình duyệt) ở 4 nơi: `LoginPage.jsx`, `RegisterPage.jsx`, và form tạo học
  sinh ở cả `TeacherDashboard.jsx` lẫn `SettingsPage.jsx` (hệ thống có 2 nơi
  trùng chức năng này do lần thiết kế lại giao diện trước). Backend không
  cần sửa vì trường `email` chỉ là chuỗi định danh, không có validate định
  dạng ở server.
  Thêm badge thông báo số lượng trên sidebar (`Sidebar.jsx`):
  - Giáo viên: số bài nộp MỚI của học sinh kể từ lần cuối xem trang "Tổng
    quan & Học sinh" - lấy qua API mới `GET /api/teacher/submissions`
    (thêm vào `statsController.js` + `teacherRoutes.js`, trả toàn bộ bài
    nộp kèm tên học sinh/tên đề, mới nhất trước), so với mốc thời gian lưu
    trong `localStorage` (`lastSeenSubmissions_<teacherId>`), tự reset về 0
    khi giáo viên bấm vào mục đó.
  - Học sinh: số đề đã được giao nhưng chưa nộp (so `student/exams` với
    `student/submissions`), không cần cơ chế "đã xem" vì số này tự giảm khi
    học sinh nộp bài.
  Test qua UI thật (Playwright) với 1 học sinh + 1 đề + 1 bài nộp tạo tạm:
  đăng nhập `admin`/`admin123` thành công ✓, badge giáo viên hiện đúng "1"
  ✓, bấm vào mục đó badge về 0 và giữ nguyên sau khi reload trang (đúng
  hành vi localStorage) ✓, học sinh đăng nhập không thấy badge vì đã nộp
  hết bài được giao ✓, không lỗi console. Đã xoá sạch học sinh/đề/bài nộp
  tạo tạm sau khi test.
- Vì sao làm như vậy: Tài khoản dạng email giả (`@example.com`) không phù
  hợp khi triển khai thực tế cho 1 lớp học cụ thể - tên đăng nhập đơn giản
  dễ nhớ hơn cho giáo viên không rành công nghệ. Badge thông báo giúp giáo
  viên biết ngay khi có học sinh vừa nộp bài mà không cần vào từng trang
  kiểm tra, và giúp học sinh biết còn bao nhiêu bài chưa làm - đúng theo
  yêu cầu người dùng.
- File nào bị ảnh hưởng: `data/users.json` (đổi tài khoản giáo viên),
  `backend/src/controllers/statsController.js` (thêm `listAllSubmissions`),
  `backend/src/routes/teacherRoutes.js` (thêm route `/submissions`),
  `frontend/src/components/Sidebar.jsx` (logic đếm + hiển thị badge),
  `frontend/src/index.css` (style `.notification-badge`),
  `frontend/src/pages/LoginPage.jsx`, `RegisterPage.jsx`,
  `TeacherDashboard.jsx`, `SettingsPage.jsx` (đổi input email -> text),
  `README.md` (cập nhật thông tin tài khoản mặc định + giải thích badge).
- Việc cần làm tiếp theo: Không còn việc bắt buộc cho Bước 13.

### 2026-09-08 - Hoàn tất Bước 12: LibreOffice cài xong, sửa lỗi ảnh công thức quá to
- Đã làm gì: Người dùng cài xong LibreOffice (26.8.0.3, đúng đường dẫn mặc
  định `C:\Program Files\LibreOffice\program\soffice.exe` mà
  `wmfConvertService.js` tự dò). Test lại `docxImportService` với file thật:
  số câu cảnh báo giảm từ 26/26 (toàn bộ thiếu công thức) xuống 2/26 (chỉ
  còn 2 câu lệch định dạng gốc, không liên quan công thức) - xác nhận
  LibreOffice chuyển WMF sang PNG thành công.
  Phát hiện lỗi UI khi test qua giao diện thật: LibreOffice xuất PNG kèm cả
  "trang giấy trắng" xung quanh công thức (coi file WMF như 1 trang tài
  liệu Draw) khiến ảnh to bất thường (992x1403px cho 1 công thức nhỏ), làm
  vỡ layout câu hỏi. Khắc phục bằng cách cài thêm `sharp` (xử lý ảnh), thêm
  hàm `trimWhitespace()` trong `wmfConvertService.js` tự động cắt viền
  trắng thừa quanh mỗi công thức ngay sau khi LibreOffice xuất ra (giữ lại
  đệm 4px mỗi cạnh cho thoáng), giảm kích thước ảnh mẫu xuống còn 128x54px
  - đúng bằng kích thước công thức thật. Thêm quy tắc CSS an toàn
  `img { max-width: 100%; height: auto }` trong `index.css` để mọi ảnh
  (công thức lẫn đồ thị) không bao giờ tràn khung dù dữ liệu ảnh bất
  thường. Test lại toàn bộ qua UI thật: 26 câu hỏi hiển thị công thức gọn,
  đúng vị trí trong dòng chữ, đồ thị/bảng biến thiên ở các câu sau vẫn hiển
  thị đúng kích thước gốc (không bị ảnh hưởng vì không đi qua pipeline WMF),
  không lỗi console. Đã xoá các đề thi tạm dùng để test.
- Vì sao làm như vậy: Chuyển đổi đúng nội dung công thức là chưa đủ - kích
  thước ảnh bất thường sẽ phá vỡ trải nghiệm đọc đề của học sinh dù nội
  dung đúng. Cắt viền trắng ngay tại nguồn (lúc chuyển đổi) triệt để hơn là
  chỉ giới hạn hiển thị bằng CSS, vì giữ được tỷ lệ chữ-công thức tự nhiên
  giống hệt file Word gốc.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (thêm
  `trimWhitespace`, dùng `sharp`), `backend/package.json` (thêm `sharp`),
  `frontend/src/index.css` (thêm quy tắc `img` an toàn).
- Việc cần làm tiếp theo: Tính năng "Tải đề từ Word" đã hoàn thiện đầy đủ,
  sẵn sàng dùng với đề thi thật. Không còn việc bắt buộc.

### 2026-09-08 - Tải đề thi từ file Word (.docx) (Bước 12) - đang hoàn thiện
- Đã làm gì: Người dùng đề nghị thay việc tạo câu hỏi thủ công bằng cách
  upload file Word đề thi có sẵn, kèm yêu cầu có bước kiểm tra lại sau khi
  tải lên. Phân tích file mẫu người dùng cung cấp phát hiện vấn đề quan
  trọng: 160 công thức Toán trong file được nhúng dạng ảnh **WMF** (định
  dạng cũ của Windows Equation Editor/MathType) mà **trình duyệt web không
  hiển thị được**. Đã hỏi ý kiến người dùng và chọn hướng dùng LibreOffice
  chạy ngầm (`soffice --headless --convert-to png`) để tự động chuyển mọi
  công thức WMF sang PNG.
  Xây dựng:
  - `backend/src/services/wmfConvertService.js`: tìm đường dẫn cài đặt
    LibreOffice trên máy (tự dò các đường dẫn mặc định Windows/macOS/Linux
    hoặc biến môi trường `LIBREOFFICE_PATH`), chuyển đổi hàng loạt ảnh WMF
    sang PNG theo từng đợt (batch 30 ảnh/lần gọi `soffice` để tránh vượt
    giới hạn độ dài dòng lệnh). Nếu không tìm thấy LibreOffice, trả về
    `null` cho từng ảnh thay vì lỗi crash toàn bộ.
  - `backend/src/services/docxImportService.js`: dùng `jszip` mở file
    .docx lấy trước toàn bộ ảnh WMF gốc (so khớp bằng mã băm MD5 nội dung
    ảnh, không dựa vào tên file, để ghép đúng ảnh dù thứ tự xử lý khác
    nhau), gọi `wmfConvertService` chuyển đổi 1 lần cho tất cả, rồi dùng
    `mammoth` dựng HTML từ .docx với ảnh WMF đã thay bằng PNG (ảnh khác như
    đồ thị/bảng biến thiên giữ nguyên vì đã là PNG/JPEG). Viết bộ tách câu
    hỏi bằng regex trên HTML: nhận diện tiêu đề "CHỦ ĐỀ" làm tag gợi ý,
    nhận diện "Câu N" làm điểm bắt đầu 1 câu hỏi, gộp các đoạn `<p>` tiếp
    theo cho đến câu kế tiếp, rồi tách đáp án bằng vị trí các nhãn in đậm
    "A./B./C./D." trong cụm HTML đó (xử lý được cả trường hợp đáp án nằm
    chung dòng với đề bài lẫn tách dòng riêng). Mỗi câu tách được kèm mảng
    `warnings` (VD: "không tách được đủ 4 đáp án", "có công thức chưa
    chuyển đổi được") để giáo viên biết chỗ nào cần chú ý ở bước kiểm tra.
  - `backend/src/controllers/importController.js`: `previewImport` (nhận
    file upload qua `multer`, gọi service phân tích, CHỈ trả về xem trước -
    chưa lưu gì vào đề) và `addQuestionsBulk` (lưu hàng loạt câu hỏi đã
    được giáo viên xác nhận, validate từng câu đủ 4 đáp án/đúng
    `correctAnswer`/có tag trước khi lưu). Route mới:
    `POST /api/exams/:examId/import-preview`,
    `POST /api/exams/:examId/questions/bulk` (trong `examRoutes.js`).
  - Frontend: thêm tab "Tải câu hỏi từ Word" trong `ExamEditorPage.jsx` -
    upload file, hiển thị từng câu hỏi nháp (nội dung + ảnh công thức render
    qua `dangerouslySetInnerHTML`), giáo viên BẮT BUỘC chọn lại đáp án đúng
    cho từng câu (file gốc không đánh dấu đáp án đúng), có thể sửa tag hoặc
    tick "bỏ qua câu này", cảnh báo hiển thị màu đỏ. Chặn lưu nếu còn câu
    thiếu đáp án đúng hoặc thiếu tag. Cập nhật `ExamPage.jsx`, `ResultPage.jsx`
    hiển thị nội dung câu hỏi/đáp án qua `dangerouslySetInnerHTML` thay vì
    text thường, để tương thích với nội dung có ảnh nhúng từ import.
  Phát hiện và sửa 1 lỗi khi test qua UI thật (Playwright, dùng 1 đề thi tạo
  tạm để không ảnh hưởng đề thật của giáo viên): lưu 26 câu hỏi có ảnh
  base64 bị lỗi 500 do `express.json()` mặc định giới hạn payload 100kb -
  đã tăng lên 25mb trong `app.js`. Test lại: tách đúng 26/27 câu (1 câu lệch
  do định dạng gốc bất thường), validate chặn lưu khi thiếu đáp án đúng
  hoạt động đúng, lưu thành công sau khi chọn đủ đáp án, không lỗi console.
  Đã xoá đề thi tạm dùng để test.
- Vì sao làm như vậy: Nhập câu hỏi thủ công từng câu quá chậm với đề thi
  thật có hàng chục câu; tự động tách cấu trúc (số câu, 4 đáp án, tag) từ
  file Word có sẵn tiết kiệm thời gian đáng kể dù công thức Toán vẫn cần
  giáo viên xác nhận/chèn lại - đây chính là lý do bắt buộc có bước kiểm tra
  trước khi lưu (đúng yêu cầu ban đầu của người dùng), vừa để sửa lỗi tách
  sai vừa để bù đắp việc thiếu ảnh công thức khi chưa cài LibreOffice.
- File nào bị ảnh hưởng: `backend/src/services/wmfConvertService.js` (mới),
  `backend/src/services/docxImportService.js` (mới),
  `backend/src/controllers/importController.js` (mới),
  `backend/src/routes/examRoutes.js` (thêm route import + bulk, thêm
  `multer`), `backend/src/app.js` (tăng giới hạn `express.json`),
  `backend/package.json` (thêm `mammoth`, `multer`, `jszip`),
  `frontend/src/pages/ExamEditorPage.jsx` (thêm tab import),
  `frontend/src/pages/ExamPage.jsx`, `ResultPage.jsx` (render HTML thay vì
  text thường).
- Việc cần làm tiếp theo: Chờ người dùng cài xong LibreOffice, sau đó test
  lại toàn bộ luồng với 1 đề thật để xác nhận công thức Toán (ảnh WMF) hiển
  thị đúng dạng PNG. Nếu LibreOffice không khả dụng vì lý do nào đó, phương
  án dự phòng là giáo viên tự chèn công thức bằng tay tại các câu có cảnh
  báo "chưa chuyển đổi được công thức" trong bước kiểm tra.

### 2026-09-08 - Tích hợp Google Gemini API (Bước 7) - đã test thành công với key thật
- Đã làm gì: Người dùng cung cấp `GEMINI_API_KEY` thật, điền vào
  `backend/.env`. Model mặc định ban đầu `gemini-2.0-flash` bị Google trả về
  404 "no longer available", đã đổi default trong
  `backend/src/services/geminiService.js` sang `gemini-3.6-flash` (vẫn cấu
  hình được qua biến môi trường `GEMINI_MODEL` nếu sau này đổi tiếp). Test
  thực tế với `POST /api/teacher/students/u-student-1/generate-roadmap`:
  Gemini trả về đúng cấu trúc JSON yêu cầu (summary, steps, exercises), nội
  dung 2 câu trắc nghiệm về "Cực trị hàm số" hợp lệ (đáp án đúng khớp
  key). Gọi lại cùng request 2 lần tiếp theo trả `fromCache:true` - xác
  nhận cơ chế cache theo `cacheKey` hoạt động đúng, không tốn thêm quota.
  Test tiếp `PUT .../approve`: tạo đúng 1 `exam` mới (status `assigned`) +
  2 `questions` copy từ exercises, gán cho đúng học sinh; gọi `approve` lần
  2 bị chặn 409 (không duyệt trùng); học sinh xem `/me/roadmaps` thấy đúng
  roadmap đã duyệt, và đề mới xuất hiện trong `/exams` được giao. Sau khi
  xác nhận toàn bộ luồng đúng, đã dọn sạch dữ liệu test khỏi
  `generated_exercises.json`, `exams.json`, `questions.json`,
  `student_topic_stats.json` (khôi phục về đúng bộ dữ liệu demo ban đầu).
- Vì sao làm như vậy: Đây là lần đầu gọi API thật nên cần xác minh model
  name còn hiệu lực (model cũ trong code đã bị Google khai tử) và luồng
  duyệt tạo đề thật hoạt động đúng trước khi coi Bước 7 là hoàn tất.
- File nào bị ảnh hưởng: `backend/.env` (đã điền `GEMINI_API_KEY` thật -
  KHÔNG commit file này lên git, đã có trong `.gitignore`),
  `backend/src/services/geminiService.js` (đổi model mặc định sang
  `gemini-3.6-flash`).
- Việc cần làm tiếp theo: Bước 8 - dựng frontend React (Vite) cho các luồng:
  đăng nhập, dashboard giáo viên (tạo đề/câu hỏi/giao đề, xem thống kê lớp,
  duyệt đề xuất AI), dashboard học sinh (làm bài, xem kết quả, xem roadmap),
  kèm biểu đồ trực quan hoá điểm yếu bằng Recharts.

### 2026-09-08 - Tích hợp Google Gemini API (Bước 7) - code logic, chờ API key thật
- Đã làm gì: Viết `backend/src/services/geminiService.js` - gọi Gemini API
  (model mặc định `gemini-2.0-flash`, cấu hình qua `GEMINI_MODEL` trong
  `.env`) bằng `fetch` sẵn có của Node, dùng `generationConfig.responseMimeType:
  "application/json"` để ép Gemini trả JSON đúng cấu trúc (summary, steps,
  exercises) thay vì phải tự parse markdown. Viết
  `backend/src/utils/slugify.js` để tạo `cacheKey` ổn định từ tên tag tiếng
  Việt có dấu. Viết `backend/src/controllers/generatedExerciseController.js`
  với luồng: `generateForStudent` (lấy `weakTags` từ
  `weaknessAnalysisService`, kiểm tra cache theo `cacheKey` trước khi gọi
  Gemini, lưu kết quả mới vào `generated_exercises` với status
  `pending_review`), `listGeneratedExercises`/`getGeneratedExerciseDetail`
  (giáo viên xem danh sách/chi tiết đề xuất), `approveGeneratedExercise`
  (tạo 1 `exam` thật + các `questions` từ exercises, giao ngay cho học sinh,
  đánh dấu `approved` - tái sử dụng đúng luồng giao đề đã có ở Bước 4),
  `rejectGeneratedExercise` (đánh dấu `rejected`), `getMyApprovedRoadmaps`
  (học sinh xem roadmap đã được duyệt của mình, ẩn nội dung câu hỏi vì đã
  có sẵn trong đề được giao). Đăng ký các route vào
  `teacherRoutes.js`/`studentRoutes.js`. Viết `docs/GEMINI_SETUP.md` hướng
  dẫn chi tiết cách lấy API key miễn phí tại Google AI Studio và cấu hình
  vào `backend/.env`.
  Đã test end-to-end mà KHÔNG cần key thật (chưa có key): xác nhận
  `generate-roadmap` trả 400 đúng khi học sinh chưa đủ ngưỡng dữ liệu; khi
  tạm thời (chỉ trong bộ nhớ/test, đã khôi phục sau đó) đẩy 1 tag của
  student1 vượt ngưỡng, gọi lại thì nhận được lỗi 502 kèm thông báo thật từ
  Google ("API key not valid") - xác nhận code gọi đúng endpoint Gemini
  thật và xử lý lỗi HTTP đúng cách, không có bản ghi `generated_exercises`
  rác nào được tạo khi gọi API thất bại (chỉ insert sau khi có kết quả hợp
  lệ). Phân quyền 403 cho học sinh gọi route giáo viên ✓.
- Vì sao làm như vậy: Chưa có `GEMINI_API_KEY` thật nên ưu tiên viết đúng
  logic nghiệp vụ (cache, validate ngưỡng, xử lý lỗi rõ ràng bằng tiếng Việt,
  không tạo rác khi lỗi) và xác nhận đường đi tới Gemini API đã đúng qua lỗi
  xác thực thật trả về, thay vì đợi có key mới code. Cơ chế duyệt
  (`pending_review` -> `approved`/`rejected`) đúng theo yêu cầu kiểm soát
  chất lượng: câu hỏi AI sinh chỉ đến tay học sinh sau khi giáo viên bấm
  duyệt.
- File nào bị ảnh hưởng: `backend/src/services/geminiService.js` (mới),
  `backend/src/utils/slugify.js` (mới),
  `backend/src/controllers/generatedExerciseController.js` (mới),
  `backend/src/routes/teacherRoutes.js` (thêm 5 route generate/list/detail/
  approve/reject), `backend/src/routes/studentRoutes.js` (thêm
  `/me/roadmaps`), `docs/GEMINI_SETUP.md` (mới).
- Việc cần làm tiếp theo: Người dùng lấy `GEMINI_API_KEY` theo hướng dẫn
  trong `docs/GEMINI_SETUP.md`, điền vào `backend/.env`, rồi test lại
  `generate-roadmap` để xác nhận Gemini trả về nội dung thật hợp lệ. Sau đó
  chuyển Bước 8 - dựng frontend cho toàn bộ các luồng đã có + biểu đồ.

### 2026-09-08 - Siết phân quyền: chỉ giáo viên tạo được tài khoản học sinh (Bước 11)
- Đã làm gì: Người dùng yêu cầu học sinh không được tự tạo tài khoản, phải
  do giáo viên cấp, và cần nơi để sửa/xoá dữ liệu học sinh. Thực hiện:
  - `backend/src/controllers/authController.js`: sửa `register` - API đăng
    ký công khai giờ CHỈ tạo được tài khoản `role: 'teacher'` (bỏ tham số
    `role`/`className` từ client, ép cứng `role = 'teacher'`; nếu client cố
    gửi `role` khác `teacher` thì trả 403 kèm thông báo rõ ràng).
  - Thêm `backend/src/controllers/studentAccountController.js`:
    `createStudent`, `updateStudent`, `deleteStudent` - đều chỉ gắn vào
    `teacherRoutes.js` (đã có `requireRole('teacher')` áp dụng cho cả
    router). `deleteStudent` cascade xoá toàn bộ dữ liệu liên quan đến học
    sinh đó (`submissions`, `submission_answers`, `student_topic_stats`,
    `generated_exercises`) và gỡ id học sinh khỏi mảng `assignedTo` của mọi
    đề, để không còn dữ liệu mồ côi tham chiếu tới tài khoản đã xoá.
  - Route mới: `POST/PUT/DELETE /api/teacher/students(/:id)`.
  - Frontend: `RegisterPage.jsx` bỏ hẳn dropdown chọn vai trò, chỉ còn form
    đăng ký giáo viên. `TeacherDashboard.jsx` thêm card "Thêm tài khoản học
    sinh" (form tạo mới) và bảng "Danh sách học sinh" giờ có thao tác
    Sửa (inline edit họ tên + lớp) và Xoá (có hộp thoại xác nhận
    `window.confirm` vì đây là hành động phá huỷ dữ liệu).
  Đã test qua API: đăng ký công khai với `role: student` bị chặn 403 ✓,
  đăng ký giáo viên vẫn hoạt động ✓, giáo viên tạo/sửa/xoá học sinh thành
  công ✓, học sinh gọi API tạo tài khoản khác bị chặn 403 (do route yêu cầu
  role giáo viên) ✓, tài khoản học sinh sau khi xoá không đăng nhập được
  nữa ✓. Đã test lại toàn bộ qua Playwright trên UI thật: trang đăng ký
  không còn dropdown vai trò ✓, thêm học sinh qua form hiện ngay trong bảng
  ✓, sửa tên cập nhật đúng ✓, xoá có hộp thoại xác nhận và biến mất khỏi
  danh sách ✓, không lỗi console.
- Vì sao làm như vậy: Trong mô hình lớp học thực tế, giáo viên cần kiểm
  soát chặt danh sách học sinh (đúng người, đúng lớp) thay vì để bất kỳ ai
  tự đăng ký nhận vai trò học sinh - tránh tài khoản ảo và đảm bảo thống kê
  điểm yếu/roadmap AI luôn gắn với học sinh thật của giáo viên đó. Cascade
  xoá dữ liệu liên quan khi xoá tài khoản để tránh để lại rác tham chiếu
  tới id không còn tồn tại (ảnh hưởng tới các hàm phân tích điểm yếu ở
  Bước 6 nếu không dọn sạch).
- File nào bị ảnh hưởng: `backend/src/controllers/authController.js` (sửa
  `register`), `backend/src/controllers/studentAccountController.js`
  (mới), `backend/src/routes/teacherRoutes.js` (thêm 3 route),
  `frontend/src/pages/RegisterPage.jsx` (bỏ chọn vai trò),
  `frontend/src/pages/TeacherDashboard.jsx` (thêm form tạo + sửa/xoá học
  sinh), `README.md` (thêm mục "Phân quyền tài khoản").
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Có thể cân nhắc thêm nếu
  cần: cho giáo viên đặt lại mật khẩu học sinh (hiện học sinh tự đổi qua
  trang Cài đặt), hoặc thêm xác nhận qua modal đẹp hơn thay vì
  `window.confirm` mặc định của trình duyệt.

### 2026-09-08 - Thiết kế lại giao diện: sidebar trái + trang Cài đặt (Bước 10)
- Đã làm gì: Người dùng phản hồi giao diện cũ (navbar ngang, màu nền xám)
  "chưa chuyên nghiệp". Thiết kế lại toàn bộ:
  - Viết lại `frontend/src/index.css` theo hệ thống thiết kế nhất quán
    (biến CSS cho màu sắc, nền trắng `--bg-page: #fff`), thêm class
    `status-pill` (nhãn trạng thái dạng viên thuốc, màu theo trạng thái:
    assigned/draft/pending_review/approved/rejected).
  - Thay `components/Navbar.jsx` (thanh ngang) bằng
    `components/Sidebar.jsx` (menu dọc bên trái, dùng `NavLink` để tự động
    highlight mục đang chọn) + `components/Layout.jsx` (khung sidebar +
    nội dung). `ProtectedRoute.jsx` tự bọc mọi trang đã đăng nhập trong
    `Layout`, nên các trang con không cần thay đổi gì để có sidebar.
  - Thêm trang `pages/SettingsPage.jsx` ("Cài đặt"): xem thông tin tài
    khoản (họ tên, email, vai trò, lớp) và form đổi mật khẩu.
  - Backend: thêm `changePassword` vào `authController.js` (kiểm tra đúng
    mật khẩu hiện tại trước khi đổi) và route `PUT /api/me/password`,
    `GET /api/me` trả về hồ sơ đầy đủ (trước đó chỉ trả lại payload JWT).
  - `LoginPage`/`RegisterPage` chuyển sang layout `auth-page`/`auth-card`
    (căn giữa màn hình, không sidebar) cho nhất quán với thiết kế mới.
  Đã `npm run build` thành công, test lại toàn bộ qua Playwright: không lỗi
  console, chụp ảnh xác nhận trang đăng nhập, dashboard giáo viên (sidebar +
  status pill hiển thị đúng), trang chi tiết học sinh, dashboard học sinh,
  trang Cài đặt đều hiển thị đúng và đẹp. Phát hiện trong lúc test rằng
  người dùng đã tự thao tác thật trên hệ thống trước đó (duyệt 2 đề xuất AI
  `ge-1`, `ge-2` thành `approved`, tạo 1 đề nháp) - đây là dữ liệu thật của
  người dùng, KHÔNG xoá/revert, chỉ xác nhận và giữ nguyên.
- Vì sao làm như vậy: Sidebar trái là bố cục quen thuộc của các dashboard
  chuyên nghiệp (dễ mở rộng thêm menu sau này), nền trắng đơn giản giúp nội
  dung (bảng biểu, biểu đồ) nổi bật hơn là màu nền xám trước đó. Trang Cài
  đặt là tính năng cơ bản người dùng mong đợi có ở mọi hệ thống tài khoản.
- File nào bị ảnh hưởng: `frontend/src/index.css` (viết lại),
  `frontend/src/components/Sidebar.jsx` (mới, thay `Navbar.jsx` đã xoá),
  `frontend/src/components/Layout.jsx` (mới),
  `frontend/src/components/ProtectedRoute.jsx` (bọc `Layout`),
  `frontend/src/pages/SettingsPage.jsx` (mới),
  `frontend/src/pages/LoginPage.jsx`, `RegisterPage.jsx` (đổi layout),
  `frontend/src/pages/TeacherDashboard.jsx`, `ExamEditorPage.jsx`,
  `TeacherStudentDetailPage.jsx` (dùng `status-pill`), `App.jsx` (bỏ
  `Navbar`, thêm route `/settings`), `backend/src/controllers/authController.js`
  (thêm `changePassword`), `backend/src/routes/meRoutes.js` (thêm
  `GET /` trả hồ sơ đầy đủ, `PUT /password`).
- Việc cần làm tiếp theo: Không còn việc bắt buộc. Có thể cân nhắc thêm sau
  nếu cần: cho giáo viên tự sửa họ tên trong Cài đặt, thu gọn sidebar trên
  màn hình nhỏ (responsive), hoặc thêm dark mode.

### 2026-09-08 - Kiểm thử biên + làm phong phú dữ liệu demo (Bước 9)
- Đã làm gì:
  1. **Làm phong phú dữ liệu demo** để câu chuyện "phát hiện điểm yếu -> AI
     gợi ý ôn tập" thuyết phục hơn khi trình bày: thêm học sinh thứ 3 (Phạm
     Văn D - cố tình chưa làm bài nào, minh hoạ trạng thái "chưa có dữ
     liệu"); thêm 2 đề ôn tập riêng (`e-2` cho Cực trị hàm số, `e-3` cho Xác
     suất thống kê) và các câu hỏi tương ứng; thêm các lượt nộp bài để dữ
     liệu `student_topic_stats` phản ánh đúng 2 câu chuyện độc lập: học
     sinh 1 (Trần Thị B) yếu thật sự "Cực trị hàm số" (3/3 câu sai, đủ
     ngưỡng `MIN_QUESTIONS_THRESHOLD=3`), học sinh 2 (Lê Văn C) yếu thật sự
     "Xác suất thống kê" (3/3 câu sai, đủ ngưỡng); đồng thời vẫn giữ các tag
     có `totalAnswered=1` (dưới ngưỡng) để minh hoạ ngưỡng lọc mẫu nhỏ vẫn
     hoạt động đúng dù học sinh sai 100% ở tag đó. Cập nhật `ge-1`/`ge-2`
     trong `generated_exercises.json` cho khớp với weakTags thực tế mới, và
     thêm `ge-2` (đề xuất cho học sinh 2) để danh sách "Duyệt đề xuất AI" có
     2 mục thay vì 1.
  2. **Kiểm thử các trường hợp biên** qua API thật: (a) giao đề khi đề chưa
     có câu hỏi -> đúng 400 bị chặn; (b) học sinh nộp bài chỉ trả lời 1/3
     câu -> các câu bỏ trống tự động tính là sai, không crash; (c) giáo viên
     xoá 1 câu hỏi đã có trong bài nộp cũ (`q-1` khỏi `e-1` dù `s-1` đã tham
     chiếu) -> không crash, `getSubmissionDetail` trả về `content`/
     `correctAnswer` là `null` cho câu đã xoá nhờ có fallback trong code (đã
     khôi phục lại `q-1` sau khi xác nhận hành vi đúng, vì đây là câu hỏi
     thuộc bộ dữ liệu demo chính thức chứ không phải dữ liệu test).
  3. Chạy lại kiểm thử UI bằng Playwright với dữ liệu demo mới: xác nhận
     biểu đồ "Điểm yếu chung của cả lớp" trên dashboard giáo viên giờ hiển
     thị dữ liệu thật (2 cột đỏ ~75-100%) thay vì thông báo "Chưa có dữ liệu
     thống kê" như dữ liệu demo tối giản ban đầu - trực quan hơn nhiều để
     trình chiếu.
  4. Dọn toàn bộ dữ liệu phát sinh trong lúc test biên (đề rỗng, submission
     test của học sinh 3, thống kê tạm) khỏi các file JSON, chỉ giữ lại bộ
     dữ liệu demo đã thiết kế có chủ đích.
  5. Cập nhật `README.md`: thêm bảng tài khoản demo (mật khẩu chung
     `password123`) kèm mô tả ngắn từng học sinh, để việc trình bày trước
     ban giám khảo không cần tra cứu lại dữ liệu.
- Vì sao làm như vậy: Dữ liệu demo tối giản ban đầu (mỗi tag chỉ 1 câu, dưới
  ngưỡng) tuy đúng về mặt kỹ thuật nhưng khiến các tính năng "cốt lõi" của đề
  tài (phát hiện điểm yếu, gợi ý roadmap) không có gì để hiển thị khi demo.
  Bộ dữ liệu mới vẫn giữ nguyên trường hợp "dưới ngưỡng" (để chứng minh cơ
  chế chống kết luận sai lệch vẫn hoạt động) nhưng bổ sung đủ trường hợp
  "đủ ngưỡng, xác nhận yếu thật" cho 2 học sinh khác nhau ở 2 chủ đề khác
  nhau - vừa đúng kỹ thuật vừa có câu chuyện rõ ràng để thuyết trình.
- File nào bị ảnh hưởng: `data/users.json` (+1 học sinh), `data/exams.json`
  (+2 đề), `data/questions.json` (+4 câu hỏi), `data/submissions.json` (+3
  lượt nộp), `data/submission_answers.json` (+7 câu trả lời),
  `data/student_topic_stats.json` (viết lại toàn bộ theo dữ liệu mới),
  `data/generated_exercises.json` (cập nhật `ge-1`, thêm `ge-2`),
  `README.md` (thêm bảng tài khoản demo).
- Việc cần làm tiếp theo: Dự án đã hoàn thành đủ 9 bước. Các việc còn lại
  mang tính tuỳ chọn cho khi cần: viết báo cáo/slide thuyết trình (có thể
  dùng chính nội dung file này làm dàn ý phần "phương pháp và triển khai"),
  cân nhắc thêm `robots`/build production nếu cần deploy demo online, và
  nếu muốn mở rộng đề tài có thể thêm tính năng xuất báo cáo PDF hoặc thống
  kê theo thời gian (tiến bộ của học sinh qua các lần làm bài).

### 2026-09-08 - Frontend React (Vite) cho toàn bộ luồng (Bước 8)
- Đã làm gì: Dựng `frontend/` bằng React + Vite (viết tay `package.json`,
  `vite.config.js`, `index.html` vì `npm create vite` bị huỷ do thư mục đã
  tồn tại từ Bước 1). Cài `axios`, `react-router-dom`, `recharts`. Xây dựng:
  `services/api.js` (axios instance tự đính JWT token, tự đăng xuất khi gặp
  401), `context/AuthContext.jsx` (quản lý đăng nhập/đăng ký, lưu
  localStorage), `components/ProtectedRoute.jsx` (chặn theo role),
  `components/Navbar.jsx`, `components/WeakTopicsChart.jsx` (biểu đồ cột
  ngang bằng Recharts, màu theo mức độ: xanh <25%, cam 25-50%, đỏ >=50%).
  Trang: `LoginPage`, `RegisterPage`, `TeacherDashboard` (biểu đồ điểm yếu cả
  lớp, danh sách học sinh, tạo đề, danh sách đề), `ExamEditorPage` (thêm/xoá
  câu hỏi, giao đề), `TeacherStudentDetailPage` (biểu đồ điểm yếu 1 học
  sinh, nút sinh roadmap AI, duyệt/từ chối đề xuất), `GeneratedExercisesListPage`
  (duyệt tất cả đề xuất đang chờ), `StudentDashboard` (đề được giao, roadmap
  đã duyệt), `ExamPage` (làm bài trắc nghiệm), `ResultPage` (xem điểm + đúng
  sai từng câu), `StudentWeakTopicsPage`. Ráp route trong `App.jsx`.
  Đã `npm run build` thành công (không lỗi). Cài Playwright, viết 2 script
  test tự động lái trình duyệt thật qua toàn bộ luồng: (1) chưa đăng nhập bị
  redirect `/login` ✓, đăng nhập giáo viên -> dashboard đủ nội dung ✓, xem
  chi tiết học sinh (biểu đồ hiển thị đúng) ✓, đăng xuất ✓, đăng nhập học
  sinh -> dashboard đúng ✓, trang điểm yếu ✓ - không có lỗi console; (2) học
  sinh 2 làm bài thi thật qua UI (click chọn đáp án, nộp bài) -> trang kết
  quả hiển thị đúng điểm 3.3/10, đúng/sai từng câu tô màu rõ ràng. Phát hiện
  và sửa 1 lỗi UI: cột biểu đồ Recharts bị animation delay nên chụp ảnh lúc
  đầu thấy trống - đã thêm `isAnimationActive={false}` để biểu đồ hiện ngay
  lập tức (quan trọng khi trình chiếu trước ban giám khảo). Sau khi test đã
  khôi phục lại đúng dữ liệu demo ban đầu (test làm bài qua UI tạo 1
  submission thật cho student2, đã backup/restore).
- Vì sao làm như vậy: Test qua trình duyệt thật (không chỉ gọi API) để bắt
  được lỗi hiển thị (như lỗi animation biểu đồ) mà test API không phát hiện
  được. Tách `WeakTopicsChart` thành component dùng chung cho cả 3 nơi cần
  hiển thị (giáo viên xem lớp, xem 1 học sinh, học sinh tự xem) để đồng nhất
  và dễ bảo trì.
- File nào bị ảnh hưởng: toàn bộ `frontend/src/` (mới), `frontend/package.json`,
  `frontend/vite.config.js`, `frontend/index.html`, `frontend/.env.example`,
  `frontend/.gitignore`.
- Việc cần làm tiếp theo: Bước 9 - kiểm thử end-to-end toàn diện thêm (đặc
  biệt các trường hợp biên: đề chưa có câu hỏi, học sinh nộp bài thiếu câu,
  giáo viên xoá câu hỏi khỏi đề đã giao) và chuẩn bị bộ dữ liệu demo đầy đủ,
  phong phú hơn để thuyết trình trước ban giám khảo (nhiều học sinh, nhiều
  đề, đủ dữ liệu vượt ngưỡng để minh hoạ roadmap AI thực tế).

### 2026-09-08 - Module phân tích điểm yếu theo tag (Bước 6)
- Đã làm gì: Viết `backend/src/services/weaknessAnalysisService.js` với 3
  hàm: `getStudentTopicStats` (toàn bộ thống kê của 1 học sinh, sắp xếp theo
  `wrongRate` giảm dần), `getWeakTags` (chỉ xét tag có `totalAnswered >=
  MIN_QUESTIONS_THRESHOLD` và `wrongRate > 0`, lấy top N - mặc định 3, đây
  là input sẽ dùng cho Gemini ở Bước 7), `getClassWeakTopics` (gộp
  totalAnswered/totalWrong theo tag trên nhiều học sinh, để giáo viên xem
  điểm yếu chung cả lớp). Viết `backend/src/controllers/statsController.js`
  và 2 route mới: `GET /api/student/me/weak-topics` (học sinh xem điểm yếu
  của chính mình) và `/api/teacher/students`, `/api/teacher/students/:id/stats`,
  `/api/teacher/class-weak-topics` (giáo viên xem thống kê từng học sinh và
  cả lớp).
  Đã test bằng curl với dữ liệu demo hiện có (student1 mỗi tag chỉ có
  `totalAnswered=1`, dưới ngưỡng 3): xác nhận `weakTags` trả về rỗng dù có
  tag `wrongRate=1` (đúng theo thiết kế tránh kết luận sai lệch với mẫu nhỏ),
  trong khi `allTopicStats` vẫn hiển thị đủ và đúng thứ tự. Đã test riêng
  logic ngưỡng + sắp xếp bằng dữ liệu giả lập (mock `dataAccess.findMany`,
  không đụng file thật): 1 tag đủ ngưỡng nhưng `wrongRate` thấp hơn vẫn được
  giữ, 1 tag `wrongRate=1` nhưng chưa đủ ngưỡng bị loại đúng như kỳ vọng.
  Route phân quyền: học sinh gọi route giáo viên bị chặn 403 ✓.
- Vì sao làm như vậy: Tách logic phân tích thành service riêng (không nhét
  vào controller) để Bước 7 (gọi Gemini) có thể tái sử dụng trực tiếp hàm
  `getWeakTags` làm input mà không lặp lại code.
- File nào bị ảnh hưởng: `backend/src/services/weaknessAnalysisService.js`
  (mới), `backend/src/controllers/statsController.js` (mới),
  `backend/src/routes/teacherRoutes.js` (mới),
  `backend/src/routes/studentRoutes.js` (thêm route `/me/weak-topics`),
  `backend/src/app.js` (đăng ký route `/api/teacher`).
- Việc cần làm tiếp theo: Bước 7 - tích hợp Google Gemini API: service gọi
  API sinh roadmap + bài tập tương tự dựa trên `getWeakTags`, lưu cache vào
  `data/generated_exercises.json`, có endpoint giáo viên duyệt trước khi
  gửi học sinh.

### 2026-09-08 - API cho học sinh: làm bài, nộp bài, chấm điểm (Bước 5)
- Đã làm gì: Thêm `backend/src/config/constants.js` (hằng số
  `MIN_QUESTIONS_THRESHOLD = 3`, để dành cho module phân tích điểm yếu ở
  Bước 6). Viết `backend/src/controllers/studentExamController.js` và
  `backend/src/routes/studentRoutes.js`, gắn tại `/api/student` (yêu cầu
  `requireRole('student')`): `GET /exams` liệt kê đề được giao,
  `GET /exams/:examId` xem đề để làm bài (ẩn `correctAnswer` trong response
  để tránh lộ đáp án qua DevTools), `POST /exams/:examId/submit` nộp bài -
  tự động chấm điểm (thang 10, làm tròn 1 chữ số thập phân), tạo bản ghi
  `submissions` + từng `submission_answers` (sao chép `tags` của câu hỏi vào
  từng answer), đồng thời cập nhật (upsert) `student_topic_stats` theo tag
  ngay trong lúc chấm bài; chặn nộp trùng nếu đã có submission `graded` cho
  đề đó. `GET /submissions` và `GET /submissions/:id` cho học sinh xem lại
  kết quả kèm đáp án đúng.
  Đã test end-to-end bằng curl với tài khoản `student2` trên đề demo `e-1`
  (3 câu, mỗi câu 1 tag): xem đề ẩn đáp án ✓, nộp bài chấm đúng 2/3 = điểm
  6.7 ✓, cập nhật đúng `student_topic_stats` cho cả 3 tag của student2 ✓,
  nộp lại bị chặn 409 ✓, giáo viên gọi route học sinh bị chặn 403 ✓,
  `student1` (đã có submission mẫu sẵn cho `e-1`) nộp lại cũng bị chặn 409
  đúng như kỳ vọng. Sau test đã khôi phục lại đúng nguyên trạng 3 file
  `submissions.json`, `submission_answers.json`, `student_topic_stats.json`
  về dữ liệu demo ban đầu.
- Vì sao làm như vậy: Việc cập nhật `student_topic_stats` ngay trong lúc
  chấm bài (thay vì tính lại từ đầu mỗi lần cần) giúp truy vấn thống kê ở
  Bước 6 (xác định chủ đề yếu nhất) chỉ cần đọc thẳng bảng tổng hợp này,
  không phải quét lại toàn bộ `submission_answers`. Chặn nộp trùng để đảm
  bảo tính toàn vẹn dữ liệu thống kê (không bị cộng dồn sai nếu học sinh nộp
  nhiều lần cho cùng 1 đề).
- File nào bị ảnh hưởng: `backend/src/config/constants.js` (mới),
  `backend/src/controllers/studentExamController.js` (mới),
  `backend/src/routes/studentRoutes.js` (mới), `backend/src/app.js` (đăng ký
  route `/api/student`).
- Việc cần làm tiếp theo: Bước 6 - module phân tích điểm yếu: đọc
  `student_topic_stats`, áp dụng `MIN_QUESTIONS_THRESHOLD`, xác định 2-3 tag
  yếu nhất cho 1 học sinh (API cho giáo viên xem thống kê cả lớp + API nội
  bộ dùng làm input cho Bước 7 - gọi Gemini).

### 2026-09-08 - API cho giáo viên: đề thi, câu hỏi, giao đề (Bước 4)
- Đã làm gì: Viết `backend/src/controllers/examController.js` và
  `backend/src/routes/examRoutes.js` với các endpoint (đều yêu cầu
  `verifyToken` + `requireRole('teacher')`, gắn tại `/api/exams`):
  `POST /` tạo đề (trạng thái `draft`), `GET /` liệt kê đề của giáo viên hiện
  tại, `GET /:examId` xem chi tiết đề kèm câu hỏi, `POST /:examId/questions`
  thêm câu hỏi (bắt buộc >=2 lựa chọn, `correctAnswer` phải trùng 1 key
  trong `options`, bắt buộc >=1 tag chủ đề), `PUT/DELETE .../questions/:id`
  sửa/xoá câu hỏi, `PUT /:examId/assign` giao đề cho danh sách học sinh
  (kiểm tra từng id đúng là học sinh tồn tại, và đề phải có ít nhất 1 câu hỏi
  trước khi giao - chuyển status sang `assigned`). Mọi thao tác sửa/xoá đều
  kiểm tra `exam.createdBy === req.user.id` để giáo viên không sửa được đề
  của người khác.
  Đã test end-to-end bằng curl sau khi phát hiện và xử lý 1 process server
  cũ bị treo cổng 5000 (taskkill): tạo đề ✓, từ chối câu hỏi thiếu tag ✓,
  thêm câu hỏi hợp lệ ✓, từ chối gán đề cho id không phải học sinh ✓, gán đề
  cho học sinh thật ✓, xem chi tiết đề kèm câu hỏi ✓, học sinh gọi API tạo đề
  bị chặn 403 ✓. Đã dọn dữ liệu test khỏi `data/exams.json` và
  `data/questions.json` sau khi test xong (test qua curl trên Git Bash làm
  sai lệch encoding tiếng Việt trong dữ liệu test - không phải lỗi code,
  chỉ là giới hạn của công cụ test dòng lệnh, dữ liệu thật qua frontend/JSON
  UTF-8 chuẩn sẽ không gặp vấn đề này).
- Vì sao làm như vậy: Đây là luồng nghiệp vụ cốt lõi phía giáo viên; validate
  chặt ở tầng API (tag bắt buộc, correctAnswer khớp option, chỉ giao đề có
  câu hỏi) giúp dữ liệu ở các bước phân tích điểm yếu sau này (Bước 6) luôn
  đáng tin cậy.
- File nào bị ảnh hưởng: `backend/src/controllers/examController.js` (mới),
  `backend/src/routes/examRoutes.js` (mới), `backend/src/app.js` (đăng ký
  route `/api/exams`), `data/users.json` (đặt lại `passwordHash` thật cho 3
  tài khoản demo, mật khẩu chung: `password123`, dùng để test đăng nhập).
- Việc cần làm tiếp theo: Bước 5 - API cho học sinh: xem đề được giao, nộp
  bài làm, chấm điểm tự động (tạo `submissions` + `submission_answers`).

### 2026-09-08 - Backend cơ bản: data access layer, auth, JWT (Bước 3)
- Đã làm gì: Khởi tạo `backend/package.json` (Express, lowdb v1, bcryptjs,
  jsonwebtoken, uuid, cors, dotenv). Viết `backend/src/models/dataAccess.js`
  — lớp trung gian đọc/ghi file JSON trong `data/` bằng lowdb v1 (mỗi lần gọi
  tạo instance mới để luôn đọc bản mới nhất từ đĩa trước khi ghi, tránh mất
  dữ liệu khi có ghi đè liên tiếp mà không cần transaction/locking phức tạp).
  Viết `backend/src/middleware/auth.js` (verifyToken, requireRole) và
  `backend/src/controllers/authController.js` + `routes/authRoutes.js`
  (đăng ký/đăng nhập, băm mật khẩu bằng bcryptjs, phát JWT). Thêm
  `routes/meRoutes.js` để kiểm tra middleware. Dựng `app.js` + `server.js`.
  Đã cài `npm install` và test thủ công bằng curl: health check, đăng ký,
  đăng nhập trả token, gọi `/api/me` có/không token — tất cả đúng như kỳ
  vọng, sau đó xoá tài khoản test khỏi `data/users.json`.
- Vì sao làm như vậy: Data access layer giúp toàn bộ backend không thao tác
  trực tiếp với `fs`, dễ kiểm soát và giải trình; đăng ký/đăng nhập + JWT là
  nền tảng bắt buộc trước khi xây các API có phân quyền (giáo viên/học sinh)
  ở các bước sau.
- File nào bị ảnh hưởng: `backend/package.json`, `backend/.env.example`,
  `backend/.gitignore`, `backend/src/models/dataAccess.js`,
  `backend/src/middleware/auth.js`, `backend/src/controllers/authController.js`,
  `backend/src/routes/authRoutes.js`, `backend/src/routes/meRoutes.js`,
  `backend/src/app.js`, `backend/src/server.js`.
- Việc cần làm tiếp theo: Bước 4 - API cho giáo viên: tạo đề thi, thêm câu
  hỏi (kèm tag chủ đề), giao đề cho học sinh (dùng `requireRole('teacher')`).

### 2026-09-08 - Thiết kế schema dữ liệu JSON (Bước 2)
- Đã làm gì: Viết `docs/DATA_SCHEMA.md` mô tả chi tiết 7 "bảng" JSON
  (`users`, `exams`, `questions`, `submissions`, `submission_answers`,
  `student_topic_stats`, `generated_exercises`), kèm sơ đồ quan hệ dạng text
  và giải thích các trường FK tham chiếu chéo. Tạo dữ liệu mẫu demo cho cả 7
  file trong `data/` với một kịch bản xuyên suốt: 1 giáo viên, 2 học sinh,
  1 đề thi 3 câu (mỗi câu 1 tag khác nhau), 1 lượt nộp bài của học sinh 1
  (sai 2/3 câu), thống kê theo tag tương ứng, và 1 bản ghi đề xuất AI
  (`generated_exercises`) ở trạng thái `pending_review`.
- Vì sao làm như vậy: Thiết kế schema rõ ràng trước khi code giúp backend
  (data access layer, API) và frontend đều bám theo một cấu trúc thống nhất;
  dữ liệu mẫu giúp test các API sau này mà không cần chờ có giao diện nhập
  liệu. Quyết định tách `submission_answers` riêng khỏi `submissions`, và
  sao chép `tags` vào từng câu trả lời (thay vì chỉ tham chiếu `questionId`)
  để việc tính thống kê theo tag không bị ảnh hưởng nếu sau này giáo viên
  sửa tag của câu hỏi gốc. Đặt ngưỡng tối thiểu 3 câu/tag (`MIN_QUESTIONS_THRESHOLD`)
  trước khi kết luận một chủ đề là "yếu", để tránh sai lệch do mẫu nhỏ (dữ
  liệu demo cố tình chỉ có 1 câu/tag để minh hoạ trường hợp chưa đủ ngưỡng).
- File nào bị ảnh hưởng: `docs/DATA_SCHEMA.md` (mới),
  `data/users.json`, `data/exams.json`, `data/questions.json`,
  `data/submissions.json`, `data/submission_answers.json`,
  `data/student_topic_stats.json`, `data/generated_exercises.json` (đều mới).
- Việc cần làm tiếp theo: Bước 3 - xây dựng backend cơ bản: data access
  layer đọc/ghi file JSON an toàn, API đăng ký/đăng nhập, middleware JWT
  phân quyền theo role.

### 2026-09-08 - Khởi tạo cấu trúc dự án
- Đã làm gì: Tạo cây thư mục `backend/`, `frontend/`, `data/`, `docs/` theo
  kiến trúc đề xuất; viết file nhật ký này.
- Vì sao làm như vậy: Đây là bước nền tảng, giúp các bước sau có chỗ để đặt
  code đúng vị trí, và file nhật ký giúp không mất ngữ cảnh giữa các phiên làm
  việc.
- File nào bị ảnh hưởng: Toàn bộ cấu trúc thư mục gốc, `docs/STEP_BY_STEP.md`.
- Việc cần làm tiếp theo: Thiết kế schema dữ liệu JSON (Bước 2) và xác nhận
  với người dùng trước khi code backend.
