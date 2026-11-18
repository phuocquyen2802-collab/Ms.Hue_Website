# Triển khai MathInsight AI lên server Ubuntu bằng Docker

Toàn bộ website (giao diện + API + LibreOffice) chạy trong **1 container**,
mở ra ngoài **1 cổng** (mặc định cổng 80). Dữ liệu được lưu trong một ổ dữ
liệu Docker tên `mathinsight-data`, không mất khi build lại hay khởi động lại.

## 1. Cài Docker (làm 1 lần)

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # để không phải gõ sudo trước lệnh docker
```

Đăng xuất SSH rồi đăng nhập lại, kiểm tra bằng `docker compose version`.

Nếu server bật tường lửa `ufw`, mở cổng web:

```bash
sudo ufw allow 80/tcp
```

## 2. Lấy mã nguồn và cấu hình

```bash
git clone https://github.com/phuocquyen2802-collab/Ms.Hue_Website.git mathinsight
cd mathinsight
cp backend/.env.example backend/.env
nano backend/.env
```

Sửa trong `backend/.env`:

```
JWT_SECRET=<dán chuỗi sinh bởi lệnh: openssl rand -hex 32>
GEMINI_API_KEY=<key Gemini thật, để trống nếu chưa có>
```

`JWT_SECRET` là bắt buộc - thiếu thì container sẽ dừng và báo lỗi.

**Font công thức (nên làm):** để ảnh công thức Toán nhập từ Word hiển thị giống
trên Windows, chép các font MathType/Times từ máy Windows vào
`docker/fonts/` trên server trước khi build. Thiếu font thì π hiện thành
`p`, ℤ hiện thành `¢`. Danh sách file xem
[docker/fonts/README.md](../docker/fonts/README.md). Gom các file đó vào thư
mục `docker\fonts` của dự án trên máy Windows, rồi gửi cả thư mục lên server
(chạy trên PowerShell của máy Windows):

```powershell
scp -r D:\duong-dan-du-an\docker\fonts <user>@<IP-server>:~/mathinsight/docker/
```

## 3. Build và chạy

```bash
docker compose up -d --build
```

Lần build đầu mất vài phút (tải LibreOffice). Kiểm tra:

```bash
docker compose ps          # cột STATUS hiện "healthy" là chạy tốt
docker compose logs -f     # xem log, Ctrl + C để thoát
```

Mở trình duyệt: `http://<IP-server>`.

**Việc đầu tiên sau khi chạy:** đăng nhập `admin` / `admin123`, vào **Cài đặt**
và **đổi mật khẩu ngay** - website đã công khai trên mạng.

Lần chạy đầu, dữ liệu ban đầu được chép từ thư mục `data/` trong mã nguồn
(đúng như lúc bạn `git push`). Các lần sau dữ liệu trên server được giữ
nguyên, không bị ghi đè.

## 4. Cập nhật khi sửa code

```bash
cd ~/mathinsight
git pull
docker compose up -d --build
```

Dữ liệu (tài khoản, đề, bài nộp, file tải lên) giữ nguyên.

## 5. Sao lưu và khôi phục dữ liệu

Sao lưu ra file nén (nên làm định kỳ):

```bash
docker compose exec app tar czf - -C /app/data . > backup-$(date +%F).tgz
```

Khôi phục từ file sao lưu (ghi đè dữ liệu hiện tại):

```bash
docker compose exec -T app sh -c 'tar xzf - -C /app/data' < backup-2026-11-15.tgz
docker compose restart
```

> Không chạy `docker compose down -v` - tham số `-v` **xoá luôn ổ dữ liệu**.
> Muốn dừng website chỉ cần `docker compose down`.

## 6. Dùng tên miền + HTTPS (tuỳ chọn)

Khi đã có tên miền trỏ về IP server, cách đơn giản nhất là dùng Caddy (tự
cấp chứng chỉ HTTPS):

1. Chạy website ở cổng khác để nhường cổng 80/443 cho Caddy:
   ```bash
   APP_PORT=8080 docker compose up -d
   ```
   (hoặc ghi `APP_PORT=8080` vào file `.env` ở thư mục gốc dự án để lần sau
   không phải gõ lại).
