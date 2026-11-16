import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import { formatClock } from '../utils/examTime';
import QuestionDiagram from '../components/QuestionDiagram';
import UiIcon, { formatScore } from '../components/UiIcon';

// Trang làm bài gồm 2 bước:
// 1. Màn hình "Bắt đầu làm bài": thông tin đề + quy định. Chưa hiện câu hỏi.
// 2. Đang làm bài: đồng hồ đếm ngược (tính theo giờ máy chủ từ lúc bấm bắt
//    đầu), toàn màn hình, ẩn menu/chat. Rê chuột ra ngoài, chuyển tab/cửa sổ,
//    thoát toàn màn hình hoặc bấm quay lại đều bị chặn bằng cảnh báo và được
//    ghi lại; tới lần thứ `maxViolations` bài tự động nộp. Hết giờ cũng tự nộp.

const LEAVE_TEXT = {
  'mouse-leave': 'Bạn vừa rê chuột ra ngoài màn hình làm bài.',
  'tab-hidden': 'Bạn vừa chuyển sang tab hoặc cửa sổ khác.',
  'window-blur': 'Bạn vừa chuyển sang cửa sổ hoặc ứng dụng khác.',
  'fullscreen-exit': 'Bạn vừa thoát chế độ toàn màn hình.',
  navigate: 'Bạn vừa bấm quay lại trang trước.',
};

const WARN_MS = 5 * 60 * 1000;
const DANGER_MS = 60 * 1000;

function fullscreenSupported() {
  return Boolean(document.documentElement.requestFullscreen) && document.fullscreenEnabled !== false;
}

// Trình duyệt chỉ cho mở toàn màn hình ngay trong sự kiện bấm của người dùng,
// nên hàm này phải được gọi trước mọi `await` trong hàm xử lý bấm nút.
function enterFullscreen() {
  if (document.fullscreenElement || !fullscreenSupported()) return Promise.resolve();
  return document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}

