import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import Celebration from '../components/Celebration';
import { useAuth } from '../context/AuthContext';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';
import UiIcon, { scoreLevel, formatScore } from '../components/UiIcon';
import { formatDuration, AUTO_SUBMIT_TEXT } from '../utils/examTime';

// Từ mức điểm này trở lên (thang 10) là làm bài xuất sắc: hiện cúp vàng,
// lời chúc mừng và pháo giấy ngay sau khi nộp bài.
export const EXCELLENT_SCORE = 8;

function celebrationTitle(score) {
  if (score >= 10) return 'Điểm tuyệt đối!';
  if (score >= 9) return 'Xuất sắc!';
  return 'Làm bài rất tốt!';
}

export default function ResultPage() {
  const { submissionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'wrong'
  // Chỉ chúc mừng ngay sau khi nộp (ExamPage gửi kèm justSubmitted), xem lại sau thì không.
  const [justSubmitted] = useState(() => Boolean(location.state?.justSubmitted));
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!justSubmitted) return;
    // Bỏ cờ khỏi lịch sử để tải lại trang không chúc mừng lần nữa.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (justSubmitted && submission && Number(submission.score) >= EXCELLENT_SCORE && submission.submitReason !== 'violations') {
      setCelebrate(true);
    }
  }, [justSubmitted, submission]);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/student/submissions/${submissionId}`)
      .then((res) => setSubmission(res.data))
      .finally(() => setLoading(false));
  }, [submissionId]);

  // Đề bật chế độ AI tự gửi: AI đang soạn lộ trình -> hỏi lại tới khi xong để
  // báo ngay trên trang kết quả (chuông thông báo cũng tự cập nhật).
  const aiWorking = submission?.roadmapStatus === 'generating';
  useEffect(() => {
    if (!aiWorking) return undefined;
    const timer = setInterval(() => {
      if (document.hidden) return;
      api.get(`/student/submissions/${submissionId}`).then((res) => {
        if (res.data?.id !== submissionId) return;
        setSubmission(res.data);
        if (res.data.roadmapStatus !== 'generating') {
          window.dispatchEvent(new Event('app:refresh-notifications'));
        }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [aiWorking, submissionId]);

  if (loading || !submission) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải kết quả bài làm…</div>
        </div>
      </div>
    );
  }

  const currentAttempt = submission.attempt || 1;
  const answers = submission.answers || [];
  const wrongCount = answers.filter((a) => !a.isCorrect).length;
  const accuracy = submission.totalQuestions > 0 ? Math.round((submission.correctCount / submission.totalQuestions) * 100) : 0;
  const level = scoreLevel(submission.score);
  const levelText = level === 'good' ? 'Kết quả tốt' : level === 'ok' ? 'Đạt yêu cầu' : 'Cần ôn tập thêm';

  return (
    <div className="container">
      {celebrate && (
        <Celebration
          title={celebrationTitle(Number(submission.score))}
          message={`Chúc mừng ${user?.name || 'bạn'} đã hoàn thành xuất sắc bài "${submission.examTitle || 'kiểm tra'}"!`}
          highlight={`${formatScore(submission.score)}/10 điểm · đúng ${submission.correctCount}/${submission.totalQuestions} câu`}
          onClose={() => setCelebrate(false)}
        />
      )}
      <div className="page-back">
        <Link to="/student" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Luyện đề
        </Link>
      </div>

      {/* Tổng quan điểm */}
      <div className="card profile-card">
        <div className="profile-head">
          <div>
            <h1 className="profile-name">{submission.examTitle || 'Kết quả bài làm'}</h1>
            <div className="meta-row">
              <span className="class-badge">Lần {currentAttempt}</span>
              <span>
                <UiIcon name="clock" size={14} />
                {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('vi-VN') : '—'}
              </span>
              {submission.timeSpentSeconds != null && (
                <span>
                  <UiIcon name="history" size={14} /> Làm trong {formatDuration(submission.timeSpentSeconds)}
                </span>
              )}
              {submission.violationCount > 0 && (
                <span className="score-pill is-ok">Rời màn hình {submission.violationCount} lần</span>
              )}
            </div>
          </div>

          <dl className="profile-stats">
            <div className="profile-stat">
              <dt>Điểm</dt>
              <dd className={`score-text is-${level}`}>
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
              <dd>{accuracy}<small>%</small></dd>
            </div>
          </dl>
        </div>

        {AUTO_SUBMIT_TEXT[submission.submitReason] && (
          <div className="notice is-warning">
            <UiIcon name={submission.submitReason === 'timeout' ? 'clock' : 'alert'} size={18} />
            <div className="notice-body">{AUTO_SUBMIT_TEXT[submission.submitReason]}.</div>
          </div>
        )}

        {submission.roadmapStatus === 'generating' && (
          <div className="notice is-info" role="status">
            <span className="spinner" style={{ width: 18, height: 18, flexShrink: 0 }} aria-hidden="true" />
            <div className="notice-body">
              <div className="notice-title">AI đang soạn lộ trình ôn tập cho bạn</div>
              <div className="notice-text">
                AI đang phân tích các câu sai để tìm lỗ hổng kiến thức. Bạn sẽ nhận thông báo khi lộ trình sẵn sàng.
              </div>
              <div className="notice-text ai-eta">
                <UiIcon name="clock" size={14} />Quá trình này mất 1 - 3 phút để AI nhận xét.
              </div>
            </div>
          </div>
        )}
        {submission.roadmapStatus === 'approved' && submission.roadmap?.autoApproved && (
          <div className="notice is-success" role="status">
            <UiIcon name="sparkles" size={18} />
            <div className="notice-body">
              <div className="notice-title">Lộ trình ôn tập AI đã sẵn sàng</div>
              <div className="notice-text">
                {submission.roadmap.examId
                  ? 'AI đã soạn lộ trình ôn tập và giao thêm bài tập luyện tập cho bạn.'
                  : 'AI đã soạn lộ trình ôn tập riêng cho lần làm này.'}
              </div>
            </div>
            <Link to={`/student/history/${submission.id}`} className="btn sm">
              Xem lộ trình
            </Link>
          </div>
        )}

        <div className="result-verdict">
          <span className={`score-pill is-${level}`}>{levelText}</span>
          <div className="result-verdict-actions">
            <Link to={`/student/history/${submission.id}`} className="btn sm secondary">
              <UiIcon name="route" size={15} /> Phân tích và lộ trình
            </Link>
            <Link to={`/student/exams/${submission.examId}`} className="btn sm secondary">
              <UiIcon name="refresh" size={15} /> Làm lại đề này
            </Link>
          </div>
        </div>
      </div>

      {/* Đối chiếu từng câu */}
      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-title-row">
              <h2>Đối chiếu đáp án</h2>
              <span className="count-badge">{answers.length} câu</span>
            </div>
            <p className="card-hint">Xem lại từng câu để biết mình sai ở đâu.</p>
          </div>
          {wrongCount > 0 && (
            <div className="segmented" role="group" aria-label="Lọc câu hỏi">
              <button
                type="button"
                className={`segmented-btn${filter === 'all' ? ' is-active' : ''}`}
                onClick={() => setFilter('all')}
                aria-pressed={filter === 'all'}
              >
                Tất cả <span className="segmented-count">{answers.length}</span>
              </button>
              <button
                type="button"
                className={`segmented-btn${filter === 'wrong' ? ' is-active' : ''}`}
                onClick={() => setFilter('wrong')}
                aria-pressed={filter === 'wrong'}
              >
                Câu sai <span className="segmented-count">{wrongCount}</span>
              </button>
            </div>
          )}
        </div>

        <div className="question-list">
          {(() => {
            let currentTopicName = null;
            let qNumInTopic = 0;

            return answers.map((a, idx) => {
              const topicName = (a.tags && a.tags.length > 0) ? a.tags[0] : 'Chưa phân loại';
              const isNewTopic = topicName !== currentTopicName;
              if (isNewTopic) {
                currentTopicName = topicName;
                qNumInTopic = 1;
              } else {
                qNumInTopic += 1;
              }
              const displayQNum = qNumInTopic;
              if (filter === 'wrong' && a.isCorrect) return null;

              return (
                <React.Fragment key={a.questionId || a.id || idx}>
                  {isNewTopic && (
                    <div className="q-topic">
                      <span className="q-topic-label">Chuyên đề</span>
                      <span className="q-topic-name">{topicName}</span>
                    </div>
                  )}

                  <div className={`question-card ${a.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                    <div className="question-header">
                      <span className="question-num">Câu {displayQNum}</span>
                      <span className={`status-pill ${a.isCorrect ? 'approved' : 'rejected'}`}>
                        <UiIcon name={a.isCorrect ? 'check' : 'close'} size={13} />
                        {a.isCorrect ? 'Đúng' : a.selectedAnswer ? 'Sai' : 'Bỏ trống'}
                      </span>
                    </div>

                    <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(a.content) }} />

                    <QuestionDiagram diagram={a.diagram} />

                    {Array.isArray(a.options) && a.options.length > 0 ? (
                      <div className="option-list">
                        {a.options.map((opt) => {
                          const isSelected = opt.key === a.selectedAnswer;
                          const isCorrectOpt = opt.key === a.correctAnswer;
                          let rowClass = 'option-row';
                          if (isCorrectOpt) rowClass += ' correct';
                          if (isSelected) rowClass += a.isCorrect ? ' is-picked-right' : ' wrong';
                          return (
                            <div key={opt.key} className={rowClass}>
                              <span className="option-key">{opt.key}.</span>
                              <span className="option-text" dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                              {isSelected && (
                                <span className={`option-tag ${a.isCorrect ? 'is-right' : 'is-wrong'}`}>
                                  <UiIcon name={a.isCorrect ? 'check' : 'close'} size={12} /> Bạn chọn
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
                    ) : (
                      <div className="meta-row">
                        <span>
                          Bạn chọn{' '}
                          <b className={`score-text is-${a.isCorrect ? 'good' : 'low'}`}>{a.selectedAnswer || 'Bỏ trống'}</b>
                        </span>
                        <span>
                          Đáp án đúng <b className="score-text is-good">{a.correctAnswer}</b>
                        </span>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
