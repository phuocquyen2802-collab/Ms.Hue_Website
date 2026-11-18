import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import GameCharacter from '../components/GameCharacters';
import {
  characterOf, formatDuration, formatPlayedAt, percentLevel, verdictOf,
} from '../components/GameHistory';
import { renderMath } from '../utils/mathRender';

// Xem lại 1 lượt chơi "Đường đua Toán học": kết quả + từng câu đã trả lời.
// Học sinh: /student/games/history/:historyId
// Giáo viên: /teacher/students/:studentId/games/:historyId
const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'wrong', label: 'Câu sai' },
  { id: 'correct', label: 'Câu đúng' },
];

export default function GameHistoryDetailPage() {
  const { historyId, studentId } = useParams();
  const isTeacher = Boolean(studentId);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const url = isTeacher
      ? `/teacher/students/${studentId}/game-history/${historyId}`
      : `/student/games/history/${historyId}`;
    setData(null);
    setError('');
    api.get(url)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Không tải được lượt chơi'));
  }, [historyId, studentId, isTeacher]);

  const back = (
    <div className="page-back">
      {isTeacher ? (
        <Link to={`/teacher/students/${studentId}`} className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại hồ sơ học sinh
        </Link>
      ) : (
        <Link to="/student/games/history" className="btn-back">
          <span className="btn-back-arrow">←</span> Quay lại Lịch sử chơi
        </Link>
      )}
    </div>
  );

  if (error || !data) {
    return (
      <div className="container game-page">
        {back}
        {error ? (
          <div className="notice is-danger"><UiIcon name="alert" size={18} /><div className="notice-body">{error}</div></div>
        ) : (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
            <div className="empty-state-title">Đang tải lượt chơi…</div>
          </div>
        )}
      </div>
    );
  }

  const level = percentLevel(data.percent);
  const character = characterOf(data.characterId);
  const groups = {
    all: data.answers,
    wrong: data.answers.filter((a) => !a.correct),
    correct: data.answers.filter((a) => a.correct),
  };
  const shown = groups[filter];
  const chosenLabel = isTeacher ? 'Học sinh chọn' : 'Bạn chọn';

  return (
    <div className="container game-page">
      {back}

      <div className="card profile-card">
        <div className="profile-head">
          <div className="profile-id">
            <span className="game-history-hero-char" aria-hidden="true">
              <GameCharacter id={character.id} mood={data.percent >= 50 ? 'happy' : 'sad'} size={64} />
            </span>
            <div>
              <h1 className="profile-name">{data.bankTitle}</h1>
              <div className="meta-row">
                {isTeacher && data.student && <span>Học sinh: <strong>{data.student.name}</strong></span>}
                <span><UiIcon name="clock" size={14} /> {formatPlayedAt(data.finishedAt)}</span>
                <span>Thời gian chơi: {formatDuration(data.durationSeconds)}</span>
                <span>{character.name}</span>
              </div>
            </div>
          </div>

          <dl className="profile-stats">
            <div className="profile-stat">
              <dt>Quãng đường</dt>
              <dd className={`score-text is-${level}`}>{data.percent}<small>%</small></dd>
            </div>
            <div className="profile-stat">
              <dt>Số câu đúng</dt>
              <dd>{data.correctCount}<small>/{data.totalQuestions}</small></dd>
            </div>
          </dl>
        </div>

        <div className="result-verdict">
          <span className={`score-pill is-${level}`}>{verdictOf(data.percent)}</span>
          {!isTeacher && data.bankAvailable && (
            <Link to={`/student/games?bank=${encodeURIComponent(data.bankId)}`} className="btn sm">
              <UiIcon name="refresh" size={15} /> Chơi lại chủ đề này
            </Link>
          )}
          {!data.bankAvailable && (
            <span className="result-verdict-compare">Chủ đề này đã bị xoá khỏi ngân hàng đề.</span>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header game-history-review-head">
          <div className="card-title-row">
            <h2>Các câu hỏi trong lượt chơi</h2>
          </div>
          <div className="segmented" role="group" aria-label="Lọc câu hỏi">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`segmented-btn${filter === f.id ? ' is-active' : ''}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {`${f.label} (${groups[f.id].length})`}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="check" size={22} /></div>
            <div className="empty-state-title">
              {filter === 'wrong' ? 'Không có câu sai nào' : 'Không có câu đúng nào'}
            </div>
          </div>
        ) : (
          <ol className="game-history-review">
            {shown.map((a) => (
              <li key={a.questionId} className={a.correct ? 'is-correct' : 'is-wrong'}>
                <div className="game-history-qhead">
                  <span className="game-history-qnum">{`Câu ${a.number}`}</span>
                  <span className={`status-pill ${a.correct ? 'approved' : 'rejected'}`}>
                    <UiIcon name={a.correct ? 'check' : 'close'} size={13} />
                    {a.correct ? 'Đúng' : 'Sai'}
                  </span>
                </div>

                {a.missing ? (
                  <p className="game-history-missing">
                    <span>Câu hỏi này đã bị xoá khỏi ngân hàng đề.</span>{' '}
                    <span>{chosenLabel}: <b>{a.chosen || '—'}</b></span>{' · '}
                    <span>Đáp án đúng: <b>{a.correctAnswer || '—'}</b></span>
                  </p>
                ) : (
                  <>
                    <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(a.content) }} />
                    <ul className="qb-preview-options">
                      {a.options.map((o) => (
                        <li
                          key={o.key}
                          className={o.key === a.correctAnswer ? 'is-correct' : o.key === a.chosen ? 'is-wrong' : ''}
                        >
                          <b>{o.key}.</b> <span className="qb-option-text" dangerouslySetInnerHTML={{ __html: renderMath(o.text) }} />
                          {o.key === a.chosen && <em className="game-review-tag">{chosenLabel}</em>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
