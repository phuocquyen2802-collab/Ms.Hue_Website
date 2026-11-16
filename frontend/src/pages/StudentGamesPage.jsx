import { useEffect, useState } from 'react';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import GameCharacter, { CHARACTERS } from '../components/GameCharacters';
import Celebration from '../components/Celebration';
import { renderMath } from '../utils/mathRender';

// Trò chơi "Đường đua Toán học": chọn chủ đề (ngân hàng đề giáo viên tải lên)
// và nhân vật; mỗi câu trả lời đúng nhân vật vui vẻ tiến 1 bước về đích, sai
// thì buồn và đứng yên. Hết câu hỏi thì tổng kết % quãng đường đã đi.

const CHARACTER_KEY = 'mi-game-character';
// Đi được từ chừng này % quãng đường trở lên thì chúc mừng (cúp vàng + pháo giấy).
const CELEBRATE_PERCENT = 80;
const COUNT_OPTIONS = [10, 20, 0]; // 0 = tất cả

function loadCharacter() {
  try {
    const id = localStorage.getItem(CHARACTER_KEY);
    return CHARACTERS.some((c) => c.id === id) ? id : CHARACTERS[0].id;
  } catch {
    return CHARACTERS[0].id;
  }
}

function resultMessage(percent) {
  if (percent === 100) return { title: 'Về đích hoàn hảo!', text: 'Bạn trả lời đúng tất cả các câu.' };
  if (percent >= 80) return { title: 'Xuất sắc!', text: 'Chỉ còn một chút nữa là về đích trọn vẹn.' };
  if (percent >= 50) return { title: 'Khá lắm!', text: 'Ôn lại các câu sai bên dưới để lần sau đi xa hơn.' };
  return { title: 'Cố lên nhé!', text: 'Xem lại các câu sai rồi thử chơi lại lần nữa.' };
}

function RaceTrack({ total, position, characterId, mood }) {
  const ratio = total ? position / total : 0;
  return (
    <div className="race" aria-label={`Đã đi ${position}/${total} bước`}>
      <div className="race-track">
        <div className="race-road" aria-hidden="true">
          {Array.from({ length: total + 1 }, (_, i) => (
            <span
              key={i}
              className={`race-dot${i <= position ? ' is-passed' : ''}`}
              style={{ left: `calc(36px + (100% - 72px) * ${total ? i / total : 0})` }}
            />
          ))}
        </div>
        <span className="race-flag" aria-hidden="true">
          <svg width="30" height="40" viewBox="0 0 30 40">
            <rect x="3" y="2" width="3" height="38" rx="1.5" fill="currentColor" />
            <path d="M6 3h20l-5 7 5 7H6z" fill="#e5484d" />
            <path d="M6 3h5v4.7H6zM16 3h5v4.7h-5zM11 7.7h5v4.6h-5zM21 7.7h3.5l-1.7 2.3 1.7 2.3H21zM6 12.3h5V17H6zM16 12.3h5V17h-5z" fill="#fff" />
          </svg>
        </span>
        <div className="race-runner" style={{ left: `calc((100% - 72px) * ${ratio})` }}>
          <GameCharacter id={characterId} mood={mood} size={72} key={`${mood}-${position}`} />
        </div>
      </div>
      <div className="race-labels" aria-hidden="true">
        <span>Xuất phát</span>
        <span>Đích</span>
      </div>
    </div>
  );
}

