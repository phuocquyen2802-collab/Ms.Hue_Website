import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const [stats, setStats] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [proposals, setProposals] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  async function loadStats() {
    const { data } = await api.get(`/teacher/students/${studentId}/stats`);
    setStats(data);
  }

  async function loadProposals() {
    const { data } = await api.get('/teacher/generated-exercises', { params: { studentId } });
    setProposals(data);
  }

  async function loadSubmissions() {
    try {
      const { data } = await api.get('/teacher/submissions');
      setSubmissions(data.filter((s) => s.studentId === studentId));
    } catch {
      setSubmissions([]);
    }
  }

  useEffect(() => {
    loadStats();
    loadProposals();
    loadSubmissions();
  }, [studentId]);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError('');
    try {
      await api.post(`/teacher/students/${studentId}/generate-roadmap`);
      loadProposals();
    } catch (err) {
      setGenerateError(err.response?.data?.message || 'Sinh bài tập AI thất bại');
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id) {
    await api.put(`/teacher/generated-exercises/${id}/approve`);
    loadProposals();
  }

  async function handleReject(id) {
    await api.put(`/teacher/generated-exercises/${id}/reject`);
    loadProposals();
  }

  if (!stats) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải thông tin học sinh...</div>
        </div>
      </div>
    );
  }

  const initial = stats.student.name ? stats.student.name.trim().charAt(0).toUpperCase() : 'H';

  return (
    <div className="container">
      <div style={{ marginBottom: 16 }}>
        <Link to="/teacher" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại quản lý học sinh
        </Link>
      </div>

      {/* Thông tin học sinh */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {initial}
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>
              {stats.student.name}
            </h1>
            <span className="tag-badge" style={{ marginTop: 4 }}>
              {stats.student.className ? `Lớp ${stats.student.className}` : 'Chưa phân lớp'}
            </span>
          </div>
        </div>

        <div>
          <button
            className="btn"
            onClick={handleGenerate}
            disabled={generating || stats.weakTags.length === 0}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}
          >
            {generating ? 'AI đang tạo bài tập...' : '✨ Sinh bài tập AI cho học sinh này'}
          </button>
        </div>
      </div>

      {/* Điểm yếu */}
      <div className="card">
        <div className="card-header">
          <h2>Chủ đề học sinh đang yếu</h2>
        </div>

        {stats.weakTags.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Chưa ghi nhận điểm yếu (học sinh làm bài tốt hoặc chưa làm đủ số câu).</p>
        ) : (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {stats.weakTags.map((t) => (
                <span className="tag-badge weak" key={t.tag} style={{ fontSize: 13, padding: '6px 14px' }}>
                  🎯 {t.tag} ({Math.round(t.wrongRate * 100)}% sai)
                </span>
              ))}
            </div>
            {generateError && <p className="error-text">⚠️ {generateError}</p>}
          </div>
        )}
      </div>

      {/* Biểu đồ */}
      <div className="card">
        <div className="card-header">
          <h2>Tỷ lệ làm sai theo từng chủ đề</h2>
        </div>
        <WeakTopicsChart data={stats.allTopicStats} />
      </div>

      {/* Lịch sử bài làm & đề thi của học sinh */}
      <div className="card">
        <div className="card-header">
          <h2>Các bài tập & đề thi đã làm ({submissions.length})</h2>
        </div>

        {submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-title">Học sinh chưa nộp bài kiểm tra nào</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Tên đề thi</th>
                  <th className="nowrap" style={{ width: 130 }}>Điểm số</th>
                  <th className="nowrap" style={{ width: 140 }}>Số câu đúng</th>
                  <th className="nowrap" style={{ width: 180 }}>Thời gian nộp</th>
                  <th className="nowrap" style={{ textAlign: 'right', width: 220 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 14 }}>
                        {sub.examTitle}
                      </div>
                    </td>
                    <td className="nowrap">
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 15,
                          color: sub.score >= 5 ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {sub.score} / 10
                      </span>
                    </td>
                    <td className="nowrap">
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {sub.correctCount} / {sub.totalQuestions} câu
                      </span>
                    </td>
                    <td className="nowrap">
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(sub.submittedAt).toLocaleString('vi-VN')}
                      </span>
                    </td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <Link
                        to={`/teacher/exams/${sub.examId}/submissions/${sub.id}`}
                        className="btn sm"
                        style={{
                          background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                          color: '#ffffff',
                          fontWeight: 700,
                        }}
                      >
                        ✨ Xem bài làm & AI ➔
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Đề xuất AI */}
      <div className="card">
        <div className="card-header">
          <h2>Bài tập & Lộ trình AI đã tạo</h2>
        </div>

        {proposals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤖</div>
            <div className="empty-state-title">Chưa có bài tập AI nào</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {proposals.map((p) => (
              <div
                key={p.id}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  background: 'var(--bg-app)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>Chuyên đề:</strong> <span style={{ color: 'var(--primary)' }}>{p.weakTags.join(', ')}</span>
                  </div>
                  <span className={`status-pill ${p.status}`}>
                    {p.status === 'approved' ? 'Đã duyệt' : p.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-main)', marginBottom: 8 }}>{p.roadmap.summary}</p>

                {p.exercises && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Kèm theo <strong>{p.exercises.length} câu hỏi</strong> ôn tập.
                  </div>
                )}

                {p.status === 'pending_review' && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                    <button className="btn success sm" onClick={() => handleApprove(p.id)}>
                      ✓ Duyệt & Giao cho học sinh
                    </button>
                    <button className="btn outline-danger sm" onClick={() => handleReject(p.id)}>
                      ✕ Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
