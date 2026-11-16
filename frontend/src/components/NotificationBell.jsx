import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function readSetKey(role, userId) {
  return `notif_read_${role}_${userId}`;
}

function loadReadSet(role, userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(readSetKey(role, userId)) || '[]'));
  } catch {
    return new Set();
  }
}

function saveReadSet(role, userId, set) {
  localStorage.setItem(readSetKey(role, userId), JSON.stringify(Array.from(set)));
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'unread'
  const [searchText, setSearchText] = useState('');
  const wrapperRef = useRef(null);

  const isTeacher = user?.role === 'teacher';

  async function load() {
    if (!user) return;
    const readSet = loadReadSet(user.role, user.id);
    try {
      if (isTeacher) {
        // Giáo viên: thông báo học sinh nộp bài + thông báo học sinh bình
        // luận vào bài đăng "Thông tin chung"
        const [subsRes, announcementsRes] = await Promise.all([
          api.get('/teacher/submissions'),
          api.get('/announcements').catch(() => ({ data: [] })),
        ]);

        const submissionItems = subsRes.data
          .filter((s) => !s.attempt || s.attempt === 1)
          .map((s) => {
            const initial = s.studentName ? s.studentName.trim().charAt(0).toUpperCase() : 'H';
            return {
              id: s.id,
              type: 'submission',
              avatarText: initial,
              avatarBg: 'linear-gradient(135deg, var(--primary), var(--primary))',
              badgeIcon: '📝',
              badgeBg: '#10b981',
              title: s.studentName,
              desc: `vừa hoàn thành và nộp bài "${s.examTitle}"`,
              timestamp: s.submittedAt,
              targetPath: `/teacher/exams/${s.examId}/submissions/${s.id}`,
              read: readSet.has(s.id),
            };
          });

        const commentItems = [];
        (announcementsRes.data || []).forEach((a) => {
          (a.comments || [])
            .filter((c) => c.authorRole === 'student')
            .forEach((c) => {
              const initial = c.authorName ? c.authorName.trim().charAt(0).toUpperCase() : 'H';
              commentItems.push({
                id: `comment-${c.id}`,
                type: 'comment',
                avatarText: initial,
                avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
                badgeIcon: '💬',
                badgeBg: 'var(--primary)',
                title: c.authorName,
                desc: `đã bình luận vào bài "${a.title || 'Thông tin chung'}": ${c.content.slice(0, 60)}${c.content.length > 60 ? '…' : ''}`,
                timestamp: c.createdAt,
                targetPath: '/announcements',
                read: readSet.has(`comment-${c.id}`),
              });
            });
        });

        const items = [...submissionItems, ...commentItems];
        items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setNotifications(items);
      } else {
        // Học sinh: đề thi mới, lộ trình AI, được thêm vào nhóm & thông báo chung
        const [examsRes, submissionsRes, roadmapsRes, groupsRes, announcementsRes] = await Promise.all([
          api.get('/student/exams'),
          api.get('/student/submissions'),
          api.get('/student/me/roadmaps').catch(() => ({ data: [] })),
          api.get('/student/me/groups').catch(() => ({ data: [] })),
          api.get('/announcements').catch(() => ({ data: [] })),
        ]);
        const submittedIds = new Set(submissionsRes.data.map((s) => s.examId));
        const pending = examsRes.data.filter((e) => !submittedIds.has(e.id));

        const examItems = pending.map((e) => {
          const isAiExam =
            (e.description && e.description.includes('Đề tự động sinh')) ||
            (e.title && e.title.includes('Bài tập tiếp theo'));

          return {
            id: `exam-${e.id}`,
            type: isAiExam ? 'ai_exam' : 'exam',
            avatarText: isAiExam ? '🎯' : '📝',
            avatarBg: isAiExam
              ? 'linear-gradient(135deg, #10b981, #059669)'
              : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            badgeIcon: isAiExam ? 'AI' : '★',
            badgeBg: isAiExam ? '#8b5cf6' : 'var(--primary)',
            title: isAiExam ? 'Bài tập AI mới' : 'Đề kiểm tra mới',
            desc: `"${e.title}" đã được giao cho bạn`,
            timestamp: e.createdAt,
            targetPath: `/student/exams/${e.id}`,
            read: readSet.has(`exam-${e.id}`) || readSet.has(e.id),
          };
        });

        const roadmapItems = (roadmapsRes.data || []).map((r) => {
          const examName = r.sourceExamTitle || 'đề thi';
          const attemptText = r.attempt ? ` (Lần ${r.attempt})` : '';

          let targetPath = '/student/weak-topics';
          if (r.sourceSubmissionId) {
            targetPath = `/student/weak-topics?submissionId=${r.sourceSubmissionId}`;
          } else if (r.sourceExamId) {
            const matchSub = submissionsRes.data.find((s) => s.examId === r.sourceExamId);
            if (matchSub) {
              targetPath = `/student/weak-topics?submissionId=${matchSub.id}`;
            }
          }

          return {
            id: `roadmap-${r.id}`,
            type: 'roadmap',
            avatarText: '✨',
            avatarBg: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            badgeIcon: '🚀',
            badgeBg: '#f59e0b',
            title: 'Lộ trình ôn tập AI',
            desc: `đã được giáo viên duyệt cho bài "${examName}"${attemptText}`,
            timestamp: r.reviewedAt || r.generatedAt,
            targetPath,
            read: readSet.has(`roadmap-${r.id}`) || readSet.has(r.id),
          };
        });

        const groupItems = (groupsRes.data || []).map((g) => ({
          id: `group-${g.id}`,
          type: 'group',
          avatarText: '🗂️',
          avatarBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
          badgeIcon: '👥',
          badgeBg: '#7c3aed',
          title: 'Được thêm vào nhóm',
          desc: `Bạn vừa được thêm vào nhóm "${g.name}" (${g.memberCount} thành viên)`,
          timestamp: g.createdAt,
          targetPath: '/student',
          read: readSet.has(`group-${g.id}`),
        }));

        const announcementItems = (announcementsRes.data || []).map((a) => ({
          id: `announcement-${a.id}`,
          type: 'announcement',
          avatarText: '📢',
          avatarBg: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
          badgeIcon: '📌',
          badgeBg: 'var(--primary)',
          title: a.authorName,
          desc: `đã đăng thông báo${a.title ? ` "${a.title}"` : ''}: ${a.content.slice(0, 60)}${a.content.length > 60 ? '…' : ''}`,
          timestamp: a.createdAt,
          targetPath: '/announcements',
          read: readSet.has(`announcement-${a.id}`),
        }));

        const items = [...examItems, ...roadmapItems, ...groupItems, ...announcementItems];
        items.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        setNotifications(items);
      }
    } catch {
      setNotifications([]);
    }
  }

  useEffect(() => {
    load();

    // Tự động làm mới thông báo định kỳ mỗi 3.5 giây (Real-time polling)
    const interval = setInterval(load, 3500);

    function onVisibleOrFocus() {
      if (!document.hidden) {
        load();
      }
    }

    window.addEventListener('focus', onVisibleOrFocus);
    document.addEventListener('visibilitychange', onVisibleOrFocus);
    window.addEventListener('app:refresh-notifications', load);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onVisibleOrFocus);
      document.removeEventListener('visibilitychange', onVisibleOrFocus);
      window.removeEventListener('app:refresh-notifications', load);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleItemClick(item) {
    const readSet = loadReadSet(user.role, user.id);
    readSet.add(item.id);
    saveReadSet(user.role, user.id, readSet);
    setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
    setOpen(false);
    navigate(item.targetPath);
  }

  function handleMarkAllAsRead() {
    const readSet = loadReadSet(user.role, user.id);
    notifications.forEach((n) => readSet.add(n.id));
    saveReadSet(user.role, user.id, readSet);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  // LƯU Ý: KHÔNG tự đánh dấu "đã đọc" chỉ vì mở chuông ra xem - số lượng
  // thông báo chưa đọc phải giữ nguyên cho tới khi người dùng thực sự bấm
  // vào đúng thông báo đó (handleItemClick) hoặc bấm "Đã đọc tất cả"
  // (handleMarkAllAsRead). Trước đây có thử tự đánh dấu đã đọc sau 1.5 giây
  // mở chuông, nhưng gây hiểu nhầm ngược lại: số lượng biến mất dù người
  // dùng chưa thật sự đọc/xử lý thông báo nào cả.

  if (!user) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const tabFiltered = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const q = searchText.trim().toLowerCase();
  const filteredList = q
    ? tabFiltered.filter((n) => `${n.title} ${n.desc}`.toLowerCase().includes(q))
    : tabFiltered;

  return (
    <div ref={wrapperRef} className="no-print exam-hide" style={{ position: 'fixed', top: 16, right: 24, zIndex: 200 }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Thông báo"
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          border: '1px solid var(--line-strong)',
          background: 'var(--surface)',
          color: open ? 'var(--primary)' : 'var(--ink-2)',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px -4px rgba(21, 32, 58, 0.18)',
          transition: 'border-color 0.15s ease, color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--primary-border)';
          e.currentTarget.style.color = 'var(--primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--line-strong)';
          e.currentTarget.style.color = open ? 'var(--primary)' : 'var(--ink-2)';
        }}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 1.8 6.5 2.5 7.2H3.5C4.2 16 6 14 6 9.5Z" />
          <path d="M10 20a2.2 2.2 0 0 0 4 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 999,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 5px',
              border: '2px solid var(--surface)',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Facebook-style Dropdown Popup */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            width: 390,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 520,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 18px 12px',
              borderBottom: '1px solid var(--bg-subtle)',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>Thông báo</h2>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary, var(--primary))',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  ✓ Đã đọc tất cả
                </button>
              )}
            </div>

            {/* Ô tìm kiếm thông báo theo tên/nội dung */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-light)' }}>🔍</span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm thông báo…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px 7px 30px',
                  fontSize: 13,
                  borderRadius: 20,
                  border: '1px solid var(--line)',
                  background: 'var(--surface-2)',
                  outline: 'none',
                }}
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  title="Xoá tìm kiếm"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-light)',
                    fontSize: 13,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills: Tất cả / Chưa đọc */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setTab('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: tab === 'all' ? 'var(--primary-light, var(--primary-light))' : 'var(--bg-subtle)',
                  color: tab === 'all' ? 'var(--primary, var(--primary))' : 'var(--ink-soft)',
                  transition: 'all 0.15s ease',
                }}
              >
                Tất cả {notifications.length > 0 && `(${notifications.length})`}
              </button>
              <button
                type="button"
                onClick={() => setTab('unread')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: tab === 'unread' ? 'var(--primary-light, var(--primary-light))' : 'var(--bg-subtle)',
                  color: tab === 'unread' ? 'var(--primary, var(--primary))' : 'var(--ink-soft)',
                  transition: 'all 0.15s ease',
                }}
              >
                Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredList.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>
                  {q ? '🔍' : tab === 'unread' ? '🎉' : '🔔'}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>
                  {q ? 'Không tìm thấy thông báo phù hợp' : tab === 'unread' ? 'Bạn đã đọc hết thông báo!' : 'Không có thông báo nào'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {q
                    ? `Không có thông báo nào khớp với "${searchText.trim()}"`
                    : tab === 'unread'
                      ? 'Tất cả các thông báo đã được xem.'
                      : 'Khi có bài nộp hoặc đề mới, thông báo sẽ xuất hiện ở đây.'}
                </div>
              </div>
            ) : (
              filteredList.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: n.read ? 'var(--surface)' : 'var(--primary-light)',
                    borderBottom: '1px solid var(--surface-2)',
                    transition: 'background 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = n.read ? 'var(--surface-2)' : 'var(--primary-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? 'var(--surface)' : 'var(--primary-light)')}
                >
                  {/* Left Avatar Icon with small badge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: n.avatarBg || 'linear-gradient(135deg, var(--primary), var(--primary))',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: n.avatarText?.length === 1 ? 18 : 20,
                        fontWeight: 800,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {n.avatarText || '🔔'}
                    </div>
                    {n.badgeIcon && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: n.badgeBg || 'var(--primary)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 800,
                          border: '2px solid var(--surface)',
                        }}
                      >
                        {n.badgeIcon}
                      </div>
                    )}
                  </div>

                  {/* Main Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.45, wordBreak: 'break-word' }}>
                      <strong style={{ fontWeight: 700, color: 'var(--ink)' }}>{n.title}</strong>{' '}
                      <span>{n.desc}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: n.read ? 'var(--ink-soft)' : 'var(--primary)',
                        fontWeight: n.read ? 400 : 700,
                        marginTop: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span>{timeAgo(n.timestamp)}</span>
                    </div>
                  </div>

                  {/* Unread Blue Dot */}
                  {!n.read && (
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        flexShrink: 0,
                        marginLeft: 4,
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
