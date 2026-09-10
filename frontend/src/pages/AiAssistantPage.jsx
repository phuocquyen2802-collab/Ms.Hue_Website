import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { renderMath } from '../utils/mathRender';

const SUGGESTED_PROMPTS = [
  {
    category: '📐 Hình học không gian',
    prompts: [
      'Cách xác định góc giữa đường thẳng và mặt phẳng trong không gian?',
      'Công thức tính khoảng cách từ một điểm đến mặt phẳng và bài tập mẫu?',
      'Phương pháp tọa độ hóa Oxyz để giải bài toán khối đa diện.',
    ],
  },
  {
    category: '📈 Khảo sát hàm số & Đồ thị',
    prompts: [
      'Cách tìm nhanh tiệm cận đứng và tiệm cận ngang của hàm phân thức bậc 1 / bậc 1 và bậc 2 / bậc 1.',
      'Điều kiện để hàm số bậc ba $y = ax^3 + bx^2 + cx + d$ có 2 điểm cực trị cùng dấu.',
      'Tìm giá trị lớn nhất và nhỏ nhất của hàm số chứa dấu giá trị tuyệt đối.',
    ],
  },
  {
    category: '🔢 Mũ & Logarit',
    prompts: [
      'Các phương pháp giải phương trình mũ: đặt ẩn phụ, logarit hóa, hàm số.',
      'Tìm tập xác định và tập giá trị của hàm số $y = \\log_a(f(x))$.',
      'Bài toán lãi suất ngân hàng và tăng trưởng liên tục lớp 12.',
    ],
  },
  {
    category: '💡 Mẹo Casio & Đề trắc nghiệm',
    prompts: [
      'Hướng dẫn bấm máy tính Casio 580VNX tính tích phân và diện tích hình phẳng.',
      'Hãy tạo 3 câu trắc nghiệm mức độ Vận dụng về nguyên hàm - tích phân kèm lời giải chi tiết.',
      'Mẹo thử nghiệm trắc nghiệm số phức và Max-Min môđun bằng số học.',
    ],
  },
];

const MATH_SHORTCUTS = [
  { label: '$x$', insert: '$x$', title: 'Công thức inline' },
  { label: '$$\\dots$$', insert: '$$\n\\dots\n$$', title: 'Công thức khối' },
  { label: '\\frac{a}{b}', insert: '\\frac{a}{b}', title: 'Phân số' },
  { label: '\\sqrt{x}', insert: '\\sqrt{x}', title: 'Căn bậc hai' },
  { label: '\\int_{a}^{b}', insert: '\\int_{a}^{b} f(x) dx', title: 'Tích phân' },
  { label: '\\lim', insert: '\\lim_{x \\to x_0} f(x)', title: 'Giới hạn' },
  { label: '\\log_a b', insert: '\\log_{a}(b)', title: 'Logarit' },
  { label: '\\vec{u}', insert: '\\vec{u}', title: 'Vectơ' },
  { label: '\\in', insert: '\\in', title: 'Thuộc' },
  { label: '\\Delta', insert: '\\Delta', title: 'Delta' },
];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Xin chào ${user?.name ? `**${user.name}**` : ''}! 👋\n\nTôi là **Trợ lý AI Toán 12 (Google Gemini)**. Tôi có thể giúp bạn:\n- 💡 **Giải chi tiết từng bước** các bài toán THPT Quốc gia (Đại số, Hình học Oxyz, Giải tích).\n- 📚 **Tóm tắt và củng cố lý thuyết trọng tâm** theo chương trình SGK mới.\n- ⚙️ **Hướng dẫn mẹo bấm máy tính Casio 580VNX / 880BTG**.\n- 📝 **Tạo đề thi và câu hỏi phân hóa** theo từng mức độ (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao).\n\nHãy nhập câu hỏi hoặc chọn các chủ đề gợi ý bên dưới để bắt đầu nhé! ✨`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

  const handleInsertShortcut = (formula) => {
    setInputText((prev) => prev + formula);
    textareaRef.current?.focus();
  };

  const handleClearChat = () => {
    if (window.confirm('Bạn có chắc chắn muốn làm mới toàn bộ cuộc trò chuyện?')) {
      setMessages([
        {
          role: 'assistant',
          content: `Đoạn chat đã được đặt lại. Tôi sẵn sàng hỗ trợ bài toán mới của bạn! 🚀`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
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
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
            }}
          >
            🤖
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 22, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              Trợ lý AI Gemini Toán 12
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
            onClick={handleClearChat}
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
          flexDirection: 'column',
          minHeight: 0,
          padding: 0,
          borderRadius: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
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
                      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
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
                      background: isUser ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : '#ffffff',
                      color: isUser ? '#ffffff' : '#1e293b',
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      boxShadow: isUser
                        ? '0 4px 12px rgba(37, 99, 235, 0.25)'
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

          {/* Suggested Prompts (Khi chưa chat nhiều) */}
          {messages.length <= 1 && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>💡</span> Gợi ý chủ đề thường gặp:
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 10,
                }}
              >
                {SUGGESTED_PROMPTS.map((group, gIdx) => (
                  <div
                    key={gIdx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 12,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                      {group.category}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {group.prompts.map((promptText, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSend(promptText)}
                          style={{
                            textAlign: 'left',
                            background: '#f8fafc',
                            border: '1px solid #edf2f7',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#eef2ff';
                            e.currentTarget.style.color = '#4338ca';
                            e.currentTarget.style.borderColor = '#c7d2fe';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.color = '#475569';
                            e.currentTarget.style.borderColor = '#edf2f7';
                          }}
                        >
                          {promptText}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Math Formula Shortcuts Bar */}
        <div
          style={{
            padding: '6px 16px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Chèn nhanh:</span>
          {MATH_SHORTCUTS.map((sc, i) => (
            <button
              key={i}
              onClick={() => handleInsertShortcut(sc.insert)}
              title={sc.title}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'KaTeX_Math, monospace, serif',
                whiteSpace: 'nowrap',
                color: '#334155',
              }}
            >
              {sc.label}
            </button>
          ))}
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
              placeholder="Nhập câu hỏi Toán 12 (VD: Cho hàm số y = x^3 - 3x + 1, tìm cực trị...) hoặc dán công thức LaTeX..."
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
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Nhấn <b>Enter</b> để gửi, <b>Shift + Enter</b> để xuống dòng</span>
              <span>Hỗ trợ định dạng LaTeX: <code>$công thức$</code></span>
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
  );
}
