import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import RoadmapSteps, { RoadmapSummary } from '../components/RoadmapSteps';
import UiIcon from '../components/UiIcon';

export default function StudentRoadmapsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const subIdFromUrl = searchParams.get('submissionId');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(subIdFromUrl || '');
  const [expandedAiFolderIds, setExpandedAiFolderIds] = useState(new Set());

  useEffect(() => {
    api
      .get('/student/me/weak-topics')
      .then((res) => {
        setData(res.data);
        const subs = res.data?.submissions || [];
        const withRoadmap = subs.filter((s) => s.roadmap);
        if (withRoadmap.length > 0) {
          const match = subIdFromUrl ? withRoadmap.find((s) => s.id === subIdFromUrl) : null;
          setSelectedSubmissionId(match ? match.id : withRoadmap[0].id);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submissions = useMemo(() => data?.submissions || [], [data]);
  const submissionsWithRoadmap = useMemo(() => submissions.filter((s) => s.roadmap), [submissions]);

  const activeSubmission = useMemo(() => {
    if (submissionsWithRoadmap.length === 0) return null;
    return submissionsWithRoadmap.find((s) => s.id === selectedSubmissionId) || submissionsWithRoadmap[0];
  }, [submissionsWithRoadmap, selectedSubmissionId]);

  function toggleAiFolder(examId) {
    setExpandedAiFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) next.delete(examId);
      else next.add(examId);
      return next;
    });
  }

  const handleSelect = (id) => {
    setSelectedSubmissionId(id);
    setSearchParams({ submissionId: id });
  };

  // Nhóm theo đề: mỗi đề giữ đợt làm có lộ trình mới nhất, đề AI sinh thêm lồng trong đề gốc
  const { topLevelGroups, aiChildrenByParent } = useMemo(() => {
    const examIds = new Set(submissionsWithRoadmap.map((s) => s.examId));
    const byExam = {};
    submissionsWithRoadmap.forEach((s) => {
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
    allGroups.forEach((g) => g.attempts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)));
    const childrenMap = {};
    allGroups.forEach((g) => {
      if (g.sourceExamId && examIds.has(g.sourceExamId)) {
        if (!childrenMap[g.sourceExamId]) childrenMap[g.sourceExamId] = [];
        childrenMap[g.sourceExamId].push(g);
      }
    });
    const topGroups = allGroups.filter((g) => !g.sourceExamId || !examIds.has(g.sourceExamId));
    return { topLevelGroups: topGroups, aiChildrenByParent: childrenMap };
  }, [submissionsWithRoadmap]);

  if (loading || !data) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải lộ trình ôn tập…</div>
        </div>
      </div>
    );
  }

  function renderExamRow(s, isNested = false) {
    const isSelected = activeSubmission?.id === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => handleSelect(s.id)}
        title={s.examTitle}
        className={`pick-item${isSelected ? ' is-selected' : ''}${isNested ? ' is-nested' : ''}`}
        aria-pressed={isSelected}
      >
        <UiIcon name={s.isAiGenerated || isNested ? 'sparkles' : 'file'} size={16} className="pick-item-icon" />
        <span className="pick-item-title">{s.examTitle}</span>
        <span className="pick-item-meta">
          <span className="class-badge">Lần {s.attempt}</span>
        </span>
      </button>
    );
  }

  const roadmap = activeSubmission?.roadmap;

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lộ trình ôn tập</h1>
          <p className="page-subtitle">Lộ trình AI soạn riêng cho từng lần làm bài, đã được giáo viên duyệt.</p>
        </div>
      </div>

      {submissionsWithRoadmap.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="route" size={24} /></div>
            <div className="empty-state-title">Chưa có lộ trình ôn tập nào</div>
            <p className="empty-state-desc">
              Sau khi bạn nộp bài và giáo viên duyệt lộ trình do AI đề xuất, lộ trình sẽ hiện ở đây.
            </p>
          </div>
        </div>
      ) : (
        <div className="split-layout">
          <aside className="card split-aside">
            <div className="split-aside-title">Chọn đề</div>
            <div className="attempt-picker">
              {topLevelGroups.map((g) => {
                const aiChildren = aiChildrenByParent[g.examId] || [];
                const folderExpanded = expandedAiFolderIds.has(g.examId);
                return (
                  <div key={g.examId} className="attempt-picker-group">
                    {g.attempts.map((s) => renderExamRow(s))}
                    {aiChildren.length > 0 && (
                      <>
                        <button
                          type="button"
                          className="pick-folder"
                          onClick={() => toggleAiFolder(g.examId)}
                          aria-expanded={folderExpanded}
                        >
                          <UiIcon name={folderExpanded ? 'chevron-up' : 'chevron-down'} size={14} />
                          {aiChildren.reduce((sum, c) => sum + c.attempts.length, 0)} lộ trình từ đề luyện tập AI
                        </button>
                        {folderExpanded && (
                          <div className="pick-nested">
                            {aiChildren.flatMap((c) => c.attempts.map((s) => renderExamRow(s, true)))}
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
            <div className="card">
              <div className="card-header">
                <div className="card-title-group">
                  <div className="card-title-row">
                    <UiIcon name="route" size={18} className="title-icon" />
                    <h2>{activeSubmission ? activeSubmission.examTitle : 'Lộ trình ôn tập'}</h2>
                  </div>
                  {activeSubmission && <p className="card-hint">Lần làm {activeSubmission.attempt}</p>}
                </div>
                {roadmap?.reviewedAt && (
                  <span className="status-pill approved">
                    <UiIcon name="check" size={13} />
                    Giáo viên đã duyệt {new Date(roadmap.reviewedAt).toLocaleDateString('vi-VN')}
                  </span>
                )}
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
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon is-svg"><UiIcon name="route" size={24} /></div>
                  <div className="empty-state-title">Chọn một đề bên trái để xem lộ trình</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
