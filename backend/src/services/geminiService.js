// Service gọi Google Gemini API để sinh roadmap ôn tập và bài tập trắc nghiệm
// tương tự dựa trên các câu hỏi học sinh làm sai thực tế.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

function cleanMathContent(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    // 1. Loại bỏ toàn bộ thẻ SVG, MathML, Style, Script
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<math[\s\S]*?<\/math>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    // 2. Lấy alt từ img nếu có, xóa img
    .replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, ' $1 ')
    .replace(/<img[^>]*>/gi, ' ')
    // 3. Xóa các thẻ HTML còn lại
    .replace(/<[^>]+>/g, ' ')
    // 4. Xóa các dòng/chuỗi tọa độ SVG path MathType rơi rớt ra ngoài
    .replace(/[MmLlHhVvCcSsQqTtAaZz]\s*-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?|\s+-?\d+(?:\.\d+)?)+[a-zA-Z0-9\s,\.\-]*z?/g, ' ')
    .replace(/(?:[cslmhz]-?\d+(?:\.\d+)?(?:,-?\d+(?:\.\d+)?)+[a-z]?)+/gi, ' ')
    .replace(/H\d+v\d+[^\s]*/gi, ' ')
    .replace(/M\d+\s+\d+[^\s]*\/>/gi, ' ')
    .replace(/[\w\d,\.-]*\/>/g, ' ')
    .replace(/["']?\s*\/>/g, ' ')
    .replace(/["'»«]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(studentName, weakTags = [], wrongQuestions = []) {
  const tagList = weakTags
    .map((t) => `- "${t.tag}" (tỷ lệ sai: ${Math.round(t.wrongRate * 100)}%, sai ${t.totalWrong}/${t.totalAnswered} câu)`)
    .join('\n');

  let wrongQuestionsSection = '';
  if (wrongQuestions && wrongQuestions.length > 0) {
    const list = wrongQuestions
      .map((q, idx) => {
        const cleanContent = cleanMathContent(q.content);
        const optionsText = (q.options || [])
          .map((opt) => `    ${opt.key}. ${cleanMathContent(opt.text)}`)
          .join('\n');
        return `[Câu sai ${idx + 1}] (Chuyên đề: ${(q.tags || []).join(', ') || 'Toán 12'})
- Đề bài gốc: ${cleanContent}
- 4 đáp án gốc:
${optionsText}
- Đáp án đúng: ${q.correctAnswer || 'A'} | Học sinh đã chọn sai: ${q.selectedOption || 'Chưa chọn'}`;
      })
      .join('\n\n');

    wrongQuestionsSection = `\nDANH SÁCH CÁC CÂU HỎI CỤ THỂ HỌC SINH VỪA LÀM SAI TRONG ĐỀ THI:
${list}\n`;
  }

  const exerciseCountPerQuestion = 3;
  const totalExercises = wrongQuestions.length > 0
    ? wrongQuestions.length * exerciseCountPerQuestion
    : Math.max(weakTags.length * 3, 3);

  return `Bạn là một giáo viên Toán lớp 12 chuyên luyện thi THPT Quốc gia tại Việt Nam. Bạn đang phân tích bài làm của học sinh "${studentName}" để:
1. Viết một Lộ trình ôn tập tự học chi tiết, chuẩn mực, công thức Toán học chuẩn LaTeX 100%.
2. Phân loại và sinh ra BỘ BÀI TẬP TRẮC NGHIỆM TƯƠNG TỰ THEO TỪNG CHUYÊN ĐỀ (mỗi câu học sinh làm sai hoặc mỗi chủ đề yếu sinh đúng ${exerciseCountPerQuestion} câu tương tự cùng dạng) với ĐỀ BÀI ĐẦY ĐỦ CÔNG THỨC / PHƯƠNG TRÌNH TOÁN, TUYỆT ĐỐI KHÔNG CỤT ĐỀ.

CHUYÊN ĐỀ YẾU CỦA HỌC SINH:
${tagList}
${wrongQuestionsSection}
HÃY TRẢ VỀ DUY NHẤT MỘT OBJECT JSON THEO ĐÚNG CẤU TRÚC SAU (KHÔNG KÈM BẤT KỲ VĂN BẢN NÀO NGOÀI JSON):

{
  "summary": "Đoạn văn 4-6 câu: Động viên em ${studentName}, nêu rõ từng dạng toán em đang bị hổng và định hướng cách ôn tập từ cơ bản đến nâng cao.",
  "steps": [
    {
      "order": 1,
      "tag": "Phương trình lượng giác",
      "theory": "1. Công thức nghiệm cơ bản:\\n- $\\\\sin x = \\\\sin \\\\alpha \\\\Leftrightarrow x = \\\\alpha + k2\\\\pi$ hoặc $x = \\\\pi - \\\\alpha + k2\\\\pi$ ($k \\\\in \\\\mathbb{Z}$).\\n- $\\\\cos x = \\\\cos \\\\alpha \\\\Leftrightarrow x = \\\\pm \\\\alpha + k2\\\\pi$ ($k \\\\in \\\\mathbb{Z}$).\\n- $\\\\tan x = \\\\tan \\\\alpha \\\\Leftrightarrow x = \\\\alpha + k\\\\pi$ ($k \\\\in \\\\mathbb{Z}$).",
      "commonMistake": "- Lỗi 1: Quên đuôi chu kỳ $+k2\\\\pi$ của sin, cos hoặc nhầm với $+k\\\\pi$ của tan.\\n- Lỗi 2: Thiếu trường hợp nghiệm $x = \\\\pi - \\\\alpha + k2\\\\pi$ của hàm số sin.",
      "action": "Bước 1: Chuyển vế đưa về dạng chuẩn $\\\\sin x = m$, $\\\\cos x = m$.\\nBước 2: Sử dụng bảng giá trị lượng giác hoặc bấm máy tính SHIFT SIN, SHIFT COS để tìm góc $\\\\alpha$.\\nBước 3: Viết đầy đủ 2 họ nghiệm kèm đuôi $k2\\\\pi$ ($k \\\\in \\\\mathbb{Z}$)."
    }
  ],
  "exercises": [
    {
      "content": "Các nghiệm của phương trình $2\\\\sin x - 1 = 0$ là:",
      "options": [
        { "key": "A", "text": "$x = \\\\frac{\\\\pi}{6} + k2\\\\pi$ và $x = \\\\frac{5\\\\pi}{6} + k2\\\\pi$ ($k \\\\in \\\\mathbb{Z}$)" },
        { "key": "B", "text": "$x = \\\\frac{\\\\pi}{3} + k2\\\\pi$ và $x = \\\\frac{2\\\\pi}{3} + k2\\\\pi$ ($k \\\\in \\\\mathbb{Z}$)" },
        { "key": "C", "text": "$x = \\\\frac{\\\\pi}{6} + k\\\\pi$ và $x = -\\\\frac{\\\\pi}{6} + k\\\\pi$ ($k \\\\in \\\\mathbb{Z}$)" },
        { "key": "D", "text": "$x = \\\\frac{\\\\pi}{3} + k\\\\pi$ và $x = -\\\\frac{\\\\pi}{3} + k\\\\pi$ ($k \\\\in \\\\mathbb{Z}$)" }
      ],
      "correctAnswer": "A",
      "tags": ["Phương trình lượng giác"]
    }
  ]
}

QUY TẮC SỐNG CÒN BẮT BUỘC:
1. PHÂN LOẠI BÀI TẬP THEO CHỦ ĐỀ:
   - Trong mỗi phần tử 'exercises', trường 'tags' BẮT BUỘC chứa đúng tên chuyên đề tương ứng (ví dụ: ['Phương trình lượng giác'], ['Phương trình mũ và lôgarit'], ['Cấp số cộng và cấp số nhân'], ['Khảo sát hàm số']).
   - Tên chuyên đề trong 'tags' phải khớp với tên chuyên đề trong 'steps' để hệ thống nhóm bài tập theo từng chuyên đề.
2. TUYỆT ĐỐI KHÔNG THAM CHIẾU HÌNH ẢNH / HÌNH VẼ KHÔNG TỒN TẠI:
   - NGHIÊM CẤM các câu hỏi chứa cụm từ: "như hình vẽ", "cho đồ thị như hình", "bảng biến thiên như hình", "như hình bên", "đồ thị dưới đây".
   - Tất cả câu hỏi phải là bài toán giải tích/đại số CÓ CÔNG THỨC RÕ RÀNG tự giải được (Ví dụ: "Cho hàm số $y = x^3 - 3x^2 + 2$. Điểm cực đại của đồ thị hàm số là:", "Tìm tiệm cận đứng của đồ thị hàm số $y = \\\\frac{2x-1}{x+1}$ là:").
3. ĐỀ BÀI CÂU HỎI VÀ ĐÁP ÁN PHẢI CHUẨN XÁC VÀ ĐẦY ĐỦ CÔNG THỨC TOÁN:
   - Trong mỗi phần tử 'exercises', trường 'content' BẮT BUỘC PHẢI CHỨA PHƯƠNG TRÌNH / BIỂU THỨC / HÀM SỐ CỤ THỂ bọc trong $...$.
   - Ví dụ đúng: 'Tổng các nghiệm của phương trình $9^x - 4 \\\\cdot 3^x + 3 = 0$ là:'
   - TUYỆT ĐỐI KHÔNG chứa mã vẽ vector, SVG path, toạ độ rác (như c0,-2... H40000...).
4. TẤT CẢ CÔNG THỨC VÀ BIẾN SỐ PHẢI BỌC TRONG $...$:
   - BẮT BUỘC: $2\\\\sin x - 1 = 0$, $x = \\\\frac{\\\\pi}{6} + k2\\\\pi$, $u_n = 2^n$, $y = \\\\frac{2x-1}{x+1}$, $a > 0, a \\\\neq 1$.
   - TUYỆT ĐỐI KHÔNG dùng dấu backtick (\`...\`) để bọc công thức.
5. SỐ LƯỢNG: Sinh ĐÚNG ${totalExercises} câu hỏi trắc nghiệm tương tự, phân bố đều theo từng chuyên đề yếu.`;
}

const FALLBACK_MODELS = Array.from(new Set([
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
].filter(Boolean)));

function safeJsonParse(rawText) {
  if (!rawText) return null;
  let cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Thử parse chuẩn trước
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Nếu AI trả về backslash đơn cho các lệnh LaTeX (\log, \Delta, \frac, \neq...),
    // ta tìm và escape tất cả các dấu \ không thuộc tập escape hợp lệ của JSON (\", \\, \/, \b, \f, \n, \r, \t, \uXXXX)
    try {
      const fixed = cleaned.replace(/\\(?:[^"\\/bfnrtu]|u(?![\da-fA-F]{4}))/g, (match) => {
        return '\\\\' + match.slice(1);
      });
      return JSON.parse(fixed);
    } catch (e2) {
      try {
        // Quét bên trong các chuỗi đóng mở ngoặc kép để sửa escape
        const fixed2 = cleaned.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
          const inner = match.slice(1, -1);
          const fixedInner = inner.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
          return '"' + fixedInner + '"';
        });
        return JSON.parse(fixed2);
      } catch (e3) {
        try {
          return Function('"use strict";return (' + cleaned + ')')();
        } catch (e4) {
          throw err;
        }
      }
    }
  }
}

// Tự động kiểm tra và chuẩn hóa các biểu thức toán học
function normalizeMathText(text) {
  if (!text || typeof text !== 'string') return text;

  let res = text
    .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '')
    .replace(/^[\s]*\*\*[\s]*$/gm, '')
    .replace(/^[\s]*\*[\s]*$/gm, '');

  // 1. Chuyển đổi backtick markdown `...` sang $...$
  res = res.replace(/`([^`\n\r]+?)`/g, (match, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return match;
    if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed;
    return `$${trimmed}$`;
  });

  // 2. Chuyển đổi \left\{ \begin{aligned} ... \end{aligned} \right. sang \begin{cases} ... \end{cases}
  res = res.replace(/\\left\\{\s*\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}\s*\\right\.?/g, (match, inner) => {
    const cleanedInner = inner.replace(/&/g, '').trim();
    return `\\begin{cases} ${cleanedInner} \\end{cases}`;
  });

  // 3. Khắc phục phân tách điều kiện và lỗi unicode
  res = res
    .replace(/\$\s*0\s*<\s*\$?\s*a\s*\\neq\s*1\s*\$?/gi, '$0 < a \\neq 1$')
    .replace(/\$\s*0\s*<\s*\$?\s*a\s*≠\s*1\s*\$?/gi, '$0 < a \\neq 1$')
    .replace(/(?:\(\s*với|với)\s*\$?\s*0\s*<\s*a\s*\\neq\s*1\s*\$?\s*\)?/gi, '(với $0 < a \\neq 1$)')
    .replace(/(?:\(\s*với|với)\s*\$?\s*a\s*>\s*0\s*[,;\s]+a\s*\\neq\s*1\s*\$?\s*\)?/gi, '(với $a > 0, a \\neq 1$)')
    .replace(/a\s*∄\s*1/gi, '$a \\neq 1$')
    .replace(/([a-zA-Z0-9])\s*neq\s*([0-9a-zA-Z])/g, '$1 \\neq $2')
    .replace(/(?:^|\s)neq\s*([0-9a-zA-Z])/g, ' $\\neq $1$ ')
    .replace(/(?:^|\s)Leftrightarrow(?:\s|$)/g, ' $\\Leftrightarrow$ ')
    .replace(/(?:^|\s)Rightarrow(?:\s|$)/g, ' $\\Rightarrow$ ')
    .replace(/[\r\n]+\s*\)\s*\.?/g, '). ')
    .replace(/[\r\n]+\s*\)\s*/g, ') ')
    .replace(/(\.\s*)-\s*\$/g, '$1\n- $');

  return res;
}

function normalizeAIOutput(data) {
  if (!data || typeof data !== 'object') return data;

  if (typeof data.summary === 'string') {
    data.summary = normalizeMathText(data.summary);
  }

  if (Array.isArray(data.steps)) {
    data.steps = data.steps.map((step) => {
      if (typeof step === 'string') return normalizeMathText(step);
      return {
        ...step,
        tag: normalizeMathText(step.tag || step.title),
        theory: normalizeMathText(step.theory),
        commonMistake: normalizeMathText(step.commonMistake),
        action: normalizeMathText(step.action),
      };
    });
  }

  if (Array.isArray(data.exercises)) {
    data.exercises = data.exercises.map((ex) => ({
      ...ex,
      content: normalizeMathText(ex.content),
      options: (ex.options || []).map((opt) => ({
        ...opt,
        text: normalizeMathText(opt.text),
      })),
      tags: (ex.tags || []).map(normalizeMathText),
    }));
  }

  return data;
}

// Gọi Gemini API với cơ chế tự động thử model dự phòng nếu model chính bị quá tải (503/429)
async function generateRoadmapAndExercises(studentName, weakTags = [], wrongQuestions = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Chưa cấu hình GEMINI_API_KEY trong backend/.env. Xem hướng dẫn lấy key tại docs/GEMINI_SETUP.md'
    );
  }

  const prompt = buildPrompt(studentName, weakTags, wrongQuestions);
  let lastError = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`[Gemini] Model ${modelName} tạm thời phản hồi (${response.status}), tự động chuyển sang model dự phòng tiếp theo...`);
        lastError = new Error(`Gemini API (${modelName}) lỗi ${response.status}: ${errorBody}`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = new Error(`Gemini API (${modelName}) không trả về nội dung text`);
        continue;
      }

      const parsed = safeJsonParse(rawText);

      if (!parsed || !Array.isArray(parsed.steps) || !Array.isArray(parsed.exercises)) {
        lastError = new Error('Cấu trúc JSON từ Gemini thiếu "steps" hoặc "exercises"');
        continue;
      }

      return normalizeAIOutput(parsed);
    } catch (err) {
      console.warn(`[Gemini] Lỗi gọi model ${modelName}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini API.');
}

