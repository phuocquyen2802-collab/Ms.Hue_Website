import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';
import { renderMath } from '../utils/mathRender';

export default function StudentWeakTopicsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const subIdFromUrl = searchParams.get('submissionId');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(subIdFromUrl || '');

  useEffect(() => {
    api
      .get('/student/me/weak-topics')
      .then((res) => {
        setData(res.data);
        const subs = res.data?.submissions || [];
        if (subs.length > 0) {
          const match = subIdFromUrl ? subs.find((s) => s.id === subIdFromUrl) : null;
          setSelectedSubmissionId(match ? match.id : subs[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, [subIdFromUrl]);

  const submissions = useMemo(() => data?.submissions || [], [data]);

  const activeSubmission = useMemo(() => {
    if (submissions.length === 0) return null;
    return submissions.find((s) => s.id === selectedSubmissionId) || submissions[0];
  }, [submissions, selectedSubmissionId]);

  const displayedTopicStats = useMemo(() => {
    if (activeSubmission && activeSubmission.topicStats) {
      return activeSubmission.topicStats;
    }
    return data?.allTopicStats || [];
  }, [activeSubmission, data]);

  const displayedWeakTags = useMemo(() => {
    if (activeSubmission && activeSubmission.weakTopics) {
      return activeSubmission.weakTopics.map((wt) => ({
        tag: wt.tag,
        wrongRate: wt.wrongRate,
        totalWrong: wt.totalWrong,
        totalAnswered: wt.totalAnswered,
      }));
    }
    return data?.weakTags || [];
  }, [activeSubmission, data]);

  // Xác định lộ trình AI phù hợp CHỈ của riêng đợt làm bài đang chọn
  const activeRoadmap = useMemo(() => {
    return activeSubmission?.roadmap || null;
  }, [activeSubmission]);

  const activeRoadmapStatus = useMemo(() => {
    return activeSubmission?.roadmapStatus || 'none';
  }, [activeSubmission]);

  const handleSelectSubmission = (id) => {
    setSelectedSubmissionId(id);
    setSearchParams({ submissionId: id });
  };

  if (loading || !data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải thống kê điểm yếu & lộ trình...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1040, paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Kết quả của tôi</h1>
          <p className="page-subtitle">
            Nhận xét chi tiết và lộ trình cải thiện
          </p>
        </div>
      </div>

      {/* Selector: Lọc theo Đề thi / Đợt làm */}
      {submissions.length > 0 ? (
        <div
          className="card"
          style={{
            padding: '12px 18px',
            marginBottom: 20,
            borderRadius: 12,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                📑 Lọc theo:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {submissions.map((s) => {
                const isSelected = activeSubmission?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSubmission(s.id)}
                    style={{
                      border: 'none',
                      borderRadius: 20,
                      padding: '6px 14px',
                      fontSize: 12.5,
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: isSelected
                        ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                        : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#475569',
                      boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                    }}
                  >
                    📝 {s.examTitle} (Lần {s.attempt})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">📖</div>
            <div className="empty-state-title">Chưa có bài thi nào được nộp</div>
            <p className="empty-state-desc">Hãy làm bài thi trong luyện đề</p>
          </div>
        </div>
      )}

      {/* Điểm yếu cảnh báo */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title-group">
            <h2 style={{ margin: 0, fontSize: 16 }}>
              🎯 Chủ đề cần chú ý {activeSubmission ? `(${activeSubmission.examTitle} - Lần ${activeSubmission.attempt})` : ''}
            </h2>
          </div>
        </div>

        {displayedWeakTags.length === 0 ? (
          <div className="alert-banner success" style={{ margin: 0 }}>
            <span>🎉</span>
            <div>
              <strong>Tuyệt vời!</strong> Bạn đã nắm vững kiến thức.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {displayedWeakTags.map((t) => (
              <span className="tag-badge weak" key={t.tag} style={{ fontSize: 13, padding: '8px 16px' }}>
                ⚠️ {t.tag} ({Math.round(t.wrongRate * 100)}% sai - {t.totalWrong}/{t.totalAnswered} câu)
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Biểu đồ phân tích chuyên đề */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div className="card-title-group">
            <h2 style={{ margin: 0, fontSize: 16 }}>
              📊 Thống kê theo chuyên đề {activeSubmission ? `(${activeSubmission.examTitle})` : ''}
            </h2>
          </div>
        </div>
        <WeakTopicsChart data={displayedTopicStats} />
      </div>

      {/* Lộ trình ôn tập AI */}
      <div className="card" style={{ borderRadius: 12 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div className="card-title-group">
            <h2 style={{ fontSize: 17, margin: 0 }}>
              ✨ Lộ trình ôn tập AI {activeSubmission ? `(${activeSubmission.examTitle} - Lần ${activeSubmission.attempt})` : ''}
            </h2>

          </div>
          {activeRoadmap && activeRoadmap.reviewedAt && (
            <span
              style={{
                fontSize: 12,
                background: 'rgba(16,185,129,0.1)',
                color: 'var(--success)',
                border: '1px solid rgba(16,185,129,0.25)',
                padding: '4px 10px',
                borderRadius: 6,
                fontWeight: 700,
              }}
            >
              ✓ Giáo viên đã duyệt ({new Date(activeRoadmap.reviewedAt).toLocaleDateString('vi-VN')})
            </span>
          )}
        </div>

        {activeRoadmap ? (
          <div>
            {/* Weak tags */}
            {activeRoadmap.weakTags && activeRoadmap.weakTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Chủ đề trọng tâm cần ôn:</span>
                {activeRoadmap.weakTags.map((tag) => (
                  <span className="tag-badge weak" key={tag}>
                    🎯 {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Summary */}
            {activeRoadmap.roadmap?.summary && (
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-main)',
                  marginBottom: 18,
                  lineHeight: 1.75,
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
                  padding: '16px 20px',
                  borderRadius: 10,
                  border: '1px solid #bfdbfe',
                }}
                dangerouslySetInnerHTML={{ __html: renderMath(activeRoadmap.roadmap.summary) }}
              />
            )}

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activeRoadmap.roadmap?.steps?.map((s) => (
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

            {/* Nút Làm lại đề thi */}
            {activeSubmission?.examId && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <Link
                  to={`/student/exams/${activeSubmission.examId}`}
                  className="btn"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: 700,
                    borderRadius: 10,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    border: 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>🔄 Làm lại đề thi này</span>
                  <span style={{ fontSize: 16 }}>➔</span>
                </Link>
              </div>
            )}
          </div>
        ) : activeRoadmapStatus === 'pending_review' ? (
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title" style={{ fontSize: 16 }}>
              Lộ trình đang chờ Giáo viên phê duyệt
            </div>
            <p className="empty-state-desc">
              Hệ thống AI đã chuẩn đoán điểm yếu của bài thi và gửi cho giáo viên xem xét. Lộ trình chi tiết sẽ hiển thị ngay khi được giáo viên phê duyệt.
            </p>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-state-icon">💡</div>
            <div className="empty-state-title" style={{ fontSize: 16 }}>
              Chưa có lộ trình AI riêng
            </div>
            <p className="empty-state-desc">
              Sau khi bạn hoàn thành bài kiểm tra có lỗi sai, giáo viên sẽ phê duyệt lộ trình ôn tập được AI đề xuất cho bạn.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
