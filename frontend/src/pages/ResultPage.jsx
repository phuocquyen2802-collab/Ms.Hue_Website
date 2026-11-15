import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';
import UiIcon, { scoreLevel, formatScore } from '../components/UiIcon';

export default function ResultPage() {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'wrong'

  useEffect(() => {
    setLoading(true);
    api
      .get(`/student/submissions/${submissionId}`)
      .then((res) => setSubmission(res.data))
      .finally(() => setLoading(false));
  }, [submissionId]);

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
