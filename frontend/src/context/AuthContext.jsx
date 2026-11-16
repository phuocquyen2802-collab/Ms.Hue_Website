import { createContext, useContext, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// Quản lý trạng thái đăng nhập toàn cục (user + token), lưu vào localStorage
// để giữ đăng nhập khi tải lại trang.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    await api.post('/auth/register', payload);
  }

  async function logout() {
    try {
      await api.post('/chat/offline');
    } catch {
      // Bỏ qua nếu token đã hết hạn hoặc lỗi mạng
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
