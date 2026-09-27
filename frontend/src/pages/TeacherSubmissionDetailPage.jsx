import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';

export default function TeacherSubmissionDetailPage() {
  const { examId, submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AI Generation & Editing state
  const [generating, setGenerating] = useState(false);
  // % tiến độ MÔ PHỎNG khi đang chờ Gemini trả lời (backend không có cách
  // báo tiến độ thật giữa chừng vì chỉ có 1 lệnh gọi API duy nhất) - tăng dần
  // theo thời gian, dừng ở 90% cho tới khi có phản hồi thật để tránh cảm
  // giác thanh chạy xong nhưng vẫn phải chờ thêm.
  const [generateProgress, setGenerateProgress] = useState(0);
  const generateProgressTimerRef = useRef(null);
  const [generateError, setGenerateError] = useState('');
  const [includeExercises, setIncludeExercises] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [editSteps, setEditSteps] = useState([]);
  const [editExercises, setEditExercises] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectActionLoading, setRejectActionLoading] = useState(false);

  // Phân nhóm danh sách bài tập theo từng Chuyên đề / Chủ đề
  const groupedExercises = useMemo(() => {
    if (!editExercises || editExercises.length === 0) return [];

    const stepTopics = (editSteps || []).map((s) => s.tag || s.title).filter(Boolean);
    const topicMap = new Map();

    editExercises.forEach((ex, originalIdx) => {
      const topic = (ex.tags && ex.tags.length > 0 && ex.tags[0]) || 'Chuyên đề ôn tập bổ trợ';
      if (!topicMap.has(topic)) {
        topicMap.set(topic, []);
      }
      topicMap.get(topic).push({ ...ex, originalIdx });
    });

    const result = [];
    stepTopics.forEach((t) => {
      if (topicMap.has(t)) {
        result.push({ topic: t, items: topicMap.get(t) });
        topicMap.delete(t);
      }
    });
    for (const [topic, items] of topicMap.entries()) {
      result.push({ topic, items });
    }

    return result;
  }, [editExercises, editSteps]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/exams/${examId}/submissions/${submissionId}`);
      setSubmission(data);
      if (data.proposal) {
        setEditSummary(data.proposal.roadmap?.summary || '');
        setEditSteps(data.proposal.roadmap?.steps ? JSON.parse(JSON.stringify(data.proposal.roadmap.steps)) : []);
        setEditExercises(data.proposal.exercises ? JSON.parse(JSON.stringify(data.proposal.exercises)) : []);
      } else {
        setEditSummary('');
        setEditSteps([]);
        setEditExercises([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Không thể tải chi tiết bài làm của học sinh.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [examId, submissionId]);

  async function handleGenerateAI(force = false) {
    const isForce = force === true;
    setGenerating(true);
    setGenerateProgress(2);
    setGenerateError('');
    setActionMessage('');

    // Tăng % mô phỏng dần đều, chậm lại khi gần tới mốc trần 90% (Gemini
    // sinh lộ trình + phân tích từng câu + bài tập thường mất 15-40 giây) -
    // KHÔNG bao giờ tự chạm 100% ở đây, chỉ set 100% thật khi API trả về.
    clearInterval(generateProgressTimerRef.current);
    generateProgressTimerRef.current = setInterval(() => {
      setGenerateProgress((prev) => {
        if (prev >= 90) return prev;
        const step = prev < 50 ? 6 : prev < 75 ? 3 : 1;
        return Math.min(90, prev + step);
      });
    }, 500);

    try {
      await api.post(`/teacher/submissions/${submissionId}/generate-roadmap`, {
        force: isForce,
        includeExercises: Boolean(includeExercises),
      });
      clearInterval(generateProgressTimerRef.current);
      setGenerateProgress(100);
      await loadData();
      setIsEditing(false);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      setActionMessage('✓ Gemini AI đã phân tích lỗi sai và tạo lộ trình ôn tập thành công!');
    } catch (err) {
      console.error(err);
      setGenerateError(err.response?.data?.message || 'Lỗi khi gọi Gemini AI.');
    } finally {
      clearInterval(generateProgressTimerRef.current);
      setGenerating(false);
      setTimeout(() => setGenerateProgress(0), 600);
    }
  }

  // Lựa chọn 1: Xóa bỏ hoàn toàn bản AI này và thoát
  async function handleDeleteAndExit() {
    if (!submission?.proposal) return;
    setRejectActionLoading(true);
    try {
      await api.delete(`/teacher/generated-exercises/${submission.proposal.id}`);
      setShowRejectModal(false);
      await loadData();
      window.dispatchEvent(new Event('app:refresh-notifications'));
      setActionMessage('✓ Đã xóa và huỷ bản đề xuất AI này khỏi hệ thống.');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi xóa bản đề xuất');
    } finally {
      setRejectActionLoading(false);
    }
  }

  // Lựa chọn 2: Xóa cũ và gọi Gemini AI sinh lại bản mới ngay
  async function handleDeleteAndRegenerate() {
    setShowRejectModal(false);
    await handleGenerateAI(true);
  }

  function handleStepChange(idx, field, value) {
    const updated = [...editSteps];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditSteps(updated);
  }

  function handleAddStep() {
    const newOrder = editSteps.length + 1;
    setEditSteps([
      ...editSteps,
      {
        order: newOrder,
        tag: 'Chủ đề ôn tập mới',
        theory: '',
        commonMistake: '',
        action: '',
      },
    ]);
  }

  function handleRemoveStep(idx) {
    const updated = editSteps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    setEditSteps(updated);
  }

  function handleExerciseChange(idx, field, value) {
    const updated = [...editExercises];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditExercises(updated);
  }

  function handleOptionChange(qIdx, optKey, value) {
    const updated = [...editExercises];
    const q = { ...updated[qIdx] };
    q.options = q.options.map((opt) => (opt.key === optKey ? { ...opt, text: value } : opt));
    updated[qIdx] = q;
    setEditExercises(updated);
  }

  function handleRemoveExercise(idx) {
    const updated = editExercises.filter((_, i) => i !== idx);
    setEditExercises(updated);
  }

  function handleAddExercise(topic = 'Chuyên đề ôn tập bổ trợ') {
    const newEx = {
      content: 'Nội dung câu hỏi mới: ...',
      options: [
        { key: 'A', text: '' },
        { key: 'B', text: '' },
        { key: 'C', text: '' },
        { key: 'D', text: '' },
      ],
      correctAnswer: 'A',
      tags: [topic],
    };
    setEditExercises([...editExercises, newEx]);
  }

  async function handleApprove(proposalId) {
    setReviewing(true);
    setActionMessage('');
    try {
      const payload = {
        includeExercises,
        roadmap: {
          summary: editSummary,
          steps: editSteps,
        },
        exercises: editExercises,
      };
      await api.put(`/teacher/generated-exercises/${proposalId}/approve`, payload);
      await loadData();
      setIsEditing(false);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      setActionMessage('✓ Đã phê duyệt và gửi lộ trình ôn tập / bài tập đến học sinh thành công!');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Lỗi khi phê duyệt');
    } finally {
      setReviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải bài làm của học sinh...</div>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container">
        <div className="card">
          <p className="error-text">⚠️ {error || 'Không tìm thấy bài nộp'}</p>
          <Link to="/teacher/analytics" className="btn-back" style={{ marginTop: 12 }}>
            <span className="btn-back-arrow">←</span> Quay lại Giám sát chất lượng học sinh
          </Link>
        </div>
      </div>
    );
  }

  const initial = submission.studentName ? submission.studentName.trim().charAt(0).toUpperCase() : 'H';
  const percentage = Math.round((submission.correctCount / submission.totalQuestions) * 100);
  const proposal = submission.proposal;

  return (
    <div className="container" style={{ maxWidth: 1120, paddingBottom: 60 }}>
      {/* Quay lại */}
      <div style={{ marginBottom: 16 }}>
        <Link to="/teacher/analytics" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Giám sát chất lượng học sinh
        </Link>
      </div>

      {/* Thông tin học sinh & Điểm số */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {initial}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {submission.studentName}
                </h1>
                <span className="tag-badge" style={{ margin: 0 }}>
                  {submission.studentClassName ? `Lớp ${submission.studentClassName}` : 'Chưa phân lớp'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Đề thi: <strong>{submission.examTitle}</strong> • Nộp lúc: {new Date(submission.submittedAt).toLocaleString('vi-VN')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: submission.score >= 5 ? 'var(--success)' : 'var(--danger)' }}>
                {submission.score} / 10 điểm
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Đúng {submission.correctCount}/{submission.totalQuestions} câu ({percentage}%)
              </div>
            </div>
          </div>
        </div>

        {/* Tiến trình làm bài qua các đợt */}
        {submission.historySubmissions && submission.historySubmissions.length > 1 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                📈 Tiến trình làm lại của học sinh ({submission.historySubmissions.length} đợt làm):
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Lần 1 ({submission.historySubmissions[0].score}đ) ➔ Mới nhất ({submission.historySubmissions[submission.historySubmissions.length - 1].score}đ)
                {submission.historySubmissions[submission.historySubmissions.length - 1].score > submission.historySubmissions[0].score && (
                  <strong style={{ color: 'var(--success)', marginLeft: 6 }}>
                    (+{(submission.historySubmissions[submission.historySubmissions.length - 1].score - submission.historySubmissions[0].score).toFixed(1)}đ 🚀)
                  </strong>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', overflowX: 'auto', padding: '4px 0' }}>
              {submission.historySubmissions.map((h, idx) => {
                const isCurrent = h.id === submission.id;
                return (
                  <div key={h.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link
                      to={`/teacher/exams/${examId}/submissions/${h.id}`}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: isCurrent ? 'rgba(37,99,235,0.1)' : '#f8fafc',
                        border: isCurrent ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                        textDecoration: 'none',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: isCurrent ? 'var(--primary)' : 'var(--text-main)' }}>
                        Lần {h.attempt || idx + 1} {isCurrent && '(Đang xem)'}:
                      </span>
                      <strong style={{ color: h.score >= 5 ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
                        {h.score}đ
                      </strong>
                    </Link>
                    {idx < submission.historySubmissions.length - 1 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>➔</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chuyên đề bị yếu */}
        {submission.weakTags && submission.weakTags.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
              🎯 Các chuyên đề học sinh làm sai nhiều trong bài này:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {submission.weakTags.map((wt) => (
                <span key={wt.tag} className="tag-badge weak" style={{ fontSize: 13, padding: '5px 12px' }}>
                  ⚠️ {wt.tag} ({Math.round(wt.wrongRate * 100)}% sai)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Khối Gemini AI: Nhận xét & Sinh bài tập */}
      <div className="card" style={{ border: '2px solid #ddd6fe', background: '#faf5ff' }}>
        <div className="card-header" style={{ borderBottom: '1px solid #ede9fe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <h2 style={{ color: '#5b21b6', margin: 0 }}>Nhận xét tự động & Giao thêm bài tập bằng AI</h2>
          </div>
        </div>

        {generateError && <p className="error-text" style={{ marginTop: 12 }}>⚠️ {generateError}</p>}
        {actionMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--success-bg)',
              color: 'var(--success-text)',
              fontWeight: 600,
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {actionMessage}
          </div>
        )}

        {!proposal ? (
          <div
            style={{
              padding: '24px 20px',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1.5px dashed #c4b5fd',
              marginTop: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 32 }}>✨</div>
            <div>
              <h3 style={{ margin: 0, color: '#5b21b6', fontSize: 16, fontWeight: 800 }}>
                Chưa có nhận xét & lộ trình ôn tập AI cho bài nộp này
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, maxWidth: 600 }}>
                Bấm nút bên dưới để Gemini AI tự động phân tích các câu làm sai của <strong>{submission.studentName}</strong>,
                chỉ ra lý thuyết cần củng cố và sinh bộ câu hỏi bài tập tương tự.
              </p>
            </div>

            <div
              style={{
                background: '#f5f3ff',
                padding: '10px 18px',
                borderRadius: 8,
                border: '1px solid #ddd6fe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <input
                type="checkbox"
                id="includeExPre"
                checked={includeExercises}
                onChange={(e) => setIncludeExercises(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="includeExPre" style={{ fontSize: 14, fontWeight: 700, color: '#5b21b6', cursor: 'pointer' }}>
                Gửi kèm bài tập ôn luyện do AI tạo cho học sinh
              </label>
            </div>

            <button
              className="btn"
              onClick={() => handleGenerateAI(false)}
              disabled={generating}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                color: '#fff',
                padding: '12px 28px',
                fontSize: 15,
                fontWeight: 800,
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
              }}
            >
              {generating ? `⏳ Gemini AI đang phân tích lỗi sai & sinh đề... ${generateProgress}%` : '✨ Bắt đầu Phân tích lỗi sai bằng Gemini AI'}
            </button>

            {generating && (
              <div style={{ width: '100%', maxWidth: 360, height: 8, background: '#ede9fe', borderRadius: 20, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${generateProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #7c3aed, #6366f1)',
                    borderRadius: 20,
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Nhận xét học lực */}
            <div style={{ background: '#ffffff', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid #ddd6fe', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <strong style={{ fontSize: 15, color: '#5b21b6' }}>📝 Nhận xét & Lộ trình ôn tập:</strong>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {proposal.status === 'pending_review' && (
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        color: isEditing ? '#6d28d9' : '#475569',
                        background: isEditing ? '#ede9fe' : '#f8fafc',
                        border: isEditing ? '1.5px solid #8b5cf6' : '1px solid #cbd5e1',
                        padding: '5px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isEditing ? '0 2px 8px rgba(139, 92, 246, 0.2)' : 'none',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isEditing}
                        onChange={(e) => setIsEditing(e.target.checked)}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <span>✏️ Chỉnh sửa nội dung trước khi gửi</span>
                    </label>
                  )}

                  <span className={`status-pill ${proposal.status}`}>
                    {proposal.status === 'approved' ? '✓ Đã duyệt & Giao bài' : proposal.status === 'rejected' ? '✕ Đã từ chối' : '⏳ Chờ giáo viên duyệt'}
                  </span>
                </div>
              </div>

              {isEditing ? (
                <div style={{ marginBottom: 16, background: '#faf5ff', padding: 14, borderRadius: 8, border: '1px dashed #c4b5fd' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#5b21b6', marginBottom: 6 }}>
                    💬 Lời nhắn / Nhận xét tổng quan của giáo viên:
                  </label>
                  <textarea
                    rows={4}
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="Nhập lời nhận xét và động viên cho học sinh..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      borderRadius: 6,
                      border: '1.5px solid #a78bfa',
                      background: '#ffffff',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--text-main)',
                    lineHeight: 1.7,
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMath(proposal.roadmap.summary) }}
                />
              )}

              {/* Các bước lộ trình */}
              {isEditing ? (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#5b21b6' }}>
                    Chỉnh sửa các bước ôn tập chi tiết:
                  </div>
                  {editSteps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #ddd6fe',
                        borderRadius: 8,
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13.5, color: '#5b21b6' }}>Bước {idx + 1}</strong>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="btn sm outline-danger"
                          style={{ padding: '2px 8px', fontSize: 11 }}
                        >
                          ✕ Xóa bước này
                        </button>
                      </div>

                      <div className="form-row">
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                            Tên chuyên đề / Chủ đề:
                          </label>
                          <input
                            type="text"
                            value={step.tag || step.title || ''}
                            onChange={(e) => handleStepChange(idx, 'tag', e.target.value)}
                            placeholder="Ví dụ: Đạo hàm, Cực trị..."
                            style={{ padding: '6px 10px', fontSize: 13 }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 4 }}>
                          📘 Lý thuyết & Công thức trọng tâm:
                        </label>
                        <div className="formula-edit-box" style={{ minHeight: 60 }}>
                          <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.theory) }} />
                          <textarea
                            rows={2}
                            value={step.theory || ''}
                            onChange={(e) => handleStepChange(idx, 'theory', e.target.value)}
                            placeholder="Tóm tắt công thức trọng tâm..."
                            className="formula-edit-box-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 4 }}>
                          ⚠️ Bẫy trắc nghiệm / Lỗi sai hay gặp:
                        </label>
                        <div className="formula-edit-box" style={{ minHeight: 60 }}>
                          <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.commonMistake) }} />
                          <textarea
                            rows={2}
                            value={step.commonMistake || ''}
                            onChange={(e) => handleStepChange(idx, 'commonMistake', e.target.value)}
                            placeholder="Chỉ ra các bẫy hoặc lỗi học sinh hay mắc..."
                            className="formula-edit-box-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#047857', marginBottom: 4 }}>
                          ✅ Hướng dẫn ôn tập / Hành động:
                        </label>
                        <div className="formula-edit-box" style={{ minHeight: 60 }}>
                          <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.action) }} />
                          <textarea
                            rows={2}
                            value={step.action || ''}
                            onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                            placeholder="Hành động cụ thể để khắc phục..."
                            className="formula-edit-box-input"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="btn sm secondary"
                    style={{ alignSelf: 'flex-start', borderStyle: 'dashed' }}
                  >
                    + Thêm bước ôn tập mới
                  </button>
                </div>
              ) : (
                proposal.roadmap?.steps && proposal.roadmap.steps.length > 0 && (
                  <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {proposal.roadmap.steps.map((step, idx) => {
                      if (typeof step === 'string') {
                        return (
                          <div
                            key={idx}
                            style={{ fontSize: 13, color: 'var(--text-main)', padding: '8px 12px', background: 'var(--bg-subtle)', borderRadius: 6 }}
                            dangerouslySetInnerHTML={{ __html: renderMath(`<strong>Bước ${idx + 1}:</strong> ${step}`) }}
                          />
                        );
                      }
                      return (
                        <div
                          key={step.order || idx}
                          style={{
                            background: '#ffffff',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '16px 18px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#6d28d9', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 800 }}>
                              Bước {step.order || idx + 1}
                            </span>
                            <span>{step.tag || step.title || 'Chủ đề ôn tập'}</span>
                          </div>

                          {step.theory && (
                            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 8, borderLeft: '4px solid #3b82f6' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>
                                📘 Lý thuyết & Công thức trọng tâm:
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#1e293b' }} dangerouslySetInnerHTML={{ __html: renderMath(step.theory) }} />
                            </div>
                          )}

                          {step.commonMistake && (
                            <div style={{ background: '#fffbeb', padding: '12px 16px', borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309', marginBottom: 6 }}>
                                ⚠️ Lỗi học sinh hay mắc phải:
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#78350f' }} dangerouslySetInnerHTML={{ __html: renderMath(step.commonMistake) }} />
                            </div>
                          )}

                          {step.action && (
                            <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#047857', marginBottom: 6 }}>
                                ✅ Hướng dẫn ôn tập & Hành động:
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#064e3b' }} dangerouslySetInnerHTML={{ __html: renderMath(step.action) }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chi tiết từng câu hỏi trong bài làm của học sinh - đặt ngay sau
          phần Nhận xét tổng thể, trước Bài tập bổ sung & Xác nhận giáo viên */}
      <div className="card">
        <div className="card-header">
          <h2>Chi tiết từng câu trong bài làm ({submission.answers?.length || 0} câu)</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(() => {
            let currentTopicName = null;
            let qNumInTopic = 0;

            return (submission.answers || []).map((ans, idx) => {
              const isCorrect = ans.isCorrect;
              const topicName = (ans.tags && ans.tags.length > 0) ? ans.tags[0] : 'Toán 12';
              const isNewTopic = topicName !== currentTopicName;
              if (isNewTopic) {
                currentTopicName = topicName;
                qNumInTopic = 1;
              } else {
                qNumInTopic += 1;
              }
              const displayQNum = qNumInTopic;

              return (
                <React.Fragment key={ans.questionId || idx}>
                  {isNewTopic && (
                    <div
                      style={{
                        marginTop: idx > 0 ? 10 : 0,
                        marginBottom: 2,
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                        color: '#fff',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16 }}>📚</span>
                        <strong style={{ fontSize: 14.5, letterSpacing: '0.02em', color: '#f8fafc' }}>
                          CHỦ ĐỀ: {topicName.toUpperCase()}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div
                    className="question-card"
                    style={{
                      borderLeft: `5px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}`,
                      background: '#ffffff',
                    }}
                  >
                    <div className="question-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
                          Câu {displayQNum}:
                        </span>
                        <span className={`status-pill ${isCorrect ? 'approved' : 'rejected'}`}>
                          {isCorrect ? '✓ Làm đúng' : '✕ Làm sai'}
                        </span>
                      </div>
                    </div>

                    <div
                      className="question-content"
                      dangerouslySetInnerHTML={{ __html: renderMath(ans.content) }}
                    />

                    <QuestionDiagram diagram={ans.diagram} />

                    {/* 4 Phương án */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {(ans.options || []).map((opt) => {
                        const isSelected = opt.key === ans.selectedAnswer;
                        const isCorrectOpt = opt.key === ans.correctAnswer;

                        let rowClass = 'option-row';
                        if (isCorrectOpt) rowClass += ' correct';
                        else if (isSelected && !isCorrect) rowClass += ' wrong';

                        return (
                          <div
                            key={opt.key}
                            className={rowClass}
                            style={{
                              border: isSelected
                                ? isCorrect
                                  ? '2px solid var(--success)'
                                  : '2px solid var(--danger)'
                                : isCorrectOpt
                                  ? '1.5px solid var(--success-border)'
                                  : '1px solid var(--border-color)',
                              background: isSelected
                                ? isCorrect
                                  ? 'var(--success-bg)'
                                  : 'var(--danger-bg)'
                                : isCorrectOpt
                                  ? 'var(--success-bg)'
                                  : '#ffffff',
                              margin: 0,
                            }}
                          >
                            <strong style={{ minWidth: 20 }}>{opt.key}.</strong>
                            <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />

                            {isSelected && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: isCorrect ? 'var(--success-text)' : 'var(--danger-text)',
                                  background: '#ffffff',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  border: '1px solid',
                                }}
                              >
                                Học sinh chọn: {opt.key} {isCorrect ? '✓' : '✕'}
                              </span>
                            )}

                            {!isSelected && isCorrectOpt && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: 'var(--success-text)',
                                }}
                              >
                                Đáp án đúng: {opt.key} ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Phân tích AI riêng cho câu này - chỉ hiện với câu làm
                        sai và khi giáo viên đã "Sinh AI" cho bài nộp này */}
                    {!isCorrect && proposal?.questionAnalyses && (() => {
                      const wqIdx = (proposal.wrongQuestions || []).findIndex((wq) => wq.id === ans.questionId);
                      if (wqIdx === -1) return null;
                      const qIndex = wqIdx + 1;
                      const qa = proposal.questionAnalyses.find((x) => (x.questionIndex || 0) === qIndex);
                      if (!qa) return null;

                      return (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {qa.mistakeAnalysis && (
                            <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid #f59e0b' }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b45309', marginBottom: 5 }}>
                                ⚠️ Lỗ hổng kiến thức:
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.65, color: '#78350f' }} dangerouslySetInnerHTML={{ __html: renderMath(qa.mistakeAnalysis) }} />
                            </div>
                          )}

                          {qa.correctSolution && (
                            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, borderLeft: '4px solid #10b981' }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#047857', marginBottom: 5 }}>
                                ✅ Cách khắc phục:
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.65, color: '#064e3b' }} dangerouslySetInnerHTML={{ __html: renderMath(qa.correctSolution) }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </React.Fragment>
              );
            });
          })()}
        </div>
      </div>

      {/* Bài tập bổ sung & Xác nhận giáo viên - chỉ hiện khi đã có đề xuất AI, đặt sau Chi tiết từng câu */}
      {proposal && (
        <div className="card" style={{ border: '2px solid #ddd6fe', background: '#faf5ff' }}>
          <div className="card-header" style={{ borderBottom: '1px solid #ede9fe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎁</span>
              <h2 style={{ color: '#5b21b6', margin: 0 }}>Bài tập bổ sung & Xác nhận giáo viên</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {/* Các câu hỏi bài tập tương tự do AI sinh theo từng Chuyên đề */}
            {groupedExercises && groupedExercises.length > 0 && (
              <details
                open
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #c4b5fd',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                  boxShadow: '0 4px 14px rgba(139, 92, 246, 0.08)',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#5b21b6', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>🎯 Bộ bài tập ôn luyện do AI tạo ({editExercises.length} câu - Phân theo {groupedExercises.length} chuyên đề)</span>
                  <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Bấm để ẩn/hiện</span>
                </summary>

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {groupedExercises.map((grp, gIdx) => (
                    <div
                      key={gIdx}
                      style={{
                        background: '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: 12,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                      }}
                    >
                      {/* Topic Banner Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 8,
                          paddingBottom: 10,
                          borderBottom: '1.5px solid #cbd5e1',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#ffffff',
                              padding: '4px 12px',
                              borderRadius: 8,
                              fontSize: 13,
                              fontWeight: 800,
                              letterSpacing: '0.3px',
                            }}
                          >
                            CHUYÊN ĐỀ {gIdx + 1}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#1e1b4b' }}>
                            {grp.topic}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              background: '#ede9fe',
                              color: '#6d28d9',
                              fontSize: 12,
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 20,
                            }}
                          >
                            {grp.items.length} câu hỏi
                          </span>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => handleAddExercise(grp.topic)}
                              className="btn sm secondary"
                              style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 6 }}
                            >
                              + Thêm câu vào chuyên đề này
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Question items in this topic */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {grp.items.map((ex, qIdx) => {
                          const origIdx = ex.originalIdx;
                          return (
                            <div
                              key={origIdx}
                              style={{
                                padding: 14,
                                background: '#ffffff',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                              }}
                            >
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span
                                        style={{
                                          background: '#6366f1',
                                          color: '#ffffff',
                                          fontSize: 12,
                                          fontWeight: 800,
                                          padding: '2px 8px',
                                          borderRadius: 6,
                                        }}
                                      >
                                        Câu {qIdx + 1}
                                      </span>
                                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        (Thứ tự tổng: #{origIdx + 1})
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExercise(origIdx)}
                                      className="btn sm outline-danger"
                                      style={{ padding: '2px 8px', fontSize: 11 }}
                                    >
                                      ✕ Xóa câu này
                                    </button>
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', fontWeight: 700, fontSize: 12, color: '#475569', marginBottom: 4 }}>
                                      Đề bài câu hỏi: <span style={{ fontWeight: 500, color: '#94a3b8' }}>(gõ mã LaTeX, ví dụ $x^2$)</span>
                                    </label>
                                    <div className="formula-edit-box" style={{ minHeight: 60 }}>
                                      <div className="formula-edit-box-preview" style={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: renderMath(ex.content) }} />
                                      <textarea
                                        rows={2}
                                        value={ex.content || ''}
                                        onChange={(e) => handleExerciseChange(origIdx, 'content', e.target.value)}
                                        className="formula-edit-box-input"
                                      />
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <label style={{ fontWeight: 700, fontSize: 12, color: '#475569' }}>
                                      Đáp án đúng:
                                    </label>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {['A', 'B', 'C', 'D'].map((key) => (
                                        <button
                                          key={key}
                                          type="button"
                                          onClick={() => handleExerciseChange(origIdx, 'correctAnswer', key)}
                                          style={{
                                            padding: '3px 10px',
                                            borderRadius: 6,
                                            border: '1.5px solid',
                                            borderColor: ex.correctAnswer === key ? '#10b981' : '#cbd5e1',
                                            background: ex.correctAnswer === key ? '#d1fae5' : '#ffffff',
                                            color: ex.correctAnswer === key ? '#065f46' : '#475569',
                                            fontWeight: 800,
                                            fontSize: 12,
                                            cursor: 'pointer',
                                          }}
                                        >
                                          {key}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ marginBottom: 10, fontSize: 14, color: '#1e293b', lineHeight: 1.65 }}>
                                  <span
                                    style={{
                                      background: '#ede9fe',
                                      color: '#6d28d9',
                                      fontWeight: 800,
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      fontSize: 13,
                                      marginRight: 8,
                                      display: 'inline-block',
                                    }}
                                  >
                                    Câu {qIdx + 1}:
                                  </span>
                                  <span dangerouslySetInnerHTML={{ __html: renderMath(ex.content) }} />
                                </div>
                              )}

                              <QuestionDiagram diagram={ex.diagram} />

                              {/* Danh sách 4 đáp án dạng DỌC (1 cột full-width) */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                                {(ex.options || []).map((opt) => (
                                  <div
                                    key={opt.key}
                                    className={`option-row ${opt.key === ex.correctAnswer ? 'correct' : ''}`}
                                    style={{
                                      margin: 0,
                                      padding: '9px 16px',
                                      fontSize: 13.5,
                                      width: '100%',
                                      minHeight: 46,
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: 8,
                                    }}
                                  >
                                    <strong style={{ minWidth: 26, fontSize: 14, color: opt.key === ex.correctAnswer ? '#047857' : '#475569' }}>
                                      {opt.key}.
                                    </strong>{' '}
                                    {isEditing ? (
                                      <div className="formula-edit-box" style={{ flex: 1, marginLeft: 6 }}>
                                        <div
                                          className="formula-edit-box-preview"
                                          style={{ fontSize: 13 }}
                                          dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
                                        />
                                        <input
                                          type="text"
                                          value={opt.text || ''}
                                          onChange={(e) => handleOptionChange(origIdx, opt.key, e.target.value)}
                                          className="formula-edit-box-input"
                                        />
                                      </div>
                                    ) : (
                                      <span style={{ flex: 1, fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                                    )}
                                    {opt.key === ex.correctAnswer && (
                                      <span style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, color: '#047857', paddingLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        ✓ Đáp án đúng
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => handleAddExercise('Chuyên đề ôn tập mới')}
                      className="btn sm secondary"
                      style={{ alignSelf: 'flex-start', borderStyle: 'dashed' }}
                    >
                      + Thêm chuyên đề bài tập mới
                    </button>
                  )}
                </div>
              </details>
            )}

            {/* HỘP DUYỆT & GỬI BÀI TẬP */}
            {proposal.status === 'pending_review' ? (
              <div
                style={{
                  background: '#ffffff',
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid #8b5cf6',
                  boxShadow: '0 4px 16px rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: '#5b21b6' }}>
                  ⚙️ Xác nhận duyệt & Phân phối bài tập cho học sinh:
                </div>

                {/* Checkbox gửi kèm bài tập */}
                <div
                  style={{
                    background: includeExercises ? '#f0fdf4' : '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: includeExercises ? '1.5px solid #86efac' : '1.5px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => setIncludeExercises(!includeExercises)}
                >
                  <input
                    type="checkbox"
                    id="includeExPost"
                    checked={includeExercises}
                    onChange={(e) => {
                      e.stopPropagation();
                      setIncludeExercises(e.target.checked);
                    }}
                    style={{ width: 20, height: 20, cursor: 'pointer' }}
                  />
                  <div>
                    <label
                      htmlFor="includeExPost"
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 700,
                        color: includeExercises ? '#15803d' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      Gửi kèm {proposal.exercises?.length || 0} câu hỏi bài tập ôn luyện này cho học sinh
                    </label>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {includeExercises
                        ? '✓ Hệ thống sẽ tự động tạo một đề thi bài tập mới và giao ngay vào tài khoản của học sinh.'
                        : '○ Chỉ gửi nhận xét & lý thuyết bằng văn bản, không tạo đề thi câu hỏi mới.'}
                    </span>
                  </div>
                </div>

                {/* Các nút hành động */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="btn"
                    onClick={() => handleApprove(proposal.id)}
                    disabled={reviewing}
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      fontWeight: 800,
                      padding: '11px 22px',
                      fontSize: 14,
                    }}
                  >
                    {reviewing ? 'Đang gửi...' : '🚀 ✓ Duyệt & Gửi nhận xét / bài tập cho học sinh'}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => handleGenerateAI(true)}
                    disabled={generating}
                  >
                    🔄 Sinh lại nhận xét AI
                  </button>
                  <button
                    className="btn outline-danger"
                    onClick={() => setShowRejectModal(true)}
                    disabled={reviewing || generating}
                  >
                    ✕ Từ chối đề xuất
                  </button>
                </div>
              </div>
            ) : proposal.status === 'approved' ? (
              <div
                style={{
                  background: '#f0fdf4',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #86efac',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, color: '#15803d', fontSize: 14 }}>
                    ✓ Đã phê duyệt và gửi lộ trình ôn tập đến học sinh thành công!
                  </div>
                  <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
                    {proposal.examId ? 'Đã tạo và giao đề thi ôn tập cho học sinh.' : 'Đã gửi bản nhận xét lý thuyết cho học sinh.'}
                  </div>
                </div>
                <button className="btn sm secondary" onClick={() => handleGenerateAI(true)} disabled={generating}>
                  🔄 Sinh lại lộ trình mới
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: '#fef2f2',
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #fca5a5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: 14 }}>
                  ✕ Đề xuất AI này đã bị từ chối.
                </div>
                <button className="btn sm" onClick={() => handleGenerateAI(true)} disabled={generating}>
                  🔄 Sinh đề xuất AI mới
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TÙY CHỌN TỪ CHỐI ĐỀ XUẤT AI */}
      {showRejectModal && (
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
          onClick={() => !rejectActionLoading && setShowRejectModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
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
                    background: '#fee2e2',
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
                  <h3 style={{ margin: 0, fontSize: 18, color: '#1e293b', fontWeight: 800 }}>
                    Xử lý Từ chối đề xuất AI
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#64748b' }}>
                    Lựa chọn hành động để xử lý bản lộ trình & bài tập hiện tại
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !rejectActionLoading && setShowRejectModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#64748b',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 18 }}>
              Bản phân tích hoặc câu hỏi AI sinh ra chưa đạt chất lượng mong muốn? Bạn có thể chọn một trong hai hành động dưới đây:
            </p>

            {/* 2 Lựa chọn Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
              {/* Lựa chọn 1: Xóa bỏ & Thoát */}
              <div
                role="button"
                tabIndex={0}
                onClick={!rejectActionLoading ? handleDeleteAndExit : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  background: '#fff1f2',
                  border: '1.5px solid #fecdd3',
                  borderRadius: 12,
                  cursor: rejectActionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: rejectActionLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!rejectActionLoading) {
                    e.currentTarget.style.borderColor = '#f43f5e';
                    e.currentTarget.style.background = '#ffe4e6';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 63, 94, 0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!rejectActionLoading) {
                    e.currentTarget.style.borderColor = '#fecdd3';
                    e.currentTarget.style.background = '#fff1f2';
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
                    background: '#ffe4e6',
                    border: '1px solid #fecdd3',
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
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#be123c', marginBottom: 2 }}>
                    1. Xóa bỏ hoàn toàn & Huỷ bản sinh này
                  </div>
                  <div style={{ fontSize: 12.5, color: '#881337', lineHeight: 1.45 }}>
                    Xóa sạch dữ liệu text cũ khỏi hệ thống, không lưu rác để giao diện quay về ban đầu.
                  </div>
                </div>
              </div>

              {/* Lựa chọn 2: Xóa cũ & Gọi Gemini AI sinh lại ngay */}
              <div
                role="button"
                tabIndex={0}
                onClick={!rejectActionLoading ? handleDeleteAndRegenerate : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  background: '#f5f3ff',
                  border: '1.5px solid #ddd6fe',
                  borderRadius: 12,
                  cursor: rejectActionLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: rejectActionLoading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!rejectActionLoading) {
                    e.currentTarget.style.borderColor = '#8b5cf6';
                    e.currentTarget.style.background = '#ede9fe';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.18)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!rejectActionLoading) {
                    e.currentTarget.style.borderColor = '#ddd6fe';
                    e.currentTarget.style.background = '#f5f3ff';
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
                    background: '#ede9fe',
                    border: '1px solid #ddd6fe',
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
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: '#6d28d9', marginBottom: 2 }}>
                    2. Xóa bản cũ & Gọi AI sinh lại bản mới ngay
                  </div>
                  <div style={{ fontSize: 12.5, color: '#5b21b6', lineHeight: 1.45 }}>
                    Huỷ bản cũ và yêu cầu Gemini AI phân tích lại bài làm để tạo bộ lộ trình + câu hỏi mới chuẩn hơn.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={rejectActionLoading}
                onClick={() => setShowRejectModal(false)}
                style={{
                  padding: '9px 18px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              >
                Đóng (Giữ nguyên)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
