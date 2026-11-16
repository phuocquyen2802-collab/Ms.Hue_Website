import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import useAutoRefresh, { setIfChanged } from '../hooks/useAutoRefresh';
import AnswerKeyPanel from '../components/AnswerKeyPanel';
import UiIcon, { scoreLevel, formatScore } from '../components/UiIcon';

export default function StudentDashboard() {
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [examsRes, subsRes, roadmapsRes, groupsRes] = await Promise.all([
      api.get('/student/exams'),
      api.get('/student/submissions'),
      api.get('/student/me/roadmaps'),
      api.get('/student/me/groups').catch(() => ({ data: [] })),
    ]);
    setIfChanged(setExams, examsRes.data);
    setIfChanged(setSubmissions, subsRes.data);
    setIfChanged(setRoadmaps, roadmapsRes.data);
    setIfChanged(setGroups, groupsRes.data || []);
  }

  useEffect(() => {
    loadData().catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Giáo viên giao đề mới / duyệt lộ trình: tự hiện mà không cần tải lại trang.
  useAutoRefresh(loadData, 15000);

  function isSubmitted(examId) {
    return submissions.some((s) => s.examId === examId);
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Luyện đề</h1>
          <p className="page-subtitle">Làm các đề giáo viên giao, xem kết quả và lộ trình ôn tập của bạn.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Đề được giao</span>
            <span className="metric-value">{exams.length}</span>
            <span className="metric-sub">Từ giáo viên của bạn</span>
          </div>
          <div className="metric-icon-box blue"><UiIcon name="file" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Đã làm</span>
            <span className="metric-value">{completedCount}</span>
            <span className="metric-sub">Đã nộp và có kết quả</span>
          </div>
          <div className="metric-icon-box green"><UiIcon name="check" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Chưa làm</span>
            <span className={`metric-value${pendingCount > 0 ? ' score-text is-ok' : ''}`}>{pendingCount}</span>
            <span className="metric-sub">Đang chờ bạn làm</span>
          </div>
          <div className="metric-icon-box amber"><UiIcon name="clock" size={20} /></div>
        </div>
        <div className="metric-card">
          <div className="metric-info">
            <span className="metric-title">Lộ trình ôn tập</span>
            <span className="metric-value">{roadmaps.length}</span>
            <span className="metric-sub">Do AI soạn, giáo viên duyệt</span>
          </div>
          <div className="metric-icon-box purple"><UiIcon name="route" size={20} /></div>
        </div>
      </div>

      {/* Nhóm học sinh mà mình là thành viên */}
      {groups.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-row">
              <h2>Nhóm của tôi</h2>
              <span className="count-badge">{groups.length}</span>
            </div>
          </div>
          <div className="my-groups">
            {groups.map((g) => (
              <div key={g.id} className="my-group">
                <div className="my-group-icon"><UiIcon name="users" size={17} /></div>
                <div className="my-group-info">
                  <div className="my-group-name">
                    {g.name} <span>{g.memberCount} thành viên</span>
                  </div>
                  <div className="my-group-members">
                    {g.members.map((m) => (m.isMe ? `${m.name} (bạn)` : m.name)).join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <h2>Danh sách đề</h2>
              {exams.length > 0 && <span className="count-badge">{topLevelExams.length}</span>}
            </div>
            <p className="card-hint">Bấm "Bắt đầu" để làm bài. Sau khi nộp, bạn xem lại được từng lần làm.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
            <div className="empty-state-title">Đang tải danh sách đề…</div>
          </div>
        ) : exams.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="inbox" size={24} /></div>
            <div className="empty-state-title">Chưa có đề nào được giao</div>
            <p className="empty-state-desc">Khi giáo viên giao bài, đề sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="exam-items">
            {topLevelExams.map((exam) => {
              const examSubs = submissions
                .filter((s) => s.examId === exam.id)
                .sort((a, b) => (b.attempt || 1) - (a.attempt || 1));
              return (
                <ExamCardItem
                  key={exam.id}
                  exam={exam}
                  examSubs={examSubs}
                  submitted={examSubs.length > 0}
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

function ScorePill({ score }) {
  const s = score !== undefined ? score : 0;
  return (
    <span className={`score-pill is-${scoreLevel(s)}`}>
      {formatScore(s)}<small>/10</small>
    </span>
  );
}

function ExamCardItem({ exam, examSubs, submitted, aiChildren = [], submissions = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [aiFolderExpanded, setAiFolderExpanded] = useState(false);
  const latest = examSubs[0];

  return (
    <div className={`exam-item${expanded || aiFolderExpanded ? ' is-open' : ''}`}>
      <div className="exam-item-row">
        <div className="exam-item-main">
          <div className={`exam-item-icon${submitted ? ' is-done' : ''}`} aria-hidden="true">
            <UiIcon name={submitted ? 'check' : 'file'} size={18} />
          </div>
          <div className="exam-item-info">
            <div className="exam-item-title">
              {exam.title}
              {!submitted && <span className="status-pill pending_review">Chưa làm</span>}
            </div>
            <div className="meta-row">
              <span><UiIcon name="clock" size={14} /> {exam.durationMinutes} phút</span>
              {exam.description && <span>{exam.description}</span>}
              {latest && (
                <span>
                  Lần gần nhất <ScorePill score={latest.score} />
                </span>
              )}
            </div>
            {aiChildren.length > 0 && (
              <button
                type="button"
                className="ai-chip"
                onClick={() => setAiFolderExpanded((v) => !v)}
                aria-expanded={aiFolderExpanded}
              >
                <UiIcon name="sparkles" size={14} />
                {aiChildren.length} đề luyện tập AI tạo thêm
                <UiIcon name={aiFolderExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="exam-item-actions">
          {submitted ? (
            <>
              <Link to={`/student/exams/${exam.id}`} className="btn sm secondary">
                <UiIcon name="refresh" size={15} /> Làm lại
              </Link>
              <button
                type="button"
                className={`btn sm secondary${expanded ? ' is-active' : ''}`}
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                title="Xem các lần làm bài"
              >
                <UiIcon name="history" size={15} /> Lịch sử
                <span className="count-badge">{examSubs.length}</span>
                <UiIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
              </button>
              {exam.answerKeyFile && (
                <AnswerKeyPanel examId={exam.id} answerKeyFile={exam.answerKeyFile} compact />
              )}
            </>
          ) : (
            <Link to={`/student/exams/${exam.id}`} className="btn sm">
              <UiIcon name="play" size={14} /> Bắt đầu
            </Link>
          )}
        </div>
      </div>

      {expanded && examSubs.length > 0 && (
        <div className="exam-item-panel">
          <div className="exam-item-panel-title">Các lần làm bài</div>
          <div className="attempt-rows">
            {examSubs.map((sub) => (
              <div key={sub.id} className="attempt-row">
                <span className="class-badge">Lần {sub.attempt || 1}</span>
                <ScorePill score={sub.score} />
                <span className="attempt-row-meta">
                  Đúng {sub.correctCount || 0}/{sub.totalQuestions || 0} câu
                </span>
                <span className="attempt-row-meta">
                  {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : ''}
                </span>
                <Link to={`/student/submissions/${sub.id}`} className="btn sm secondary attempt-row-action">
                  Xem kết quả
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiFolderExpanded && aiChildren.length > 0 && (
        <div className="exam-item-panel is-ai">
          <div className="exam-item-panel-title">Đề luyện tập AI tạo thêm từ đề này</div>
          <div className="attempt-rows">
            {aiChildren.map((child) => {
              const childSubs = submissions.filter((s) => s.examId === child.id);
              const lastChildSub = childSubs[childSubs.length - 1];
              return (
                <div key={child.id} className="attempt-row">
                  <span className="attempt-row-title">{child.title}</span>
                  {lastChildSub ? (
                    <>
                      <ScorePill score={lastChildSub.score} />
                      <Link to={`/student/submissions/${lastChildSub.id}`} className="btn sm secondary attempt-row-action">
                        Xem kết quả
                      </Link>
                    </>
                  ) : (
                    <Link to={`/student/exams/${child.id}`} className="btn sm attempt-row-action">
                      <UiIcon name="play" size={14} /> Bắt đầu
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