// Trò chuyện trực tiếp với Gemini AI về Toán học
async function chatWithGemini(messages = [], userContext = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong backend/.env');
  }

  const roleName = userContext.role === 'teacher' ? 'Thầy/Cô giáo' : 'Học sinh';
  const userName = userContext.name || 'Người dùng';

  const systemInstruction = `Bạn là Trợ lý AI Gemini - Chuyên gia Toán học THPT Quốc gia (Toán 12) tại Việt Nam.
Bạn đang trò chuyện và hỗ trợ trực tiếp cho ${roleName} "${userName}".
Nhiệm vụ của bạn:
1. Giải đáp chi tiết, từng bước các bài toán Giải tích, Đại số, Hình học không gian, Mũ & Lôgarit, Tích phân, Số phức, Xác suất thống kê lớp 12.
2. Giải thích phương pháp giải, chứng minh công thức, lưu ý các bẫy trắc nghiệm hay gặp và chia sẻ mẹo bấm máy tính Casio (fx-580VNX, fx-880BTG).
3. Soạn câu hỏi trắc nghiệm, bài tập tự luyện tương tự theo yêu cầu.
4. Trả lời thân thiện, sư phạm, rõ ràng, gãy gọn.

QUY TẮC CÔNG THỨC VÀ BỐ CỤC BẮT BUỘC:
- Mọi công thức, ký hiệu toán học, biến số, phương trình PHẢI bọc trong cặp dấu $...$ (nếu trong dòng) hoặc $$...$$ (nếu hiển thị khối trung tâm).
- Dùng cú pháp LaTeX chuẩn: $\\frac{a}{b}$, $\\sqrt{x}$, $\\int_a^b f(x)dx$, $\\log_a b$, $x = \\alpha + k2\\pi$, $\\begin{cases} f(x) = g(x) \\\\ f(x) > 0 \\end{cases}$, $a > 0, a \\neq 1$.
- TUYỆT ĐỐI KHÔNG dùng backtick (\`...\`) cho công thức toán.
- TRÌNH BÀY GỌN GÀNG, ĐẸP MẮT: KHÔNG dùng các đường kẻ rác (---, ___), KHÔNG lạm dụng các dấu thăng (####, ###), KHÔNG để các ký tự markdown thừa (như ** đứng một mình). Dùng gạch đầu dòng rõ ràng (- hoặc •) và số thứ tự (1., 2., Bước 1:, Bước 2:).`;

  // Chuyển đổi lịch sử chat sang định dạng Gemini
  const contents = [];
  
  // Tin nhắn hệ thống ban đầu đưa vào lượt đầu tiên
  let isFirst = true;
  for (const m of messages) {
    const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
    let text = m.content || '';
    if (isFirst && role === 'user') {
      text = `[CHỈ DẪN HỆ THỐNG]: ${systemInstruction}\n\n[CÂU HỎI TỪ ${roleName.toUpperCase()} ${userName.toUpperCase()}]: ${text}`;
      isFirst = false;
    }
    contents.push({
      role,
      parts: [{ text }],
    });
  }

  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: systemInstruction + '\n\nXin chào Trợ lý AI!' }],
    });
  }

  let lastError = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`[Gemini Chat] Model ${modelName} phản hồi (${response.status}), chuyển sang model dự phòng...`);
        lastError = new Error(`Gemini API (${modelName}) lỗi ${response.status}: ${errorBody}`);
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      const data = await response.json();
      const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawReply) {
        lastError = new Error(`Model ${modelName} không trả về nội dung`);
        continue;
      }

      return normalizeMathText(rawReply);
    } catch (err) {
      console.warn(`[Gemini Chat] Lỗi gọi model ${modelName}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini API.');
}

module.exports = {
  generateRoadmapAndExercises,
  chatWithGemini,
};
