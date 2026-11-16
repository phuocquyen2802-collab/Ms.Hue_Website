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
        const diagramLine = q.diagram
          ? `\n- Hình minh hoạ gốc (dữ liệu CHÍNH XÁC, dùng làm mẫu để vẽ hình tương tự): ${JSON.stringify(q.diagram)}`
          : '';
        return `[Câu sai ${idx + 1}] (Chuyên đề: ${(q.tags || []).join(', ') || 'Toán 12'})
- Đề bài gốc: ${cleanContent}
- 4 đáp án gốc:
${optionsText}
- Đáp án đúng: ${q.correctAnswer || 'A'} | Học sinh đã chọn sai: ${q.selectedOption || 'Chưa chọn'}${diagramLine}`;
      })
      .join('\n\n');

    wrongQuestionsSection = `\nDANH SÁCH CÁC CÂU HỎI CỤ THỂ HỌC SINH VỪA LÀM SAI TRONG ĐỀ THI:
${list}\n`;
  }

  const exerciseCountPerQuestion = 2;
  const totalExercises = wrongQuestions.length > 0
    ? wrongQuestions.length * exerciseCountPerQuestion
    : Math.max(weakTags.length * 3, 3);

  const wantQuestionAnalyses = wrongQuestions && wrongQuestions.length > 0;

  return `Bạn là một giáo viên Toán lớp 12 chuyên luyện thi THPT Quốc gia tại Việt Nam. Bạn đang phân tích bài làm của học sinh "${studentName}" để:
1. Viết một Lộ trình ôn tập tự học chi tiết, chuẩn mực, công thức Toán học chuẩn LaTeX 100%.
2. ${wantQuestionAnalyses ? 'Phân tích RIÊNG TỪNG CÂU học sinh đã làm sai (xem "questionAnalyses" trong cấu trúc JSON bên dưới): chỉ ra LỖ HỔNG KIẾN THỨC cụ thể đứng sau lỗi sai đó (thiếu/nhầm kiến thức nền nào khiến học sinh chọn sai đáp án đã chọn) và CÁCH KHẮC PHỤC lỗ hổng đó (nên ôn lại phần lý thuyết/dạng bài nào, luyện tập theo hướng nào) - KHÔNG giải lại chi tiết từng bước của câu hỏi (lời giải chi tiết đầy đủ đã có sẵn trong file đáp án riêng giáo viên phát cho học sinh).' : ''}
3. Phân loại và sinh ra BỘ BÀI TẬP TRẮC NGHIỆM TƯƠNG TỰ THEO TỪNG CHUYÊN ĐỀ (mỗi câu học sinh làm sai hoặc mỗi chủ đề yếu sinh đúng ${exerciseCountPerQuestion} câu tương tự cùng dạng) với ĐỀ BÀI ĐẦY ĐỦ CÔNG THỨC / PHƯƠNG TRÌNH TOÁN, TUYỆT ĐỐI KHÔNG CỤT ĐỀ.

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
${wantQuestionAnalyses ? `  "questionAnalyses": [
    {
      "questionIndex": 1,
      "mistakeAnalysis": "Học sinh chưa nắm chắc công thức nghiệm ĐẦY ĐỦ của phương trình lượng giác cơ bản dạng $\\\\sin x = \\\\sin\\\\alpha$ - chỉ nhớ 1 họ nghiệm $x = \\\\frac{\\\\pi}{3} + k2\\\\pi$ mà quên mất còn 1 họ nghiệm nữa là $x = \\\\pi - \\\\frac{\\\\pi}{3} + k2\\\\pi$, đây là lỗ hổng rất phổ biến khi mới học phương trình lượng giác cơ bản.",
      "correctSolution": "Ôn lại bảng công thức nghiệm của cả 3 loại phương trình lượng giác cơ bản (sin, cos, tan) - đặc biệt chú ý: sin và cos luôn cho 2 họ nghiệm, chỉ riêng tan mới cho 1 họ nghiệm. Nên luyện thêm 3-5 bài dạng phương trình lượng giác cơ bản để ghi nhớ chắc quy tắc này."
    }
  ],
