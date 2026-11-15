#!/bin/sh
set -e

DATA_DIR=/app/data
SEED_DIR=/app/data-seed

# JWT_SECRET dùng để ký phiên đăng nhập - thiếu thì không ai đăng nhập được.
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change_this_to_a_random_secret_key" ]; then
  echo "LỖI: chưa đặt JWT_SECRET trong backend/.env." >&2
  echo "Tạo một chuỗi ngẫu nhiên bằng lệnh: openssl rand -hex 32" >&2
  exit 1
fi

# Lần chạy đầu tiên: ổ dữ liệu còn trống -> chép dữ liệu ban đầu vào.
if [ ! -f "$DATA_DIR/users.json" ]; then
  echo "Khởi tạo dữ liệu ban đầu vào $DATA_DIR ..."
  cp -R "$SEED_DIR/." "$DATA_DIR/"
fi

# Thư mục chứa file tải lên (tạo nếu thiếu, tránh lỗi khi upload lần đầu).
mkdir -p "$DATA_DIR/chat_uploads" "$DATA_DIR/announcement_uploads" "$DATA_DIR/exam_answer_keys"

if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_google_gemini_api_key_here" ]; then
  echo "Lưu ý: chưa có GEMINI_API_KEY - các tính năng AI sẽ không hoạt động, phần còn lại vẫn chạy bình thường."
fi

exec "$@"
