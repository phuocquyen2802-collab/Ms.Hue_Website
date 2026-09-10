import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';

// Chặn truy cập nếu chưa đăng nhập hoặc sai role, đồng thời bọc nội dung
// trong Layout (sidebar trái) cho mọi trang đã đăng nhập.
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return <Layout>{children}</Layout>;
}
