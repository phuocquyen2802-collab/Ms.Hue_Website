export default function WeakTopicsChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '28px 16px' }}>
        <div className="empty-state-icon">📊</div>
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
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {topicList.map((item, idx) => {
          const percent = item.wrongPercent;
          let statusColor = '#ef4444';
          let statusBg = 'rgba(239, 68, 68, 0.08)';
          let statusBorder = 'rgba(239, 68, 68, 0.25)';
          let statusText = 'Yếu - Cần ôn gấp';
          let barGradient = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)';

          if (percent < 30) {
            statusColor = '#10b981';
            statusBg = 'rgba(16, 185, 129, 0.08)';
            statusBorder = 'rgba(16, 185, 129, 0.25)';
            statusText = 'Nắm vững kiến thức';
            barGradient = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)';
          } else if (percent < 50) {
            statusColor = '#d97706';
            statusBg = 'rgba(245, 158, 11, 0.08)';
            statusBorder = 'rgba(245, 158, 11, 0.25)';
            statusText = 'Cần luyện tập thêm';
            barGradient = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)';
          }

          return (
            <div
              key={item.tag || idx}
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-light, #e2e8f0)',
                borderRadius: 10,
                padding: '12px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              }}
            >
              {/* Header info */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-main)' }}>
                    {item.tag}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      background: statusBg,
                      color: statusColor,
                      border: `1px solid ${statusBorder}`,
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11.5,
                      fontWeight: 600,
                    }}
                  >
                    {statusText}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: statusColor, minWidth: 42, textAlign: 'right' }}>
                    {percent}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: '100%',
                  height: 8,
                  background: '#f1f5f9',
                  borderRadius: 6,
                  overflow: 'hidden',
                  margin: '6px 0',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(3, percent))}%`,
                    background: barGradient,
                    borderRadius: 6,
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>

              {/* Sub info */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--text-muted)',
                }}
              >
                <span>
                  Số câu sai: <strong style={{ color: 'var(--danger)' }}>{item.totalWrong}</strong> /{' '}
                  <strong>{item.totalAnswered}</strong> câu đã làm
                </span>
                {item.studentCount !== undefined && (
                  <span>
                    Kiểm tra trên <strong>{item.studentCount}</strong> học sinh
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
