import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import QuestionDiagram from '../components/QuestionDiagram';

export default function ResultPage() {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

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
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Đang tải kết quả bài làm...</div>
        </div>
      </div>
    );
  }

  const currentAttempt = submission.attempt || 1;

  const accuracy = submission.totalQuestions > 0 ? Math.round((submission.correctCount / submission.totalQuestions) * 100) : 0;
  let scoreColor = 'var(--danger)';
  let scoreBg = 'rgba(239,68,68,0.1)';
  let statusText = 'Cần ôn tập gấp';
  if (submission.score >= 8) {
    scoreColor = 'var(--success)';
    scoreBg = 'rgba(16,185,129,0.1)';
    statusText = 'Kết quả xuất sắc';
  } else if (submission.score >= 5) {
    scoreColor = '#d97706';
    scoreBg = 'rgba(245,158,11,0.1)';
    statusText = 'Đạt yêu cầu';
  }

  return (
    <div className="container" style={{ maxWidth: 960, paddingBottom: 60 }}>
      {/* Standard Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">{submission.examTitle || 'Chi Tiết Đợt Làm Bài'}</h1>
          <p className="page-subtitle">
            Chi tiết từng câu hỏi và đối chiếu kết quả của tôi với đáp án chính xác
          </p>
        </div>
        <div className="header-actions">
          <Link to="/student" className="btn-back">
            <span className="btn-back-arrow">←</span> Quay lại Góc Luyện Tập
          </Link>
        </div>
      </div>

      {/* Score Overview Card */}
      <div
        className="card"
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  background: '#e2e8f0',
                  color: '#1e293b',
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Đợt làm: Lần {currentAttempt}
              </span>
            </div>

            <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 600, marginBottom: 4 }}>
              Số câu đúng: <strong style={{ color: 'var(--primary)' }}>{submission.correctCount}/{submission.totalQuestions} câu ({accuracy}%)</strong>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Thời gian nộp bài: {submission.submittedAt ? new Date(submission.submittedAt).toLocaleString('vi-VN') : '---'}
            </div>
          </div>

          {/* Right Score Badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px 24px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              minWidth: 150,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                {submission.score}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>/ 10đ</span>
            </div>
            <span
              style={{
                marginTop: 6,
                fontSize: 12,
                fontWeight: 700,
                color: scoreColor,
                background: scoreBg,
                padding: '2px 10px',
                borderRadius: 10,
              }}
            >
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Answers Review */}
      <div className="card" style={{ borderRadius: 12 }}>
        <div className="card-header">
          <div className="card-title-group">
            <h2>Chi tiết từng câu hỏi & Đối chiếu đáp án</h2>
            <p className="card-hint">Xem lại các câu bạn đã làm đúng hoặc sai để rút kinh nghiệm</p>
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Tổng số: <strong>{submission.answers.length}</strong> câu
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(() => {
            let currentTopicName = null;
            let qNumInTopic = 0;

            return submission.answers.map((a, idx) => {
              const topicName = (a.tags && a.tags.length > 0) ? a.tags[0] : 'Chưa phân loại';
              const isNewTopic = topicName !== currentTopicName;
              if (isNewTopic) {
                currentTopicName = topicName;
                qNumInTopic = 1;
              } else {
                qNumInTopic += 1;
              }
              const displayQNum = qNumInTopic;

              return (
                <React.Fragment key={a.questionId || a.id || idx}>
                  {isNewTopic && (
                    <div
                      style={{
                        marginTop: idx > 0 ? 10 : 0,
                        marginBottom: 2,
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary) 100%)',
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
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: 18,
                      background: a.isCorrect ? 'var(--success-bg)' : 'var(--danger-bg)',
                      borderColor: a.isCorrect ? 'var(--success-border)' : 'var(--danger-border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>Câu {displayQNum}:</span>
                      <span className={`status-pill ${a.isCorrect ? 'approved' : 'rejected'}`}>
                        {a.isCorrect ? '✓ Chính xác' : '✕ Chưa đúng'}
                      </span>
                    </div>

                    <div
                      style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)', marginBottom: 12, lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: renderMath(a.content) }}
                    />

                    <QuestionDiagram diagram={a.diagram} />

                    <div style={{ fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Kết quả của tôi:</span>{' '}
                        <strong style={{ color: a.isCorrect ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          {a.selectedAnswer ? `Phương án ${a.selectedAnswer}` : '(Bỏ trống)'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Đáp án:</span>{' '}
                        <strong style={{ color: 'var(--success-text)' }}>Phương án {a.correctAnswer}</strong>
                      </div>
                    </div>
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
