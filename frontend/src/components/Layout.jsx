import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import ChatWidget from './ChatWidget';

// Khung layout chung cho các trang sau khi đăng nhập: sidebar cố định bên
// trái + nội dung cuộn riêng bên phải + chuông thông báo góc trên phải + khung chat & trạng thái online góc dưới phải.
export default function Layout({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <NotificationBell />
      <ChatWidget />
      <div className="main-content">{children}</div>
    </div>
  );
}