function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// Số thứ tự câu hỏi THEO TỪNG CHỦ ĐỀ (mỗi chủ đề bắt đầu lại từ Câu 1) - dùng
// chung cho danh sách câu hỏi và bảng điều hướng để số luôn khớp nhau.
function withTopicNumbers(questions) {
  let currentTopicName = null;
  let qNumInTopic = 0;
  return questions.map((q) => {
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
}

export default function ExamPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [info, setInfo] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [phase, setPhase] = useState('intro'); // 'intro' | 'running'
  const [starting, setStarting] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(null);
  const [violations, setViolations] = useState(0);
  const [maxViolations, setMaxViolations] = useState(3);
  const [guard, setGuard] = useState(null); // { type } khi đang hiện cảnh báo rời màn hình
  const [autoReason, setAutoReason] = useState(null); // 'timeout' | 'violations' khi bài đang tự nộp
  const [resumeNotice, setResumeNotice] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Các trình nghe sự kiện (rời màn hình, hẹn giờ...) đọc giá trị mới nhất qua ref.
  const phaseRef = useRef('intro');
  const answersRef = useRef({});
  const violationsRef = useRef(0);
  const maxViolationsRef = useRef(3);
  const guardRef = useRef(null);
  const graceUntilRef = useRef(0);
  const finishingRef = useRef(false);
  const timeoutFiredRef = useRef(false);
  const saveTimerRef = useRef(null);
  const clockOffsetRef = useRef(0);

  // Đã nộp xong (kể cả máy chủ tự nộp) -> sang trang kết quả.
  const finish = useCallback(
    (submissionId) => {
      finishingRef.current = true;
      phaseRef.current = 'done';
      window.clearTimeout(saveTimerRef.current);
      exitFullscreen();
      window.dispatchEvent(new Event('app:refresh-notifications'));
      navigate(`/student/submissions/${submissionId}`, { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    let alive = true;
    api
      .get(`/student/exams/${examId}`)
      .then(({ data }) => {
        if (!alive) return;
        // Lượt làm dở đã hết giờ -> máy chủ đã nộp với các đáp án đã lưu.
        if (data.finalizedSubmissionId) {
          finish(data.finalizedSubmissionId);
          return;
        }
        setInfo(data);
        if (data.maxViolations) {
          maxViolationsRef.current = data.maxViolations;
          setMaxViolations(data.maxViolations);
        }
      })
      .catch((err) => {
        if (alive) setLoadError(err.response?.data?.message || 'Không tải được đề thi.');
      });
    return () => {
      alive = false;
    };
  }, [examId, finish]);

  // Tự lưu đáp án / ghi nhận 1 lần rời màn hình lên máy chủ.
  const patchSession = useCallback(
    async (body) => {
      try {
        const { data } = await api.patch(`/student/exams/${examId}/session`, body);
        if (data.finalizedSubmissionId) {
          finish(data.finalizedSubmissionId);
          return data;
        }
        if (typeof data.violationCount === 'number') {
          violationsRef.current = Math.max(violationsRef.current, data.violationCount);
          setViolations(violationsRef.current);
        }
        return data;
      } catch {
        return null;
      }
    },
    [examId, finish]
  );

  const submit = useCallback(
    async (reason = 'manual') => {
      if (finishingRef.current) return;
      finishingRef.current = true;
      window.clearTimeout(saveTimerRef.current);
      setConfirmOpen(false);
      setSubmitting(true);
      setError('');
      try {
        const payload = {
          reason,
          answers: Object.entries(answersRef.current).map(([questionId, selectedAnswer]) => ({
            questionId,
            selectedAnswer,
          })),
        };
        const { data } = await api.post(`/student/exams/${examId}/submit`, payload);
        finish(data.id);
      } catch (err) {
        finishingRef.current = false;
        setSubmitting(false);
        setError(err.response?.data?.message || 'Nộp bài chưa được. Kiểm tra kết nối mạng rồi bấm nộp lại.');
      }
    },
    [examId, finish]
  );
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Học sinh rời khỏi màn hình làm bài: hiện cảnh báo chặn bài làm và tính 1
  // lần. Trong lúc cảnh báo còn mở, các sự kiện tiếp theo không tính thêm.
  const reportLeave = useCallback(
    (type) => {
      if (phaseRef.current !== 'running' || finishingRef.current || guardRef.current) return;
      if (Date.now() < graceUntilRef.current) return;
      guardRef.current = { type };
      setGuard({ type });
      violationsRef.current += 1;
      setViolations(violationsRef.current);
      if (violationsRef.current >= maxViolationsRef.current) setAutoReason('violations');

      window.clearTimeout(saveTimerRef.current);
      patchSession({ answers: answersRef.current, violation: { type } }).then(() => {
        if (finishingRef.current) return;
        if (violationsRef.current >= maxViolationsRef.current) {
          setAutoReason('violations');
          submitRef.current('violations');
        }
      });
    },
    [patchSession]
  );
  const reportLeaveRef = useRef(reportLeave);
  reportLeaveRef.current = reportLeave;

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    setError('');
    const fullscreen = enterFullscreen(); // gọi ngay trong sự kiện bấm
    try {
      const { data } = await api.post(`/student/exams/${examId}/start`);
      if (data.finalizedSubmissionId) {
        finish(data.finalizedSubmissionId);
        return;
      }
      await fullscreen;
      const s = data.session;
      clockOffsetRef.current = new Date(s.serverNow).getTime() - Date.now();
      maxViolationsRef.current = s.maxViolations || 3;
      answersRef.current = s.answers || {};
      violationsRef.current = s.violationCount || 0;
      setMaxViolations(maxViolationsRef.current);
      setAnswers(answersRef.current);
      setViolations(violationsRef.current);
      setQuestions(data.questions || []);
      setSession(s);
      setResumeNotice(Boolean(data.resumed));
      graceUntilRef.current = Date.now() + 1500;
      phaseRef.current = 'running';
      setPhase('running');
    } catch (err) {
      exitFullscreen();
      setError(err.response?.data?.message || 'Không mở được đề. Vui lòng thử lại.');
    } finally {
      setStarting(false);
    }
  }

  async function handleReturn() {
    graceUntilRef.current = Date.now() + 1500;
    await enterFullscreen();
    graceUntilRef.current = Date.now() + 800;
    guardRef.current = null;
    setGuard(null);
  }

  function selectAnswer(questionId, key) {
    if (finishingRef.current) return;
    const next = { ...answersRef.current, [questionId]: key };
    answersRef.current = next;
    setAnswers(next);
    window.clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    saveTimerRef.current = window.setTimeout(async () => {
      const data = await patchSession({ answers: answersRef.current });
      setSaveState(data ? 'saved' : 'error');
    }, 500);
  }

  function scrollToQuestion(idx) {
    const el = document.getElementById(`exam-question-${idx}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Đồng hồ đếm ngược - hết giờ thì tự nộp.
  useEffect(() => {
    if (phase !== 'running' || !session) return undefined;
    const endMs = new Date(session.endsAt).getTime();
    const tick = () => {
      const left = endMs - (Date.now() + clockOffsetRef.current);
      setRemaining(left);
      if (left <= 0 && !timeoutFiredRef.current && !finishingRef.current) {
        timeoutFiredRef.current = true;
        setAutoReason('timeout');
        submitRef.current('timeout');
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [phase, session]);

  // Khoá màn hình làm bài: ẩn menu/chat, theo dõi rời màn hình, chặn quay lại.
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const leave = (type) => reportLeaveRef.current(type);

    // relatedTarget = null nghĩa là con trỏ đã ra khỏi cửa sổ trình duyệt.
    const onMouseOut = (e) => {
      if (!e.relatedTarget) leave('mouse-leave');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') leave('tab-hidden');
    };
    const onBlur = () => leave('window-blur');
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) leave('fullscreen-exit');
    };
    const onBeforeUnload = (e) => {
      // __miForceNavigation: tài khoản vừa bị xoá, đang tự đăng xuất (services/api.js).
      if (finishingRef.current || window.__miForceNavigation) return;
      e.preventDefault();
      e.returnValue = '';
    };
    // Bấm "quay lại" trên trình duyệt: giữ nguyên trang làm bài.
    const onPopState = () => {
      if (finishingRef.current) return;
      window.history.pushState(window.history.state, '', window.location.href);
      leave('navigate');
    };

    document.body.classList.add('exam-lock');
    window.history.pushState(window.history.state, '', window.location.href);
    document.addEventListener('mouseout', onMouseOut);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);
    return () => {
      document.body.classList.remove('exam-lock');
      document.removeEventListener('mouseout', onMouseOut);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [phase]);

  // Rời trang bằng cách khác -> thoát toàn màn hình, huỷ lưu chờ.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
      exitFullscreen();
    },
    []
  );

  if (loadError) {
    return (
      <div className="container">
        <div className="page-back">
          <Link to="/student" className="btn-back">
            <span className="btn-back-arrow">←</span> Quay lại
          </Link>
        </div>
        <div className="notice is-danger">
          <UiIcon name="alert" size={18} />
          <div className="notice-body">{loadError}</div>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px', width: 24, height: 24 }} />
          <div className="empty-state-title">Đang tải đề…</div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Bắt đầu
  if (phase === 'intro') {
    const prevCount = info.previousSubmissions?.length || 0;
    const bestPrev = prevCount > 0 ? Math.max(...info.previousSubmissions.map((s) => s.score || 0)) : null;
    const active = info.activeSession;
    const activeLeftMin = active
      ? Math.max(
          1,
          Math.ceil((new Date(active.endsAt).getTime() - new Date(active.serverNow).getTime()) / 60000)
        )
      : 0;
    const noQuestions = !info.questionCount;

    return (
      <div className="container">
        <div className="page-back">
          <Link to="/student" className="btn-back">
            <span className="btn-back-arrow">←</span> Quay lại
          </Link>
        </div>

        <div className="card exam-intro">
          <div>
            <span className="exam-intro-eyebrow">
              <UiIcon name="file" size={15} /> Bài kiểm tra
            </span>
            <h1 className="exam-intro-title">{info.title}</h1>
            {info.description && <p className="exam-intro-desc">{info.description}</p>}
          </div>

          <dl className="exam-facts">
            <div>
              <dt>Số câu hỏi</dt>
              <dd>{info.questionCount || 0}<small>câu</small></dd>
            </div>
            <div>
              <dt>Thời gian</dt>
              <dd>{info.durationMinutes}<small>phút</small></dd>
            </div>
            <div>
              <dt>Lần làm</dt>
              <dd>{prevCount + 1}</dd>
            </div>
            {bestPrev !== null && (
              <div>
                <dt>Điểm cao nhất</dt>
                <dd>{formatScore(bestPrev)}<small>/10</small></dd>
              </div>
            )}
          </dl>

          {active && (
            <div className="notice is-warning">
              <UiIcon name="clock" size={18} />
              <div className="notice-body">
                <div className="notice-title">Bạn đang làm dở đề này</div>
                <div className="notice-text">
                  Đồng hồ vẫn chạy từ lúc bắt đầu, còn khoảng {activeLeftMin} phút. Rời trang làm bài được tính
                  là 1 lần rời màn hình.
                </div>
              </div>
            </div>
          )}

          <section className="exam-rules" aria-labelledby="exam-rules-title">
            <h2 id="exam-rules-title">Quy định khi làm bài</h2>
            <ul>
              <li>
                <span className="exam-rule-icon"><UiIcon name="clock" size={18} /></span>
                <div>
                  <b>Đồng hồ bắt đầu đếm ngược ngay khi bấm “Bắt đầu làm bài”</b>
                  <span>Hết {info.durationMinutes} phút, bài tự động nộp với các câu bạn đã chọn.</span>
                </div>
              </li>
              <li>
                <span className="exam-rule-icon"><UiIcon name="mouse" size={18} /></span>
                <div>
                  <b>Không rời khỏi màn hình làm bài</b>
                  <span>
                    Bài làm hiện toàn màn hình. Không rê chuột ra ngoài, không chuyển tab hay mở cửa sổ khác,
                    không nhấn Esc để thoát toàn màn hình.
                  </span>
                </div>
              </li>
              <li>
                <span className="exam-rule-icon is-warn"><UiIcon name="alert" size={18} /></span>
                <div>
                  <b>Rời màn hình {maxViolations} lần, bài tự động nộp</b>
                  <span>Mỗi lần rời màn hình đều được ghi lại và giáo viên xem được.</span>
                </div>
              </li>
              <li>
                <span className="exam-rule-icon"><UiIcon name="check" size={18} /></span>
                <div>
                  <b>Đáp án được lưu tự động</b>
                  <span>Lỡ tải lại trang vẫn làm tiếp được, nhưng thời gian không dừng lại.</span>
                </div>
              </li>
            </ul>
          </section>

          {error && (
            <div className="notice is-danger">
              <UiIcon name="alert" size={18} />
              <div className="notice-body">{error}</div>
            </div>
          )}

          <div className="exam-intro-actions">
            {noQuestions && <span className="exam-intro-hint">Đề chưa có câu hỏi.</span>}
            <button type="button" className="btn btn-lg" onClick={handleStart} disabled={starting || noQuestions}>
              {starting ? (
                <>
                  <span className="spinner is-on-primary" /> Đang mở đề…
                </>
              ) : (
                <>
                  <UiIcon name="play" size={17} /> {active ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------- Đang làm bài
  const questionsWithMeta = withTopicNumbers(questions);
  const answeredCount = Object.keys(answers).length;
  const totalCount = questions.length;
  const unanswered = totalCount - answeredCount;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const left = remaining ?? 0;
  const clockLevel = left <= DANGER_MS ? 'danger' : left <= WARN_MS ? 'warn' : 'normal';
  const locked = submitting || Boolean(autoReason);
  const leavesLeft = Math.max(0, maxViolations - violations);

  const navGroups = [];
  questionsWithMeta.forEach(({ question: q, topicName, displayQNum }, idx) => {
    if (!navGroups.length || navGroups[navGroups.length - 1].topicName !== topicName) {
      navGroups.push({ topicName, items: [] });
    }
    navGroups[navGroups.length - 1].items.push({ q, displayQNum, idx });
  });

  return (
    <div className="exam-stage">
      <header className="exam-bar">
        <div className="exam-bar-inner">
          <div className="exam-bar-main">
            <div className="exam-bar-title" title={info.title}>{info.title}</div>
            <div className="exam-bar-progress">
              <div className="score-bar is-thin" aria-hidden="true">
                <span className="is-primary" style={{ width: `${progressPercent}%` }} />
              </div>
              <span>
                {answeredCount}/{totalCount} câu
              </span>
              {saveState !== 'idle' && (
                <span className={`exam-save is-${saveState}`}>
                  {saveState === 'saving' && 'Đang lưu…'}
                  {saveState === 'saved' && (
                    <>
                      <UiIcon name="check" size={13} /> Đã lưu
                    </>
                  )}
                  {saveState === 'error' && 'Chưa lưu được'}
                </span>
              )}
            </div>
          </div>

          <div className="exam-bar-side">
            {violations > 0 && (
              <span className="exam-strikes" title="Số lần rời màn hình làm bài">
                <UiIcon name="alert" size={14} /> {violations}/{maxViolations}
              </span>
            )}
            <div
              className={`exam-clock is-${clockLevel}`}
              role="timer"
              aria-label={`Thời gian còn lại ${formatClock(left)}`}
            >
              <UiIcon name="clock" size={17} />
              <span>{formatClock(left)}</span>
            </div>
            <button type="button" className="btn sm" onClick={() => setConfirmOpen(true)} disabled={locked}>
              {submitting && !autoReason ? <span className="spinner is-on-primary" /> : <UiIcon name="check" size={15} />}
              Nộp bài
            </button>
          </div>
        </div>
        <span className="visually-hidden" aria-live="polite">
          {clockLevel === 'danger' ? 'Còn dưới 1 phút' : clockLevel === 'warn' ? 'Còn dưới 5 phút' : ''}
        </span>
      </header>

      <div className="exam-body">
        <main className="exam-main">
          {resumeNotice && (
            <div className="notice is-warning exam-resume">
              <UiIcon name="alert" size={18} />
              <div className="notice-body">
                Bạn đã rời trang làm bài, việc này được tính là 1 lần rời màn hình (hiện tại {violations}/
                {maxViolations}). Thời gian vẫn tính từ lúc bắt đầu.
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setResumeNotice(false)}
                aria-label="Đóng thông báo"
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>
          )}

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
                              disabled={locked}
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

          <div className="card exam-submit">
            {error && !autoReason && (
              <div className="notice is-danger">
                <UiIcon name="alert" size={18} />
                <div className="notice-body">{error}</div>
              </div>
            )}
            <p>
              Bạn đã chọn đáp án cho <strong>{answeredCount}</strong>/{totalCount} câu.
              {unanswered > 0 && ' Câu bỏ trống sẽ tính là sai.'}
            </p>
            <button className="btn btn-lg" onClick={() => setConfirmOpen(true)} disabled={locked}>
              {submitting && !autoReason ? (
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
        </main>

        {/* Bảng điều hướng: nhóm theo chủ đề, số câu khớp với danh sách bên trái */}
        <aside className="exam-question-nav" aria-label="Danh sách câu hỏi">
          <div className="exam-question-nav-title">Danh sách câu hỏi</div>
          <div className="exam-question-nav-body">
            {navGroups.map((group, gIdx) => (
              <div key={`${group.topicName}-${gIdx}`} className="exam-question-nav-group">
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
            ))}
          </div>
          <div className="exam-question-nav-legend">
            <span><i className="exam-question-nav-dot done" aria-hidden="true" /> Đã làm ({answeredCount})</span>
            <span><i className="exam-question-nav-dot pending" aria-hidden="true" /> Chưa làm ({unanswered})</span>
          </div>
        </aside>
      </div>

      {/* Xác nhận nộp bài (không dùng window.confirm vì sẽ làm mất toàn màn hình) */}
      {confirmOpen && !autoReason && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title">
          <div className="modal-panel">
            <div className="modal-head">
              <div className="modal-icon is-primary">
                <UiIcon name="check" size={20} />
              </div>
              <div>
                <h3 id="exam-confirm-title">Nộp bài?</h3>
                <p>
                  Bạn đã làm {answeredCount}/{totalCount} câu
                  {unanswered > 0 ? `, còn ${unanswered} câu chưa chọn đáp án (tính là sai)` : ''}. Thời gian còn
                  lại {formatClock(left)}.
                </p>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setConfirmOpen(false)}>
                Làm tiếp
              </button>
              <button type="button" className="btn" onClick={() => submit('manual')} autoFocus>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo rời màn hình / bài đang tự nộp */}
      {(guard || autoReason) && (
        <div
          className="exam-guard"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="exam-guard-title"
          aria-describedby="exam-guard-desc"
        >
          <div className="exam-guard-card">
            {autoReason ? (
              <>
                <div className={`exam-guard-icon ${autoReason === 'timeout' ? 'is-time' : 'is-danger'}`}>
                  <UiIcon name={autoReason === 'timeout' ? 'clock' : 'alert'} size={26} />
                </div>
                <h2 id="exam-guard-title">
                  {autoReason === 'timeout' ? 'Hết giờ làm bài' : `Bạn đã rời màn hình ${maxViolations} lần`}
                </h2>
                <p id="exam-guard-desc">
                  {error || 'Bài làm đang được nộp tự động với các đáp án bạn đã chọn.'}
                </p>
                {error ? (
                  <button type="button" className="btn btn-lg" onClick={() => submit(autoReason)}>
                    <UiIcon name="refresh" size={17} /> Nộp lại
                  </button>
                ) : (
                  <span className="spinner" style={{ width: 24, height: 24 }} aria-hidden="true" />
                )}
              </>
            ) : (
              <>
                <div className="exam-guard-icon">
                  <UiIcon name="alert" size={26} />
                </div>
                <h2 id="exam-guard-title">Bạn đã rời khỏi màn hình làm bài</h2>
                <p id="exam-guard-desc">
                  {LEAVE_TEXT[guard.type] || 'Bạn vừa rời khỏi màn hình làm bài.'} Lần này đã được ghi lại.
                </p>
                <div className="exam-guard-strikes" aria-hidden="true">
                  {Array.from({ length: maxViolations }, (_, i) => (
                    <i key={i} className={i < violations ? 'is-on' : ''} />
                  ))}
                </div>
                <div className="exam-guard-count">
                  <b>
                    Lần {violations}/{maxViolations}
                  </b>
                  {' · '}Rời thêm {leavesLeft} lần nữa, bài sẽ tự động nộp.
                </div>
                <div className="exam-guard-time">
                  Đồng hồ vẫn chạy: còn <b>{formatClock(left)}</b>
                </div>
                <button type="button" className="btn btn-lg" onClick={handleReturn} autoFocus>
                  <UiIcon name="expand" size={17} /> Quay lại làm bài
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
