import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';
import { renderMath } from '../utils/mathRender';

export default function StudentHistoryDetailPage() {
  const { submissionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/student/submissions/${submissionId}`)
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading || !data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải chi tiết đợt làm bài...</div>
        </div>
      </div>
    );
  }

  const currentAttempt = data.attempt || 1;
  const history = data.historySubmissions || [];
  const prevAttemptSub = history.find((h) => (h.attempt || 1) === currentAttempt - 1);
  const scoreDiff = prevAttemptSub ? (data.score - prevAttemptSub.score).toFixed(1) : null;
  const maxScore = history.length > 0 ? Math.max(...history.map((h) => h.score || 0)) : data.score;
  const isBestScore = data.score >= maxScore;

  const roadmap = data.roadmap;
  const roadmapStatus = data.roadmapStatus;

  const accuracy = data.totalQuestions > 0 ? Math.round((data.correctCount / data.totalQuestions) * 100) : 0;
  let scoreColor = 'var(--danger)';
  let scoreBg = 'rgba(239,68,68,0.1)';
  let statusText = 'Cần ôn tập gấp';
  if (data.score >= 8) {
    scoreColor = 'var(--success)';
    scoreBg = 'rgba(16,185,129,0.1)';
    statusText = 'Kết quả xuất sắc';
  } else if (data.score >= 5) {
    scoreColor = '#d97706';
    scoreBg = 'rgba(245,158,11,0.1)';
    statusText = 'Đạt yêu cầu';
  }

  return (
    <div className="container" style={{ maxWidth: 960, paddingBottom: 60 }}>
      {/* Standard Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{data.examTitle || 'Chi Tiết Đợt Làm Bài'}</h1>
          <p className="page-subtitle">
            Kết quả điểm số, phân tích lỗi sai và lộ trình ôn tập AI riêng cho đợt làm này
          </p>
        </div>
        <div className="header-actions">
          <Link to="/student" className="btn-back">
            <span className="btn-back-arrow">←</span> Quay lại Góc Luyện Tập
          </Link>
        </div>
      </div>

      {/* Score Overview Card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: '#e2e8f0',
                  color: '#1e293b',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Đợt làm: Lần {currentAttempt}
              </span>
              {isBestScore && history.length > 1 && (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--success)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  ⭐ Điểm cao nhất của đề
                </span>
              )}
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 600, marginBottom: 4 }}>
              Số câu đúng: <strong style={{ color: 'var(--primary)' }}>{data.correctCount}/{data.totalQuestions} câu ({accuracy}%)</strong>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Thời gian nộp bài: {data.submittedAt ? new Date(data.submittedAt).toLocaleString('vi-VN') : '---'}
            </div>

            {scoreDiff !== null && (
              <div style={{ marginTop: 6, fontSize: 13 }}>
                {parseFloat(scoreDiff) > 0 ? (
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                    🚀 Tăng +{scoreDiff} điểm so với Lần {currentAttempt - 1}
                  </span>
                ) : parseFloat(scoreDiff) < 0 ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    Giảm {scoreDiff} điểm so với Lần {currentAttempt - 1}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>
                    Điểm tương đương Lần {currentAttempt - 1}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Score Badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 24px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              minWidth: 150,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                {data.score}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>/ 10đ</span>
            </div>
            <span
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 700,
                color: scoreColor,
                background: scoreBg,
                padding: '2px 10px',
                borderRadius: 10,
              }}
            >
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Weak Points Diagnosis for this Attempt */}
      <div className="card" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div className="card-header">
          <div className="card-title-group">
            <h2 style={{ fontSize: 17 }}>🎯 Chuẩn đoán điểm yếu & Tỷ lệ làm sai (Lần {currentAttempt})</h2>
            <p className="card-hint">
              Phân tích tỷ lệ làm đúng/sai theo từng chuyên đề xuất hiện trong đề thi
            </p>
          </div>
        </div>

        {/* Warning tags */}
        {data.examWeakTopics && data.examWeakTopics.length > 0 ? (
          <div
            style={{
              marginBottom: 16,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(254,242,242,0.9) 0%, rgba(255,237,237,0.8) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <strong style={{ fontSize: 13, color: '#b91c1c', textTransform: 'uppercase' }}>
                Các chuyên đề bạn cần cải thiện ở lần làm này:
              </strong>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.examWeakTopics.map((wt) => (
                <span
                  key={wt.tag}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger)',
                    fontSize: 12.5,
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: 14,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>📌 {wt.tag}</span>
                  <span style={{ color: '#dc2626', background: 'rgba(239,68,68,0.1)', padding: '1px 6px', borderRadius: 8 }}>
                    Sai {wt.totalWrong}/{wt.totalAnswered} câu ({Math.round(wt.wrongRate * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: 'var(--success-bg)',
              color: 'var(--success-text)',
              border: '1px solid var(--success-border)',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            🎉 Xuất sắc! Bạn đã làm đúng toàn bộ các câu hỏi trong đề thi này!
          </div>
        )}

        {/* Charts & Failure rates */}
        {data.examTopicStats && data.examTopicStats.length > 0 && (
          <WeakTopicsChart data={data.examTopicStats} />
        )}
      </div>

      {/* AI Roadmap for this Specific Attempt */}
      <div className="card" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="card-title-group">
            <h2 style={{ fontSize: 17 }}>✨ Lộ trình ôn tập AI dành riêng cho bài thi này</h2>
            <p className="card-hint">
              Được AI chuẩn đoán dựa trên các lỗi sai của đề thi và giáo viên phê duyệt
            </p>
          </div>
          {roadmap && roadmap.reviewedAt && (
            <span
              style={{
                fontSize: 12.5,
                background: 'rgba(16,185,129,0.1)',
                color: 'var(--success)',
                border: '1px solid rgba(16,185,129,0.2)',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              ✓ Giáo viên đã duyệt ({new Date(roadmap.reviewedAt).toLocaleDateString('vi-VN')})
            </span>
          )}
        </div>

        {roadmap ? (
          <div>
            {/* Weak tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Chủ đề trọng tâm cần ôn:</span>
              {roadmap.weakTags && roadmap.weakTags.map((tag) => (
                <span className="tag-badge weak" key={tag}>
                  🎯 {tag}
                </span>
              ))}
            </div>

            {/* Summary */}
            <p
              style={{
                fontSize: 14.5,
                color: 'var(--text-main)',
                marginBottom: 18,
                lineHeight: 1.75,
                background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                padding: '16px 20px',
                borderRadius: 10,
                border: '1px solid #bfdbfe',
              }}
              dangerouslySetInnerHTML={{ __html: renderMath(roadmap.roadmap?.summary) }}
            />

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {roadmap.roadmap?.steps?.map((s) => (
                <div
                  key={s.order}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '16px 18px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: 'var(--primary)' }}>
                    Bước {s.order}: {s.tag}
                  </div>
                  {s.theory && (
                    <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8, color: '#334155' }}>
                      📘 <strong>Lý thuyết cần nắm:</strong> <span dangerouslySetInnerHTML={{ __html: renderMath(s.theory) }} />
                    </p>
                  )}
                  {s.commonMistake && (
                    <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8, color: '#b91c1c' }}>
                      ⚠️ <strong>Lỗi hay mắc phải:</strong> <span dangerouslySetInnerHTML={{ __html: renderMath(s.commonMistake) }} />
                    </p>
                  )}
                  {s.action && (
                    <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: '#047857' }}>
                      ✅ <strong>Hành động khắc phục:</strong> <span dangerouslySetInnerHTML={{ __html: renderMath(s.action) }} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : roadmapStatus === 'pending_review' ? (
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title" style={{ fontSize: 16 }}>
              Lộ trình đang chờ Giáo viên phê duyệt
            </div>
            <p className="empty-state-desc">
              Hệ thống AI đã chuẩn đoán điểm yếu của bạn và gửi cho giáo viên xem xét. Bạn sẽ thấy lộ trình chi tiết ngay sau khi được duyệt.
            </p>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">💡</div>
            <div className="empty-state-title" style={{ fontSize: 16 }}>
              {data.score === 10 ? '🎉 Bạn đã đạt điểm tuyệt đối!' : 'Chưa có lộ trình riêng cho đợt làm này'}
            </div>
            <p className="empty-state-desc">
              {data.score === 10
                ? 'Không có lỗi sai nào cần khắc phục. Tiếp tục phát huy nhé!'
                : 'Bạn có thể làm lại đề thi hoặc liên hệ giáo viên để nhận hướng dẫn chi tiết.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
