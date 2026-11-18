import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import UiIcon, { scoreLevel } from './UiIcon';
import GameCharacter, { CHARACTERS } from './GameCharacters';

// Lịch sử chơi "Đường đua Toán học": thống kê + danh sách các lượt chơi.
// Dùng ở trang Lịch sử chơi của học sinh và hồ sơ học sinh của giáo viên.

const PAGE_SIZE = 10;

// Mức màu theo % quãng đường, cùng mốc với điểm: >= 80% tốt, >= 50% đạt.
export const percentLevel = (percent) => scoreLevel((Number(percent) || 0) / 10);

export function verdictOf(percent) {
  const level = percentLevel(percent);
  if (level === 'good') return 'Kết quả tốt';
  if (level === 'ok') return 'Đạt yêu cầu';
  return 'Cần ôn tập thêm';
}

export function characterOf(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} phút ${s % 60} giây` : `${m} phút`;
  return m % 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${Math.floor(m / 60)} giờ`;
}

export function formatPlayedAt(iso) {
  return iso
    ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';
}

function statsOf(items) {
  const questions = items.reduce((sum, i) => sum + (i.totalQuestions || 0), 0);
  const correct = items.reduce((sum, i) => sum + (i.correctCount || 0), 0);
  return {
    games: items.length,
    best: items.length ? Math.max(...items.map((i) => i.percent || 0)) : 0,
    accuracy: questions ? Math.round((correct / questions) * 100) : 0,
    correct,
    questions,
    perfect: items.filter((i) => i.percent === 100).length,
  };
}

function HistoryRow({ item, to }) {
  return (
    <li className="game-history-row">
      <span className="game-history-avatar" aria-hidden="true">
        <GameCharacter id={item.characterId || undefined} size={36} />
      </span>
      <div className="game-history-main">
        <span className="game-history-topic">{item.bankTitle}</span>
        <span className="game-history-meta">
          <span><UiIcon name="clock" size={13} /> {formatPlayedAt(item.finishedAt)}</span>
          <span>{formatDuration(item.durationSeconds)}</span>
          <span>{`Đúng ${item.correctCount}/${item.totalQuestions} câu`}</span>
        </span>
      </div>
      <span className={`score-pill is-${percentLevel(item.percent)}`}>
        {item.percent}<small>%</small>
      </span>
      <Link to={to} className="btn sm secondary game-history-action">Xem lại</Link>
    </li>
  );
}

// items: danh sách tóm tắt từ API (mới nhất trước); detailPath(id) -> link xem lại.
export default function GameHistoryPanel({ items, detailPath, empty }) {
  const [topic, setTopic] = useState('all');
  const [shown, setShown] = useState(PAGE_SIZE);

  const topics = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      const t = map.get(i.bankId) || { bankId: i.bankId, title: i.bankTitle, count: 0 };
      t.count += 1;
      map.set(i.bankId, t);
    });
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
  }, [items]);

  if (items.length === 0) return empty;

  const filtered = topic === 'all' ? items : items.filter((i) => i.bankId === topic);
  const stats = statsOf(filtered);

  return (
    <div className="game-history">
      <dl className="game-history-stats">
        <div>
          <dt>Số lượt chơi</dt>
          <dd>{stats.games}</dd>
        </div>
        <div>
          <dt>Kết quả tốt nhất</dt>
          <dd className={`is-${percentLevel(stats.best)}`}>{stats.best}<small>%</small></dd>
        </div>
        <div>
          <dt>Tỉ lệ trả lời đúng</dt>
          <dd>{stats.accuracy}<small>%</small></dd>
          <span className="game-history-stat-sub">{`${stats.correct}/${stats.questions} câu`}</span>
        </div>
        <div>
          <dt>Về đích hoàn hảo</dt>
          <dd>{stats.perfect}</dd>
          <span className="game-history-stat-sub">Đúng 100%</span>
        </div>
      </dl>

      {topics.length > 1 && (
        <div className="game-history-filter">
          <label htmlFor="game-history-topic">Chủ đề</label>
          <select
            id="game-history-topic"
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setShown(PAGE_SIZE); }}
          >
            <option value="all">Tất cả chủ đề</option>
            {topics.map((t) => (
              <option key={t.bankId} value={t.bankId}>{`${t.title} (${t.count})`}</option>
            ))}
          </select>
        </div>
      )}

      <ul className="game-history-list">
        {filtered.slice(0, shown).map((item) => (
          <HistoryRow key={item.id} item={item} to={detailPath(item.id)} />
        ))}
      </ul>

      {filtered.length > shown && (
        <div className="game-history-more">
          <button type="button" className="btn secondary sm" onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Xem thêm <UiIcon name="chevron-down" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
