import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import WeakTopicsChart from '../components/WeakTopicsChart';
import RoadmapSteps, { RoadmapSummary } from '../components/RoadmapSteps';
import UiIcon, { scoreLevel, formatScore, ScoreTrend } from '../components/UiIcon';
import { RoadmapSentPill, RoadmapGeneratingState } from '../components/RoadmapStatus';

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

  // AI đang soạn lộ trình cho lần làm này: hỏi lại tới khi có kết quả.
  const aiWorking = data?.roadmapStatus === 'generating';
  useEffect(() => {
    if (!aiWorking) return undefined;
    const timer = setInterval(() => {
      if (document.hidden) return;
      api.get(`/student/submissions/${submissionId}`).then((res) => {
        if (res.data?.id === submissionId) setData(res.data);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [aiWorking, submissionId]);

  if (loading || !data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải lần làm bài…</div>
        </div>
      </div>
    );
  }

  const currentAttempt = data.attempt || 1;
  const history = data.historySubmissions || [];
  const prevAttemptSub = history.find((h) => (h.attempt || 1) === currentAttempt - 1);
  const maxScore = history.length > 0 ? Math.max(...history.map((h) => h.score || 0)) : data.score;
  const isBestScore = data.score >= maxScore;

  const roadmap = data.roadmap;
  const roadmapStatus = data.roadmapStatus;

  const accuracy = data.totalQuestions > 0 ? Math.round((data.correctCount / data.totalQuestions) * 100) : 0;
  const level = scoreLevel(data.score);
  const levelText = level === 'good' ? 'Kết quả tốt' : level === 'ok' ? 'Đạt yêu cầu' : 'Cần ôn tập thêm';

  return (
    <div className="container">
      <div className="page-back">
        <Link to="/student" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Luyện đề
        </Link>
      </div>

      {/* Tổng quan điểm */}
      <div className="card profile-card">
        <div className="profile-head">
          <div>
            <h1 className="profile-name">{data.examTitle || 'Chi tiết lần làm bài'}</h1>
            <div className="meta-row">
              <span className="class-badge">Lần {currentAttempt}</span>
              {isBestScore && history.length > 1 && (
                <span className="status-pill approved">Điểm cao nhất của đề</span>
              )}
              <span>
                <UiIcon name="clock" size={14} />
                {data.submittedAt ? new Date(data.submittedAt).toLocaleString('vi-VN') : '—'}
              </span>
            </div>
          </div>

          <dl className="profile-stats">
            <div className="profile-stat">
              <dt>Điểm</dt>
              <dd className={`score-text is-${level}`}>
                {formatScore(data.score)}<small>/10</small>
              </dd>
            </div>
            <div className="profile-stat">
              <dt>Số câu đúng</dt>
              <dd>
                {data.correctCount}<small>/{data.totalQuestions}</small>
              </dd>
            </div>
            <div className="profile-stat">
              <dt>Tỉ lệ đúng</dt>
              <dd>{accuracy}<small>%</small></dd>
            </div>
          </dl>
        </div>

        <div className="result-verdict">
          <span className={`score-pill is-${level}`}>{levelText}</span>
          {prevAttemptSub && (
            <span className="result-verdict-compare">
              So với lần {currentAttempt - 1}: <ScoreTrend diff={data.score - prevAttemptSub.score} />
            </span>
          )}
        </div>
      </div>

      {/* Chuyên đề cần cải thiện */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <UiIcon name="target" size={18} className="title-icon" />
              <h2>Chuyên đề cần cải thiện</h2>
            </div>
            <p className="card-hint">Tỉ lệ làm sai theo từng chuyên đề có trong đề.</p>
          </div>
        </div>

        {data.examWeakTopics && data.examWeakTopics.length > 0 ? (
          <div className="weak-grid" style={{ marginBottom: 18 }}>
            {data.examWeakTopics.map((wt) => {
              const percent = Math.round(wt.wrongRate * 100);
              return (
                <div key={wt.tag} className="weak-item">
                  <div className="weak-item-row">
                    <span className="weak-name" title={wt.tag}>{wt.tag}</span>
                    <span className="weak-rate">Sai {percent}%</span>
                  </div>
                  <div className="score-bar" aria-hidden="true">
                    <span className="is-low" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="weak-item-sub">Sai {wt.totalWrong}/{wt.totalAnswered} câu</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="notice is-success" style={{ marginBottom: 18 }}>
            <UiIcon name="check" size={18} />
            <div className="notice-body">Bạn làm đúng toàn bộ các câu trong đề này.</div>
          </div>
        )}

        {data.examTopicStats && data.examTopicStats.length > 0 && (
          <WeakTopicsChart data={data.examTopicStats} />
        )}
      </div>

      {/* Lộ trình ôn tập cho lần làm này */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <UiIcon name="route" size={18} className="title-icon" />
              <h2>Lộ trình ôn tập cho lần làm này</h2>
            </div>
            <p className="card-hint">AI phân tích các câu sai và soạn lộ trình ôn tập riêng cho bạn.</p>
          </div>
          <RoadmapSentPill roadmap={roadmap} />
        </div>

        {roadmap ? (
          <div>
            {roadmap.weakTags && roadmap.weakTags.length > 0 && (
              <div className="focus-tags">
                <span className="focus-tags-label">Trọng tâm cần ôn</span>
                {roadmap.weakTags.map((tag) => (
                  <span className="focus-tag" key={tag}>{tag}</span>
                ))}
              </div>
            )}
            <RoadmapSummary text={roadmap.roadmap?.summary} />
            <RoadmapSteps steps={roadmap.roadmap?.steps} />
          </div>
        ) : roadmapStatus === 'generating' ? (
          <RoadmapGeneratingState />
        ) : roadmapStatus === 'pending_review' ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="clock" size={24} /></div>
            <div className="empty-state-title">Lộ trình đang chờ giáo viên duyệt</div>
            <p className="empty-state-desc">
              AI đã phân tích bài làm và gửi cho giáo viên. Lộ trình sẽ hiện ở đây ngay khi giáo viên duyệt.
            </p>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon is-svg">
              <UiIcon name={data.score === 10 ? 'check' : 'route'} size={24} />
            </div>
            <div className="empty-state-title">
              {data.score === 10 ? 'Bạn đạt điểm tuyệt đối' : 'Chưa có lộ trình cho lần làm này'}
            </div>
            <p className="empty-state-desc">
              {data.score === 10
                ? 'Không có câu sai nào cần khắc phục.'
                : 'Bạn có thể làm lại đề hoặc hỏi giáo viên để được hướng dẫn thêm.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
