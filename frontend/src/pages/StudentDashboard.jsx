import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AnswerKeyPanel from '../components/AnswerKeyPanel';

export default function StudentDashboard() {
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/student/exams'),
      api.get('/student/submissions'),
      api.get('/student/me/roadmaps'),
      api.get('/student/me/groups').catch(() => ({ data: [] })),
    ])
      .then(([examsRes, subsRes, roadmapsRes, groupsRes]) => {
        setExams(examsRes.data);
        setSubmissions(subsRes.data);
        setRoadmaps(roadmapsRes.data);
        setGroups(groupsRes.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  function isSubmitted(examId) {
    return submissions.some((s) => s.examId === examId);
  }

  function submissionFor(examId) {
    return submissions.find((s) => s.examId === examId);
  }

  const completedCount = exams.filter((e) => isSubmitted(e.id)).length;
  const pendingCount = exams.length - completedCount;

  // Nhóm các đề AI tự sinh thêm (sourceExamId) vào đúng "thư mục" của đề
  // gốc, thay vì hiện tách rời như 1 đề độc lập trong danh sách chính.
  const examIds = new Set(exams.map((e) => e.id));
  const aiChildrenByParent = {};
  exams.forEach((exam) => {
    if (exam.sourceExamId && examIds.has(exam.sourceExamId)) {
      if (!aiChildrenByParent[exam.sourceExamId]) aiChildrenByParent[exam.sourceExamId] = [];
      aiChildrenByParent[exam.sourceExamId].push(exam);
    }
  });
  const topLevelExams = exams.filter((exam) => !exam.sourceExamId || !examIds.has(exam.sourceExamId));

  return (
    <div className="container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Góc luyện đề</h1>
          <p className="page-subtitle">
            Hoàn thành các đề kiểm tra được giáo viên giao và theo dõi lộ trình cải thiện điểm số
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Tổng số bài được giao</span>
            <span className="metric-value">{exams.length}</span>
            <span className="metric-sub">Đề kiểm tra từ giáo viên</span>
          </div>
          <div className="metric-icon-box blue">📝</div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Đã hoàn thành</span>
            <span className="metric-value" style={{ color: 'var(--success)' }}>
              {completedCount}
            </span>
            <span className="metric-sub">Đã nộp và có kết quả</span>
          </div>
          <div className="metric-icon-box green">✓</div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Chưa làm</span>
            <span
              className="metric-value"
              style={{ color: pendingCount > 0 ? 'var(--warning)' : 'var(--text-muted)' }}
            >
              {pendingCount}
            </span>
            <span className="metric-sub">Đang chờ bạn thực hiện</span>
          </div>
          <div className="metric-icon-box amber">⏳</div>
        </div>

        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Lộ trình AI</span>
            <span className="metric-value" style={{ color: 'var(--purple)' }}>
              {roadmaps.length}
            </span>
            <span className="metric-sub">Kế hoạch cải thiện cá nhân</span>
          </div>
          <div className="metric-icon-box purple">✨</div>
        </div>
      </div>

      {/* Nhóm học sinh mà mình là thành viên - xem có bao nhiêu bạn cùng nhóm */}
      {groups.length > 0 && (
        <div className="card" style={{ padding: '18px 22px', borderRadius: 14 }}>
          <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>🗂️ Nhóm của tôi</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groups.map((g) => (
              <div
                key={g.id}
                style={{
                  padding: '10px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  background: '#fafafa',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                  {g.name} <span style={{ fontWeight: 500, color: '#64748b', fontSize: 12.5 }}>({g.memberCount} thành viên)</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>
                  {g.members.map((m) => (m.isMe ? `${m.name} (Bạn)` : m.name)).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modern Exam Card List */}
      <div className="card" style={{ padding: '20px 24px', borderRadius: 14 }}>
        <div className="card-header" style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
          <div className="card-title-group">
            <h2 style={{ fontSize: 18 }}>Danh sách đề thi</h2>
            <p className="card-hint">
              Làm bài kiểm tra, xem kết quả của tôi và nhận lộ trình ôn tập từ AI
            </p>
          </div>
          {exams.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Tổng cộng: <strong>{exams.length}</strong> đề thi
            </span>
          )}
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải danh sách bài tập...</div>
          </div>
        ) : exams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">Chưa có đề thi nào được giao</div>
            <p className="empty-state-desc">Khi giáo viên giao bài, các đề thi sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topLevelExams.map((exam) => {
              const examSubs = submissions
                .filter((s) => s.examId === exam.id)
                .sort((a, b) => (b.attempt || 1) - (a.attempt || 1));
              const submitted = examSubs.length > 0;

              return (
                <ExamCardItem
                  key={exam.id}
                  exam={exam}
                  examSubs={examSubs}
                  submitted={submitted}
                  aiChildren={aiChildrenByParent[exam.id] || []}
                  submissions={submissions}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ExamCardItem({ exam, examSubs, submitted, aiChildren = [], submissions = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [aiFolderExpanded, setAiFolderExpanded] = useState(false);

  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        background: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          flexWrap: 'wrap',
          gap: 16,
          background: expanded ? 'rgba(37,99,235,0.02)' : '#ffffff',
        }}
      >
        {/* Left: Icon + Title & Description */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 260, flex: 1 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: submitted ? 'rgba(37,99,235,0.08)' : '#f1f5f9',
              color: submitted ? 'var(--primary)' : '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {submitted ? '📝' : '📖'}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 4 }}>
              {exam.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#475569' }}>⏱️ {exam.durationMinutes} phút</span>
              {exam.description && <span>• {exam.description}</span>}
            </div>
            {aiChildren.length > 0 && (
              <button
                type="button"
                onClick={() => setAiFolderExpanded((v) => !v)}
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--purple, #7c3aed)',
                  background: '#f3ecff',
                  border: '1px solid #ddcbfb',
                  borderRadius: 20,
                  padding: '3px 10px',
                  cursor: 'pointer',
                }}
              >
                📂 {aiChildren.length} bài tập AI sinh thêm {aiFolderExpanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, justifyContent: 'flex-end' }}>
          {submitted ? (
            <>
              <Link
                to={`/student/exams/${exam.id}`}
                className="btn sm secondary"
                style={{
                  height: 35,
                  padding: '0 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: 7,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                🔄 Làm lại
              </Link>

              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                style={{
                  height: 35,
                  border: expanded ? '1.5px solid #2563eb' : '1.5px solid #cbd5e1',
                  background: expanded ? '#eff6ff' : '#ffffff',
                  color: expanded ? '#1d4ed8' : '#334155',
                  borderRadius: 7,
                  padding: '0 12px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
                title="Bấm để xem chi tiết lịch sử các lần làm bài"
              >
                <span>📋 Lịch sử ({examSubs.length} lần làm)</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: expanded ? '#dbeafe' : '#f1f5f9',
                    color: expanded ? '#1d4ed8' : '#64748b',
                    fontSize: 9,
                    fontWeight: 800,
                    transition: 'transform 0.2s ease',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                >
                  ▼
                </span>
              </button>
            </>
          ) : (
            <Link
              to={`/student/exams/${exam.id}`}
              className="btn sm btn-primary"
              style={{
                height: 35,
                padding: '0 18px',
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 7,
                display: 'inline-flex',
                alignItems: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              Bắt đầu làm bài ➔
            </Link>
          )}
        </div>
      </div>

      {/* Đáp án chi tiết (nếu giáo viên có đính kèm) - chỉ hiện sau khi đã nộp bài */}
      {submitted && exam.answerKeyFile && (
        <div style={{ padding: '0 24px 18px' }}>
          <AnswerKeyPanel examId={exam.id} answerKeyFile={exam.answerKeyFile} />
        </div>
      )}

      {/* Expanded History Sub-list for All Attempts */}
      {expanded && examSubs.length > 0 && (
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🕒 Chi tiết các đợt làm bài:</span>
            <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>(Xem lại bài làm chi tiết)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {examSubs.map((sub) => {
              const sScore = sub.score !== undefined ? sub.score : 0;
              let sColor = 'var(--danger)';
              if (sScore >= 8) sColor = 'var(--success)';
              else if (sScore >= 5) sColor = '#d97706';

              return (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#334155',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      Lần {sub.attempt || 1}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 13.5, color: sColor }}>
                      {sScore} / 10đ
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      Đúng {sub.correctCount || 0}/{sub.totalQuestions || 0} câu
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      • {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <Link
                      to={`/student/submissions/${sub.id}`}
                      className="btn sm"
                      style={{
                        padding: '5px 14px',
                        fontSize: 12.5,
                        background: 'var(--primary)',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontWeight: 600,
                      }}
                    >
                      📊 Kết quả của tôi
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thư mục con: bài tập AI sinh thêm dựa trên đề này */}
      {aiFolderExpanded && aiChildren.length > 0 && (
        <div style={{ padding: '14px 20px', background: '#f9f5ff', borderTop: '1px solid #ddcbfb' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7c3aed', marginBottom: 10 }}>
            📂 Bài tập AI sinh thêm từ đề này:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiChildren.map((child) => {
              const childSubs = submissions.filter((s) => s.examId === child.id);
              const childSubmitted = childSubs.length > 0;
              return (
                <div
                  key={child.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    background: '#ffffff',
                    borderRadius: 8,
                    border: '1px solid #ddcbfb',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1e293b' }}>{child.title}</div>
                  {childSubmitted ? (
                    <Link
                      to={`/student/submissions/${childSubs[childSubs.length - 1].id}`}
                      className="btn sm"
                      style={{ padding: '5px 14px', fontSize: 12.5, background: 'var(--primary)', color: '#fff', borderRadius: 6, fontWeight: 600 }}
                    >
                      📊 Kết quả của tôi
                    </Link>
                  ) : (
                    <Link
                      to={`/student/exams/${child.id}`}
                      className="btn sm"
                      style={{ padding: '5px 14px', fontSize: 12.5, borderRadius: 6, fontWeight: 700 }}
                    >
                      Bắt đầu làm bài ➔
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
