import UiIcon from './UiIcon';

// Tỉ lệ làm sai theo từng chuyên đề: dưới 30% "nắm vững", 30-50% "cần luyện
// thêm", từ 50% "cần ôn gấp". Dùng chung cho trang giáo viên và học sinh.
function levelOf(wrongPercent) {
  if (wrongPercent < 30) return { key: 'good', label: 'Nắm vững' };
  if (wrongPercent < 50) return { key: 'ok', label: 'Cần luyện thêm' };
  return { key: 'low', label: 'Cần ôn gấp' };
}

export default function WeakTopicsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon is-svg"><UiIcon name="chart" size={22} /></div>
        <div className="empty-state-title">Chưa có dữ liệu thống kê chuyên đề</div>
      </div>
    );
  }

  const topicList = data.map((d) => ({
    tag: d.tag,
    wrongPercent: Math.round((d.wrongRate !== undefined ? d.wrongRate : 0) * 100),
    totalAnswered: d.totalAnswered || 0,
    totalWrong: d.totalWrong || 0,
    studentCount: d.studentCount,
  }));

  return (
    <ul className="topic-list">
      {topicList.map((item, idx) => {
        const level = levelOf(item.wrongPercent);
        return (
          <li key={item.tag || idx} className="topic-row">
            <div className="topic-row-head">
              <span className="topic-name">{item.tag}</span>
              <span className={`topic-level is-${level.key}`}>{level.label}</span>
              <span className={`topic-percent score-text is-${level.key}`}>Sai {item.wrongPercent}%</span>
            </div>
            <div className="score-bar" aria-hidden="true">
              <span className={`is-${level.key}`} style={{ width: `${Math.min(100, Math.max(2, item.wrongPercent))}%` }} />
            </div>
            <div className="meta-row">
              <span>Sai {item.totalWrong}/{item.totalAnswered} câu đã làm</span>
              {item.studentCount !== undefined && <span>Trên {item.studentCount} học sinh</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
