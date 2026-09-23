import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';

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
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải lộ trình ôn tập...</div>
        </div>
      </div>
    );
  }

  function renderExamRow(s, extraStyle = {}) {
    const isSelected = activeSubmission?.id === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => handleSelect(s.id)}
        title={s.examTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          textAlign: 'left',
          border: isSelected ? '1.5px solid var(--gold, #c98a2c)' : '1px solid var(--border-color)',
          borderRadius: 10,
          padding: '9px 12px',
          fontSize: 13,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          background: isSelected ? 'var(--gold-soft, #f3e4c6)' : '#fff',
          ...extraStyle,
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{s.isAiGenerated ? '✨' : '📝'}</span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isSelected ? 700 : 500,
            color: isSelected ? 'var(--gold-text, #8a611f)' : 'var(--text-main)',
          }}
        >
          {s.examTitle}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11.5,
            fontWeight: 700,
            padding: '2px 9px',
            borderRadius: 999,
            background: isSelected ? 'rgba(255,255,255,0.6)' : 'var(--bg-subtle)',
            color: isSelected ? 'var(--gold-text, #8a611f)' : 'var(--text-muted)',
          }}
        >
          Lần {s.attempt}
        </span>
        {isSelected && <span style={{ color: 'var(--gold-text, #8a611f)', fontSize: 13 }}>✓</span>}
      </button>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1140, paddingBottom: 60 }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Lộ trình học tập theo đề</h1>
          <p className="page-subtitle">Xem lộ trình ôn tập AI đã sinh ra, theo từng đề thi</p>
        </div>
      </div>

      {submissionsWithRoadmap.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">🗺️</div>
            <div className="empty-state-title">Chưa có lộ trình ôn tập nào</div>
            <p className="empty-state-desc">
              Lộ trình ôn tập AI sẽ xuất hiện ở đây sau khi bạn nộp bài và được sinh/duyệt lộ trình.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 20, alignItems: 'start' }}>
          {/* Danh sách đề bên trái */}
          <div
            className="card"
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              position: 'sticky',
              top: 16,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
              🗂️ Chọn đề để xem lộ trình
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 560,
                overflowY: 'auto',
                paddingRight: 2,
              }}
            >
              {topLevelGroups.map((g) => {
                const aiChildren = aiChildrenByParent[g.examId] || [];
                const folderExpanded = expandedAiFolderIds.has(g.examId);
                return (
                  <div key={g.examId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {g.attempts.map((s) => renderExamRow(s))}

                    {aiChildren.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleAiFolder(g.examId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            background: 'transparent',
                            padding: '4px 12px 4px 28px',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                        >
                          📂 {aiChildren.reduce((sum, c) => sum + c.attempts.length, 0)} lộ trình AI sinh thêm{' '}
                          {folderExpanded ? '▲' : '▼'}
                        </button>

                        {folderExpanded && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              paddingLeft: 22,
                              borderLeft: '2px dashed var(--border-color)',
                              marginLeft: 12,
                            }}
                          >
                            {aiChildren.flatMap((c) => c.attempts.map((s) => renderExamRow(s, { fontSize: 12.5, padding: '8px 12px' })))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ghi chú lộ trình bên phải */}
          <div className="card" style={{ borderRadius: 12 }}>
            <div
              className="card-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
            >
              <div className="card-title-group">
                <h2 style={{ fontSize: 17, margin: 0 }}>
                  ✨ Lộ trình ôn tập {activeSubmission ? `- ${activeSubmission.examTitle} (Lần ${activeSubmission.attempt})` : ''}
                </h2>
              </div>
              {activeSubmission?.roadmap?.reviewedAt && (
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
                  ✓ Giáo viên đã duyệt ({new Date(activeSubmission.roadmap.reviewedAt).toLocaleDateString('vi-VN')})
                </span>
              )}
            </div>

            {activeSubmission?.roadmap ? (
              <div>
                {activeSubmission.roadmap.weakTags && activeSubmission.roadmap.weakTags.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-main)' }}>Chủ đề trọng tâm cần ôn:</span>
                    {activeSubmission.roadmap.weakTags.map((tag) => (
                      <span className="tag-badge weak" key={tag}>
                        🎯 {tag}
                      </span>
                    ))}
                  </div>
                )}

                {activeSubmission.roadmap.roadmap?.summary && (
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
                    dangerouslySetInnerHTML={{ __html: renderMath(activeSubmission.roadmap.roadmap.summary) }}
                  />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {activeSubmission.roadmap.roadmap?.steps?.map((s) => (
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
                          📘 <strong>Lý thuyết cần nắm:</strong>{' '}
                          <span dangerouslySetInnerHTML={{ __html: renderMath(s.theory) }} />
                        </p>
                      )}
                      {s.commonMistake && (
                        <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 8, color: '#b91c1c' }}>
                          ⚠️ <strong>Lỗi hay mắc phải:</strong>{' '}
                          <span dangerouslySetInnerHTML={{ __html: renderMath(s.commonMistake) }} />
                        </p>
                      )}
                      {s.action && (
                        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: '#047857' }}>
                          ✅ <strong>Việc cần làm:</strong> <span dangerouslySetInnerHTML={{ __html: renderMath(s.action) }} />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <div className="empty-state-icon">🗺️</div>
                <div className="empty-state-title">Chọn một đề bên trái để xem lộ trình</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
