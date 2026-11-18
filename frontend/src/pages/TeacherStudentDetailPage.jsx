import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';
import UiIcon, { scoreLevel, formatScore } from '../components/UiIcon';
import GameHistoryPanel from '../components/GameHistory';
import { renderMath } from '../utils/mathRender';

export default function TeacherStudentDetailPage() {
  const { studentId } = useParams();
  const [stats, setStats] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [proposals, setProposals] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [gameHistory, setGameHistory] = useState(null);

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

  async function loadGameHistory() {
    try {
      const { data } = await api.get(`/teacher/students/${studentId}/game-history`);
      setGameHistory(data.items || []);
    } catch {
      setGameHistory([]);
    }
  }

  useEffect(() => {
    loadStats();
    loadProposals();
    loadSubmissions();
    loadGameHistory();
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
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải thông tin học sinh…</div>
        </div>
      </div>
    );
  }

  const initial = stats.student.name ? stats.student.name.trim().charAt(0).toUpperCase() : 'H';
  const avgScore = submissions.length > 0
    ? submissions.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / submissions.length
    : null;
  const statusLabel = (status) => {
    if (status === 'approved') return 'Đã duyệt';
    if (status === 'rejected') return 'Đã từ chối';
    return 'Chờ duyệt';
  };

  return (
    <div className="container">
      <div className="page-back">
        <Link to="/teacher" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Quản lý học sinh
        </Link>
      </div>

      {/* Hồ sơ học sinh */}
      <div className="card profile-card">
        <div className="profile-head">
          <div className="profile-id">
            <div className="avatar is-lg" aria-hidden="true">{initial}</div>
            <div>
              <h1 className="profile-name">{stats.student.name}</h1>
              <div className="meta-row">
                <span className="class-badge">
                  {stats.student.className ? `Lớp ${stats.student.className}` : 'Chưa phân lớp'}
                </span>
                {stats.student.email && <span>{stats.student.email}</span>}
              </div>
            </div>
          </div>

          <dl className="profile-stats">
            <div className="profile-stat">
              <dt>Bài đã nộp</dt>
              <dd>{submissions.length}</dd>
            </div>
            <div className="profile-stat">
              <dt>Điểm trung bình</dt>
              <dd className={avgScore !== null ? `score-text is-${scoreLevel(avgScore)}` : ''}>
                {avgScore !== null ? <>{formatScore(avgScore)}<small>/10</small></> : '—'}
              </dd>
            </div>
            <div className="profile-stat">
              <dt>Chuyên đề yếu</dt>
              <dd className={stats.weakTags.length > 0 ? 'score-text is-low' : ''}>{stats.weakTags.length}</dd>
            </div>
          </dl>
        </div>

        <div className="weak-panel">
          <div className="weak-panel-head">
            <UiIcon name="target" size={17} />
            <strong>Chuyên đề học sinh đang yếu</strong>
            <button
              className="btn sm weak-panel-action"
              onClick={handleGenerate}
              disabled={generating || stats.weakTags.length === 0}
              title={stats.weakTags.length === 0 ? 'Học sinh chưa có chuyên đề yếu' : undefined}
            >
              {generating ? (
                <><span className="spinner is-on-primary" /> AI đang soạn…</>
              ) : (
                <><UiIcon name="sparkles" size={15} /> Tạo lộ trình và bài tập AI</>
              )}
            </button>
          </div>

          {generateError && (
            <div className="notice is-danger" style={{ marginBottom: 12 }}>
              <UiIcon name="alert" size={18} />
              <div className="notice-body">{generateError}</div>
            </div>
          )}

          {stats.weakTags.length === 0 ? (
            <p className="text-muted-cell">Chưa ghi nhận chuyên đề yếu (học sinh làm tốt hoặc chưa làm đủ số câu).</p>
          ) : (
            <div className="weak-grid">
              {stats.weakTags.map((t) => {
                const percent = Math.round(t.wrongRate * 100);
                return (
                  <div key={t.tag} className="weak-item">
                    <div className="weak-item-row">
                      <span className="weak-name" title={t.tag}>{t.tag}</span>
                      <span className="weak-rate">Sai {percent}%</span>
                    </div>
                    <div className="score-bar" aria-hidden="true">
                      <span className="is-low" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tỉ lệ làm sai theo chuyên đề */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <UiIcon name="chart" size={18} className="title-icon" />
            <h2>Tỉ lệ làm sai theo chuyên đề</h2>
          </div>
        </div>
        <WeakTopicsChart data={stats.allTopicStats} />
      </div>

      {/* Bài đã nộp */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <h2>Bài đã nộp</h2>
            <span className="count-badge">{submissions.length}</span>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="file" size={24} /></div>
            <div className="empty-state-title">Học sinh chưa nộp bài nào</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Đề</th>
                  <th className="nowrap" style={{ width: 110 }}>Điểm</th>
                  <th className="nowrap" style={{ width: 120 }}>Số câu đúng</th>
                  <th className="nowrap" style={{ width: 180 }}>Nộp lúc</th>
                  <th className="nowrap" style={{ textAlign: 'right', width: 160 }}><span className="rm-visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td><span className="exam-item-title">{sub.examTitle}</span></td>
                    <td className="nowrap">
                      <span className={`score-pill is-${scoreLevel(sub.score)}`}>
                        {formatScore(sub.score)}<small>/10</small>
                      </span>
                    </td>
                    <td className="nowrap">{sub.correctCount}/{sub.totalQuestions}</td>
                    <td className="nowrap text-muted-cell">{new Date(sub.submittedAt).toLocaleString('vi-VN')}</td>
                    <td className="nowrap" style={{ textAlign: 'right' }}>
                      <Link to={`/teacher/exams/${sub.examId}/submissions/${sub.id}`} className="btn sm secondary">
                        Xem bài làm
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lịch sử chơi trò chơi Đường đua Toán học */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <UiIcon name="play" size={18} className="title-icon" />
              <h2>Lịch sử trò chơi</h2>
              <span className="count-badge">{gameHistory ? gameHistory.length : 0}</span>
            </div>
            <p className="card-hint">Các lượt chơi Đường đua Toán học học sinh đã chơi xong.</p>
          </div>
        </div>

        {gameHistory === null ? (
          <div className="empty-state"><div className="empty-state-title">Đang tải…</div></div>
        ) : (
          <GameHistoryPanel
            items={gameHistory}
            detailPath={(id) => `/teacher/students/${studentId}/games/${id}`}
            empty={(
              <div className="empty-state">
                <div className="empty-state-icon is-svg"><UiIcon name="play" size={24} /></div>
                <div className="empty-state-title">Học sinh chưa chơi xong lượt nào</div>
              </div>
            )}
          />
        )}
      </div>

      {/* Lộ trình và bài tập AI đã tạo */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <UiIcon name="sparkles" size={18} className="ai-mark" />
            <h2>Lộ trình và bài tập AI đã tạo</h2>
            <span className="count-badge">{proposals.length}</span>
          </div>
        </div>

        {proposals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="sparkles" size={24} /></div>
            <div className="empty-state-title">Chưa có lộ trình AI nào</div>
            <p className="empty-state-desc">Bấm "Tạo lộ trình và bài tập AI" ở trên để AI soạn cho học sinh này.</p>
          </div>
        ) : (
          <div className="proposal-list">
            {proposals.map((p) => (
              <div key={p.id} className="proposal-item">
                <div className="proposal-head">
                  <div className="focus-tags" style={{ margin: 0 }}>
                    {(p.weakTags || []).map((tag) => (
                      <span className="focus-tag" key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className={`status-pill ${p.status}`}>
                    <span className="status-dot" />
                    {statusLabel(p.status)}
                  </span>
                </div>

                {p.roadmap?.summary && (
                  <div className="proposal-summary" dangerouslySetInnerHTML={{ __html: renderMath(p.roadmap.summary) }} />
                )}

                <div className="proposal-foot">
                  {p.exercises && (
                    <span className="meta-row">
                      <span><UiIcon name="list" size={14} /> {p.exercises.length} câu bài tập</span>
                    </span>
                  )}
                  {p.status === 'pending_review' && (
                    <div className="action-row">
                      <button className="btn sm success" onClick={() => handleApprove(p.id)}>
                        <UiIcon name="send" size={14} /> Duyệt và gửi
                      </button>
                      <button className="btn sm outline-danger" onClick={() => handleReject(p.id)}>
                        <UiIcon name="close" size={14} /> Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
