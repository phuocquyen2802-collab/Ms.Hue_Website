import UiIcon from './UiIcon';

// Nhãn "đã gửi" của 1 lộ trình: AI tự gửi (đề bật chế độ tự động) hoặc giáo
// viên đã duyệt.
export function RoadmapSentPill({ roadmap }) {
  if (!roadmap?.reviewedAt) return null;
  const date = new Date(roadmap.reviewedAt).toLocaleDateString('vi-VN');
  return (
    <span className="status-pill approved">
      <UiIcon name={roadmap.autoApproved ? 'sparkles' : 'check'} size={13} />
      {roadmap.autoApproved ? `AI gửi ngày ${date}` : `Giáo viên đã duyệt ${date}`}
    </span>
  );
}

// Trạng thái "AI đang soạn lộ trình" cho học sinh (ngay sau khi nộp bài với đề
// bật chế độ AI tự gửi). Trang gọi sẽ tự tải lại để hiện lộ trình khi xong.
export function RoadmapGeneratingState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon is-svg">
        <span className="spinner" style={{ width: 22, height: 22 }} />
      </div>
      <div className="empty-state-title">AI đang soạn lộ trình ôn tập cho bạn</div>
      <p className="empty-state-desc">
        AI đang phân tích các câu sai để chỉ ra lỗ hổng kiến thức. Lộ trình sẽ tự hiện ở đây và bạn sẽ nhận
        thông báo khi xong.
      </p>
      <p className="empty-state-desc ai-eta">
        <UiIcon name="clock" size={14} />Quá trình này mất 1 - 3 phút để AI nhận xét.
      </p>
    </div>
  );
}
