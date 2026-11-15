import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';

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
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải đề thi...</div>
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

  return (
    <div className="container" style={{ maxWidth: 860 }}>
      {/* Top Banner & Timer Header */}
      <div className="card" style={{ border: '2px solid var(--primary-border)', padding: '22px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 14 }}>
          <div>
            <Link to="/student" className="btn-back" style={{ marginBottom: 12 }}>
              <span className="btn-back-arrow">←</span> Thoát ra ngoài
            </Link>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
              {exam.title}
            </h1>
            {exam.description && (
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 2 }}>{exam.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'rgba(41, 82, 217,0.08)',
                border: '1px solid rgba(41, 82, 217,0.2)',
                padding: '6px 16px',
                borderRadius: 20,
              }}
            >
              ⏱️ Thời gian: {exam.durationMinutes} phút
            </span>
          </div>
        </div>

        {/* Attempt info if retaking */}
        {exam.previousSubmissions && exam.previousSubmissions.length > 0 && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 14px',
              background: 'rgba(41, 82, 217,0.06)',
              border: '1px solid rgba(41, 82, 217,0.2)',
              borderRadius: 8,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
              🔄 Bạn đang làm lại đề thi này (Lần thứ {exam.previousSubmissions.length + 1})
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Điểm cao nhất các lần trước:{' '}
              <strong style={{ color: 'var(--success)', fontSize: 13 }}>
                {Math.max(...exam.previousSubmissions.map((s) => s.score || 0))}/10đ
              </strong>
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
            <span>Tiến độ làm bài:</span>
            <span>{answeredCount} / {totalCount} câu ({progressPercent}%)</span>
          </div>
          <div className="progress-bar-wrapper" style={{ maxWidth: '100%', height: 10 }}>
            <div className="progress-bar-fill success" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {(() => {
          return questionsWithMeta.map(({ question: q, topicName, isNewTopic, displayQNum }, idx) => {
            const selected = answers[q.id];

            return (
              <React.Fragment key={q.id}>
                {isNewTopic && (
                  <div
                    style={{
                      marginTop: idx > 0 ? 10 : 0,
                      marginBottom: -6,
                      padding: '10px 16px',
                      background: 'var(--ink)',
                      color: '#fff',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>📚</span>
                      <strong style={{ fontSize: 14.5, letterSpacing: '0.02em', color: '#f8fafc' }}>
                        CHỦ ĐỀ: {topicName.toUpperCase()}
                      </strong>
                    </div>
                  </div>
                )}

                <div
                  id={`exam-question-${idx}`}
                  className="card"
                  style={{ borderColor: selected ? 'var(--primary-border)' : 'var(--border-color)', margin: 0, scrollMarginTop: 20 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 15 }}>
                      Câu {displayQNum}:
                    </span>
                    {q.tags && q.tags.length > 0 && (
                      <span className="tag-badge" style={{ fontSize: 11 }}>
                        {q.tags.join(', ')}
                      </span>
                    )}
                  </div>

                  <div
                    style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)', marginBottom: 14, lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: renderMath(q.content) }}
                  />

                  <QuestionDiagram diagram={q.diagram} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt) => {
                      const isChecked = selected === opt.key;
                      return (
                        <label
                          key={opt.key}
                          className={`option-row ${isChecked ? 'correct' : ''}`}
                          style={{
                            cursor: 'pointer',
                            borderColor: isChecked ? 'var(--primary)' : 'var(--border-color)',
                            background: isChecked ? 'var(--primary-light)' : '#ffffff',
                          }}
                          onClick={() => selectAnswer(q.id, opt.key)}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            checked={isChecked}
                            onChange={() => selectAnswer(q.id, opt.key)}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: 700, width: 20 }}>{opt.key}.</span>
                          <span
                            style={{ flex: 1, color: isChecked ? 'var(--primary)' : 'var(--text-main)' }}
                            dangerouslySetInnerHTML={{ __html: renderMath(opt.text) }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            );
          });
        })()}
      </div>

      {/* Submit Action Card */}
      <div className="card" style={{ marginTop: 20, textAlign: 'center' }}>
        {error && <p className="error-text" style={{ justifyContent: 'center' }}>⚠️ {error}</p>}
        <p style={{ color: 'var(--text-muted)', marginBottom: 14 }}>
          Bạn đã chọn đáp án cho <strong>{answeredCount}</strong> trên tổng số <strong>{totalCount}</strong> câu hỏi.
        </p>
        <button className="btn" onClick={handleSubmit} disabled={submitting} style={{ padding: '12px 32px', fontSize: 15 }}>
          {submitting ? 'Đang chấm điểm & nộp bài...' : '✓ Nộp bài thi ngay'}
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
