import { useEffect, useState } from 'react';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';

// Nhóm các câu hỏi AI sinh theo đúng chuyên đề trong lộ trình (tái sử dụng
// cho cả khối xem trước trên trang và khối xuất PDF, tránh lặp code).
function buildTopicGroups(p) {
  const stepTopics = (p.roadmap?.steps || []).map((s) => s.tag || s.title).filter(Boolean);
  const topicMap = new Map();
  p.exercises.forEach((ex, origIdx) => {
    const topic = (ex.tags && ex.tags.length > 0 && ex.tags[0]) || 'Chuyên đề ôn tập bổ trợ';
    if (!topicMap.has(topic)) topicMap.set(topic, []);
    topicMap.get(topic).push({ ...ex, origIdx });
  });
  const groups = [];
  stepTopics.forEach((t) => {
    if (topicMap.has(t)) {
      groups.push({ topic: t, items: topicMap.get(t) });
      topicMap.delete(t);
    }
  });
  for (const [topic, items] of topicMap.entries()) {
    groups.push({ topic, items });
  }
  return groups;
}

function ExerciseGroups({ proposal }) {
  const groups = buildTopicGroups(proposal);
  return groups.map((grp, gIdx) => (
    <div key={gIdx} style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--line)', padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--purple-text)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ background: 'var(--purple-bg)', padding: '2px 8px', borderRadius: 4, fontSize: 11.5 }}>
          Chủ đề {gIdx + 1}
        </span>
        <span>{grp.topic} ({grp.items.length} câu)</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grp.items.map((ex, qIdx) => (
          <div key={qIdx} style={{ padding: 10, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--bg-subtle)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--purple-text)', marginRight: 6 }}>Câu {qIdx + 1}:</strong>
              <span dangerouslySetInnerHTML={{ __html: renderMath(ex.content) }} />
            </div>
            <QuestionDiagram diagram={ex.diagram} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ex.options.map((opt) => (
                <div
                  key={opt.key}
                  className={`option-row ${opt.key === ex.correctAnswer ? 'correct' : ''}`}
                  style={{
                    margin: 0,
                    padding: '8px 14px',
                    fontSize: 13,
                    width: '100%',
                    minHeight: 40,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ minWidth: 24, color: opt.key === ex.correctAnswer ? 'var(--success-text)' : 'var(--ink-2)' }}>
                    {opt.key}.
                  </strong>{' '}
                  <span style={{ flex: 1, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                  {opt.key === ex.correctAnswer && (
                    <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 11.5, color: 'var(--success-text)' }}>
                      ✓ Đúng
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ));
}

export default function GeneratedExercisesListPage() {
  const [proposals, setProposals] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRejectProposal, setSelectedRejectProposal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [printProposal, setPrintProposal] = useState(null);

  // In PDF: trình duyệt tự "In > Lưu dưới dạng PDF" - không cần thư viện nào,
  // luôn khớp CHÍNH XÁC với công thức/hình vẽ đã render trên trang (không
  // phải render lại bằng công cụ khác nên không rủi ro lệch định dạng.
  useEffect(() => {
    if (!printProposal) return;
    const timer = setTimeout(() => window.print(), 150);
    const onAfterPrint = () => setPrintProposal(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printProposal]);

  async function loadData() {
    setLoading(true);
    try {
      const [proposalsRes, studentsRes] = await Promise.all([
        api.get('/teacher/generated-exercises', { params: { status: 'pending_review' } }),
        api.get('/teacher/students'),
      ]);
      setProposals(proposalsRes.data);
      setStudents(studentsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function getStudent(id) {
    return students.find((s) => s.id === id);
  }

  async function handleApprove(id) {
    await api.put(`/teacher/generated-exercises/${id}/approve`);
    window.dispatchEvent(new Event('app:refresh-notifications'));
    loadData();
  }

  async function handleDeleteAndExit() {
    if (!selectedRejectProposal) return;
    setActionLoading(true);
    try {
      await api.delete(`/teacher/generated-exercises/${selectedRejectProposal.id}`);
      setSelectedRejectProposal(null);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi xóa bản đề xuất');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteAndRegenerate() {
    if (!selectedRejectProposal) return;
    setActionLoading(true);
    try {
      if (selectedRejectProposal.sourceSubmissionId) {
        await api.post(`/teacher/submissions/${selectedRejectProposal.sourceSubmissionId}/generate-roadmap`, { force: true });
      } else {
        await api.delete(`/teacher/generated-exercises/${selectedRejectProposal.id}`);
      }
      setSelectedRejectProposal(null);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi sinh lại đề xuất');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Đề xuất Bài tập AI</h1>
          <p className="page-subtitle">Kiểm duyệt câu hỏi do AI tạo trước khi giao cho học sinh</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Đề xuất đang chờ duyệt ({proposals.length})</h2>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải danh sách...</div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✨</div>
            <div className="empty-state-title">Không có đề xuất nào đang chờ duyệt</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {proposals.map((p) => {
              const student = getStudent(p.studentId);
              return (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 18,
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>Học sinh: {student ? student.name : p.studentId}</strong>
                      {student?.className && (
                        <span className="tag-badge" style={{ marginLeft: 8 }}>
                          Lớp {student.className}
                        </span>
                      )}
                    </div>
                    <span className="status-pill pending_review">Chờ duyệt</span>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chuyên đề:</span>{' '}
                    {p.weakTags.map((t) => (
                      <span className="tag-badge weak" key={t}>
                        🎯 {t}
                      </span>
                    ))}
                  </div>

                  <p
                    style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 12, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: renderMath(p.roadmap.summary) }}
                  />

                  <details
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      marginBottom: 14,
                    }}
                  >
                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--primary)', fontSize: 13.5 }}>
                      🎯 Xem trước {p.exercises.length} câu hỏi AI đã sinh (Phân theo chuyên đề)
                    </summary>
                    <div style={{ marginTop: 12 }}>
                      <ExerciseGroups proposal={p} />
                    </div>
                  </details>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn success sm" onClick={() => handleApprove(p.id)}>
                      ✓ Duyệt & Giao bài
                    </button>
                    <button className="btn outline-danger sm" onClick={() => setSelectedRejectProposal(p)}>
                      ✕ Từ chối
                    </button>
                    <button className="btn sm secondary" onClick={() => setPrintProposal(p)} style={{ marginLeft: 'auto' }}>
                      🖨️ Xuất PDF
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL XỬ LÝ TỪ CHỐI */}
      {selectedRejectProposal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => !actionLoading && setSelectedRejectProposal(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: '24px 28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--danger-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  🗑️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: 'var(--ink)', fontWeight: 800 }}>
                    Xử lý Từ chối đề xuất AI
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                    Lựa chọn cách xử lý bản đề xuất bài tập này
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !actionLoading && setSelectedRejectProposal(null)}
                style={{
                  background: 'var(--bg-subtle)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: 'var(--ink-soft)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 18 }}>
              Bản đề xuất câu hỏi của học sinh chưa đạt chất lượng yêu cầu? Bạn có thể chọn một trong hai hành động:
            </p>

            {/* 2 Lựa chọn Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
              {/* Lựa chọn 1: Xóa bỏ & Thoát */}
              <div
                role="button"
                tabIndex={0}
                onClick={!actionLoading ? handleDeleteAndExit : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  background: 'var(--danger-bg)',
                  border: '1.5px solid var(--danger-border)',
                  borderRadius: 12,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: actionLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!actionLoading) {
                    e.currentTarget.style.borderColor = '#f43f5e';
                    e.currentTarget.style.background = 'var(--danger-bg)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 63, 94, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!actionLoading) {
                    e.currentTarget.style.borderColor = 'var(--danger-border)';
                    e.currentTarget.style.background = 'var(--danger-bg)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  🗑️
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--danger)', marginBottom: 2 }}>
                    1. Xóa bỏ hoàn toàn & Huỷ bản đề xuất này
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--danger-text)', lineHeight: 1.45 }}>
                    Xóa sạch đề xuất cũ khỏi danh sách chờ duyệt, không lưu lại dữ liệu rác.
                  </div>
                </div>
              </div>

              {/* Lựa chọn 2: Xóa cũ & Sinh lại ngay */}
              <div
                role="button"
                tabIndex={0}
                onClick={!actionLoading ? handleDeleteAndRegenerate : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  background: 'var(--purple-bg)',
                  border: '1.5px solid var(--purple-border)',
                  borderRadius: 12,
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: actionLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!actionLoading) {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.background = 'var(--purple-bg)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.18)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!actionLoading) {
                    e.currentTarget.style.borderColor = 'var(--purple-border)';
                    e.currentTarget.style.background = 'var(--purple-bg)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: 'var(--purple-bg)',
                    border: '1px solid var(--purple-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  🔄
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--purple-text)', marginBottom: 2 }}>
                    2. Xóa cũ & Gọi AI sinh lại bản mới ngay
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--purple-text)', lineHeight: 1.45 }}>
                    Huỷ bản cũ và yêu cầu Gemini AI phân tích lại bài làm để tạo bộ đề bài tập mới chuẩn hơn.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setSelectedRejectProposal(null)}
                style={{
                  padding: '9px 18px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: 'var(--ink-2)',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--line)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-subtle)'; }}
              >
                Đóng (Giữ nguyên)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Khối chỉ hiện khi in (window.print) - ẩn hoàn toàn trên màn hình bình
          thường bằng CSS trong index.css (.print-only). Tách riêng khỏi khối
          xem trước bên trên để không bị cắt giữa chừng bởi kích thước cố định
          của <details>/scroll, và không in kèm giao diện quản lý (nút bấm...). */}
      {printProposal && (
        <div className="print-only">
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Bài tập ôn tập bổ trợ - AI sinh</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16 }}>
            Học sinh: {getStudent(printProposal.studentId)?.name || printProposal.studentId}
            {' • '}Chuyên đề trọng tâm: {printProposal.weakTags.join(', ')}
          </p>
          <ExerciseGroups proposal={printProposal} />
        </div>
      )}
    </div>
  );
}
