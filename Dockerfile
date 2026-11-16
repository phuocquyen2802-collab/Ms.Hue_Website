# MathInsight AI - 1 container chạy cả backend (API) lẫn giao diện đã build.
# Backend (backend/src/app.js) tự phục vụ thư mục frontend/dist, nên chỉ
# cần mở 1 cổng duy nhất.

# ---------- Bước 1: build giao diện React/Vite ----------
FROM node:24-bookworm-slim AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
# Giao diện và API chạy chung 1 địa chỉ, nên gọi API bằng đường dẫn tương
# đối "/api" (mặc định trong code là http://localhost:5000/api - chỉ đúng
# khi chạy trên máy cá nhân).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


# ---------- Bước 2: máy chủ chạy thật ----------
FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    PORT=5000 \
    TZ=Asia/Ho_Chi_Minh \
    LIBREOFFICE_PATH=/usr/bin/soffice

# LibreOffice (bản không giao diện): Draw đổi ảnh công thức WMF sang PNG/SVG,
# Writer đổi file đáp án Word sang PDF để xem trước.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libreoffice-writer-nogui \
      libreoffice-draw-nogui \
      fonts-liberation2 \
      fonts-urw-base35 \
      fonts-dejavu-core \
      fontconfig \
      tzdata \
 && rm -rf /var/lib/apt/lists/*

# Font bổ sung (tuỳ chọn): file .ttf/.otf đặt trong docker/fonts/ trước khi
# build sẽ được cài vào máy chủ - xem docker/fonts/README.md.
# fonts-liberation2 thay Times New Roman, fonts-urw-base35 (P052) thay
# Palatino Linotype cùng độ rộng chữ - xem docker/fontconfig/.
COPY docker/fonts/ /usr/share/fonts/truetype/mathinsight/
COPY docker/fontconfig/30-mathinsight-aliases.conf /etc/fonts/conf.d/30-mathinsight-aliases.conf
RUN fc-cache -f

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY backend/src ./src
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Dữ liệu ban đầu (tài khoản admin, đề mẫu...) - chỉ chép sang ổ dữ liệu ở
# lần chạy đầu tiên, các lần sau giữ nguyên dữ liệu đang có.
COPY data/ /app/data-seed/

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
 && chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/data \
 && chown -R node:node /app/data /app/data-seed

USER node
VOLUME ["/app/data"]
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "src/server.js"]