export default function StudentGamesPage() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [bankId, setBankId] = useState(null);
  const [characterId, setCharacterId] = useState(loadCharacter);
  const [count, setCount] = useState(10);
  // Báo khi đổi sang chủ đề ít câu hơn số câu đang chọn (tự chuyển sang "Tất cả").
  const [countNote, setCountNote] = useState('');

  const [phase, setPhase] = useState('pick'); // pick | play | result
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [game, setGame] = useState(null); // { bank, questions }
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // { question, chosen, correct, correctAnswer }
  const [feedback, setFeedback] = useState(null); // answer vừa chấm của câu hiện tại
  const [checking, setChecking] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    api.get('/student/games/banks')
      .then(({ data }) => setBanks(data))
      .catch((err) => setLoadError(err.response?.data?.message || 'Không tải được danh sách chủ đề'))
      .finally(() => setLoading(false));
  }, []);

  function chooseCharacter(id) {
    setCharacterId(id);
    try { localStorage.setItem(CHARACTER_KEY, id); } catch { /* bỏ qua */ }
  }

  async function startGame(targetBankId = bankId) {
    if (!targetBankId) return;
    setStarting(true);
    setStartError('');
    try {
      const bank = banks.find((b) => b.id === targetBankId);
      // Phòng hờ: số câu vượt quá chủ đề thì chơi tất cả.
      const safeCount = bank && count > bank.questionCount ? 0 : count;
      const { data } = await api.post(`/student/games/${targetBankId}/start`, { count: safeCount });
      setGame(data);
      setIndex(0);
      setAnswers([]);
      setFeedback(null);
      setCelebrate(false);
      setPhase('play');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setStartError(err.response?.data?.message || 'Không bắt đầu được trò chơi. Thử lại nhé.');
    } finally {
      setStarting(false);
    }
  }

  async function choose(optionKey) {
    if (feedback || checking) return;
    const question = game.questions[index];
    setChecking(true);
    try {
      const { data } = await api.post(`/student/games/${game.bank.id}/check`, { questionId: question.id, answer: optionKey });
      const result = { question, chosen: optionKey, correct: data.correct, correctAnswer: data.correctAnswer };
      setFeedback(result);
      setAnswers((prev) => [...prev, result]);
    } catch (err) {
      alert(err.response?.data?.message || 'Không chấm được câu này, thử lại nhé.');
    } finally {
      setChecking(false);
    }
  }

  function next() {
    if (index + 1 >= game.questions.length) {
      const correct = answers.filter((a) => a.correct).length;
      setCelebrate(Math.round((correct / game.questions.length) * 100) >= CELEBRATE_PERCENT);
      setPhase('result');
      window.scrollTo({ top: 0 });
      return;
    }
    setIndex((i) => i + 1);
    setFeedback(null);
  }

  function quit() {
    if (answers.length > 0 && !window.confirm('Thoát lượt chơi này? Kết quả sẽ không được tính.')) return;
    setPhase('pick');
    setGame(null);
  }

  const character = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
  const correctCount = answers.filter((a) => a.correct).length;

  // ---------- Đang chơi ----------
  if (phase === 'play' && game) {
    const question = game.questions[index];
    const total = game.questions.length;
    const mood = feedback ? (feedback.correct ? 'happy' : 'sad') : 'neutral';
    const isLast = index + 1 >= total;

    return (
      <div className="container game-page">
        <div className="game-bar">
          <div className="game-bar-title">
            <span className="game-bar-topic">{game.bank.title}</span>
            <span className="game-bar-meta">Câu {index + 1}/{total} · Đúng {correctCount}</span>
          </div>
          <button type="button" className="btn secondary sm" onClick={quit}>
            <UiIcon name="close" size={15} /> Thoát
          </button>
        </div>

        <RaceTrack total={total} position={correctCount} characterId={characterId} mood={mood} />

        <div className="card game-question">
          <div className="game-question-head">Câu {index + 1}</div>
          <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(question.content) }} />
          <div className="game-options">
            {question.options.map((o) => {
              let state = '';
              if (feedback) {
                if (o.key === feedback.correctAnswer) state = ' is-correct';
                else if (o.key === feedback.chosen) state = ' is-wrong';
                else state = ' is-dim';
              }
              return (
                <button
                  key={o.key}
                  type="button"
                  className={`game-option${state}`}
                  onClick={() => choose(o.key)}
                  disabled={Boolean(feedback) || checking}
                >
                  <span className="game-option-key">{o.key}</span>
                  <span className="game-option-text" dangerouslySetInnerHTML={{ __html: renderMath(o.text) }} />
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`game-feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`} role="status" aria-live="polite">
              <div className="game-feedback-text">
                <strong>{feedback.correct ? 'Chính xác!' : 'Chưa đúng rồi.'}</strong>{' '}
                {feedback.correct
                  ? <>{character.name} tiến thêm 1 bước.</>
                  : <>Đáp án đúng là <b>{feedback.correctAnswer}</b>. {character.name} đứng yên.</>}
              </div>
              <button type="button" className="btn" onClick={next} autoFocus>
                {isLast ? 'Xem kết quả' : 'Câu tiếp theo'} <UiIcon name="arrow-right" size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Kết quả ----------
  if (phase === 'result' && game) {
    const total = game.questions.length;
    const percent = total ? Math.round((correctCount / total) * 100) : 0;
    const msg = resultMessage(percent);
    const wrong = answers.filter((a) => !a.correct);

    return (
      <div className="container game-page">
        {celebrate && (
          <Celebration
            title={percent === 100 ? 'Về đích hoàn hảo!' : 'Về đích xuất sắc!'}
            message={`Chúc mừng! ${character.name} đã đi được ${percent}% quãng đường chủ đề "${game.bank.title}".`}
            highlight={`Đúng ${correctCount}/${total} câu`}
            onClose={() => setCelebrate(false)}
          />
        )}
        <div className="game-bar">
          <div className="game-bar-title">
            <span className="game-bar-topic">Kết quả lượt chơi</span>
            <span className="game-bar-meta">{game.bank.title}</span>
          </div>
        </div>

        <div className="card game-result">
          <div className="game-result-hero">
            <GameCharacter id={characterId} mood={percent >= 50 ? 'happy' : 'sad'} size={120} />
            <div>
              <h2 className="game-result-title">{msg.title}</h2>
              <p className="game-result-text">{msg.text}</p>
            </div>
            <div className="game-result-percent">
              <span className="game-result-number">{percent}%</span>
              <span>quãng đường</span>
            </div>
          </div>

          <RaceTrack total={total} position={correctCount} characterId={characterId} mood={percent >= 50 ? 'happy' : 'sad'} />

          <dl className="game-result-stats">
            <div><dt>Trả lời đúng</dt><dd className="is-correct">{correctCount}</dd></div>
            <div><dt>Trả lời sai</dt><dd className="is-wrong">{total - correctCount}</dd></div>
            <div><dt>Tổng số câu</dt><dd>{total}</dd></div>
          </dl>

          <div className="game-result-actions">
            <button type="button" className="btn secondary" onClick={() => { setPhase('pick'); setGame(null); }}>
              Đổi chủ đề / nhân vật
            </button>
            <button type="button" className="btn" onClick={() => startGame(game.bank.id)} disabled={starting}>
              <UiIcon name="refresh" size={16} /> {starting ? 'Đang chuẩn bị…' : 'Chơi lại'}
            </button>
          </div>
        </div>

        {wrong.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2>Xem lại các câu sai <span className="count-badge">{wrong.length}</span></h2>
            </div>
            <ol className="game-review">
              {wrong.map((a) => (
                <li key={a.question.id}>
                  <div className="question-content" dangerouslySetInnerHTML={{ __html: renderMath(a.question.content) }} />
                  <ul className="qb-preview-options">
                    {a.question.options.map((o) => (
                      <li key={o.key} className={o.key === a.correctAnswer ? 'is-correct' : o.key === a.chosen ? 'is-wrong' : ''}>
                        <b>{o.key}.</b> <span className="qb-option-text" dangerouslySetInnerHTML={{ __html: renderMath(o.text) }} />
                        {o.key === a.chosen && <em className="game-review-tag">Bạn chọn</em>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    );
  }

  // ---------- Chọn chủ đề & nhân vật ----------
  const selectedBank = banks.find((b) => b.id === bankId);
  // Số câu vượt quá số câu của chủ đề đang chọn thì không cho chọn.
  const tooMany = (n) => Boolean(selectedBank) && n > 0 && n > selectedBank.questionCount;
  const blockedCounts = COUNT_OPTIONS.filter(tooMany);

  function chooseBank(bank) {
    setBankId(bank.id);
    if (count > 0 && count > bank.questionCount) {
      setCount(0);
      setCountNote(`Chủ đề "${bank.title}" chỉ có ${bank.questionCount} câu nên đã chuyển sang chơi tất cả ${bank.questionCount} câu.`);
    } else {
      setCountNote('');
    }
  }

  return (
    <div className="container game-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trò chơi</h1>
          <p className="page-subtitle">Đường đua Toán học: trả lời đúng để đưa nhân vật của bạn về đích</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2><span className="game-step">1</span> Chọn chủ đề</h2>
        </div>
        {loading ? (
          <div className="empty-state"><div className="empty-state-title">Đang tải…</div></div>
        ) : loadError ? (
          <div className="notice is-danger"><UiIcon name="alert" size={18} /><div className="notice-body">{loadError}</div></div>
        ) : banks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="folder" size={22} /></div>
            <div className="empty-state-title">Chưa có chủ đề nào</div>
            <p className="empty-state-desc">Khi giáo viên thêm đề vào ngân hàng đề, các chủ đề sẽ hiện ở đây.</p>
          </div>
        ) : (
          <div className="game-topics">
            {banks.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`game-topic${b.id === bankId ? ' is-selected' : ''}`}
                aria-pressed={b.id === bankId}
                onClick={() => chooseBank(b)}
              >
                <span className="game-topic-icon" aria-hidden="true"><UiIcon name="book" size={18} /></span>
                <span className="game-topic-title">{b.title}</span>
                <span className="game-topic-count">{b.questionCount} câu</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2><span className="game-step">2</span> Chọn nhân vật</h2>
        </div>
        <div className="game-characters">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`game-character${c.id === characterId ? ' is-selected' : ''}`}
              aria-pressed={c.id === characterId}
              onClick={() => chooseCharacter(c.id)}
            >
              <GameCharacter id={c.id} mood={c.id === characterId ? 'happy' : 'neutral'} size={78} />
              <span className="game-character-name">{c.name}</span>
              <span className="game-character-motto">{c.motto}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card game-start">
        <div className="game-count-wrap">
          <div className="game-count">
            <span className="game-count-label"><span className="game-step">3</span> Số câu hỏi</span>
            <div className="segmented" role="group" aria-label="Số câu hỏi">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`segmented-btn${count === n ? ' is-active' : ''}`}
                  aria-pressed={count === n}
                  disabled={tooMany(n)}
                  title={tooMany(n) ? `Chủ đề này chỉ có ${selectedBank.questionCount} câu` : undefined}
                  onClick={() => { setCount(n); setCountNote(''); }}
                >
                  {n === 0 ? `Tất cả${selectedBank ? ` (${selectedBank.questionCount})` : ''}` : `${n} câu`}
                </button>
              ))}
            </div>
          </div>
          {(countNote || blockedCounts.length > 0) && (
            <p className="game-count-hint" role="status" aria-live="polite">
              <UiIcon name="alert" size={15} />
              <span>
                {countNote || `Chủ đề "${selectedBank.title}" chỉ có ${selectedBank.questionCount} câu nên không chọn được ${blockedCounts.join(' và ')} câu.`}
              </span>
            </p>
          )}
        </div>
        {startError && <div className="notice is-danger"><UiIcon name="alert" size={18} /><div className="notice-body">{startError}</div></div>}
        <button type="button" className="btn btn-lg" disabled={!bankId || starting} onClick={() => startGame()}>
          <UiIcon name="play" size={18} /> {starting ? 'Đang chuẩn bị…' : 'Bắt đầu chơi'}
        </button>
      </div>
    </div>
  );
}
