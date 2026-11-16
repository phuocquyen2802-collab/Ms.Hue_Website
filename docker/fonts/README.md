# Font bổ sung cho máy chủ (tuỳ chọn)

File `.ttf` / `.otf` đặt trong thư mục này sẽ được cài vào máy chủ khi build
Docker.

Ảnh công thức Toán trong file Word (MathType/Equation) dùng các font
`Times New Roman`, `Symbol`, `MT Extra`, `Euclid`. Máy chủ Linux không có sẵn
các font này nên LibreOffice dùng font thay thế, và một vài ký hiệu có thể
hiển thị khác so với khi chạy trên Windows.

Muốn ảnh công thức giống hệt, hãy chép các file font sau từ máy Windows đã cài
MathType (thư mục `C:\Windows\Fonts`) vào đây **trên server**, rồi build lại:

- `symbol.ttf` (font `Symbol`: π, α, β, ∈, ≤...)
- `mtextra_01.ttf` (font `MT Extra`: ℤ, ℝ, ℕ, mũi tên vectơ...). Lưu ý: máy
  có thể có thêm file `MTEXTRA.TTF` cùng tên font nhưng thiếu ký tự - dùng
  đúng file mà Windows đang dùng, xem trong
  `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`.
- `times.ttf`, `timesbd.ttf`, `timesi.ttf`, `timesbi.ttf`
- `pala.ttf`, `palai.ttf`, `palab.ttf`, `palabi.ttf` (font `Palatino Linotype`:
  nhiều đề dùng font này cho biến số và chữ số trong công thức). Thiếu font
  này máy chủ dùng P052 (bản Palatino tự do, đã cài sẵn khi build - xem
  `docker/fontconfig/`); trước đây khi chưa có P052 thì chữ trong công thức
  bị chồng lên nhau.
- Bộ `Euclid` (nếu đề dùng kiểu Euclid của MathType): `euclid*.ttf`,
  `eucsym*.ttf`, `euextra*.ttf`, `eufrak*.ttf`, `eumat*.ttf`

Thiếu `Symbol`/`MT Extra` thì π hiện thành chữ `p`, ℤ hiện thành `¢`.

Sau khi thêm font phải build lại (`docker compose up -d --build`) rồi **nhập
lại file Word** của các đề đã tải lên trước đó - ảnh công thức cũ đã được vẽ
sẵn bằng font thay thế nên không tự sửa được.

Các font này có bản quyền riêng nên **không đưa lên GitHub**: file `.gitignore`
đã chặn sẵn file font trong thư mục này.
