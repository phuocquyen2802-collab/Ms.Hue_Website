import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import useAutoRefresh, { setIfChanged } from '../hooks/useAutoRefresh';
import WeakTopicsChart from '../components/WeakTopicsChart';
import { renderMath } from '../utils/mathRender';
import RoadmapSteps, { RoadmapSummary } from '../components/RoadmapSteps';
import UiIcon from '../components/UiIcon';

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

  // Lần nộp mới, lộ trình vừa được duyệt: tự cập nhật, giữ nguyên lần làm đang chọn.
  useAutoRefresh(async () => {
    const res = await api.get('/student/me/weak-topics');
    setIfChanged(setData, res.data);
  }, 20000);

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

  const [expandedAiFolderIds, setExpandedAiFolderIds] = useState(new Set());
  function toggleAiFolder(examId) {
    setExpandedAiFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) next.delete(examId);
      else next.add(examId);
      return next;
    });
  }

  // Nhóm các đợt làm bài theo đề: đề AI sinh thêm (sourceExamId) sẽ nằm lồng trong đề gốc
  const { topLevelGroups, aiChildrenByParent } = useMemo(() => {
    const examIds = new Set(submissions.map((s) => s.examId));
    const byExam = {};
    submissions.forEach((s) => {
      if (!byExam[s.examId]) {
        byExam[s.examId] = {
          examId: s.examId,
          examTitle: s.examTitle,
          isAiGenerated: s.isAiGenerated,
          sourceExamId: s.sourceExamId,
          attempts: [],
        };
      }
      byExam[s.examId].attempts.push(s);
    });
    const allGroups = Object.values(byExam);
    const childrenMap = {};
    allGroups.forEach((g) => {
      if (g.sourceExamId && examIds.has(g.sourceExamId)) {
        if (!childrenMap[g.sourceExamId]) childrenMap[g.sourceExamId] = [];
        childrenMap[g.sourceExamId].push(g);
      }
    });
    const topGroups = allGroups.filter((g) => !g.sourceExamId || !examIds.has(g.sourceExamId));
    return { topLevelGroups: topGroups, aiChildrenByParent: childrenMap };
  }, [submissions]);

  if (loading || !data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải kết quả…</div>
        </div>
      </div>
    );
  }

  const renderPickItem = (s, isAi = false) => {
    const isSelected = activeSubmission?.id === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => handleSelectSubmission(s.id)}
        title={s.examTitle}
        className={`pick-item${isSelected ? ' is-selected' : ''}${isAi ? ' is-nested' : ''}`}
        aria-pressed={isSelected}
      >
        <UiIcon name={s.isAiGenerated || isAi ? 'sparkles' : 'file'} size={16} className="pick-item-icon" />
        <span className="pick-item-title">{s.examTitle}</span>
        <span className="pick-item-meta">
          <span className="class-badge">Lần {s.attempt}</span>
          {s.roadmapStatus !== 'approved' && (
            <span className="pick-item-flag" title="Giáo viên chưa gửi lộ trình ôn tập cho lần làm này">
              Chưa có lộ trình
            </span>
          )}
        </span>
      </button>
    );
  };

  const contextLabel = activeSubmission ? `${activeSubmission.examTitle}, lần ${activeSubmission.attempt}` : '';

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kết quả của tôi</h1>
          <p className="page-subtitle">Chuyên đề còn yếu, thống kê theo chuyên đề và lộ trình ôn tập của từng lần làm bài.</p>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="file" size={24} /></div>
            <div className="empty-state-title">Bạn chưa nộp bài nào</div>
            <p className="empty-state-desc">Làm một đề trong mục Luyện đề để xem kết quả và lộ trình ôn tập ở đây.</p>
            <Link to="/student" className="btn sm">Đến Luyện đề</Link>
          </div>
        </div>
      ) : (
        <div className="split-layout">
          {/* Chọn đề và lần làm */}
          <aside className="card split-aside">
            <div className="split-aside-title">Chọn lần làm bài</div>
            <div className="attempt-picker">
              {topLevelGroups.map((g) => {
                const aiChildren = aiChildrenByParent[g.examId] || [];
                const folderExpanded = expandedAiFolderIds.has(g.examId);
                const aiAttemptCount = aiChildren.reduce((sum, c) => sum + c.attempts.length, 0);
                return (
                  <div key={g.examId} className="attempt-picker-group">
                    {g.attempts.map((s) => renderPickItem(s))}
                    {aiChildren.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="pick-folder"
                          onClick={() => toggleAiFolder(g.examId)}
                          aria-expanded={folderExpanded}
                        >
                          <UiIcon name={folderExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
                          {aiAttemptCount} lần làm đề luyện tập AI
                        </button>
                        {folderExpanded && (
                          <div className="pick-nested">
                            {aiChildren.flatMap((c) => c.attempts.map((s) => renderPickItem(s, true)))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="split-main">
            {/* Chuyên đề cần chú ý */}
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <div className="card-title-row">
                    <UiIcon name="target" size={18} className="title-icon" />
                    <h2>Chuyên đề cần chú ý</h2>
                  </div>
                  {contextLabel && <p className="card-hint">{contextLabel}</p>}
                </div>
              </div>

              {displayedWeakTags.length === 0 ? (
                <div className="notice is-success">
                  <UiIcon name="check" size={18} />
                  <div className="notice-body">Bạn không có chuyên đề nào sai nhiều trong lần làm này.</div>
                </div>
              ) : (
                <div className="weak-grid">
                  {displayedWeakTags.map((t) => {
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
                        {t.totalAnswered ? (
                          <div className="weak-item-sub">Sai {t.totalWrong}/{t.totalAnswered} câu</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Thống kê theo chuyên đề */}
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <div className="card-title-row">
                    <UiIcon name="chart" size={18} className="title-icon" />
                    <h2>Thống kê theo chuyên đề</h2>
                  </div>
                  {activeSubmission && <p className="card-hint">{activeSubmission.examTitle}</p>}
                </div>
              </div>
              <WeakTopicsChart data={displayedTopicStats} />
            </div>

            {/* Lộ trình ôn tập AI */}
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <div className="card-title-row">
                    <UiIcon name="route" size={18} className="title-icon" />
                    <h2>Lộ trình ôn tập</h2>
                  </div>
                  {contextLabel && <p className="card-hint">{contextLabel}</p>}
                </div>
                {activeRoadmap && activeRoadmap.reviewedAt && (
                  <span className="status-pill approved">
                    <UiIcon name="check" size={13} />
                    Giáo viên đã duyệt {new Date(activeRoadmap.reviewedAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
              </div>

              {activeRoadmap ? (
                <div>
                  {activeRoadmap.weakTags && activeRoadmap.weakTags.length > 0 && (
                    <div className="focus-tags">
                      <span className="focus-tags-label">Trọng tâm cần ôn</span>
                      {activeRoadmap.weakTags.map((tag) => (
                        <span className="focus-tag" key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  <RoadmapSummary text={activeRoadmap.roadmap?.summary} />
                  <RoadmapSteps steps={activeRoadmap.roadmap?.steps} />

                  {activeRoadmap.questionAnalyses && activeRoadmap.questionAnalyses.length > 0 && (
                    <div className="wrong-analyses">
                      <h3 className="ai-section-title">Phân tích từng câu em làm sai</h3>
                      {activeRoadmap.questionAnalyses.map((qa, idx) => {
                        const wrongQ = (activeRoadmap.wrongQuestions || [])[qa.questionIndex - 1] || (activeRoadmap.wrongQuestions || [])[idx];
                        return (
                          <div key={idx} className="wrong-analysis">
                            <div className="wrong-analysis-head">
                              <span className="status-pill rejected">Câu sai {qa.questionIndex || idx + 1}</span>
                              {wrongQ && (
                                <span className="meta-row">
                                  <span>Đáp án đúng <b className="score-text is-good">{wrongQ.correctAnswer}</b></span>
                                  <span>Em chọn <b className="score-text is-low">{wrongQ.selectedOption || 'Chưa chọn'}</b></span>
                                </span>
                              )}
                            </div>
                            {wrongQ && (
                              <div className="wrong-analysis-question" dangerouslySetInnerHTML={{ __html: renderMath(wrongQ.content) }} />
                            )}
                            <div className="q-analysis">
                              {qa.mistakeAnalysis && (
                                <section className="rm-block rm-mistake">
                                  <div className="rm-label"><UiIcon name="alert" size={15} /> Lỗ hổng kiến thức</div>
                                  <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(qa.mistakeAnalysis) }} />
                                </section>
                              )}
                              {qa.correctSolution && (
                                <section className="rm-block rm-action">
                                  <div className="rm-label"><UiIcon name="check" size={15} /> Cách khắc phục</div>
                                  <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(qa.correctSolution) }} />
                                </section>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeSubmission?.examId && (
                    <div className="card-foot-actions">
                      <Link to={`/student/exams/${activeSubmission.examId}`} className="btn">
                        <UiIcon name="refresh" size={16} /> Làm lại đề này
                      </Link>
                    </div>
                  )}
                </div>
              ) : activeRoadmapStatus === 'pending_review' ? (
                <div className="empty-state">
                  <div className="empty-state-icon is-svg"><UiIcon name="clock" size={24} /></div>
                  <div className="empty-state-title">Lộ trình đang chờ giáo viên duyệt</div>
                  <p className="empty-state-desc">
                    AI đã phân tích bài làm và gửi cho giáo viên. Lộ trình sẽ hiện ở đây ngay khi giáo viên duyệt.
                  </p>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon is-svg"><UiIcon name="route" size={24} /></div>
                  <div className="empty-state-title">Chưa có lộ trình cho lần làm này</div>
                  <p className="empty-state-desc">
                    Khi bài làm có câu sai, giáo viên sẽ duyệt và gửi lộ trình ôn tập do AI đề xuất cho bạn.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