2. Cài Caddy theo hướng dẫn tại https://caddyserver.com/docs/install, rồi
   sửa `/etc/caddy/Caddyfile`:
   ```
   ten-mien-cua-ban.vn {
       reverse_proxy localhost:8080
   }
   ```
3. `sudo systemctl reload caddy`, mở cổng `sudo ufw allow 443/tcp`.

Nếu server đã có sẵn **nginx**, thêm `client_max_body_size 50m;` vào khối
`server` để tải được file Word/ảnh lớn, và `proxy_pass http://127.0.0.1:8080;`.

## 6b. Gửi email khôi phục mật khẩu (tuỳ chọn)

Khi người dùng quên mật khẩu, hoặc nhập sai mật khẩu 5 lần liên tiếp (tài khoản
bị tạm khoá 15 phút), trang đăng nhập cho nhập tên đăng nhập + email đã đăng ký.
Hệ thống gửi đường dẫn đặt lại mật khẩu (dùng 1 lần, hết hạn sau 30 phút) tới
email đó. Email chỉ được gửi khi khớp với **email khôi phục** của tài khoản:
giáo viên nhập khi thêm/sửa học sinh, hoặc người dùng tự thêm ở trang Cài đặt
(tên đăng nhập là email thì dùng luôn email đó).

Email được gửi qua Resend API (https://resend.com, miễn phí 3.000 email/tháng),
đi qua HTTPS nên không bị nhà cung cấp server chặn như cổng SMTP:

1. Đăng ký tại https://resend.com, vào **Domains → Add Domain**, nhập tên miền
   dùng để gửi mail.
2. Thêm các bản ghi DNS mà Resend hiển thị (TXT/MX) vào trang quản lý DNS của
   tên miền, chờ Resend báo **Verified**.
3. Vào **API Keys → Create API Key** (quyền *Sending access* là đủ), chép key
   (bắt đầu bằng `re_`).
4. Thêm vào `backend/.env` trên server (xem mẫu ở `backend/.env.example`):
   ```
   APP_URL=https://ten-mien-cua-website
   EMAIL_FROM="MathInsight AI <support@ten-mien-da-xac-minh>"
   RESEND_API_KEY=re_xxxxxxxx
   ```
   `APP_URL` là địa chỉ người dùng mở website - nút trong email trỏ về đây.
5. `docker compose up -d` để nạp cấu hình mới. Log khởi động có dòng `[Email]`
   cho biết đã bật gửi email chưa (`docker compose logs app | grep Email`).
6. Gửi thử 1 email để kiểm tra:
   ```
   docker compose exec app npm run mail:test -- ten-ban@gmail.com
   ```
   Lỗi `domain is not verified` là tên miền trong `EMAIL_FROM` chưa xác minh
   xong ở Resend; lỗi `API key is invalid` là sai key.

Muốn dùng dịch vụ SMTP khác (Brevo, Gmail...) thì bỏ trống `RESEND_API_KEY` và
đặt `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (xem `backend/.env.example`).

Chưa cấu hình gửi email thì màn khôi phục báo "Hệ thống chưa bật gửi email, liên hệ
giáo viên"; giáo viên vẫn đặt lại mật khẩu cho học sinh ở mục Quản lý học sinh
(việc này cũng mở khoá tài khoản ngay).

## 7. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `Bind for 0.0.0.0:80 failed: port is already allocated` | Cổng 80 đã có dịch vụ khác: chạy `APP_PORT=8080 docker compose up -d` rồi vào `http://<IP>:8080` |
| Container dừng ngay, log báo `chưa đặt JWT_SECRET` | Sửa `backend/.env` (mục 2) rồi `docker compose up -d` |
| `env file .../backend/.env not found` | Chưa tạo file: `cp backend/.env.example backend/.env` |
| Tính năng AI báo lỗi | Kiểm tra `GEMINI_API_KEY` trong `backend/.env`, rồi `docker compose up -d` để nạp lại |
| π hiện thành `p`, ℤ thành `¢`, ký hiệu thành ô vuông | Chép font vào `docker/fonts/` (mục 2), `docker compose up -d --build`, rồi nhập lại file Word của đề đó |
| Không vào được web từ máy khác | Kiểm tra `ufw`/tường lửa của nhà cung cấp server đã mở cổng chưa |
