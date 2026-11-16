import axios from 'axios';

// Base URL của backend - đọc từ biến môi trường VITE_API_URL nếu có,
// mặc định trỏ về backend chạy local ở cổng 5000
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  // Không đặt timeout trước đây khiến 1 request bị treo (VD backend đứng
  // hình lúc gọi LibreOffice chuyển đổi file) làm ĐƠ CỨNG cả nút bấm liên
  // quan vĩnh viễn (await không bao giờ resolve/reject nên finally không
  // bao giờ chạy tới) - đặt giới hạn 90 giây để mọi request luôn có hồi đáp
  // (thành công hoặc lỗi) thay vì treo vô thời hạn.
  timeout: 90000,
});

// Tự động đính kèm JWT token (nếu đã đăng nhập) vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Nếu token hết hạn/không hợp lệ ở các trang được bảo vệ, tự động đăng xuất và quay về trang giới thiệu
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    if (error.response && error.response.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// Gọi API trả về Server-Sent Events (VD trợ lý AI trả lời dần từng đoạn).
// axios không đọc được luồng dữ liệu trong trình duyệt nên dùng fetch.
// onEvent(event, data) được gọi cho từng sự kiện; lỗi HTTP ném ra err.status.
export async function postEventStream(path, body, onEvent, signal) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${api.defaults.baseURL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const error = new Error(`HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

export default api;
