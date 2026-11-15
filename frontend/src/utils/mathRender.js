import katex from 'katex';
import 'katex/dist/katex.min.css';

const KATEX_OPTS_INLINE = {
  displayMode: false,
  throwOnError: false,
  strict: false,
};

const KATEX_OPTS_BLOCK = {
  displayMode: true,
  throwOnError: false,
  strict: false,
};

/**
 * Tự động chuyển đổi các biểu thức toán học LaTeX ($...$, $$...$$, \(...\), \[...\] và `...` có ký hiệu toán)
 * sang HTML KaTeX sắc nét, chuẩn mực.
 * Khắc phục hoàn toàn các lỗi ngắt dòng, lỗi box rỗng `a ∄ 1` và định dạng thẳng hàng tuyệt đối.
 */
export function renderMath(text) {
  if (!text || typeof text !== 'string') return '';

  const htmlTokens = [];

  // 0. Dọn chữ "undefined" rác lọt vào nội dung (lỗi dữ liệu cũ khi ghép
  // chuỗi với một trường bị thiếu/JS undefined, từ trước khi các bản vá
  // backend hiện tại có hiệu lực) - dọn NGAY TỪ ĐẦU, không chỉ khi đứng
  // riêng 1 dòng, để không làm rối các bước xử lý công thức phía sau.
  let tokenized = text.replace(/\$?\bundefined\b\$?/g, '');

  // 1. TÁCH VÀ BẢO VỆ 100% CÁC THẺ HTML/IMG/SVG CÓ SẴN NGAY ĐẦU TIÊN
  tokenized = tokenized.replace(
    /(<svg[\s\S]*?<\/svg>|<table[\s\S]*?<\/table>|<img[^>]*>|<\/?[a-zA-Z][a-zA-Z0-9\-_]*(?:\s+[^>]*)?\/?>|<!--[\s\S]*?-->)/gi,
    (match) => {
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(match);
      return placeholder;
    }
  );

  // 2. Chuyển đổi \left\{ \begin{aligned} ... \end{aligned} \right. sang \begin{cases} ... \end{cases}
  tokenized = tokenized.replace(/\\left\\{\s*\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}\s*\\right\.?/g, (match, inner) => {
    const cleanedInner = inner.replace(/&/g, '').trim();
    return `\\begin{cases} ${cleanedInner} \\end{cases}`;
  });

  // 3. Khắc phục dứt điểm điều kiện phân tách như $0 < $a \neq 1 hoặc $0 < a \neq 1$
  tokenized = tokenized
    .replace(/và\s*[\r\n\s]*\$*\s*a\s*[\r\n\s]*[∄\\≠]*\s*(?:neq)?\s*1\s*\$*[\r\n\s]*,\s*/gi, () => 'và $a \\neq 1$, ')
    .replace(/\$\s*0\s*<\s*\$?\s*a\s*\\neq\s*1\s*\$?/gi, '$0 < a \\neq 1$')
    .replace(/\$\s*0\s*<\s*\$?\s*a\s*≠\s*1\s*\$?/gi, '$0 < a \\neq 1$')
    .replace(/(?:\(\s*với|với)\s*\$?\s*0\s*<\s*a\s*\\neq\s*1\s*\$?\s*\)?/gi, '(với $0 < a \\neq 1$)')
    .replace(/(?:\(\s*với|với)\s*\$?\s*a\s*>\s*0\s*[,;\s]+a\s*\\neq\s*1\s*\$?\s*\)?/gi, '(với $a > 0, a \\neq 1$)')
    .replace(/a\s*[\r\n\s]*[∄\\]*neq\s*1/gi, () => '$a \\neq 1$')
    .replace(/a\s*[\r\n\s]*∄\s*1/gi, () => '$a \\neq 1$')
    .replace(/a\s*[\r\n\s]*≠\s*1/gi, () => '$a \\neq 1$');

  // 4. Khắc phục dấu ngoặc đơn rớt dòng \n).
  tokenized = tokenized
    .replace(/[\r\n]+\s*\)\s*\.?/g, '). ')
    .replace(/[\r\n]+\s*\)\s*/g, ') ')
    .replace(/(\.\s*)-\s*\$/g, '$1\n- $');

  // 5. Khắc phục bất kỳ block math $$...$$ nào ngắn nằm giữa câu văn -> chuyển thành inline math $...$
  tokenized = tokenized.replace(/\$\$\s*([a-zA-Z0-9_\{\}\^\+\-\*\/\\,;\s]{1,30})\s*\$\$/g, (match, formula) => {
    return `$${formula.trim()}$`;
  });

  // 6. Chuyển đổi các dấu markdown backtick `...` có chứa công thức hoặc ký hiệu toán học sang $...$
  tokenized = tokenized.replace(/`([^`\n\r]+?)`/g, (match, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return match;
    if (trimmed.startsWith('$') && trimmed.endsWith('$')) {
      return trimmed;
    }
    return `$${trimmed}$`;
  });

  // 7. Khắc phục các từ khóa LaTeX bị rơi rớt hoặc biến dạng
  tokenized = tokenized
    .replace(/([a-zA-Z0-9])\s*neq\s*([0-9a-zA-Z])/g, '$1 \\neq $2')
    .replace(/(?:^|\s)neq\s*([0-9a-zA-Z])/g, ' $\\neq $1$ ')
    .replace(/(?:^|\s)Leftrightarrow(?:\s|$)/g, ' $\\Leftrightarrow$ ')
    .replace(/(?:^|\s)Rightarrow(?:\s|$)/g, ' $\\Rightarrow$ ');

  // 8. Xử lý Block Math $$...$$ và \[...\] (Bảo vệ bằng token không bị chia dòng)
  tokenized = tokenized.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
    try {
      const rendered = `<span class="katex-block-wrapper" style="display:block;margin:10px auto;text-align:center;">${katex.renderToString(
        formula.trim(),
        KATEX_OPTS_BLOCK
      ).replace(/\r?\n/g, ' ')}</span>`;
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(rendered);
      return placeholder;
    } catch {
      return match;
    }
  });

  tokenized = tokenized.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
    try {
      const rendered = `<span class="katex-block-wrapper" style="display:block;margin:10px auto;text-align:center;">${katex.renderToString(
        formula.trim(),
        KATEX_OPTS_BLOCK
      ).replace(/\r?\n/g, ' ')}</span>`;
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(rendered);
      return placeholder;
    } catch {
      return match;
    }
  });

  // 9. Xử lý Inline Math \(...\)
  tokenized = tokenized.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
    try {
      const rendered = katex.renderToString(formula.trim(), KATEX_OPTS_INLINE).replace(/\r?\n/g, ' ');
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(rendered);
      return placeholder;
    } catch {
      return match;
    }
  });

  // 10. Xử lý Inline Math $...$ — cho phép công thức lỡ bị AI ngắt xuống dòng
  // giữa 2 dấu $ (vẫn khớp được, gộp lại thành 1 dòng trước khi render KaTeX).
  // CHẶN NUỐT NHẦM VĂN XUÔI: nếu lỡ có 1 dấu $ lẻ (AI quên đóng), việc cho
  // phép xuống dòng có thể khiến regex "nuốt" luôn cả đoạn văn tiếng Việt
  // phía sau cho tới dấu $ kế tiếp, rồi bị KaTeX in nghiêng + xoá hết khoảng
  // trắng (chế độ Toán coi khoảng trắng là vô nghĩa) - làm vỡ chữ tiếng Việt
  // hoàn toàn. Công thức LaTeX thật chỉ gồm số/chữ Latin/lệnh LaTeX, KHÔNG
  // BAO GIỜ có tiếng Việt có dấu, nên dùng chính đặc điểm này để nhận diện:
  // hễ nội dung bắt được có dấu tiếng Việt -> chắc chắn không phải công thức
  // thật, trả về nguyên văn thay vì đưa vào KaTeX.
  const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;
  tokenized = tokenized.replace(/\$([^\$]{1,300}?)\$/g, (match, formula) => {
    if (VIETNAMESE_DIACRITICS.test(formula)) return match;
    try {
      const cleanFormula = formula.replace(/[\r\n]+/g, ' ').trim();
      if (!cleanFormula) return match;
      const rendered = katex.renderToString(cleanFormula, KATEX_OPTS_INLINE).replace(/\r?\n/g, ' ');
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(rendered);
      return placeholder;
    } catch {
      return match;
    }
  });

  // 10.5 Bọc riêng các KÝ HIỆU TOÁN ĐƠN LẺ (không cần tham số) còn sót lại
  // NGOÀI mọi cặp $...$ (mọi công thức có $ đã được tách hết ra token ở
  // bước 10 phía trên) - trường hợp AI quên bọc $ cho 1 ký hiệu đơn lẻ giữa
  // câu văn (ví dụ "...a > 0,a \neq 1 thì..."). Chỉ áp dụng cho danh sách
  // ký hiệu AN TOÀN không cần tham số đi kèm, tránh render sai các lệnh
  // cần đối số như \frac, \sqrt nếu chúng lỡ đứng ngoài $ (hiếm gặp hơn).
  const STANDALONE_SYMBOLS = [
    'neq', 'leq', 'geq', 'leftrightarrow', 'Leftrightarrow', 'rightarrow', 'Rightarrow',
    'in', 'notin', 'forall', 'exists', 'cdot', 'times', 'div', 'pm', 'mp', 'infty',
    'alpha', 'beta', 'gamma', 'delta', 'pi', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega',
    'subset', 'cup', 'cap', 'emptyset', 'partial', 'nabla', 'approx', 'equiv', 'sim',
    'propto', 'cong', 'perp', 'parallel', 'angle', 'to',
  ];
  const standaloneSymbolPattern = new RegExp(`\\\\(?:${STANDALONE_SYMBOLS.join('|')})(?![a-zA-Z])`, 'g');
  tokenized = tokenized.replace(standaloneSymbolPattern, (match) => {
    try {
      const rendered = katex.renderToString(match, KATEX_OPTS_INLINE);
      const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
      htmlTokens.push(rendered);
      return placeholder;
    } catch {
      return match;
    }
  });

  // 9. Dọn dẹp các ký tự thừa thãi, dòng cô đơn như **, ---, ***
  tokenized = tokenized
    .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0;" />')
    .replace(/^[\s]*\*\*[\s]*$/gm, '') // Dòng chỉ có ** cô đơn
    .replace(/^[\s]*\*[\s]*$/gm, '');

  // 10. Chuyển đổi Markdown Bold `**text**` và Italic `*text*`
  tokenized = tokenized.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  tokenized = tokenized.replace(/(^|[^\*])\*([^*\n]+?)\*([^\*]|$)/g, '$1<em>$2</em>$3');

  // 11. Xử lý từng dòng để format Headings, Lists, Paragraphs
  const rawLines = tokenized.split(/\r?\n/);
  const formattedElements = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    if (!line) continue;

    // Nếu dòng là placeholder HTML (như block math hoặc hr) -> giữ nguyên
    if (/^___HTML_TOKEN_\d+___$/.test(line)) {
      formattedElements.push(line);
      continue;
    }

    // Markdown Headers: #, ##, ###, ####, #####
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      formattedElements.push(`<h2 style="font-size:17px;font-weight:700;color:#1e293b;margin:14px 0 8px 0;padding-bottom:4px;border-bottom:1.5px solid #e2e8f0;">${h1Match[1]}</h2>`);
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      formattedElements.push(`<h3 style="font-size:16px;font-weight:700;color:var(--primary-strong);margin:12px 0 6px 0;">${h2Match[1]}</h3>`);
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      formattedElements.push(`<div style="font-size:15px;font-weight:700;color:var(--primary-strong);margin:12px 0 6px 0;display:flex;align-items:center;gap:6px;"><span style="color:#6366f1;">■</span> ${h3Match[1]}</div>`);
      continue;
    }

    const h4Match = line.match(/^####\s+(.+)$/);
    if (h4Match) {
      formattedElements.push(`<div style="font-size:14px;font-weight:700;color:var(--primary);margin:10px 0 4px 0;display:flex;align-items:center;gap:6px;"><span style="color:var(--primary);">▸</span> ${h4Match[1]}</div>`);
      continue;
    }

    // Tiêu đề số thứ tự: "1. Tiêu đề:" hoặc "1. <strong>Tiêu đề:</strong>"
    const numHeaderMatch = line.match(/^([1-9]\d*)\.\s+(.*)$/);
    if (numHeaderMatch) {
      const num = numHeaderMatch[1];
      const rest = numHeaderMatch[2];
      formattedElements.push(
        `<div style="margin-top:10px;margin-bottom:4px;font-weight:700;color:#1e293b;display:flex;align-items:flex-start;gap:6px;">
          <span style="background:#e0e7ff;color:#4338ca;padding:1px 6px;border-radius:4px;font-size:12px;font-weight:800;flex-shrink:0;">${num}</span>
          <div style="flex:1;">${rest}</div>
        </div>`
      );
      continue;
    }

    // Gạch đầu dòng cấp 1: "- " hoặc "• " hoặc "* "
    if (/^[-•*]\s+/.test(line)) {
      const content = line.replace(/^[-•*]\s+/, '');
      formattedElements.push(
        `<div style="margin-left:10px;margin-top:4px;display:flex;align-items:flex-start;gap:8px;">
          <span style="color:#6366f1;font-weight:900;flex-shrink:0;margin-top:-1px;">•</span>
          <div style="flex:1;line-height:1.6;">${content}</div>
        </div>`
      );
      continue;
    }

    // Gạch đầu dòng cấp 2: "+ " hoặc "▸ "
    if (/^[+▸]\s+/.test(line)) {
      const content = line.replace(/^[+▸]\s+/, '');
      formattedElements.push(
        `<div style="margin-left:24px;margin-top:3px;display:flex;align-items:flex-start;gap:6px;">
          <span style="color:#94a3b8;flex-shrink:0;">▸</span>
          <div style="flex:1;line-height:1.6;">${content}</div>
        </div>`
      );
      continue;
    }

    // Đoạn văn thông thường
    formattedElements.push(`<div style="margin-top:4px;line-height:1.65;">${line}</div>`);
  }

  let result = formattedElements.join('');

  // 12. Khôi phục các thẻ HTML/SVG/IMG và KaTeX nguyên bản
  htmlTokens.forEach((originalHtml, idx) => {
    result = result.replace(`___HTML_TOKEN_${idx}___`, originalHtml);
  });

  return result;
}

export default renderMath;
