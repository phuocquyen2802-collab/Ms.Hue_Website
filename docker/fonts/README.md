# Font bổ sung cho máy chủ (tuỳ chọn)

File `.ttf` / `.otf` đặt trong thư mục này sẽ được cài vào máy chủ khi build
Docker.

Ảnh công thức Toán trong file Word (MathType/Equation) dùng các font
`Times New Roman`, `Symbol`, `MT Extra`, `Euclid`. Máy chủ Linux không có sẵn
các font này nên LibreOffice dùng font thay thế, và một vài ký hiệu có thể
hiển thị khác so với khi chạy trên Windows.

Muốn ảnh công thức giống hệt, hãy chép các file font sau từ máy Windows đã cài
MathType (thư mục `C:\Windows\Fonts`) vào đây **trên server**, rồi build lại:

- `times.ttf`, `timesbd.ttf`, `timesi.ttf`, `timesbi.ttf`
- `symbol.ttf`
- `MTEXTRA.TTF`
- `euclid.ttf`, `euclidb.ttf`, `euclidi.ttf`, `euclidbi.ttf`

Các font này có bản quyền riêng nên **không đưa lên GitHub**: file `.gitignore`
đã chặn sẵn file font trong thư mục này.
