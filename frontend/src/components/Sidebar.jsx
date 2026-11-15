import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';
import { APP_NAME, APP_TAGLINE } from '../config/brand';

// Bộ icon nét (stroke) 24x24 dùng cho menu - thay cho emoji để giao diện
// đồng nhất trên mọi hệ điều hành.
const ICONS = {
  announcements: (
    <>
      <path d="M4 10.5v3a1 1 0 0 0 1 1h2.5L13 19V5L7.5 9.5H5a1 1 0 0 0-1 1Z" />
      <path d="M16.5 9a4.2 4.2 0 0 1 0 6" />
      <path d="M19.2 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18.2 14.3A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  exams: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v2.5H9z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
    </>
  ),
  analytics: (
    <>
      <path d="M3.5 3.5v17h17" />
      <path d="m7.5 15 3.5-4 3 2.5 5-6" />
    </>
  ),
  scores: (
    <>
      <path d="M3 20.5h18" />
      <rect x="5" y="11" width="3.2" height="7" rx="1" />
      <rect x="10.4" y="5" width="3.2" height="13" rx="1" />
      <rect x="15.8" y="13.5" width="3.2" height="4.5" rx="1" />
    </>
  ),
  ai: (
    <>
      <path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7Z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
    </>
  ),
  practice: (
    <>
      <path d="M4 20h4.2L19.3 8.9a2.6 2.6 0 0 0-3.7-3.7L4.5 16.3Z" />
      <path d="m14 6.8 3.7 3.7" />
    </>
  ),
  results: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  roadmap: (
    <>
      <circle cx="6" cy="18.5" r="2.3" />
      <circle cx="18" cy="5.5" r="2.3" />
      <path d="M8.3 18.5H16a3.3 3.3 0 0 0 0-6.6H8a3.3 3.3 0 0 1 0-6.6h7.7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  logout: (
    <>
      <path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" />
      <path d="m9.5 16.5-4.5-4.5 4.5-4.5" />
      <path d="M5 12h10.5" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg
      className="sidebar-icon"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

const TEACHER_MENU = [
  { to: '/announcements', icon: 'announcements', label: 'Thông tin chung' },
  { to: '/teacher', icon: 'students', label: 'Quản lý học sinh', end: true },
  { to: '/teacher/exams', icon: 'exams', label: 'Quản lý bài tập' },
  { to: '/teacher/analytics', icon: 'analytics', label: 'Giám sát chất lượng' },
  { to: '/teacher/score-stats', icon: 'scores', label: 'Thống kê điểm số' },
  { to: '/teacher/ai-assistant', icon: 'ai', label: 'Trợ lý AI Gemini' },
];

const STUDENT_MENU = [
  { to: '/announcements', icon: 'announcements', label: 'Thông tin chung' },
  { to: '/student', icon: 'practice', label: 'Luyện đề', end: true },
  { to: '/student/weak-topics', icon: 'results', label: 'Kết quả của tôi' },
  { to: '/student/roadmaps', icon: 'roadmap', label: 'Lộ trình ôn tập' },
  { to: '/student/ai-assistant', icon: 'ai', label: 'Trợ lý AI - Chatbot' },
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
        <BrandMark size={36} className="sidebar-logo" />
        <div className="sidebar-brand-copy">
          <div className="sidebar-brand-text">{APP_NAME}</div>
          <div className="sidebar-brand-sub">{APP_TAGLINE}</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user-card">
          <div className={`user-avatar ${isTeacher ? 'teacher' : 'student'}`} aria-hidden="true">
            {avatarChar}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user.name}>{user.name}</div>
            <div className="sidebar-user-role">
              {isTeacher ? 'Giáo viên' : (user.className ? `Lớp ${user.className}` : 'Học sinh')}
            </div>
          </div>
        </div>

        <div className="sidebar-actions">
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-action${isActive ? ' active' : ''}`}
            title="Cài đặt tài khoản"
          >
            <Icon name="settings" />
            <span>Cài đặt</span>
          </NavLink>

          <button type="button" className="sidebar-action logout-link" onClick={handleLogout} title="Đăng xuất">
            <Icon name="logout" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
