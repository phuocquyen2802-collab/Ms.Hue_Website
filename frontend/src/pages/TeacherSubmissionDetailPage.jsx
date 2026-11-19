import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import RoadmapSteps, { RoadmapSummary } from '../components/RoadmapSteps';
import UiIcon, { scoreLevel, formatScore, ScoreTrend } from '../components/UiIcon';
import QuestionDiagram from '../components/QuestionDiagram';
import { toast } from '../components/Notify';
import { formatDuration, AUTO_SUBMIT_TEXT } from '../utils/examTime';

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
      toast.error(err.response?.data?.message || 'Lỗi khi xóa bản đề xuất');
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
      toast.error(err.response?.data?.message || 'Lỗi khi phê duyệt');
    } finally {
      setReviewing(false);
    }
  }

  if (loading) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 26, height: 26 }} />
          <div className="empty-state-title">Đang tải bài làm của học sinh…</div>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container">
        <div className="card">
          <div className="notice is-danger">
            <UiIcon name="alert" size={18} />
            <div className="notice-body">{error || 'Không tìm thấy bài nộp này.'}</div>
          </div>
          <Link to="/teacher/analytics" className="btn-back" style={{ marginTop: 14 }}>
            <span className="btn-back-arrow">←</span> Quay lại Giám sát chất lượng học sinh
          </Link>
        </div>
      </div>
    );
  }

  const initial = submission.studentName ? submission.studentName.trim().charAt(0).toUpperCase() : 'H';
  const percentage = submission.totalQuestions
    ? Math.round((submission.correctCount / submission.totalQuestions) * 100)
    : 0;
  const proposal = submission.proposal;
  const history = submission.historySubmissions || [];
  const statusLabel = (status) => {
    if (status === 'approved') return 'Đã duyệt và gửi';
    if (status === 'rejected') return 'Đã từ chối';
    return 'Chờ giáo viên duyệt';
  };

  return (
    <div className="container submission-page">
      <div className="page-back">
        <Link to="/teacher/analytics" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Giám sát chất lượng học sinh
        </Link>
      </div>

      {/* Hồ sơ bài nộp */}
      <div className="card profile-card">
        <div className="profile-head">
          <div className="profile-id">
            <div className="avatar is-lg" aria-hidden="true">{initial}</div>
            <div>
              <h1 className="profile-name">{submission.studentName}</h1>
              <div className="meta-row">
                <span className="class-badge">
                  {submission.studentClassName ? `Lớp ${submission.studentClassName}` : 'Chưa phân lớp'}
                </span>
                <span>
                  <UiIcon name="file" size={14} /> {submission.examTitle}
                </span>
                <span>
                  <UiIcon name="clock" size={14} /> {new Date(submission.submittedAt).toLocaleString('vi-VN')}
                </span>
                {submission.timeSpentSeconds != null && (
                  <span>
                    <UiIcon name="history" size={14} /> Làm trong {formatDuration(submission.timeSpentSeconds)}
                  </span>
                )}
                {submission.violationCount > 0 && (
                  <span className="score-pill is-ok">Rời màn hình {submission.violationCount} lần</span>
                )}
                {AUTO_SUBMIT_TEXT[submission.submitReason] && (
                  <span className="score-pill is-low">
                    {submission.submitReason === 'timeout' ? 'Tự nộp do hết giờ' : 'Tự nộp do rời màn hình'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <dl className="profile-stats">
            <div className="profile-stat">
              <dt>Điểm</dt>
              <dd className={`score-text is-${scoreLevel(submission.score)}`}>
                {formatScore(submission.score)}<small>/10</small>
              </dd>
            </div>
            <div className="profile-stat">
              <dt>Số câu đúng</dt>
              <dd>
                {submission.correctCount}<small>/{submission.totalQuestions}</small>
              </dd>
            </div>
            <div className="profile-stat">
              <dt>Tỉ lệ đúng</dt>
              <dd>{percentage}<small>%</small></dd>
            </div>
          </dl>
        </div>

        {history.length > 1 && (
          <div className="attempt-strip">
            <span className="attempt-strip-label">Các lần làm</span>
            {history.map((h, idx) => {
              const isCurrent = h.id === submission.id;
              return (
                <React.Fragment key={h.id || idx}>
                  {idx > 0 && <UiIcon name="arrow-right" size={14} className="attempt-sep" />}
                  <Link
                    to={`/teacher/exams/${examId}/submissions/${h.id}`}
                    className={`attempt-link${isCurrent ? ' is-current' : ''}`}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    Lần {h.attempt || idx + 1}
                    <b className={`score-text is-${scoreLevel(h.score)}`}>{formatScore(h.score)}</b>
                  </Link>
                </React.Fragment>
              );
            })}
            <ScoreTrend diff={history[history.length - 1].score - history[0].score} />
          </div>
        )}

        {submission.weakTags && submission.weakTags.length > 0 && (
          <div className="weak-panel">
            <div className="weak-panel-head">
              <UiIcon name="target" size={17} />
              <strong>Chuyên đề làm sai nhiều trong bài này</strong>
            </div>
            <div className="weak-grid">
              {submission.weakTags.map((wt) => {
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Nhận xét và lộ trình ôn tập AI */}
      <div className="card ai-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <UiIcon name="sparkles" size={19} className="ai-mark" />
              <h2>Nhận xét và lộ trình ôn tập AI</h2>
            </div>
            <p className="card-hint">
              AI phân tích các câu làm sai, chỉ ra lý thuyết cần củng cố và đề xuất bài tập tương tự. Giáo viên duyệt trước khi gửi cho học sinh.
            </p>
          </div>
          {proposal && (
            <span className={`status-pill ${proposal.status}`}>
              <span className="status-dot" />
              {statusLabel(proposal.status)}
            </span>
          )}
        </div>

        {generateError && (
          <div className="notice is-danger" style={{ marginBottom: 14 }}>
            <UiIcon name="alert" size={18} />
            <div className="notice-body">{generateError}</div>
          </div>
        )}
        {actionMessage && (
          <div className="notice is-success" style={{ marginBottom: 14 }}>
            <UiIcon name="check" size={18} />
            <div className="notice-body">{actionMessage}</div>
          </div>
        )}

        {!proposal ? (
          <div className="ai-empty">
            <div className="ai-empty-icon">
              <UiIcon name="sparkles" size={24} />
            </div>
            <div>
              <h3>Chưa có nhận xét AI cho bài nộp này</h3>
              <p>
                AI sẽ đọc các câu <strong>{submission.studentName}</strong> làm sai, chỉ ra lỗ hổng kiến thức
                và soạn bộ câu hỏi luyện tập tương tự.
              </p>
            </div>

            <label className={`check-row${includeExercises ? ' is-checked' : ''}`} htmlFor="includeExPre">
              <input
                type="checkbox"
                id="includeExPre"
                checked={includeExercises}
                onChange={(e) => setIncludeExercises(e.target.checked)}
              />
              <span>
                <strong>Tạo kèm bài tập luyện tập</strong>
                <span>Gửi cho học sinh bộ câu hỏi tương tự theo từng chuyên đề.</span>
              </span>
            </label>

            <button className="btn btn-lg" onClick={() => handleGenerateAI(false)} disabled={generating}>
              {generating ? (
                <>
                  <span className="spinner is-on-primary" /> Đang phân tích… {generateProgress}%
                </>
              ) : (
                <>
                  <UiIcon name="sparkles" size={17} /> Phân tích bài làm bằng AI
                </>
              )}
            </button>

            {generating && (
              <div className="score-bar is-thin ai-progress" aria-hidden="true">
                <span className="is-primary" style={{ width: `${generateProgress}%` }} />
              </div>
            )}
          </div>
        ) : (
          <div className="ai-result">
            <div className="ai-toolbar">
              <h3>Nhận xét chung</h3>
              {proposal.status === 'pending_review' && (
                <label className={`toggle-chip${isEditing ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={isEditing} onChange={(e) => setIsEditing(e.target.checked)} />
                  <UiIcon name="edit" size={15} />
                  {isEditing ? 'Đang chỉnh sửa' : 'Chỉnh sửa trước khi gửi'}
                </label>
              )}
            </div>

            {isEditing ? (
              <div className="edit-panel">
                <label className="edit-field-label" htmlFor="editSummary">
                  Lời nhận xét gửi học sinh
                </label>
                <textarea
                  id="editSummary"
                  rows={4}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="Nhập lời nhận xét và động viên cho học sinh…"
                />
              </div>
            ) : (
              <RoadmapSummary text={proposal.roadmap?.summary} />
            )}

            {(isEditing || (proposal.roadmap?.steps?.length > 0)) && (
              <h3 className="ai-section-title">Các bước ôn tập</h3>
            )}

            {isEditing ? (
              <div className="edit-steps">
                {editSteps.map((step, idx) => (
                  <div key={idx} className="edit-step">
                    <div className="edit-step-head">
                      <span className="ex-num">Bước {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStep(idx)}
                        className="icon-btn is-danger"
                        title="Xoá bước này"
                        aria-label={`Xoá bước ${idx + 1}`}
                      >
                        <UiIcon name="trash" size={16} />
                      </button>
                    </div>

                    <div>
                      <label className="edit-field-label">Tên chuyên đề</label>
                      <input
                        type="text"
                        value={step.tag || step.title || ''}
                        onChange={(e) => handleStepChange(idx, 'tag', e.target.value)}
                        placeholder="Ví dụ: Đạo hàm, Cực trị…"
                      />
                    </div>

                    <div>
                      <label className="edit-field-label">Lý thuyết cần nắm</label>
                      <div className="formula-edit-box" style={{ minHeight: 60 }}>
                        <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.theory) }} />
                        <textarea
                          rows={2}
                          value={step.theory || ''}
                          onChange={(e) => handleStepChange(idx, 'theory', e.target.value)}
                          placeholder="Tóm tắt công thức trọng tâm…"
                          className="formula-edit-box-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="edit-field-label">Lỗi hay mắc phải</label>
                      <div className="formula-edit-box" style={{ minHeight: 60 }}>
                        <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.commonMistake) }} />
                        <textarea
                          rows={2}
                          value={step.commonMistake || ''}
                          onChange={(e) => handleStepChange(idx, 'commonMistake', e.target.value)}
                          placeholder="Các bẫy hoặc lỗi học sinh hay mắc…"
                          className="formula-edit-box-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="edit-field-label">Hành động khắc phục</label>
                      <div className="formula-edit-box" style={{ minHeight: 60 }}>
                        <div className="formula-edit-box-preview" dangerouslySetInnerHTML={{ __html: renderMath(step.action) }} />
                        <textarea
                          rows={2}
                          value={step.action || ''}
                          onChange={(e) => handleStepChange(idx, 'action', e.target.value)}
                          placeholder="Việc cụ thể học sinh cần làm…"
                          className="formula-edit-box-input"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={handleAddStep} className="btn sm secondary btn-dashed">
                  <UiIcon name="plus" size={15} /> Thêm bước ôn tập
                </button>
              </div>
            ) : (
              <RoadmapSteps steps={proposal.roadmap?.steps} />
            )}
          </div>
        )}
      </div>

      {/* Chi tiết từng câu trong bài làm */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-row">
            <h2>Chi tiết bài làm</h2>
            <span className="count-badge">{submission.answers?.length || 0} câu</span>
          </div>
        </div>

        <div className="question-list">
          {(() => {
            let currentTopicName = null;
            let qNumInTopic = 0;

            return (submission.answers || []).map((ans, idx) => {
              const isCorrect = ans.isCorrect;
              const topicName = (ans.tags && ans.tags.length > 0) ? ans.tags[0] : 'Chưa phân loại';
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
                    <div className="q-topic">
                      <span className="q-topic-label">Chuyên đề</span>
                      <span className="q-topic-name">{topicName}</span>
                    </div>
                  )}

                  <div className={`question-card ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
                    <div className="question-header">
                      <span className="question-num">Câu {displayQNum}</span>
                      <span className={`status-pill ${isCorrect ? 'approved' : 'rejected'}`}>
                        <UiIcon name={isCorrect ? 'check' : 'close'} size={13} />
                        {isCorrect ? 'Làm đúng' : 'Làm sai'}
                      </span>
                    </div>

                    <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(ans.content) }} />

                    <QuestionDiagram diagram={ans.diagram} />

                    <div className="option-list">
                      {(ans.options || []).map((opt) => {
                        const isSelected = opt.key === ans.selectedAnswer;
                        const isCorrectOpt = opt.key === ans.correctAnswer;
                        let rowClass = 'option-row';
                        if (isCorrectOpt) rowClass += ' correct';
                        if (isSelected) rowClass += isCorrect ? ' is-picked-right' : ' wrong';

                        return (
                          <div key={opt.key} className={rowClass}>
                            <span className="option-key">{opt.key}.</span>
                            <span className="option-text" dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                            {isSelected && (
                              <span className={`option-tag ${isCorrect ? 'is-right' : 'is-wrong'}`}>
                                <UiIcon name={isCorrect ? 'check' : 'close'} size={12} />
                                Học sinh chọn
                              </span>
                            )}
                            {!isSelected && isCorrectOpt && (
                              <span className="option-tag is-right">
                                <UiIcon name="check" size={12} /> Đáp án đúng
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Phân tích AI riêng cho câu làm sai (sau khi đã chạy AI) */}
                    {!isCorrect && proposal?.questionAnalyses && (() => {
                      const wqIdx = (proposal.wrongQuestions || []).findIndex((wq) => wq.id === ans.questionId);
                      if (wqIdx === -1) return null;
                      const qIndex = wqIdx + 1;
                      const qa = proposal.questionAnalyses.find((x) => (x.questionIndex || 0) === qIndex);
                      if (!qa) return null;

                      return (
                        <div className="q-analysis">
                          {qa.mistakeAnalysis && (
                            <section className="rm-block rm-mistake">
                              <div className="rm-label">
                                <UiIcon name="alert" size={15} /> Lỗ hổng kiến thức
                              </div>
                              <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(qa.mistakeAnalysis) }} />
                            </section>
                          )}
                          {qa.correctSolution && (
                            <section className="rm-block rm-action">
                              <div className="rm-label">
                                <UiIcon name="check" size={15} /> Cách khắc phục
                              </div>
                              <div className="rm-body" dangerouslySetInnerHTML={{ __html: renderMath(qa.correctSolution) }} />
                            </section>
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

      {/* Bài tập bổ sung và duyệt gửi - chỉ hiện khi đã có đề xuất AI */}
      {proposal && (
        <div className="card">
          <div className="card-header">
            <div className="card-title-group">
              <div className="card-title-row">
                <h2>Bài tập bổ sung và duyệt gửi</h2>
              </div>
              <p className="card-hint">Kiểm tra bộ câu hỏi AI soạn, chỉnh sửa nếu cần rồi gửi cho học sinh.</p>
            </div>
          </div>

          <div className="approve-layout">
            {groupedExercises && groupedExercises.length > 0 && (
              <details className="ex-details" open>
                <summary>
                  <UiIcon name="chevron-down" size={17} className="ex-chevron" />
                  <span>Bộ bài tập luyện tập</span>
                  <span className="count-badge">{editExercises.length} câu</span>
                  <span className="count-badge">{groupedExercises.length} chuyên đề</span>
                </summary>

                <div className="ex-groups">
                  {groupedExercises.map((grp, gIdx) => (
                    <div key={gIdx} className="ex-group">
                      <div className="ex-group-head">
                        <span className="ex-group-label">Chuyên đề {gIdx + 1}</span>
                        <span className="ex-group-name">{grp.topic}</span>
                        <span className="count-badge">{grp.items.length} câu</span>
                        {isEditing && (
                          <button type="button" onClick={() => handleAddExercise(grp.topic)} className="btn sm secondary">
                            <UiIcon name="plus" size={14} /> Thêm câu
                          </button>
                        )}
                      </div>

                      <div className="ex-list">
                        {grp.items.map((ex, qIdx) => {
                          const origIdx = ex.originalIdx;
                          return (
                            <div key={origIdx} className="ex-item">
                              {isEditing ? (
                                <div className="ex-edit">
                                  <div className="ex-item-head">
                                    <span className="ex-num">Câu {qIdx + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveExercise(origIdx)}
                                      className="icon-btn is-danger"
                                      title="Xoá câu này"
                                      aria-label={`Xoá câu ${qIdx + 1}`}
                                    >
                                      <UiIcon name="trash" size={16} />
                                    </button>
                                  </div>

                                  <div>
                                    <label className="edit-field-label">
                                      Đề bài <span className="edit-field-hint">(công thức gõ dạng LaTeX, ví dụ $x^2$)</span>
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

                                  <div className="answer-picker">
                                    <span className="edit-field-label" style={{ margin: 0 }}>Đáp án đúng</span>
                                    {['A', 'B', 'C', 'D'].map((key) => (
                                      <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleExerciseChange(origIdx, 'correctAnswer', key)}
                                        className={ex.correctAnswer === key ? 'is-active' : ''}
                                        aria-pressed={ex.correctAnswer === key}
                                      >
                                        {key}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="ex-content">
                                  <span className="ex-num">Câu {qIdx + 1}</span>{' '}
                                  <span dangerouslySetInnerHTML={{ __html: renderMath(ex.content) }} />
                                </div>
                              )}

                              <QuestionDiagram diagram={ex.diagram} />

                              <div className="option-list">
                                {(ex.options || []).map((opt) => (
                                  <div key={opt.key} className={`option-row${opt.key === ex.correctAnswer ? ' correct' : ''}`}>
                                    <span className="option-key">{opt.key}.</span>
                                    {isEditing ? (
                                      <div className="formula-edit-box" style={{ flex: 1 }}>
                                        <div
                                          className="formula-edit-box-preview"
                                          style={{ fontSize: 13.5 }}
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
                                      <span className="option-text" dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                                    )}
                                    {opt.key === ex.correctAnswer && (
                                      <span className="option-tag is-right">
                                        <UiIcon name="check" size={12} /> Đáp án đúng
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
                      className="btn sm secondary btn-dashed"
                    >
                      <UiIcon name="plus" size={15} /> Thêm chuyên đề bài tập
                    </button>
                  )}
                </div>
              </details>
            )}

            {proposal.status === 'pending_review' ? (
              <div className="approve-box">
                <h3>Duyệt và gửi cho học sinh</h3>

                <label className={`check-row${includeExercises ? ' is-checked' : ''}`} htmlFor="includeExPost">
                  <input
                    type="checkbox"
                    id="includeExPost"
                    checked={includeExercises}
                    onChange={(e) => setIncludeExercises(e.target.checked)}
                  />
                  <span>
                    <strong>Gửi kèm {proposal.exercises?.length || 0} câu bài tập luyện tập</strong>
                    <span>
                      {includeExercises
                        ? 'Hệ thống tạo một đề luyện tập mới và giao ngay cho học sinh.'
                        : 'Chỉ gửi nhận xét và lộ trình ôn tập, không tạo đề luyện tập.'}
                    </span>
                  </span>
                </label>

                <div className="action-row">
                  <button className="btn success" onClick={() => handleApprove(proposal.id)} disabled={reviewing}>
                    <UiIcon name="send" size={16} /> {reviewing ? 'Đang gửi…' : 'Duyệt và gửi cho học sinh'}
                  </button>
                  <button className="btn secondary" onClick={() => handleGenerateAI(true)} disabled={generating}>
                    <UiIcon name="refresh" size={16} /> Tạo lại bằng AI
                  </button>
                  <button
                    className="btn outline-danger"
                    onClick={() => setShowRejectModal(true)}
                    disabled={reviewing || generating}
                  >
                    <UiIcon name="close" size={16} /> Từ chối đề xuất
                  </button>
                </div>
              </div>
            ) : proposal.status === 'approved' ? (
              <div className="notice is-success">
                <UiIcon name="check" size={18} />
                <div className="notice-body">
                  <div className="notice-title">Đã duyệt và gửi lộ trình ôn tập cho học sinh</div>
                  <div className="notice-text">
                    {proposal.examId ? 'Đề luyện tập đã được tạo và giao cho học sinh.' : 'Học sinh đã nhận được nhận xét và lộ trình ôn tập.'}
                  </div>
                </div>
                <button className="btn sm secondary" onClick={() => handleGenerateAI(true)} disabled={generating}>
                  <UiIcon name="refresh" size={15} /> Tạo lộ trình mới
                </button>
              </div>
            ) : (
              <div className="notice is-danger">
                <UiIcon name="close" size={18} />
                <div className="notice-body">
                  <div className="notice-title">Đề xuất AI này đã bị từ chối</div>
                </div>
                <button className="btn sm" onClick={() => handleGenerateAI(true)} disabled={generating}>
                  <UiIcon name="sparkles" size={15} /> Tạo đề xuất mới
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hộp thoại từ chối đề xuất AI */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => !rejectActionLoading && setShowRejectModal(false)}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div className="modal-icon">
                <UiIcon name="trash" size={20} />
              </div>
              <div>
                <h3 id="reject-title">Từ chối đề xuất AI</h3>
                <p>Chọn cách xử lý bản lộ trình và bài tập hiện tại.</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => !rejectActionLoading && setShowRejectModal(false)}
                aria-label="Đóng"
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>

            <div className="choice-list">
              <button type="button" className="choice-card is-danger" onClick={handleDeleteAndExit} disabled={rejectActionLoading}>
                <span className="choice-icon"><UiIcon name="trash" size={18} /></span>
                <span>
                  <span className="choice-title">Xoá bản này</span>
                  <span className="choice-desc">Xoá nhận xét và bài tập AI vừa tạo, trang quay về trạng thái chưa phân tích.</span>
                </span>
              </button>
              <button type="button" className="choice-card" onClick={handleDeleteAndRegenerate} disabled={rejectActionLoading}>
                <span className="choice-icon"><UiIcon name="refresh" size={18} /></span>
                <span>
                  <span className="choice-title">Xoá và để AI tạo lại</span>
                  <span className="choice-desc">Xoá bản cũ và yêu cầu AI phân tích lại bài làm để tạo lộ trình và bài tập mới.</span>
                </span>
              </button>
            </div>

            <div className="modal-foot">
              <button type="button" className="btn secondary" disabled={rejectActionLoading} onClick={() => setShowRejectModal(false)}>
                Giữ nguyên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
