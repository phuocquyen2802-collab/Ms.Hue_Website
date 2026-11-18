import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import GameHistoryPanel from '../components/GameHistory';

// Lịch sử chơi "Đường đua Toán học" của học sinh: mỗi lượt chơi xong được máy
// chủ tự lưu lại (bỏ dở giữa chừng thì không tính).
export default function StudentGameHistoryPage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/student/games/history')
      .then(({ data }) => setItems(data.items || []))
      .catch((err) => setError(err.response?.data?.message || 'Không tải được lịch sử chơi'));
  }, []);

  const empty = (
    <div className="empty-state">
      <div className="empty-state-icon is-svg"><UiIcon name="history" size={24} /></div>
      <div className="empty-state-title">Chưa có lượt chơi nào</div>
      <p className="empty-state-desc">Chơi xong một lượt, kết quả sẽ được lưu ở đây.</p>
      <Link to="/student/games" className="btn" style={{ marginTop: 12 }}>
        <UiIcon name="play" size={16} /> Chơi ngay
      </Link>
    </div>
  );

  return (
    <div className="container game-page">
      <div className="page-back">
        <Link to="/student/games" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Trò chơi
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Lịch sử chơi</h1>
          <p className="page-subtitle">Kết quả các lượt chơi Đường đua Toán học của bạn</p>
        </div>
      </div>

      <div className="card">
        {error ? (
          <div className="notice is-danger"><UiIcon name="alert" size={18} /><div className="notice-body">{error}</div></div>
        ) : items === null ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
            <div className="empty-state-title">Đang tải lịch sử chơi…</div>
          </div>
        ) : (
          <GameHistoryPanel items={items} detailPath={(id) => `/student/games/history/${id}`} empty={empty} />
        )}
      </div>
    </div>
  );
}
