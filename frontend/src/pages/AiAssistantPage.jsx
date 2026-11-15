import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';
import BrandMark from '../components/BrandMark';
import { APP_NAME, APP_TITLE } from '../config/brand';

function greetingMessage(user) {
  return {
    role: 'assistant',
    content: `Xin chào ${user?.name ? `**${user.name}**` : ''}! 👋 Tôi là **trợ lý AI của ${APP_TITLE}**, có thể:\n- 💡 Giải chi tiết từng bước\n- 📚 Tóm tắt lý thuyết\n- ⚙️ Mẹo bấm máy tính Casio\n- 📝 Tạo đề thi/câu hỏi\n\nNhập câu hỏi bên dưới để bắt đầu nhé! ✨`,
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

// Lịch sử các đoạn chat lưu riêng theo từng người dùng (chưa có backend lưu
// chat AI, nên lưu tạm ở localStorage - giống cơ chế lưu "đã đọc thông báo"
// đang dùng trong NotificationBell.jsx).
function historyKey(userId) {
  return `ai_chat_history_${userId}`;
}

function loadHistory(userId) {
  try {
    return JSON.parse(localStorage.getItem(historyKey(userId)) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(userId, list) {
  localStorage.setItem(historyKey(userId), JSON.stringify(list));
}

// Tiêu đề đoạn chat = rút gọn câu hỏi đầu tiên của người dùng trong đoạn đó
function buildConversationTitle(messages) {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'Đoạn chat mới';
  const text = firstUserMsg.content.trim().replace(/\s+/g, ' ');
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

export default function AiAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([greetingMessage(user)]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (user?.id) setHistory(loadHistory(user.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Tự động lưu đoạn chat hiện tại vào lịch sử mỗi khi có tin nhắn mới (chỉ
  // lưu khi đã có ít nhất 1 câu hỏi thật của người dùng, không lưu đoạn chat
  // trống chỉ có mỗi lời chào ban đầu).
  useEffect(() => {
    if (!user?.id) return;
    const hasUserMessage = messages.some((m) => m.role === 'user');
    if (!hasUserMessage) return;

    const conversationId = activeConversationId || `conv-${Date.now()}`;
    if (!activeConversationId) setActiveConversationId(conversationId);

    const entry = {
      id: conversationId,
      title: buildConversationTitle(messages),
      messages,
      updatedAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const next = [entry, ...prev.filter((c) => c.id !== conversationId)];
      saveHistory(user.id, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  function handleNewChat() {
    setMessages([greetingMessage(user)]);
    setActiveConversationId(null);
    setShowHistory(false);
  }

  function handleLoadConversation(conv) {
    setMessages(conv.messages);
    setActiveConversationId(conv.id);
    setShowHistory(false);
  }

  function handleDeleteConversation(convId, e) {
    e.stopPropagation();
    if (!window.confirm('Xoá đoạn chat này khỏi lịch sử?')) return;
    setHistory((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      saveHistory(user.id, next);
      return next;
    });
    if (activeConversationId === convId) {
      handleNewChat();
    }
  }

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMessage = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      // Chuẩn bị payload gửi lên backend (chỉ lấy role và content)
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post('/ai/chat', { messages: apiMessages });

      if (res.data && res.data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: res.data.reply,
            timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      console.error('Lỗi khi chat với Gemini:', err);
      const errorMsg =
        err.response?.data?.message || 'Có lỗi xảy ra khi kết nối tới máy chủ AI. Vui lòng thử lại sau.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ **Lỗi kết nối:** ${errorMsg}`,
          isError: true,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDeleteMessage = (indexToDelete) => {
    setMessages((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  const isTeacher = user?.role === 'teacher';

  return (
    <div className="container" style={{ maxWidth: 1200, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={44} />
          <div>
            <h1 className="page-title" style={{ fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Trợ lý {APP_NAME}
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: '#e0e7ff',
                  color: '#4338ca',
                  fontWeight: 600,
                }}
              >
                Gemini 3.5 Flash
              </span>
            </h1>
            <p className="page-subtitle" style={{ margin: 0, fontSize: 13 }}>
              Hỏi đáp, giải chi tiết từng bước, tra cứu công thức và sinh bài tập tương tự
            </p>
          </div>
        </div>

        <div className="header-actions" style={{ gap: 8 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`btn ${showHistory ? '' : 'btn-outline'}`}
            style={{
              fontSize: 13,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: '#e2e8f0',
            }}
            title="Xem lịch sử các đoạn chat trước đó"
          >
            📜 Lịch sử {history.length > 0 && `(${history.length})`}
          </button>
          <button
            onClick={handleNewChat}
            className="btn btn-outline"
            style={{
              fontSize: 13,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderColor: '#e2e8f0',
            }}
            title="Bắt đầu phiên hỏi đáp mới"
          >
            🔄 Đoạn chat mới
          </button>
        </div>
      </div>

      {/* Main Chat Body Card */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          minHeight: 0,
          padding: 0,
          borderRadius: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Lịch sử đoạn chat - chỉ hiện khi bật */}
        {showHistory && (
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 12.5, fontWeight: 700, color: '#64748b' }}>
              💬 Lịch sử đoạn chat
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {history.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
                  Chưa có đoạn chat nào được lưu
                </div>
              ) : (
                history
                  .slice()
                  .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                  .map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleLoadConversation(conv)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        marginBottom: 4,
                        background: conv.id === activeConversationId ? '#e0e7ff' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 6,
                      }}
                      onMouseEnter={(e) => { if (conv.id !== activeConversationId) e.currentTarget.style.background = '#f1f5f9'; }}
                      onMouseLeave={(e) => { if (conv.id !== activeConversationId) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                          {new Date(conv.updatedAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        title="Xoá đoạn chat này"
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                      >
                        🗑️
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Vùng chat chính */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            background: '#f8fafc',
            overflow: 'hidden',
          }}
      >
        {/* Messages Stream Area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  maxWidth: isUser ? '82%' : '90%',
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: isUser
                      ? 'linear-gradient(135deg, var(--primary), var(--primary-hover))'
                      : 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  }}
                >
                  {isUser ? (user?.name ? user.name[0].toUpperCase() : 'U') : '✨'}
                </div>

                {/* Message Bubble Container */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#94a3b8',
                      marginBottom: 4,
                      paddingLeft: isUser ? 0 : 4,
                      paddingRight: isUser ? 4 : 0,
                    }}
                  >
                    {isUser ? (user?.name || 'Bạn') : 'Trợ lý Gemini'} • {msg.timestamp}
                  </div>

                  <div
                    style={{
                      padding: '12px 18px',
                      borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                      background: isUser ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' : '#ffffff',
                      color: isUser ? '#ffffff' : '#1e293b',
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      boxShadow: isUser
                        ? '0 4px 12px rgba(41, 82, 217, 0.25)'
                        : '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
                      border: isUser ? 'none' : '1px solid #e2e8f0',
                      wordBreak: 'break-word',
                    }}
                  >
                    {/* Math Rendered Content */}
                    <div
                      className="ai-chat-content"
                      dangerouslySetInnerHTML={{
                        __html: renderMath(msg.content),
                      }}
                      style={{
                        color: isUser ? '#ffffff' : 'inherit',
                      }}
                    />
                  </div>

                  {/* Actions under User message (Copy & Delete) */}
                  {isUser && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 6, paddingRight: 4 }}>
                      <button
                        onClick={() => handleCopy(msg.content, idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedIndex === idx ? '#16a34a' : '#94a3b8',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '2px 6px',
                          borderRadius: 4,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#475569')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = copiedIndex === idx ? '#16a34a' : '#94a3b8')}
                        title="Sao chép câu hỏi"
                      >
                        {copiedIndex === idx ? '✓ Đã sao chép' : '📋 Sao chép'}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '2px 6px',
                          borderRadius: 4,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#f87171')}
                        title="Xóa tin nhắn này"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  )}

                  {/* Actions under AI message (Copy & Delete) */}
                  {!isUser && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 6, paddingLeft: 4 }}>
                      <button
                        onClick={() => handleCopy(msg.content, idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedIndex === idx ? '#16a34a' : '#64748b',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '2px 6px',
                          borderRadius: 4,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#1e293b')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = copiedIndex === idx ? '#16a34a' : '#64748b')}
                        title="Sao chép nội dung câu trả lời"
                      >
                        {copiedIndex === idx ? '✓ Đã sao chép' : '📋 Sao chép'}
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          padding: '2px 6px',
                          borderRadius: 4,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#f87171')}
                        title="Xóa tin nhắn này"
                      >
                        🗑️ Xóa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                alignSelf: 'flex-start',
                maxWidth: '85%',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 14,
                  animation: 'pulse 1.5s infinite',
                }}
              >
                ✨
              </div>
              <div
                style={{
                  padding: '12px 18px',
                  borderRadius: '4px 16px 16px 16px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  color: '#6366f1',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                <span>Gemini đang suy nghĩ và tính toán bước giải...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar Area */}
        <div
          style={{
            padding: '12px 16px',
            background: '#ffffff',
            borderTop: '1px solid #edf2f7',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Vui lòng nhập câu hỏi..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid #cbd5e1',
                fontSize: 14,
                lineHeight: 1.4,
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              disabled={loading}
            />
            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                marginTop: 2,
              }}
            >
              <span>Nhấn <b>Enter</b> để gửi, <b>Shift + Enter</b> để xuống dòng</span>
            </div>
          </div>

          <button
            onClick={() => handleSend()}
            disabled={!inputText.trim() || loading}
            style={{
              height: 48,
              padding: '0 20px',
              borderRadius: 10,
              background:
                !inputText.trim() || loading
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: 14,
              cursor: !inputText.trim() || loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow:
                !inputText.trim() || loading ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span>Gửi</span>
            <span>➤</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
