import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

// Chặn truy cập nếu chưa đăng nhập hoặc sai role, đồng thời bọc nội dung
// trong Layout (sidebar trái) cho mọi trang đã đăng nhập.
// - Chưa đăng nhập: về trang giới thiệu "/" (từ đó bấm Đăng nhập).
// - Sai vai trò (VD học sinh mở link trang giáo viên): về trang của vai trò đó.
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/student'} replace />;
  }

  return <Layout>{children}</Layout>;
}