` : ''}  "exercises": [
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
    },
    {
      "content": "Cho hàm số $y = x^3 - 3x + 2$ có đồ thị như hình vẽ. Hàm số nghịch biến trên khoảng nào dưới đây?",
      "diagram": { "type": "function-graph", "expression": "x^3 - 3*x + 2", "domain": [-3, 3] },
      "options": [
        { "key": "A", "text": "$(-1; 1)$" },
        { "key": "B", "text": "$(-\\\\infty; -1)$" },
        { "key": "C", "text": "$(1; +\\\\infty)$" },
        { "key": "D", "text": "$(-1; 0)$" }
      ],
      "correctAnswer": "A",
      "tags": ["Khảo sát hàm số"]
    },
    {
      "content": "Cho hàm số $y = f(x)$ có bảng biến thiên như hình vẽ. Hàm số đạt cực đại tại điểm nào?",
      "diagram": { "type": "variation-table", "points": ["-\\\\infty", "0", "2", "+\\\\infty"], "signs": ["+", "-", "+"], "values": ["-\\\\infty", "4", "0", "+\\\\infty"] },
      "options": [
        { "key": "A", "text": "$x = 0$" },
        { "key": "B", "text": "$x = 2$" },
        { "key": "C", "text": "$x = 4$" },
        { "key": "D", "text": "$x = -\\\\infty$" }
      ],
      "correctAnswer": "A",
      "tags": ["Khảo sát hàm số"]
    },
    {
      "content": "Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông, $SA \\\\perp (ABCD)$. Gọi $O$ là giao điểm của $AC$ và $BD$. Khẳng định nào sau đây đúng?",
      "diagram": { "type": "solid-geometry", "shape": "pyramid4", "baseLabels": ["A", "B", "C", "D"], "apexLabel": "S", "extraPoints": [{ "name": "O", "type": "intersection", "points": ["A", "C", "B", "D"] }] },
      "options": [
        { "key": "A", "text": "$BD \\\\perp (SAC)$" },
        { "key": "B", "text": "$BD \\\\perp (SAB)$" },
        { "key": "C", "text": "$BD \\\\perp SC$" },
        { "key": "D", "text": "$BD \\\\perp SA$" }
      ],
      "correctAnswer": "A",
      "tags": ["Hình học không gian"]
    }
  ]
}

QUY TẮC SỐNG CÒN BẮT BUỘC:
1. PHÂN LOẠI BÀI TẬP THEO CHỦ ĐỀ:
   - Trong mỗi phần tử 'exercises', trường 'tags' BẮT BUỘC chứa đúng tên chuyên đề tương ứng (ví dụ: ['Phương trình lượng giác'], ['Phương trình mũ và lôgarit'], ['Cấp số cộng và cấp số nhân'], ['Khảo sát hàm số']).
   - Tên chuyên đề trong 'tags' phải khớp với tên chuyên đề trong 'steps' để hệ thống nhóm bài tập theo từng chuyên đề.
2. HÌNH ẢNH/HÌNH VẼ - CHỈ ĐƯỢC DÙNG 5 LOẠI HÌNH CÓ CẤU TRÚC SAU (do hệ thống tự vẽ lại chính xác từ dữ liệu bạn cung cấp, KHÔNG phải bạn tự vẽ ảnh):
   a) ĐỒ THỊ HÀM SỐ - thêm trường 'diagram' dạng:
      "diagram": { "type": "function-graph", "expression": "<biểu thức theo x, cú pháp: + - * / ^, ngoặc, sin cos tan sqrt abs ln log exp, hằng số pi>", "domain": [xMin, xMax] }
      - 'expression' PHẢI khớp CHÍNH XÁC với hàm số $y = ...$ đã nêu trong 'content' (không được vẽ hàm khác).
      - CHỈ dùng cho hàm số vẽ được trong mặt phẳng 2D bằng 1 biểu thức theo x (đa thức, phân thức, lượng giác cơ bản) - KHÔNG dùng cho hàm có tham số ẩn (m, a, b...) hoặc hàm cần vẽ nhiều nhánh phức tạp.
   b) BẢNG BIẾN THIÊN - thêm trường 'diagram' dạng:
      "diagram": { "type": "variation-table", "points": ["-\\\\infty", "x1", "x2", ..., "+\\\\infty"], "signs": ["+", "-", ...], "values": ["-\\\\infty", "y1", "y2", ..., "+\\\\infty"] }
      - 'points' và 'values' PHẢI có ĐÚNG cùng độ dài; 'signs' PHẢI có độ dài ÍT HƠN 'points' đúng 1 (số dấu = số khoảng giữa các mốc).
      - Các mốc 'points' PHẢI xếp theo thứ tự tăng dần, thường bắt đầu bằng "-\\\\infty" và kết thúc bằng "+\\\\infty".
   c) HÌNH HỌC KHÔNG GIAN CƠ BẢN (hình chóp/lăng trụ) - thêm trường 'diagram' dạng:
      "diagram": { "type": "solid-geometry", "shape": "pyramid3"|"pyramid4"|"prism3"|"prism4", "baseLabels": ["A","B","C"] hoặc ["A","B","C","D"], "apexLabel": "S" (bắt buộc với pyramid3/pyramid4, bỏ qua với prism), "topLabels": ["A'","B'",...] (tuỳ chọn, chỉ dùng cho prism3/prism4, mặc định tự thêm dấu ' nếu bỏ trống), "extraPoints": [{ "name": "M", "type": "midpoint", "points": ["A","D"] }, { "name": "O", "type": "intersection", "points": ["A","C","B","D"] }] (tuỳ chọn, dùng khi đề có nhắc trung điểm/giao điểm 2 đường chéo đáy) }
      - 'shape' = "pyramid3"/"pyramid4": hình chóp đáy tam giác/tứ giác (đỉnh 'apexLabel'). 'shape' = "prism3"/"prism4": hình lăng trụ đứng đáy tam giác/tứ giác (kể cả hình hộp chữ nhật/hình lập phương, dùng "prism4").
      - 'baseLabels' PHẢI khớp ĐÚNG tên các đỉnh đáy đã nêu trong 'content' (ví dụ content nói "$S.ABCD$" thì baseLabels = ["A","B","C","D"], apexLabel = "S").
      - CHỈ dùng cho hình chóp/lăng trụ ĐƠN GIẢN có thể mô tả bằng đúng các trường trên - KHÔNG dùng cho hình phức tạp hơn (đa diện lồng nhau, khối đa diện ghép nhiều khối).
   d) HỆ TRỤC TOẠ ĐỘ OXYZ - thêm trường 'diagram' dạng:
      "diagram": { "type": "oxyz", "points": [{ "name": "A", "coords": [1, 2, 3] }, ...], "vectors": [{ "from": "O", "to": "A" }, ...] (tuỳ chọn), "plane": ["A", "B", "C"] (tuỳ chọn, tô mờ mặt phẳng qua 3-4 điểm đã khai báo) }
      - 'coords' PHẢI khớp CHÍNH XÁC toạ độ đã nêu trong 'content' (ví dụ content ghi "$A(1;2;3)$" thì coords = [1,2,3]).
      - CHỈ dùng khi đề cho SẴN toạ độ cụ thể của điểm/vectơ (không dùng khi đề chỉ nói chung chung về mặt phẳng/đường thẳng bằng phương trình tổng quát mà không có điểm/vectơ cụ thể để vẽ).
   e) KHỐI TRÒN XOAY CƠ BẢN (nón/trụ/cầu) - thêm trường 'diagram' dạng:
      "diagram": { "type": "round-solid", "shape": "cone"|"cylinder"|"sphere", "radiusLabel": "r" (tuỳ chọn, mặc định "r"), "heightLabel": "h" (tuỳ chọn, mặc định "h", bỏ qua với sphere), "apexLabel": "S" (tuỳ chọn, chỉ cone), "centerLabel": "O" (tuỳ chọn) }
      - Hình vẽ MANG TÍNH MINH HOẠ (không theo tỉ lệ số liệu đề bài) - 'radiusLabel'/'heightLabel' PHẢI khớp đúng ký hiệu chữ (r, h...) hoặc số cụ thể đã dùng trong 'content'.
      - CHỈ dùng cho nón/trụ/cầu ĐƠN GIẢN (không dùng cho khối tròn xoay phức tạp, ghép nhiều khối, hoặc mặt cầu ngoại tiếp/nội tiếp đa diện - trường hợp đó vẫn dùng shape "solid-geometry" ở mục (c) cho khối đa diện, không vẽ thêm mặt cầu).
   - CHỈ thêm trường 'diagram' khi câu hỏi THẬT SỰ cần và đúng 1 trong 5 dạng trên - các chủ đề khác không vẽ được bằng các dạng này (lượng giác, mũ-logarit, cấp số...) thì KHÔNG có trường 'diagram', chỉ mô tả bằng lời/công thức như bình thường.
   - QUAN TRỌNG: nếu câu hỏi gốc học sinh làm sai (trong DANH SÁCH CÂU HỎI CỤ THỂ bên dưới, nếu có) có kèm dòng "Hình minh hoạ gốc (dữ liệu CHÍNH XÁC...)", đây LÀ dữ liệu 'diagram' THẬT của chính câu hỏi đó - PHẢI dùng đúng 'type' của nó (và giữ đúng cấu trúc a/b/c/d/e tương ứng) cho các bài tập tương tự sinh ra từ câu này, chỉ được đổi các con số/nhãn cụ thể (VD: đổi hệ số hàm số, đổi tên đỉnh, đổi mốc bảng biến thiên) sao cho khớp với đề bài MỚI - TUYỆT ĐỐI KHÔNG tự đổi sang loại hình khác. Nếu câu gốc KHÔNG có dòng "Hình minh hoạ gốc" này (không có hình) thì cũng KHÔNG tự thêm hình cho bài tập tương tự. Nếu câu hỏi gốc không nằm trong DANH SÁCH CÂU HỎI CỤ THỂ (trường hợp chỉ có CHUYÊN ĐỀ YẾU, không có câu cụ thể), mới XÁC ĐỊNH LOẠI HÌNH dựa vào nội dung văn bản như mô tả (ví dụ "Cho hình chóp $S.ABCD$..." nghĩa là có hình chóp tứ giác) - KHÔNG bỏ qua hình chỉ vì chủ đề không phải Khảo sát hàm số.
   - NGHIÊM CẤM mọi hình thức khác: KHÔNG được viết "như hình vẽ" mà không có trường 'diagram' đi kèm đúng cấu trúc trên, KHÔNG được mô tả hình học không gian/hình vẽ tự do bằng lời rồi bảo học sinh tự hình dung, KHÔNG được chèn mã vẽ vector/SVG path/toạ độ rác vào 'content'.
3. ĐỀ BÀI CÂU HỎI VÀ ĐÁP ÁN PHẢI CHUẨN XÁC VÀ ĐẦY ĐỦ CÔNG THỨC TOÁN:
   - Trong mỗi phần tử 'exercises', trường 'content' BẮT BUỘC PHẢI CHỨA PHƯƠNG TRÌNH / BIỂU THỨC / HÀM SỐ CỤ THỂ bọc trong $...$.
   - Ví dụ đúng: 'Tổng các nghiệm của phương trình $9^x - 4 \\\\cdot 3^x + 3 = 0$ là:'
   - TUYỆT ĐỐI KHÔNG chứa mã vẽ vector, SVG path, toạ độ rác (như c0,-2... H40000...).
4. TẤT CẢ CÔNG THỨC VÀ BIẾN SỐ PHẢI BỌC TRONG $...$:
   - BẮT BUỘC: $2\\\\sin x - 1 = 0$, $x = \\\\frac{\\\\pi}{6} + k2\\\\pi$, $u_n = 2^n$, $y = \\\\frac{2x-1}{x+1}$, $a > 0, a \\\\neq 1$.
   - TUYỆT ĐỐI KHÔNG dùng dấu backtick (\`...\`) để bọc công thức.
5. SỐ LƯỢNG: Sinh ĐÚNG ${totalExercises} câu hỏi trắc nghiệm tương tự, phân bố đều theo từng chuyên đề yếu.${wantQuestionAnalyses ? `
6. PHÂN TÍCH TỪNG CÂU SAI ("questionAnalyses") LÀ BẮT BUỘC:
   - PHẢI có ĐÚNG ${wrongQuestions.length} phần tử trong 'questionAnalyses', mỗi phần tử ứng với ĐÚNG 1 câu trong "DANH SÁCH CÁC CÂU HỎI CỤ THỂ" theo thứ tự [Câu sai 1], [Câu sai 2], ... - trường 'questionIndex' = số thứ tự đó (1, 2, 3...).
   - 'mistakeAnalysis' (LỖ HỔNG KIẾN THỨC): chỉ ra CỤ THỂ đây là lỗ hổng kiến thức nào (thiếu công thức gì, nhầm quy tắc/điều kiện gì, hiểu sai khái niệm gì) khiến học sinh chọn nhầm đáp án đã chọn - KHÔNG viết chung chung kiểu "học sinh chưa nắm vững kiến thức", và KHÔNG giải lại chi tiết bài toán.
   - 'correctSolution' (CÁCH KHẮC PHỤC): đưa ra HƯỚNG KHẮC PHỤC lỗ hổng đó cho học sinh - nên ôn lại phần lý thuyết/công thức/dạng bài nào, cần luyện tập thêm theo hướng nào để không lặp lại lỗi này - TUYỆT ĐỐI KHÔNG trình bày lời giải chi tiết từng "Bước 1, Bước 2..." của CHÍNH câu hỏi đó vì lời giải chi tiết đầy đủ đã có sẵn trong file đáp án riêng giáo viên phát cho học sinh, viết lại ở đây là thừa và trùng lặp.` : ''}`;
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

  // QUAN TRỌNG - sửa TRƯỚC khi parse (không phải chỉ khi parse báo lỗi):
  // \b \f \r \t đều là escape HỢP LỆ của JSON, nên nếu Gemini lỡ dùng 1 dấu
  // \ cho lệnh LaTeX bắt đầu đúng các chữ này (\right, \rho, \tan, \tau,
  // \to, \frac, \forall, \beta, \begin...), JSON.parse sẽ ÂM THẦM "nuốt"
  // nó thành ký tự điều khiển (KHÔNG báo lỗi) - ví dụ "\right)" bị hiểu
  // thành ký tự CR + "ight)", mất chữ "r" - nên toàn bộ cơ chế sửa lỗi ở
  // các bước try/catch bên dưới KHÔNG BAO GIỜ được chạy tới (vì JSON.parse
  // "thành công" ngay từ đầu, chỉ là sai nội dung). Escape JSON thật luôn
  // đứng 1 mình (theo sau là dấu " hoặc \), còn lệnh LaTeX luôn có thêm chữ
  // cái ngay sau - dùng đặc điểm này để phân biệt, escape kép (\\) an toàn
  // cho trường hợp có chữ cái theo sau. KHÔNG đụng \n (dùng cho xuống dòng
  // thật trong nội dung) và \u (escape Unicode).
  cleaned = cleaned.replace(/(?<!\\)\\([bfrt])(?=[a-zA-Z])/g, '\\\\$1');

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

  // 2. Chuyển đổi \left\{ \begin{aligned} ... \end{aligned} \right. (và biến
  // thể dùng ngoặc vuông \left[ ... \right. để biểu diễn "hoặc" giữa các họ
  // nghiệm - cách viết phổ biến trong SGK Việt Nam) sang \begin{cases} ...
  // \end{cases} - KaTeX không tự hỗ trợ ngoặc vuông bọc \aligned nên nếu
  // không đổi, công thức vỡ hoàn toàn không hiển thị được.
  res = res.replace(/\\left(?:\\\{|\[)\s*\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}\s*\\right(?:\.|\])?/g, (_match, inner) => {
    const cleanedInner = inner.replace(/&/g, '').trim();
    return `\\begin{cases} ${cleanedInner} \\end{cases}`;
  });

  // 3. Khắc phục phân tách điều kiện và lỗi unicode
  // QUAN TRỌNG: đôi khi Gemini không dùng lệnh LaTeX \neq mà lại chèn thẳng
  // 1 ký tự unicode "trông giống" dấu khác (≠, ⊟ boxminus, ≢, ∄...) do lỗi
  // sinh token - các ký tự này gần như KHÔNG BAO GIỜ có nghĩa hợp lệ nào
  // khác trong ngữ cảnh Toán 12, nên thay thế THẲNG về \neq trước, áp dụng
  // rộng (không chỉ riêng khuôn mẫu "a > 0, a ≠ 1") để chặn lỗi dạng này ở
  // mọi vị trí xuất hiện.
  res = res.replace(/[≠⊟≢∄]/g, ' \\neq ');

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

  if (Array.isArray(data.questionAnalyses)) {
    data.questionAnalyses = data.questionAnalyses.map((qa) => ({
      ...qa,
      mistakeAnalysis: normalizeMathText(qa.mistakeAnalysis),
      correctSolution: normalizeMathText(qa.correctSolution),
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
            maxOutputTokens: 32768,
          },
        }),
        // Model bị treo (đo thực tế có model không phản hồi quá 90 giây) thì bỏ, thử model dự phòng.
        signal: AbortSignal.timeout(180000),
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

// ---------------------------------------------------------------------------
// Trò chuyện trực tiếp với Gemini AI về Toán học (trang Trợ lý AI)
//
// Ưu tiên tốc độ: đo thực tế (11/2026) bản Flash-Lite bắt đầu trả lời sau
// ~1 giây, còn các bản Flash phải "suy nghĩ" ~1000 token và xếp hàng nên mất
// 5-20 giây mới có chữ đầu tiên. Vì vậy trợ lý chat dùng Flash-Lite (đổi được
// qua GEMINI_CHAT_MODEL), trả lời dạng stream để chữ hiện dần, và nếu một
// model chưa trả chữ nào sau CHAT_FIRST_TOKEN_TIMEOUT_MS thì bỏ, chuyển sang
// model dự phòng. Phần sinh lộ trình/bài tập ở trên vẫn dùng GEMINI_MODEL.
// ---------------------------------------------------------------------------
const CHAT_MODELS = Array.from(new Set([
  process.env.GEMINI_CHAT_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  process.env.GEMINI_MODEL,
  'gemini-3.5-flash',
].filter(Boolean)));
const CHAT_FIRST_TOKEN_TIMEOUT_MS = 20000;
const CHAT_TOTAL_TIMEOUT_MS = 120000;
// Model trả 404 (không còn/không tồn tại) thì bỏ qua 1 giờ, khỏi mất thời gian thử lại mỗi câu hỏi.
const unavailableUntil = new Map();

// Gemini 3 trở lên: giảm mức suy nghĩ để trả lời nhanh (Flash-Lite mặc định gần như không suy nghĩ).
function chatThinkingConfig(modelName) {
  return /^gemini-([3-9]|\d{2,})/.test(modelName) ? { thinkingLevel: 'low' } : undefined;
}

function buildChatContents(messages, userContext) {
  const roleName = userContext.role === 'teacher' ? 'Thầy/Cô giáo' : 'Học sinh';
  const userName = userContext.name || 'Người dùng';

  const systemInstruction = `Bạn là trợ lý AI của "MathInsight AI - Phần mềm học toán cùng AI", chuyên gia Toán học THPT tại Việt Nam. Khi tự giới thiệu, hãy xưng là trợ lý AI của MathInsight AI.
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

  // Người dùng đang xem giao diện tiếng Anh: yêu cầu AI trả lời bằng tiếng Anh.
  const languageRule = userContext.lang === 'en'
    ? '\n\nNGÔN NGỮ: Người dùng đang dùng giao diện tiếng Anh. LUÔN trả lời hoàn toàn bằng tiếng Anh (English), kể cả khi câu hỏi viết bằng tiếng Việt; dùng thuật ngữ Toán tiếng Anh chuẩn (Step 1, Step 2, ...).'
    : '';

  // Chuyển đổi lịch sử chat sang định dạng Gemini
  const contents = [];
  
  // Tin nhắn hệ thống ban đầu đưa vào lượt đầu tiên
  let isFirst = true;
  for (const m of messages) {
    const role = m.role === 'assistant' || m.role === 'model' ? 'model' : 'user';
    let text = m.content || '';
    if (isFirst && role === 'user') {
      text = `[CHỈ DẪN HỆ THỐNG]: ${systemInstruction}${languageRule}\n\n[CÂU HỎI TỪ ${roleName.toUpperCase()} ${userName.toUpperCase()}]: ${text}`;
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
      parts: [{ text: systemInstruction + languageRule + '\n\nXin chào Trợ lý AI!' }],
    });
  }

  return contents;
}

// Gọi 1 model ở chế độ stream (SSE). onDelta nhận từng đoạn chữ ngay khi có.
// Lỗi xảy ra SAU khi đã gửi chữ cho người dùng được đánh dấu committed = true
// (không chuyển model khác nữa vì người dùng đã thấy nửa câu trả lời).
async function streamOneChatModel(modelName, contents, apiKey, onDelta, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal) {
    if (signal.aborted) abort();
    signal.addEventListener('abort', abort);
  }
  let gotText = false;
  const firstTokenTimer = setTimeout(abort, CHAT_FIRST_TOKEN_TIMEOUT_MS);
  const totalTimer = setTimeout(abort, CHAT_TOTAL_TIMEOUT_MS);

  try {
    const generationConfig = { temperature: 0.6, maxOutputTokens: 8192 };
    const thinkingConfig = chatThinkingConfig(modelName);
    if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 404) unavailableUntil.set(modelName, Date.now() + 60 * 60 * 1000);
      throw new Error(`Gemini API (${modelName}) lỗi ${response.status}: ${errorBody.slice(0, 300)}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith('data:')) continue;
        let data;
        try { data = JSON.parse(line.slice(5)); } catch { continue; }
        const text = (data.candidates?.[0]?.content?.parts || [])
          .filter((p) => !p.thought)
          .map((p) => p.text || '')
          .join('');
        if (!text) continue;
        if (!gotText) {
          gotText = true;
          clearTimeout(firstTokenTimer);
        }
        full += text;
        onDelta(text);
      }
    }

    if (!full) throw new Error(`Model ${modelName} không trả về nội dung`);
    return full;
  } catch (err) {
    const error = controller.signal.aborted && !signal?.aborted
      ? new Error(gotText ? `Gemini (${modelName}) trả lời quá lâu` : `Gemini (${modelName}) chưa phản hồi sau ${CHAT_FIRST_TOKEN_TIMEOUT_MS / 1000} giây`)
      : err;
    error.committed = gotText;
    throw error;
  } finally {
    clearTimeout(firstTokenTimer);
    clearTimeout(totalTimer);
    if (signal) signal.removeEventListener('abort', abort);
  }
}

