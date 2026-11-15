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

export default api;
