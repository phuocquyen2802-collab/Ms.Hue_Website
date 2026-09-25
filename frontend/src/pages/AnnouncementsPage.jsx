import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
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

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Đăng thông báo mới (chỉ giáo viên)
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFiles, setNewFiles] = useState([]);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  // Sửa thông báo
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editRemoveAttachments, setEditRemoveAttachments] = useState([]);
  const [editNewFiles, setEditNewFiles] = useState([]);

  // Ô nhập bình luận theo từng bài (key = announcementId)
  const [commentDrafts, setCommentDrafts] = useState({});
  const [postingCommentId, setPostingCommentId] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handlePost(e) {
    e.preventDefault();
    setPostError('');
    if (!newContent.trim()) {
      setPostError('Vui lòng nhập nội dung thông báo');
      return;
    }
    setPosting(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle);
      formData.append('content', newContent);
      newFiles.forEach((f) => formData.append('files', f));
      await api.post('/announcements', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setNewTitle('');
      setNewContent('');
      setNewFiles([]);
      window.dispatchEvent(new Event('app:refresh-notifications'));
      await loadData();
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
  }

  function toggleRemoveAttachment(filename) {
    setEditRemoveAttachments((prev) =>
      prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename]
    );
  }

  async function handleSaveEdit(id) {
    if (!editContent.trim()) return;
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('content', editContent);
      editRemoveAttachments.forEach((filename) => formData.append('removeAttachments', filename));
      editNewFiles.forEach((f) => formData.append('files', f));
      await api.put(`/announcements/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setEditingId(null);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi sửa thông báo');
    }
  }

  async function handleDeleteAnnouncement(a) {
    if (!window.confirm('Xoá thông báo này? Toàn bộ bình luận bên dưới sẽ bị xoá theo.')) return;
    try {
      await api.delete(`/announcements/${a.id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xoá thông báo');
    }
  }

  async function handleAddComment(announcementId) {
    const content = (commentDrafts[announcementId] || '').trim();
    if (!content) return;
    setPostingCommentId(announcementId);
    try {
      await api.post(`/announcements/${announcementId}/comments`, { content });
      setCommentDrafts((prev) => ({ ...prev, [announcementId]: '' }));
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi gửi bình luận');
    } finally {
      setPostingCommentId(null);
    }
  }

  async function handleDeleteComment(commentId) {
    if (!window.confirm('Xoá bình luận này?')) return;
    try {
      await api.delete(`/announcements/comments/${commentId}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xoá bình luận');
    }
  }

  return (
    <div className="container" style={{ maxWidth: 760 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thông tin chung</h1>
          <p className="page-subtitle">
            {isTeacher
              ? 'Đăng thông báo cho toàn bộ học sinh, mọi người đều có thể bình luận bên dưới'
              : 'Thông báo từ giáo viên - bạn có thể bình luận bên dưới mỗi bài'}
          </p>
        </div>
      </div>

      {/* Ô đăng thông báo mới - CHỈ giáo viên */}
      {isTeacher && (
        <div className="card">
          <form onSubmit={handlePost}>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Tiêu đề (tuỳ chọn)…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ fontWeight: 700 }}
              />
            </div>
            <div className="form-group">
              <textarea
                placeholder="Bạn muốn thông báo điều gì tới học sinh?"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                style={{ resize: 'vertical', width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: 14 }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="ann-files" className="btn sm secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                🖼️ Đính kèm ảnh / tệp
              </label>
              <input
                id="ann-files"
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
              />
              {newFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {newFiles.map((f, i) => (
                    <span key={i} className="tag-badge" style={{ margin: 0 }}>
                      {f.type.startsWith('image/') ? '🖼️' : '📎'} {f.name}
                      <button
                        type="button"
                        onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, color: 'var(--danger)', fontWeight: 700 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {postError && (
              <p className="error-text" role="alert" aria-live="polite">
                <span aria-hidden="true">⚠️</span> {postError}
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" type="submit" disabled={posting}>
                {posting ? 'Đang đăng…' : '📢 Đăng thông báo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danh sách thông báo */}
      {loading ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Đang tải bảng tin…</div>
          </div>
        </div>
      ) : announcements.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📢</div>
            <div className="empty-state-title">Chưa có thông báo nào</div>
            <p className="empty-state-desc">
              {isTeacher ? 'Đăng thông báo đầu tiên cho học sinh ở ô phía trên.' : 'Khi giáo viên đăng thông báo, nó sẽ xuất hiện ở đây.'}
            </p>
          </div>
        </div>
      ) : (
        announcements.map((a) => {
          const isMine = a.authorId === user?.id;
          const isEditing = editingId === a.id;

          return (
            <div key={a.id} className="card">
              {/* Header bài đăng */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="table-avatar" style={{ width: 40, height: 40, fontSize: 15, background: 'var(--primary-light)', color: 'var(--gold-text)' }}>
                    {a.authorName?.trim().charAt(0).toUpperCase() || 'G'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-main)' }}>
                      {a.authorName} <span className="tag-badge" style={{ marginLeft: 6, fontSize: 10.5 }}>Giáo viên</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {timeAgo(a.createdAt)}{a.updatedAt ? ' (đã chỉnh sửa)' : ''}
                    </div>
                  </div>
                </div>
                {isTeacher && isMine && !isEditing && (
                  <div className="action-buttons">
                    <button type="button" className="btn sm secondary" onClick={() => startEdit(a)}>Sửa</button>
                    <button type="button" className="btn sm outline-danger" onClick={() => handleDeleteAnnouncement(a)}>Xoá</button>
                  </div>
                )}
              </div>

              {/* Nội dung bài đăng / form sửa */}
              {isEditing ? (
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Tiêu đề (tuỳ chọn)…"
                    style={{ fontWeight: 700, marginBottom: 8 }}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    style={{ resize: 'vertical', width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: 14, marginBottom: 8 }}
                  />

                  {a.attachments.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Ảnh/tệp đã đính kèm:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {a.attachments.map((att) => {
                          const marked = editRemoveAttachments.includes(att.filename);
                          return (
                            <span
                              key={att.filename}
                              className="tag-badge"
                              style={{ margin: 0, textDecoration: marked ? 'line-through' : 'none', opacity: marked ? 0.5 : 1 }}
                            >
                              {att.isImage ? '🖼️' : '📎'} {att.originalName}
                              <button
                                type="button"
                                onClick={() => toggleRemoveAttachment(att.filename)}
                                title={marked ? 'Bỏ đánh dấu xoá' : 'Đánh dấu xoá'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 4, color: 'var(--danger)', fontWeight: 700 }}
                              >
                                {marked ? '↺' : '✕'}
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <label htmlFor={`ann-edit-files-${a.id}`} className="btn sm secondary" style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: 8 }}>
                    🖼️ Thêm ảnh / tệp
                  </label>
                  <input
                    id={`ann-edit-files-${a.id}`}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => setEditNewFiles(Array.from(e.target.files || []))}
                  />
                  {editNewFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {editNewFiles.map((f, i) => (
                        <span key={i} className="tag-badge" style={{ margin: 0 }}>
                          {f.type.startsWith('image/') ? '🖼️' : '📎'} {f.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn sm secondary" onClick={() => setEditingId(null)}>Huỷ</button>
                    <button type="button" className="btn sm" onClick={() => handleSaveEdit(a.id)}>Lưu</button>
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  {a.title && <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 4, color: 'var(--text-main)' }}>{a.title}</div>}
                  <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{a.content}</div>

                  {a.attachments.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {/* Ảnh: lưới xem trực tiếp */}
                      {a.attachments.some((att) => att.isImage) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 8 }}>
                          {a.attachments.filter((att) => att.isImage).map((att) => (
                            <a key={att.filename} href={getFullUrl(att.url)} target="_blank" rel="noopener noreferrer">
                              <img
                                src={getFullUrl(att.url)}
                                alt={att.originalName}
                                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-color)' }}
                              />
                            </a>
                          ))}
                        </div>
                      )}
                      {/* Tệp khác: danh sách tải về */}
                      {a.attachments.some((att) => !att.isImage) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {a.attachments.filter((att) => !att.isImage).map((att) => (
                            <a
                              key={att.filename}
                              href={getFullUrl(att.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                            >
                              📎 {att.originalName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bình luận */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                  💬 {a.commentCount} bình luận
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {a.comments.map((c) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div className="table-avatar" style={{ width: 28, height: 28, fontSize: 11, flexShrink: 0 }}>
                        {c.authorName?.trim().charAt(0).toUpperCase() || '?'}
                      </div>
                      <div style={{ flex: 1, background: 'var(--bg-subtle)', borderRadius: 10, padding: '6px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-main)' }}>
                            {c.authorName}
                            {c.authorRole === 'teacher' && <span className="tag-badge" style={{ marginLeft: 6, fontSize: 10 }}>GV</span>}
                          </span>
                          {(c.authorId === user?.id || isTeacher) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(c.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--text-main)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{c.content}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(c.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ô nhập bình luận mới - cả giáo viên & học sinh */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Viết bình luận…"
                    value={commentDrafts[a.id] || ''}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(a.id); }}
                    style={{ flex: 1, fontSize: 13.5, padding: '7px 12px' }}
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
            </div>
          );
        })
      )}
    </div>
  );
}