// Trả lời dạng stream: onDelta(text) cho từng đoạn chữ, trả về toàn bộ câu
// trả lời đã chuẩn hoá công thức khi xong. signal: huỷ khi người dùng rời trang.
async function streamChatWithGemini(messages = [], userContext = {}, onDelta = () => {}, signal) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong backend/.env');
  }

  const contents = buildChatContents(messages, userContext);
  const now = Date.now();
  const models = CHAT_MODELS.filter((m) => !(unavailableUntil.get(m) > now));
  let lastError = null;

  for (const modelName of models.length ? models : CHAT_MODELS) {
    if (signal?.aborted) break;
    try {
      const full = await streamOneChatModel(modelName, contents, apiKey, onDelta, signal);
      return normalizeMathText(full);
    } catch (err) {
      if (err.committed || signal?.aborted) throw err;
      console.warn(`[Gemini Chat] ${err.message} - chuyển sang model dự phòng...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối tới Google Gemini API.');
}

// Bản không stream (giữ cho các nơi gọi cũ): chờ đủ câu trả lời rồi trả về.
async function chatWithGemini(messages = [], userContext = {}) {
  return streamChatWithGemini(messages, userContext);
}

module.exports = {
  generateRoadmapAndExercises,
  chatWithGemini,
  streamChatWithGemini,
};
