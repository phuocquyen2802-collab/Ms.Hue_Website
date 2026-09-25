import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TEACHER_MENU = [
  { to: '/announcements', icon: '📢', label: 'Thông tin chung' },
  { to: '/teacher', icon: '👥', label: 'Quản lý học sinh', end: true },
  { to: '/teacher/exams', icon: '📝', label: 'Quản lý bài tập' },
  { to: '/teacher/analytics', icon: '📊', label: 'Giám sát chất lượng' },
  { to: '/teacher/ai-assistant', icon: '🤖', label: 'Trợ lý AI Gemini' },
];

const STUDENT_MENU = [
  { to: '/announcements', icon: '📢', label: 'Thông tin chung' },
  { to: '/student', icon: '🏠', label: 'Luyện đề', end: true },
  { to: '/student/weak-topics', icon: '📈', label: 'Kết quả của tôi' },
  { to: '/student/roadmaps', icon: '🗺️', label: 'Lộ trình ôn tập' },
  { to: '/student/ai-assistant', icon: '🤖', label: 'Trợ lý AI - Chatbot' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const isTeacher = user.role === 'teacher';
  const menu = isTeacher ? TEACHER_MENU : STUDENT_MENU;

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const avatarChar = user.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo-icon">∑</div>
        <div>
          <div className="sidebar-brand-text">Ôn Tập Toán 12</div>
          <div className="sidebar-brand-sub">{isTeacher ? 'Giáo Viên' : 'Học Sinh'}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className={`user-avatar ${isTeacher ? 'teacher' : 'student'}`}>
            {avatarChar}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user.name}>{user.name}</div>
            <div className="sidebar-user-role">
              {isTeacher ? 'Giáo viên' : (user.className ? `Lớp ${user.className}` : 'Học sinh')}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            style={{
              padding: '6px 8px',
              fontSize: 12,
              justifyContent: 'center',
              borderRadius: 6,
              border: '1px solid rgba(238, 240, 248, 0.16)',
              background: 'rgba(238, 240, 248, 0.06)',
            }}
            title="Cài đặt tài khoản"
          >
            <span className="sidebar-icon" style={{ fontSize: 13 }}>⚙️</span>
            <span>Cài đặt</span>
          </NavLink>

          <button
            className="logout-link"
            onClick={handleLogout}
            title="Đăng xuất"
            style={{
              padding: '6px 8px',
              fontSize: 12,
              justifyContent: 'center',
              borderRadius: 6,
              border: '1px solid rgba(220, 38, 38, 0.3)',
              background: 'rgba(220, 38, 38, 0.1)',
            }}
          >
            <span>🚪</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
