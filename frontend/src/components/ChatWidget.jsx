import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

function getFullUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  return `${BACKEND_BASE}${url}`;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Cảm xúc',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤩', '🤔', '🥺', '😭', '😡', '😴', '🤐', '🤗'],
  },
  {
    name: 'Cử chỉ & Trái tim',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '👊', '👌', '🤙', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💖', '💯', '🔥', '✨', '⭐', '🌟'],
  },
  {
    name: 'Học tập & Toán học',
    emojis: ['📝', '📚', '📖', '💡', '📐', '📏', '✏️', '✒️', '🎓', '🎯', '🚀', '🏆', '🥇', '⏳', '⏰', '🔍', '📊', '📈', '📌', '🔑', '✅', '❌', '❓', '❗', '💪'],
  },
];

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins}p trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days}d trước`;
}

function formatMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileMeta(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (['doc', 'docx'].includes(ext)) {
    return { icon: '📄', label: 'WORD', color: 'var(--primary)', bg: 'var(--primary-light)', border: 'var(--primary-border)' };
  }
  if (['pdf'].includes(ext)) {
    return { icon: '📕', label: 'PDF', color: '#dc2626', bg: 'var(--danger-bg)', border: 'var(--danger-border)' };
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return { icon: '📊', label: 'EXCEL', color: '#16a34a', bg: 'var(--success-bg)', border: 'var(--success-border)' };
  }
  if (['ppt', 'pptx'].includes(ext)) {
    return { icon: '📑', label: 'POWERPOINT', color: '#ea580c', bg: 'var(--warning-bg)', border: 'var(--warning-border)' };
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return { icon: '🗂️', label: 'NÉN', color: '#7c3aed', bg: 'var(--purple-bg)', border: 'var(--purple-border)' };
  }
  if (['txt'].includes(ext)) {
    return { icon: '📝', label: 'VĂN BẢN', color: 'var(--ink-2)', bg: 'var(--surface-2)', border: 'var(--line)' };
  }
  return { icon: '📁', label: (ext || 'TẬP TIN').toUpperCase(), color: 'var(--ink-2)', bg: 'var(--surface-2)', border: 'var(--line)' };
}

export default function ChatWidget() {
  const { user } = useAuth();

  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [activePartner, setActivePartner] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedRawFile, setSelectedRawFile] = useState(null); // File object
  const [filePreview, setFilePreview] = useState(null); // { isImage, previewUrl, name, size }
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'online'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [previewZoomImage, setPreviewZoomImage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Trên điện thoại khung chat mở toàn màn hình: khoá cuộn trang phía sau
  // (CSS chỉ áp dụng lớp này ở màn hình hẹp, xem .chat-dock trong index.css).
  const chatOpen = isPanelExpanded || Boolean(activePartner);
  useEffect(() => {
    document.body.classList.toggle('chat-open', chatOpen);
    return () => document.body.classList.remove('chat-open');
  }, [chatOpen]);

  // 1. Heartbeat: Đánh dấu người dùng đang online định kỳ mỗi 15 giây
  useEffect(() => {
    if (!user) return;

    function sendHeartbeat() {
      api.post('/chat/heartbeat').catch(() => {});
    }

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);

    function onFocus() {
      if (!document.hidden) sendHeartbeat();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('click', sendHeartbeat);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('click', sendHeartbeat);
    };
  }, [user]);

  // 2. Fetch danh sách liên hệ & trạng thái online mỗi 2.5s
  async function loadContacts() {
    if (!user) return;
    try {
      const { data } = await api.get('/chat/contacts');
      setContacts(data || []);

      if (activePartner) {
        const updated = (data || []).find((c) => c.id === activePartner.id);
        if (updated) {
          setActivePartner((prev) => ({
            ...prev,
            isOnline: updated.isOnline,
            lastActiveAt: updated.lastActiveAt,
          }));
        }
      }
    } catch {
      // Bỏ qua lỗi
    }
  }

  useEffect(() => {
    if (!user) return;
    loadContacts();

    const interval = setInterval(loadContacts, 2500);
    return () => clearInterval(interval);
  }, [user, activePartner?.id]);

  // 3. Load hội thoại khi mở chat với một người
  async function loadConversation(partnerId) {
    if (!partnerId) return;
    try {
      const { data } = await api.get(`/chat/messages/${partnerId}`);
      if (data) {
        setConversation(data.messages || []);
        if (data.partner) {
          setActivePartner((prev) => ({
            ...prev,
            ...data.partner,
          }));
        }
      }
    } catch {
      // Bỏ qua lỗi
    }
  }

  // Polling hội thoại đang mở mỗi 2 giây
  useEffect(() => {
    if (!activePartner?.id) return;
    loadConversation(activePartner.id);

    const interval = setInterval(() => {
      loadConversation(activePartner.id);
    }, 2000);

    return () => clearInterval(interval);
  }, [activePartner?.id]);

  // Tự động cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (activePartner) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation, activePartner]);

  // Focus ô nhập khi mở cuộc trò chuyện
  useEffect(() => {
    if (activePartner) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activePartner]);

  // Đóng emoji picker khi click ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // Chọn liên hệ để nhắn tin
  function handleSelectContact(contact) {
    setActivePartner(contact);
    loadConversation(contact.id);
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, unreadCount: 0 } : c))
    );
  }

  // Xử lý chọn tệp đính kèm (Hình ảnh, Word, PDF, Excel, v.v.)
  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('Dung lượng tệp tối đa là 50MB.');
      return;
    }

    const isImage = file.type.startsWith('image/');
    setSelectedRawFile(file);
    setFilePreview({
      isImage,
      previewUrl: isImage ? URL.createObjectURL(file) : null,
      name: file.name,
      size: file.size,
    });

    setTimeout(() => inputRef.current?.focus(), 50);
    e.target.value = '';
  }

  function handleCancelFile() {
    if (filePreview?.previewUrl) {
      URL.revokeObjectURL(filePreview.previewUrl);
    }
    setSelectedRawFile(null);
    setFilePreview(null);
  }

  // Chèn emoji vào ô nhập tin nhắn
  function handleInsertEmoji(emoji) {
    setInputText((prev) => prev + emoji);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Gửi tin nhắn (Văn bản + File upload qua Multipart FormData)
  async function handleSendMessage(e) {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedRawFile) || !activePartner?.id || sending) return;

    const textToSend = inputText.trim();
    const rawFile = selectedRawFile;
    const currentPreview = filePreview;

    setInputText('');
    setSelectedRawFile(null);
    setFilePreview(null);
    setShowEmojiPicker(false);
    setSending(true);

    let uploadedImage = null;
    let uploadedAttachment = null;

    try {
      // 1. Upload file lên server nếu có (siêu nhanh vì lưu trực tiếp vào đĩa)
      if (rawFile) {
        const formData = new FormData();
        formData.append('file', rawFile);

        const { data: uploadRes } = await api.post('/chat/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (uploadRes.isImage) {
          uploadedImage = uploadRes.url;
        } else {
          uploadedAttachment = {
            name: uploadRes.name,
            size: uploadRes.size,
            type: uploadRes.type,
            url: uploadRes.url,
          };
        }
      }

      // 2. Gửi bản ghi tin nhắn kèm link URL (dung lượng payload < 1KB)
      await api.post('/chat/messages', {
        receiverId: activePartner.id,
        text: textToSend,
        image: uploadedImage,
        attachment: uploadedAttachment,
      });

      loadConversation(activePartner.id);
      loadContacts();
    } catch {
      alert('Không thể gửi tin nhắn/tệp đính kèm. Vui lòng thử lại.');
      setInputText(textToSend);
      setSelectedRawFile(rawFile);
      setFilePreview(currentPreview);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Xóa toàn bộ lịch sử tin nhắn
  async function handleClearAllMessages() {
    if (!activePartner?.id) return;
    const confirmDelete = window.confirm(
      `Bạn có chắc chắn muốn XÓA TOÀN BỘ lịch sử tin nhắn với ${activePartner.name} không?\nHành động này không thể hoàn tác.`
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/chat/messages/${activePartner.id}`);
      setConversation([]);
      loadContacts();
    } catch {
      alert('Không thể xóa lịch sử tin nhắn. Vui lòng thử lại.');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  if (!user) return null;

  const totalUnread = contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const onlineCount = contacts.filter((c) => c.isOnline).length;

  const filteredContacts = contacts.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.className && c.className.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchSearch) return false;
    if (filterTab === 'online') return c.isOnline;
    return true;
  });

  return (
    <div
      className={`chat-dock no-print exam-hide${chatOpen ? ' is-open' : ''}${activePartner ? ' has-chat' : ''}`}
      style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 199, fontFamily: 'inherit', display: 'flex', alignItems: 'flex-end', gap: 14 }}
    >
      {/* 1. POPUP HỘI THOẠI TRÒ CHUYỆN */}
      {activePartner && (
        <div
          className="chat-window"
          style={{
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            height: 530,
            background: 'var(--surface)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out',
            position: 'relative',
          }}
        >
          {/* Header hội thoại */}
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {activePartner.name.charAt(0).toUpperCase()}
                </div>
                {/* 🟢 Dấu chấm xanh lá cây trạng thái online */}
                {activePartner.isOnline ? (
                  <div
                    title="Đang hoạt động"
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: '#22c55e',
                      border: '2px solid var(--surface)',
                      boxShadow: '0 0 6px rgba(34, 197, 94, 0.9)',
                    }}
                  />
                ) : (
                  <div
                    title="Ngoại tuyến"
                    style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'var(--text-light)',
                      border: '2px solid var(--surface)',
                    }}
                  />
                )}
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activePartner.name}
                  {activePartner.className && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-soft)', marginLeft: 5 }}>
                      ({activePartner.className})
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: activePartner.isOnline ? '#16a34a' : 'var(--text-light)',
                    fontWeight: activePartner.isOnline ? 700 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {activePartner.isOnline ? (
                    <>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#22c55e',
                          boxShadow: '0 0 4px #22c55e',
                        }}
                      />
                      Đang hoạt động
                    </>
                  ) : (
                    `Hoạt động ${timeAgo(activePartner.lastActiveAt) || 'gần đây'}`
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons (Xóa tất cả + Đóng) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={handleClearAllMessages}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 15,
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: '5px 7px',
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                }}
                title="Xóa tất cả tin nhắn"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'var(--danger-bg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-light)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                🗑️
              </button>

              <button
                type="button"
                onClick={() => setActivePartner(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 17,
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  borderRadius: 4,
                }}
                title="Đóng chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Danh sách tin nhắn */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              background: 'var(--surface-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {conversation.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-light)', padding: 16 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>👋</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>
                  Bắt đầu trò chuyện với {activePartner.name}
                </div>
                <div style={{ fontSize: 11.5, marginTop: 4 }}>
                  Gửi tin nhắn, hình ảnh hoặc đính kèm file Word (.docx), PDF, Excel để trao đổi bài học.
                </div>
              </div>
            ) : (
              conversation.map((msg, idx) => {
                const isMe = msg.senderId === user.id;
                const prevMsg = conversation[idx - 1];
                const showTimeGap =
                  !prevMsg ||
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

                const fileMeta = msg.attachment ? getFileMeta(msg.attachment.name) : null;
                const fullImageUrl = msg.image ? getFullUrl(msg.image) : null;
                const fullFileUrl = msg.attachment?.url ? getFullUrl(msg.attachment.url) : null;

                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {showTimeGap && (
                      <div
                        style={{
                          textAlign: 'center',
                          fontSize: 10,
                          color: 'var(--text-light)',
                          margin: '6px 0 4px',
                          fontWeight: 500,
                        }}
                      >
                        {formatMsgTime(msg.createdAt)}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        gap: 6,
                      }}
                    >
                      {!isMe && (
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10.5,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {activePartner.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div
                        style={{
                          maxWidth: '82%',
                          padding: msg.image && !msg.text ? '4px' : '8px 12px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isMe ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))' : 'var(--surface)',
                          color: isMe ? '#ffffff' : 'var(--ink)',
                          fontSize: 13,
                          lineHeight: 1.45,
                          wordBreak: 'break-word',
                          boxShadow: isMe
                            ? '0 2px 6px rgba(41, 82, 217,0.25)'
                            : '0 1px 3px rgba(0,0,0,0.06)',
                          border: isMe ? 'none' : '1px solid var(--line)',
                        }}
                      >
                        {/* 1. Hiển thị hình ảnh đính kèm nếu có */}
                        {fullImageUrl && (
                          <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                            <img
                              src={fullImageUrl}
                              alt="Đính kèm"
                              onClick={() => setPreviewZoomImage(fullImageUrl)}
                              style={{
                                maxWidth: '100%',
                                maxHeight: 200,
                                borderRadius: 12,
                                display: 'block',
                                cursor: 'zoom-in',
                                objectFit: 'cover',
                              }}
                            />
                          </div>
                        )}

                        {/* 2. Hiển thị thẻ tệp đính kèm (Word, PDF, Excel, ...) */}
                        {msg.attachment && fullFileUrl && (
                          <div style={{ marginBottom: msg.text ? 6 : 0 }}>
                            <a
                              href={fullFileUrl}
                              download={msg.attachment.name}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                background: isMe ? 'rgba(255, 255, 255, 0.18)' : fileMeta.bg,
                                border: isMe ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${fileMeta.border}`,
                                borderRadius: 12,
                                textDecoration: 'none',
                                color: isMe ? '#ffffff' : 'var(--ink)',
                                transition: 'all 0.15s ease',
                              }}
                              title="Bấm để tải tệp về máy"
                            >
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 8,
                                  background: isMe ? 'var(--surface)' : fileMeta.color,
                                  color: isMe ? 'var(--primary)' : '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 18,
                                  flexShrink: 0,
                                  fontWeight: 800,
                                }}
                              >
                                {fileMeta.icon}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: 12.5,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    color: isMe ? '#ffffff' : 'var(--ink)',
                                  }}
                                >
                                  {msg.attachment.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10.5,
                                    color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--ink-soft)',
                                    marginTop: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                  }}
                                >
                                  <span>{formatFileSize(msg.attachment.size)}</span>
                                  <span>•</span>
                                  <span style={{ fontWeight: 600 }}>Tải xuống 📥</span>
                                </div>
                              </div>
                            </a>
                          </div>
                        )}

                        {/* 3. Nội dung văn bản */}
                        {msg.text && <div>{msg.text}</div>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preview File đang chọn gửi */}
          {filePreview && (
            <div
              style={{
                padding: '6px 12px',
                background: 'var(--bg-subtle)',
                borderTop: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              {filePreview.isImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img
                    src={filePreview.previewUrl}
                    alt="Chuẩn bị gửi"
                    style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--line-strong)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>Ảnh đính kèm sẵn sàng gửi</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 20 }}>{getFileMeta(filePreview.name).icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {filePreview.name}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>
                      {formatFileSize(filePreview.size)} • {getFileMeta(filePreview.name).label}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleCancelFile}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '3px 8px',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                Hủy
              </button>
            </div>
          )}

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              style={{
                position: 'absolute',
                bottom: 56,
                left: 10,
                right: 10,
                height: 220,
                background: 'var(--surface)',
                borderRadius: 14,
                boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
                border: '1px solid var(--line)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 10,
                animation: 'fadeIn 0.15s ease-out',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>Bộ biểu tượng cảm xúc</span>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(false)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: 14 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.name} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4 }}>
                      {cat.name}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
                      {cat.emojis.map((emoji, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleInsertEmoji(emoji)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: 18,
                            cursor: 'pointer',
                            padding: '4px 0',
                            borderRadius: 6,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Bar với Upload Tệp (Word, PDF, Excel, Ảnh...) + Emoji Picker + Gửi */}
          <form
            onSubmit={handleSendMessage}
            style={{
              padding: '8px 10px',
              background: 'var(--surface)',
              borderTop: '1px solid var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* Nút Upload Tệp (Word, PDF, Excel, Ảnh, ZIP...) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc,.pdf,.xlsx,.xls,.pptx,.ppt,.txt,.zip,.rar,image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Gửi tệp đính kèm (Word .docx, PDF, Excel, Ảnh...)"
              disabled={sending}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--bg-subtle)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                color: 'var(--ink-2)',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--line)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            >
              📎
            </button>

            {/* Nút Emoji */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((p) => !p)}
              title="Chèn biểu tượng cảm xúc"
              disabled={sending}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: showEmojiPicker ? 'var(--primary-light)' : 'var(--bg-subtle)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
                transition: 'background 0.15s ease',
              }}
            >
              😊
            </button>

            {/* Input văn bản */}
            <input
              ref={inputRef}
              type="text"
              placeholder={sending ? 'Đang gửi...' : 'Nhập tin nhắn...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 18,
                border: '1px solid var(--line)',
                fontSize: 13,
                outline: 'none',
                background: sending ? 'var(--bg-subtle)' : 'var(--surface-2)',
                minWidth: 0,
              }}
            />

            {/* Nút Gửi */}
            <button
              type="submit"
              disabled={(!inputText.trim() && !selectedRawFile) || sending}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: inputText.trim() || selectedRawFile ? 'var(--primary)' : 'var(--line)',
                color: inputText.trim() || selectedRawFile ? '#ffffff' : 'var(--text-light)',
                border: 'none',
                cursor: inputText.trim() || selectedRawFile ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {sending ? '⏳' : '➔'}
            </button>
          </form>
        </div>
      )}

      {/* 2. CỘT DANH SÁCH HỌC SINH & TRẠNG THÁI ONLINE BÊN PHẢI MÀN HÌNH */}
      {isPanelExpanded ? (
        <div
          className="chat-panel"
          style={{
            width: 290,
            maxWidth: 'calc(100vw - 40px)',
            height: 530,
            maxHeight: 'calc(100vh - 80px)',
            background: 'var(--surface)',
            borderRadius: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)',
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Header Panel */}
          <div
            style={{
              padding: '12px 14px 10px',
              background: 'var(--surface)',
              borderBottom: '1px solid var(--bg-subtle)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16 }}>💬</span>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                  {user.role === 'teacher' ? 'Học sinh' : 'Giáo viên'}
                </h4>
                {totalUnread > 0 && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 10,
                      boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    {totalUnread > 99 ? '99+' : totalUnread} tin mới
                  </span>
                )}
                {onlineCount > 0 && (
                  <span
                    style={{
                      background: 'var(--success-bg)',
                      color: '#059669',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 10,
                      border: '1px solid var(--success-border)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 5px #10b981',
                      }}
                    />
                    {onlineCount} online
                  </span>
                )}
              </div>

              {/* Nút thu nhỏ panel */}
              <button
                type="button"
                onClick={() => setIsPanelExpanded(false)}
                title="Thu gọn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 16,
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                ▼
              </button>
            </div>

            {/* Ô tìm kiếm */}
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <input
                type="text"
                placeholder="Tìm tên, lớp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 26px',
                  borderRadius: 12,
                  border: '1px solid var(--line)',
                  fontSize: 12,
                  background: 'var(--surface-2)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 11,
                  color: 'var(--text-light)',
                }}
              >
                🔍
              </span>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => setFilterTab('all')}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterTab === 'all' ? 'var(--primary-light)' : 'var(--bg-subtle)',
                  color: filterTab === 'all' ? 'var(--primary)' : 'var(--ink-soft)',
                }}
              >
                Tất cả ({contacts.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab('online')}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: filterTab === 'online' ? 'var(--success-bg)' : 'var(--bg-subtle)',
                  color: filterTab === 'online' ? '#059669' : 'var(--ink-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: filterTab === 'online' ? '#10b981' : 'var(--text-light)',
                  }}
                />
                Online ({onlineCount})
              </button>
            </div>
          </div>

          {/* Danh sách học sinh */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2px 0' }}>
            {filteredContacts.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>👥</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
                  {filterTab === 'online' ? 'Chưa có học sinh nào online' : 'Không tìm thấy'}
                </div>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => handleSelectContact(contact)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    background:
                      activePartner?.id === contact.id
                        ? 'var(--primary-light)'
                        : contact.unreadCount > 0
                        ? 'var(--danger-bg)'
                        : 'var(--surface)',
                    borderLeft: contact.unreadCount > 0 ? '3px solid #ef4444' : '3px solid transparent',
                    borderBottom: '1px solid var(--surface-2)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (activePartner?.id !== contact.id) e.currentTarget.style.background = 'var(--surface-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (activePartner?.id !== contact.id)
                      e.currentTarget.style.background = contact.unreadCount > 0 ? 'var(--danger-bg)' : 'var(--surface)';
                  }}
                >
                  {/* Avatar + 🟢 Dấu chấm xanh lá cây */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: contact.unreadCount > 0
                          ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                          : 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {contact.name.charAt(0).toUpperCase()}
                    </div>

                    {/* 🟢 Dấu chấm tròn xanh lá cây phát sáng khi hoạt động */}
                    {contact.isOnline ? (
                      <div
                        title="Đang hoạt động"
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 11,
                          height: 11,
                          borderRadius: '50%',
                          background: '#22c55e',
                          border: '2px solid var(--surface)',
                          boxShadow: '0 0 6px rgba(34, 197, 94, 0.9)',
                        }}
                      />
                    ) : (
                      <div
                        title="Ngoại tuyến"
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: 'var(--line-strong)',
                          border: '1.5px solid var(--surface)',
                        }}
                      />
                    )}
                  </div>

                  {/* Tên & Trạng thái & Huy hiệu số tin nhắn chưa đọc màu đỏ */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        style={{
                          fontWeight: contact.unreadCount > 0 ? 800 : 700,
                          fontSize: 13,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {contact.name}
                      </div>

                      {/* 🔴 Huy hiệu số lượng tin nhắn chưa đọc màu đỏ */}
                      {contact.unreadCount > 0 && (
                        <div
                          title={`${contact.unreadCount} tin nhắn chưa đọc`}
                          style={{
                            minWidth: 18,
                            height: 18,
                            borderRadius: 9,
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: 11,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 5px',
                            flexShrink: 0,
                            marginLeft: 4,
                            boxShadow: '0 2px 5px rgba(239, 68, 68, 0.45)',
                          }}
                        >
                          {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      {contact.className && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)' }}>
                          Lớp {contact.className} •
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10.5,
                          color: contact.unreadCount > 0 ? '#ef4444' : contact.isOnline ? '#16a34a' : 'var(--text-light)',
                          fontWeight: contact.unreadCount > 0 ? 700 : contact.isOnline ? 700 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {contact.unreadCount > 0
                          ? `🔴 ${contact.unreadCount} tin nhắn mới`
                          : contact.isOnline
                          ? '🟢 Đang online'
                          : timeAgo(contact.lastActiveAt) || 'Ngoại tuyến'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Floating Button khi thu gọn */
        <button
          type="button"
          className="chat-launcher"
          aria-label={user.role === 'teacher' ? 'Mở tin nhắn với học sinh' : 'Mở tin nhắn'}
          onClick={() => setIsPanelExpanded(true)}
          style={{
            height: 48,
            padding: '0 16px',
            borderRadius: 24,
            background: 'var(--contrast-bg)',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 8px 24px rgba(27, 35, 64, 0.35)',
            fontWeight: 700,
            fontSize: 13.5,
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>💬</span>
            {onlineCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: '#22c55e',
                  border: '2px solid var(--primary)',
                  boxShadow: '0 0 6px #22c55e',
                }}
              />
            )}
          </div>
          <span className="chat-launcher-label">{user.role === 'teacher' ? 'Học sinh' : 'Tin nhắn'}</span>
          {onlineCount > 0 && (
            <span
              className="chat-launcher-online"
              style={{
                background: 'rgba(255,255,255,0.25)',
                padding: '2px 7px',
                borderRadius: 10,
                fontSize: 11.5,
              }}
            >
              🟢 {onlineCount}
            </span>
          )}
          {totalUnread > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 10,
              }}
            >
              {totalUnread}
            </span>
          )}
        </button>
      )}

      {/* 3. MODAL PHÓNG TO XEM ẢNH FULL SIZE */}
      {previewZoomImage && (
        <div
          onClick={() => setPreviewZoomImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img
              src={previewZoomImage}
              alt="Xem ảnh lớn"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
            />
            <button
              type="button"
              onClick={() => setPreviewZoomImage(null)}
              style={{
                position: 'absolute',
                top: -12,
                right: -12,
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--surface)',
                color: 'var(--ink)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 800,
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
