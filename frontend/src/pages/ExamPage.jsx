import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';
import UiIcon, { formatScore } from '../components/UiIcon';

export default function ExamPage() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/student/exams/${examId}`).then((res) => setExam(res.data));
  }, [examId]);

  function selectAnswer(questionId, key) {
    setAnswers((prev) => ({ ...prev, [questionId]: key }));
  }

  function scrollToQuestion(idx) {
    const el = document.getElementById(`exam-question-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit() {
    setError('');
    const totalQ = exam?.questions?.length || 0;
    const answeredCount = Object.keys(answers).length;

    if (answeredCount < totalQ) {
      const confirmSubmit = window.confirm(
        `Bạn mới làm ${answeredCount}/${totalQ} câu hỏi. Bạn có chắc chắn muốn nộp bài không?`
      );
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({
          questionId,
          selectedAnswer,
        })),
      };
      const { data } = await api.post(`/student/exams/${examId}/submit`, payload);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      navigate(`/student/submissions/${data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Nộp bài thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  if (!exam) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải đề…</div>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalCount = exam.questions.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  // Tính trước số thứ tự câu hỏi THEO TỪNG CHỦ ĐỀ (mỗi chủ đề bắt đầu lại từ
  // Câu 1, giống hệt cách hiển thị trong danh sách câu hỏi bên dưới) - dùng
  // chung cho cả danh sách câu hỏi và bảng điều hướng, để số thứ tự luôn
  // khớp nhau giữa 2 nơi.
  const questionsWithMeta = (() => {
    let currentTopicName = null;
    let qNumInTopic = 0;
    return exam.questions.map((q) => {
      const topicName = q.tags?.[0] || 'Kiến thức chung';
      const isNewTopic = topicName !== currentTopicName;
      if (isNewTopic) {
        currentTopicName = topicName;
        qNumInTopic = 1;
      } else {
        qNumInTopic += 1;
      }
      return { question: q, topicName, isNewTopic, displayQNum: qNumInTopic };
    });
  })();

  const bestPrev = exam.previousSubmissions && exam.previousSubmissions.length > 0
    ? Math.max(...exam.previousSubmissions.map((s) => s.score || 0))
    : null;

  return (
    <div className="container exam-page">
      <div className="page-back">
        <Link to="/student" className="btn-back">
          <span className="btn-back-arrow">←</span> Thoát
        </Link>
      </div>

      {/* Thông tin đề và tiến độ */}
      <div className="card exam-head">
        <div className="exam-head-top">
          <div>
            <h1 className="profile-name">{exam.title}</h1>
            {exam.description && <p className="exam-head-desc">{exam.description}</p>}
          </div>
          <span className="exam-time">
            <UiIcon name="clock" size={16} /> {exam.durationMinutes} phút
          </span>
        </div>

        {bestPrev !== null && (
          <div className="notice is-info">
            <UiIcon name="refresh" size={17} />
            <div className="notice-body">
              Bạn đang làm lại đề này, lần {exam.previousSubmissions.length + 1}. Điểm cao nhất trước đó:{' '}
              <b>{formatScore(bestPrev)}/10</b>.
            </div>
          </div>
        )}

        <div className="exam-progress">
          <div className="exam-progress-row">
            <span>Tiến độ</span>
            <span className="exam-progress-count">
              {answeredCount}/{totalCount} câu
            </span>
          </div>
          <div className="score-bar is-thin" aria-hidden="true">
            <span className="is-primary" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Danh sách câu hỏi */}
      <div className="question-list exam-questions">
        {questionsWithMeta.map(({ question: q, topicName, isNewTopic, displayQNum }, idx) => {
          const selected = answers[q.id];
          return (
            <React.Fragment key={q.id}>
              {isNewTopic && (
                <div className="q-topic">
                  <span className="q-topic-label">Chuyên đề</span>
                  <span className="q-topic-name">{topicName}</span>
                </div>
              )}

              <div
                id={`exam-question-${idx}`}
                className={`question-card exam-question${selected ? ' is-answered' : ''}`}
              >
                <div className="question-header">
                  <span className="question-num">Câu {displayQNum}</span>
                  {selected ? (
                    <span className="class-badge is-answered">Đã chọn {selected}</span>
                  ) : (
                    <span className="class-badge">Chưa chọn</span>
                  )}
                </div>

                <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(q.content) }} />

                <QuestionDiagram diagram={q.diagram} />

                <div className="option-list" role="radiogroup" aria-label={`Câu ${displayQNum}`}>
                  {q.options.map((opt) => {
                    const isChecked = selected === opt.key;
                    return (
                      <label key={opt.key} className={`option-row is-choice${isChecked ? ' is-checked' : ''}`}>
                        <input
                          type="radio"
                          name={q.id}
                          checked={isChecked}
                          onChange={() => selectAnswer(q.id, opt.key)}
                        />
                        <span className="option-key">{opt.key}.</span>
                        <span className="option-text" dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }} />
                      </label>
                    );
                  })}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Nộp bài */}
      <div className="card exam-submit">
        {error && (
          <div className="notice is-danger">
            <UiIcon name="alert" size={18} />
            <div className="notice-body">{error}</div>
          </div>
        )}
        <p>
          Bạn đã chọn đáp án cho <strong>{answeredCount}</strong>/{totalCount} câu.
          {answeredCount < totalCount && ' Câu bỏ trống sẽ tính là sai.'}
        </p>
        <button className="btn btn-lg" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner is-on-primary" /> Đang chấm điểm…
            </>
          ) : (
            <>
              <UiIcon name="check" size={17} /> Nộp bài
            </>
          )}
        </button>
      </div>

      {/* Bảng điều hướng câu hỏi - hiện cố định bên phải trên màn hình rộng.
          Nhóm theo chủ đề + đánh số Câu 1, 2, 3... trong TỪNG chủ đề, khớp
          đúng với số hiển thị ở danh sách câu hỏi bên trái. */}
      <aside className="exam-question-nav" aria-label="Danh sách câu hỏi">
        <div className="exam-question-nav-title">Danh sách câu hỏi</div>
        <div className="exam-question-nav-body">
          {(() => {
            let currentTopicName = null;
            const groups = [];
            questionsWithMeta.forEach(({ question: q, topicName, displayQNum }, idx) => {
              if (topicName !== currentTopicName) {
                currentTopicName = topicName;
                groups.push({ topicName, items: [] });
              }
              groups[groups.length - 1].items.push({ q, displayQNum, idx });
            });

            return groups.map((group) => (
              <div key={group.topicName} className="exam-question-nav-group">
                <div className="exam-question-nav-group-title">{group.topicName}</div>
                <div className="exam-question-nav-grid">
                  {group.items.map(({ q, displayQNum, idx }) => {
                    const isAnswered = Boolean(answers[q.id]);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        className={`exam-question-nav-item${isAnswered ? ' answered' : ''}`}
                        onClick={() => scrollToQuestion(idx)}
                        aria-label={`Câu ${displayQNum} - ${group.topicName}${isAnswered ? ' - đã làm' : ' - chưa làm'}`}
                      >
                        {displayQNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
        <div className="exam-question-nav-legend">
          <span><i className="exam-question-nav-dot done" aria-hidden="true" /> Đã làm ({answeredCount})</span>
          <span><i className="exam-question-nav-dot pending" aria-hidden="true" /> Chưa làm ({totalCount - answeredCount})</span>
        </div>
      </aside>
    </div>
  );
}
