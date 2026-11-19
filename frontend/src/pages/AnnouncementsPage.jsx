import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import UiIcon from '../components/UiIcon';
import { confirmDialog, toast } from '../components/Notify';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Bảng tin tự cập nhật ngầm (không hiện "Đang tải") để bài đăng/bình luận
// mới từ người khác hiện ra mà không cần tải lại trang.
const REFRESH_INTERVAL_MS = 5000;
const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

function getFullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${BACKEND_BASE}${url}`;
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

function formatPostedDate(iso) {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classesList, setClassesList] = useState([]);
  const [groups, setGroups] = useState([]);

  // Đăng thông báo mới (chỉ giáo viên)
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  const [newAudienceType, setNewAudienceType] = useState('all'); // 'all' | 'class' | 'group'
  const [newAudienceValue, setNewAudienceValue] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Sửa thông báo
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRemoveAttachments, setEditRemoveAttachments] = useState([]);
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editAudienceType, setEditAudienceType] = useState('all');
  const [editAudienceValue, setEditAudienceValue] = useState('');

  // Ô nhập bình luận theo từng bài (key = announcementId)
  const [commentDrafts, setCommentDrafts] = useState({});
  const [postingCommentId, setPostingCommentId] = useState(null);

  // Sửa bình luận (key = commentId)
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [savingCommentId, setSavingCommentId] = useState(null);

  // Đánh số từng lượt tải: chỉ nhận kết quả của lượt MỚI NHẤT, tránh việc
  // 1 lượt tải ngầm cũ về chậm ghi đè mất dữ liệu vừa đăng/sửa.
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    loadSeqRef.current += 1;
    const seq = loadSeqRef.current;
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/announcements');
      if (seq === loadSeqRef.current) setAnnouncements(data);
    } catch (err) {
      if (!silent) console.error(err);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const refresh = () => {
      if (!document.hidden) loadData({ silent: true });
    };
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('app:refresh-notifications', refresh);

    if (isTeacher) {
      api.get('/teacher/students')
        .then(({ data }) => {
          const classes = Array.from(new Set((data || []).map((s) => (s.className || '').trim()).filter(Boolean))).sort();
          setClassesList(classes);
        })
        .catch(() => {});
      api.get('/teacher/groups').then(({ data }) => setGroups(data || [])).catch(() => {});
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('app:refresh-notifications', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePost(e) {
    e.preventDefault();
    setPostError('');
    if (!newContent.trim()) {
      setPostError('Vui lòng nhập nội dung thông báo');
      return;
    }
    if (newAudienceType !== 'all' && !newAudienceValue) {
      setPostError('Vui lòng chọn lớp hoặc nhóm nhận thông báo');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle);
      formData.append('content', newContent);
      formData.append('audienceType', newAudienceType);
      if (newAudienceType !== 'all') formData.append('audienceValue', newAudienceValue);
      newFiles.forEach((f) => formData.append('files', f));
      const { data: created } = await api.post('/announcements', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Hiện bài vừa đăng ngay lập tức từ kết quả trả về, sau đó mới đồng bộ
      // lại toàn bộ danh sách.
      if (created && created.id) {
        setAnnouncements((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
      }
      setNewTitle('');
      setNewContent('');
      setNewFiles([]);
      setNewAudienceType('all');
      setNewAudienceValue('');
      window.dispatchEvent(new Event('app:refresh-notifications'));
      await loadData({ silent: true });
    } catch (err) {
      setPostError(err.response?.data?.message || 'Đăng thông báo thất bại');
    } finally {
      setPosting(false);
    }
  }

  function startEdit(a) {
    setEditingId(a.id);
    setEditTitle(a.title || '');
    setEditContent(a.content);
    setEditRemoveAttachments([]);
    setEditNewFiles([]);
    setEditAudienceType(a.audienceType || 'all');
    setEditAudienceValue(a.audienceValue || '');
  }

  function toggleRemoveAttachment(filename) {
    setEditRemoveAttachments((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
  }

  async function handleSaveEdit(id) {
    if (!editContent.trim()) return;
    if (editAudienceType !== 'all' && !editAudienceValue) {
      toast.warning('Vui lòng chọn lớp hoặc nhóm nhận thông báo');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('content', editContent);
      formData.append('audienceType', editAudienceType);
      if (editAudienceType !== 'all') formData.append('audienceValue', editAudienceValue);
      editRemoveAttachments.forEach((filename) => formData.append('removeAttachments', filename));
      editNewFiles.forEach((f) => formData.append('files', f));
      await api.put(`/announcements/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditingId(null);
      await loadData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi sửa thông báo');
    }
  }

  async function handleDeleteAnnouncement(a) {
    const ok = await confirmDialog({
      title: 'Xoá thông báo này?',
      message: 'Toàn bộ bình luận bên dưới sẽ bị xoá theo.',
      confirmText: 'Xoá',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/announcements/${a.id}`);
      await loadData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xoá thông báo');
    }
  }

  async function handleAddComment(announcementId) {
    const content = (commentDrafts[announcementId] || '').trim();
    if (!content) return;
    setPostingCommentId(announcementId);
    try {
      await api.post(`/announcements/${announcementId}/comments`, { content });
      setCommentDrafts((prev) => ({ ...prev, [announcementId]: '' }));
      await loadData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setPostingCommentId(null);
    }
  }

  async function handleDeleteComment(commentId) {
    const ok = await confirmDialog({
      title: 'Xoá bình luận này?',
      message: 'Bình luận sẽ bị xoá vĩnh viễn.',
      confirmText: 'Xoá',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api.delete(`/announcements/comments/${commentId}`);
      await loadData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xoá bình luận');
    }
  }

  function startEditComment(comment) {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  }

  async function handleSaveEditComment(commentId) {
    const content = editCommentText.trim();
    if (!content) return;
    setSavingCommentId(commentId);
    try {
      await api.put(`/announcements/comments/${commentId}`, { content });
      setEditingCommentId(null);
      await loadData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi sửa bình luận');
    } finally {
      setSavingCommentId(null);
    }
  }

  function renderAudienceSelect({ type, value, onTypeChange, onValueChange, idPrefix }) {
    return (
      <>
        <label className="toolbar-field" htmlFor={`${idPrefix}-audience`}>
          Gửi tới
          <select id={`${idPrefix}-audience`} value={type} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="all">Tất cả học sinh</option>
            <option value="class">Một lớp</option>
            <option value="group">Một nhóm</option>
          </select>
        </label>
        {type === 'class' && (
          <select aria-label="Chọn lớp nhận thông báo" value={value} onChange={(e) => onValueChange(e.target.value)}>
            <option value="">Chọn lớp</option>
            {classesList.map((c) => <option key={c} value={c}>Lớp {c}</option>)}
          </select>
        )}
        {type === 'group' && (
          <select aria-label="Chọn nhóm nhận thông báo" value={value} onChange={(e) => onValueChange(e.target.value)}>
            <option value="">Chọn nhóm</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
      </>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 780 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thông tin chung</h1>
          <p className="page-subtitle">
            {isTeacher
              ? 'Đăng thông báo cho học sinh, mọi người có thể bình luận bên dưới mỗi bài'
              : 'Thông báo từ giáo viên, bạn có thể bình luận bên dưới mỗi bài'}
          </p>
        </div>
      </div>

      {/* Ô đăng thông báo mới - chỉ giáo viên */}
      {isTeacher && (
        <div className="card composer">
          <form onSubmit={handlePost}>
            <input
              type="text"
              className="composer-title"
              placeholder="Tiêu đề (không bắt buộc)"
              aria-label="Tiêu đề thông báo"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <textarea
              className="composer-body"
              placeholder="Nội dung thông báo cho học sinh"
              aria-label="Nội dung thông báo"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />

            {newFiles.length > 0 && (
              <div className="file-chips">
                {newFiles.map((f, i) => (
                  <span key={i} className="file-chip">
                    <UiIcon name={f.type.startsWith('image/') ? 'image' : 'file'} size={14} />
                    <span className="file-chip-name">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Bỏ tệp ${f.name}`}
                    >
                      <UiIcon name="close" size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              id="ann-files"
              type="file"
              multiple
              className="visually-hidden"
              tabIndex={-1}
              onChange={(e) => {
                setNewFiles(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />

            {postError && (
              <div className="ce-alert is-danger" role="alert" aria-live="polite">
                <UiIcon name="alert" size={17} />
                <span>{postError}</span>
              </div>
            )}

            <div className="composer-bar">
              <button type="button" className="btn sm secondary" onClick={() => document.getElementById('ann-files')?.click()}>
                <UiIcon name="image" size={15} />
                Đính kèm ảnh hoặc tệp
              </button>
              {renderAudienceSelect({
                idPrefix: "new",
                type: newAudienceType,
                value: newAudienceValue,
                onTypeChange: (t) => { setNewAudienceType(t); setNewAudienceValue(''); },
                onValueChange: setNewAudienceValue,
              })}
              <div className="toolbar-spacer" />
              <button className="btn" type="submit" disabled={posting}>
                <UiIcon name="send" size={16} />
                {posting ? 'Đang đăng…' : 'Đăng thông báo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách thông báo */}
      {loading ? (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div className="empty-state-title">Đang tải bảng tin…</div>
          </div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon is-svg"><UiIcon name="megaphone" size={22} /></div>
            <div className="empty-state-title">Chưa có thông báo nào</div>
            <p className="empty-state-desc">
              {isTeacher ? 'Viết thông báo đầu tiên cho học sinh ở ô phía trên.' : 'Khi giáo viên đăng thông báo, nó sẽ hiện ở đây.'}
            </p>
          </div>
        </div>
      ) : (
        announcements.map((a) => {
          const isMine = a.authorId === user?.id;
          const isEditing = editingId === a.id;

          return (
            <article key={a.id} className="card post">
              <header className="post-head">
                <span className="avatar" aria-hidden="true">{a.authorName?.trim().charAt(0).toUpperCase() || 'G'}</span>
                <div className="post-author">
                  <div className="post-author-row">
                    <strong>{a.authorName}</strong>
                    <span className="role-badge">Giáo viên</span>
                    {a.audienceType !== 'all' && <span className="class-badge">Gửi {a.audienceLabel}</span>}
                  </div>
                  <div className="meta-row">
                    <span>{timeAgo(a.createdAt)}{a.updatedAt ? ' (đã chỉnh sửa)' : ''}</span>
                    <span>{formatPostedDate(a.createdAt)}</span>
                  </div>
                </div>
                {isTeacher && isMine && !isEditing && (
                  <div className="row-actions">
                    <button type="button" className="icon-btn" onClick={() => startEdit(a)} aria-label="Sửa thông báo" title="Sửa thông báo">
                      <UiIcon name="edit" size={15} />
                    </button>
                    <button type="button" className="icon-btn is-danger" onClick={() => handleDeleteAnnouncement(a)} aria-label="Xoá thông báo" title="Xoá thông báo">
                      <UiIcon name="trash" size={15} />
                    </button>
                  </div>
                )}
              </header>

              {isEditing ? (
                <div className="post-edit">
                  <input
                    type="text"
                    className="composer-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Tiêu đề (không bắt buộc)"
                    aria-label="Tiêu đề thông báo"
                  />
                  <textarea
                    className="composer-body"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    aria-label="Nội dung thông báo"
                  />

                  {(a.attachments.length > 0 || editNewFiles.length > 0) && (
                    <div className="file-chips">
                      {a.attachments.map((att) => {
                        const marked = editRemoveAttachments.includes(att.filename);
                        return (
                          <span key={att.filename} className={`file-chip${marked ? ' is-removed' : ''}`}>
                            <UiIcon name={att.isImage ? 'image' : 'file'} size={14} />
                            <span className="file-chip-name">{att.originalName}</span>
                            <button
                              type="button"
                              onClick={() => toggleRemoveAttachment(att.filename)}
                              aria-label={marked ? `Giữ lại ${att.originalName}` : `Gỡ ${att.originalName}`}
                              title={marked ? 'Giữ lại tệp này' : 'Gỡ tệp này khi lưu'}
                            >
                              <UiIcon name={marked ? 'undo' : 'close'} size={13} />
                            </button>
                          </span>
                        );
                      })}
                      {editNewFiles.map((f, i) => (
                        <span key={`new-${i}`} className="file-chip is-new">
                          <UiIcon name={f.type.startsWith('image/') ? 'image' : 'file'} size={14} />
                          <span className="file-chip-name">{f.name}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <input
                    id={`ann-edit-files-${a.id}`}
                    type="file"
                    multiple
                    className="visually-hidden"
                    tabIndex={-1}
                    onChange={(e) => {
                      setEditNewFiles(Array.from(e.target.files || []));
                      e.target.value = '';
                    }}
                  />

                  <div className="composer-bar">
                    <button
                      type="button"
                      className="btn sm secondary"
                      onClick={() => document.getElementById(`ann-edit-files-${a.id}`)?.click()}
                    >
                      <UiIcon name="image" size={15} />
                      Thêm ảnh hoặc tệp
                    </button>
                    {renderAudienceSelect({
                      idPrefix: `edit-${a.id}`,
                      type: editAudienceType,
                      value: editAudienceValue,
                      onTypeChange: (t) => { setEditAudienceType(t); setEditAudienceValue(''); },
                      onValueChange: setEditAudienceValue,
                    })}
                    <div className="toolbar-spacer" />
                    <button type="button" className="btn sm secondary" onClick={() => setEditingId(null)}>Huỷ</button>
                    <button type="button" className="btn sm" onClick={() => handleSaveEdit(a.id)}>Lưu thay đổi</button>
                  </div>
                </div>
              ) : (
                <div className="post-body">
                  {a.title && <h3 className="post-title">{a.title}</h3>}
                  <div className="post-content">{a.content}</div>

                  {a.attachments.some((att) => att.isImage) && (
                    <div className="post-images">
                      {a.attachments.filter((att) => att.isImage).map((att) => (
                        <a key={att.filename} href={getFullUrl(att.url)} target="_blank" rel="noopener noreferrer">
                          <img src={getFullUrl(att.url)} alt={att.originalName} />
                        </a>
                      ))}
                    </div>
                  )}
                  {a.attachments.some((att) => !att.isImage) && (
                    <div className="post-files">
                      {a.attachments.filter((att) => !att.isImage).map((att) => (
                        <a key={att.filename} className="post-file" href={getFullUrl(att.url)} target="_blank" rel="noopener noreferrer">
                          <UiIcon name="file" size={16} />
                          <span>{att.originalName}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bình luận */}
              <div className="post-comments">
                <div className="post-comments-count">
                  <UiIcon name="message" size={15} />
                  {a.commentCount} bình luận
                </div>

                {a.comments.length > 0 && (
                  <ul className="comment-list">
                    {a.comments.map((c) => (
                      <li key={c.id} className="comment">
                        <span className="avatar is-sm" aria-hidden="true">{c.authorName?.trim().charAt(0).toUpperCase() || '?'}</span>
                        <div className="comment-bubble">
                          <div className="comment-head">
                            <strong>{c.authorName}</strong>
                            {c.authorRole === 'teacher' && <span className="role-badge">Giáo viên</span>}
                            <span className="comment-time">{timeAgo(c.createdAt)}{c.updatedAt ? ' (đã sửa)' : ''}</span>
                          </div>

                          {editingCommentId === c.id ? (
                            <div className="comment-edit">
                              <input
                                type="text"
                                value={editCommentText}
                                onChange={(e) => setEditCommentText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditComment(c.id); }}
                                aria-label="Sửa bình luận"
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => handleSaveEditComment(c.id)}
                                disabled={savingCommentId === c.id || !editCommentText.trim()}
                              >
                                Lưu
                              </button>
                              <button type="button" className="btn sm secondary" onClick={() => setEditingCommentId(null)}>Huỷ</button>
                            </div>
                          ) : (
                            <div className="comment-content">{c.content}</div>
                          )}

                          {editingCommentId !== c.id && (c.authorId === user?.id || isTeacher) && (
                            <div className="comment-actions">
                              {c.authorId === user?.id && (
                                <button type="button" className="text-btn is-muted" onClick={() => startEditComment(c)}>Sửa</button>
                              )}
                              <button type="button" className="text-btn is-muted" onClick={() => handleDeleteComment(c.id)}>Xoá</button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="comment-form">
                  <span className="avatar is-sm" aria-hidden="true">{user?.name?.trim().charAt(0).toUpperCase() || '?'}</span>
                  <input
                    type="text"
                    placeholder="Viết bình luận…"
                    aria-label="Viết bình luận"
                    value={commentDrafts[a.id] || ''}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(a.id); }}
                  />
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => handleAddComment(a.id)}
                    disabled={postingCommentId === a.id || !(commentDrafts[a.id] || '').trim()}
                  >
                    Gửi
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
