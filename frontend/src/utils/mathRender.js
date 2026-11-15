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

// Công thức LaTeX thật chỉ gồm chữ Latin/số/lệnh LaTeX, KHÔNG BAO GIỜ có
// tiếng Việt có dấu - dùng để nhận ra cặp $...$ bắt nhầm cả đoạn văn (AI
// quên đóng $) và trả về nguyên văn thay vì đưa cả đoạn văn vào KaTeX.
const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;

// Chỉ coi là thẻ HTML thật khi đúng tên thẻ thường gặp VÀ đúng cú pháp thuộc
// tính (tên="giá trị"). Trước đây mọi chuỗi dạng "<chữ ... >" đều bị coi là
// thẻ, nên "0 <a \neq 1$) ... $x >" trong lộ trình AI bị hiểu nhầm thành thẻ
// <a> (link), làm vỡ cả đoạn công thức phía sau.
const HTML_TAG_NAMES = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'center', 'code', 'col', 'colgroup', 'del',
  'div', 'em', 'figcaption', 'figure', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
  'img', 'ins', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strike', 'strong', 'sub',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];
// Giá trị không có ngoặc vẫn được phép chứa "=" (VD ảnh base64 src=data:...==).
const HTML_ATTR = String.raw`\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>` + '`' + String.raw`]+))?`;
const HTML_TAG_RE = new RegExp(
  String.raw`<svg[\s\S]*?<\/svg>|<table[\s\S]*?<\/table>|<!--[\s\S]*?-->|<\/?(?:${HTML_TAG_NAMES.join('|')})(?:${HTML_ATTR})*\s*\/?>`,
  'gi'
);

// Ký hiệu toán đơn lẻ (không cần tham số) AI hay viết thiếu $ giữa câu văn.
const STANDALONE_SYMBOLS = [
  'neq', 'leq', 'geq', 'leftrightarrow', 'Leftrightarrow', 'rightarrow', 'Rightarrow',
  'in', 'notin', 'forall', 'exists', 'cdot', 'times', 'div', 'pm', 'mp', 'infty',
  'alpha', 'beta', 'gamma', 'delta', 'pi', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega',
  'subset', 'cup', 'cap', 'emptyset', 'partial', 'nabla', 'approx', 'equiv', 'sim',
  'propto', 'cong', 'perp', 'parallel', 'angle', 'to',
];
const STANDALONE_SYMBOL_RE = new RegExp(String.raw`\\(?:${STANDALONE_SYMBOLS.join('|')})(?![a-zA-Z])`, 'g');

const TOKEN_RE = /___HTML_TOKEN_(\d+)___/g;

/**
 * Chuyển văn bản có công thức LaTeX ($...$, $$...$$, \(...\), \[...\]) và
 * Markdown đơn giản (tiêu đề, gạch đầu dòng, **đậm**) sang HTML.
 *
 * Thứ tự xử lý (quan trọng):
 *  1. Giữ nguyên thẻ HTML thật (ảnh công thức, bảng... từ file Word).
 *  2. Sửa những lỗi AI hay gặp mà CHẮC CHẮN là lỗi (VD "$0 < $a \neq 1").
 *  3. Tách TẤT CẢ công thức đã viết đúng ra trước.
 *  4. Chỉ sau đó mới chạy các bước "sửa tự động" (thiếu \, thiếu $) trên
 *     phần chữ thường còn lại - không bao giờ đụng vào bên trong công thức.
 *  5. Thoát ký tự < > còn lại để trình duyệt không hiểu nhầm thành thẻ HTML.
 *  6. Dựng tiêu đề / danh sách / đoạn văn.
 */
export function renderMath(text) {
  if (!text || typeof text !== 'string') return '';

  const htmlTokens = [];
  const stash = (html) => {
    const placeholder = `___HTML_TOKEN_${htmlTokens.length}___`;
    htmlTokens.push(html);
    return placeholder;
  };
  const renderKatex = (formula, opts) => {
    try {
      return katex.renderToString(formula, opts).replace(/\r?\n/g, ' ');
    } catch {
      return null;
    }
  };
  const renderBlock = (formula) => {
    const html = renderKatex(formula, KATEX_OPTS_BLOCK);
    return html ? `<span class="katex-block-wrapper">${html}</span>` : null;
  };

  // 0. Dọn chữ "undefined" rác (dữ liệu cũ ghép chuỗi với trường bị thiếu).
  let s = text.replace(/\$?\bundefined\b\$?/g, '');

  // 1. Giữ nguyên thẻ HTML thật.
  s = s.replace(HTML_TAG_RE, (m) => stash(m));

  // 2. Sửa lỗi AI chắc chắn là lỗi (chỉ khớp đúng dạng hỏng, không khớp công thức đúng).
  s = s
    // \left\{ \begin{aligned} ... \end{aligned} \right. -> \begin{cases} ... \end{cases}
    .replace(/\\left\\{\s*\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}\s*\\right\.?/g, (m, inner) => (
      `\\begin{cases} ${inner.replace(/&/g, '').trim()} \\end{cases}`
    ))
    // "$0 < $a \neq 1" (dấu $ đóng nhầm ở giữa) -> "$0 < a \neq 1$"
    .replace(/\$\s*0\s*<\s*\$\s*a\s*(?:\\neq|≠|∄)\s*1(?:\s*\$)?/g, '$0 < a \\neq 1$')
    // `công thức` kiểu Markdown -> $công thức$
    .replace(/`([^`\n\r]+?)`/g, (m, inner) => {
      const t = inner.trim();
      if (!t) return m;
      return t.startsWith('$') && t.endsWith('$') ? t : `$${t}$`;
    })
    // Dấu ngoặc đóng bị rớt xuống dòng riêng
    .replace(/[\r\n]+\s*\)\s*\.?/g, '). ')
    // 2 ý bị viết dính trên cùng 1 dòng: "...). - $công thức$" -> xuống dòng
    .replace(/([.;:])\s+-\s+(?=\$|\\\(|[A-ZĐ])/g, '$1\n- ');

  // 3. Tách công thức đã viết đúng.
  // $$...$$ ngắn nằm giữa câu -> inline; dài -> khối riêng, căn giữa.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, formula) => {
    const f = formula.trim();
    if (/^[a-zA-Z0-9_{}^+\-*/\\,;\s]{1,30}$/.test(f)) {
      const html = renderKatex(f, KATEX_OPTS_INLINE);
      return html ? stash(html) : m;
    }
    const html = renderBlock(f);
    return html ? stash(html) : m;
  });
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (m, formula) => {
    const html = renderBlock(formula.trim());
    return html ? stash(html) : m;
  });
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (m, formula) => {
    const html = renderKatex(formula.trim(), KATEX_OPTS_INLINE);
    return html ? stash(html) : m;
  });
  // $...$ : dò từng cặp dấu $. Cặp nào không giống công thức (có tiếng Việt,
  // có dòng trống, bắt đầu bằng ")" "." "," ...) nghĩa là dấu $ mở đang bị
  // ghép nhầm - thường do AI viết thừa 1 dấu $ ở phía trước (VD "b > 0$).").
  // Khi đó bỏ qua dấu $ mở này và ghép lại từ dấu $ kế tiếp, để 1 dấu $ thừa
  // không làm lệch toàn bộ các công thức phía sau.
  // Chữ tiếng Việt nằm trong \text{...} vẫn là công thức hợp lệ
  // (VD $u_{n+1} - u_n = \text{hằng số}$) - chỉ xét phần ngoài \text{}.
  const withoutTextBlocks = (t) => t.replace(/\\(?:text|textbf|textit|textrm|mathrm|mbox|operatorname)\s*\{[^{}]*\}/g, '');
  const looksLikeFormula = (inner) => {
    const t = inner.trim();
    return t.length > 0
      && inner.length <= 300
      && !VIETNAMESE_DIACRITICS.test(withoutTextBlocks(inner))
      && !/\n\s*\n/.test(inner)
      && !/^[).,;:\]]/.test(t)
      && !inner.includes('___HTML_TOKEN_');
  };
  const isStrayDollar = (inner) => /^\s*[).,;:\]]/.test(inner) || /\n\s*\n/.test(inner);
  let inlineOut = '';
  let pos = 0;
  while (pos < s.length) {
    const open = s.indexOf('$', pos);
    const close = open === -1 ? -1 : s.indexOf('$', open + 1);
    if (close === -1) {
      inlineOut += s.slice(pos);
      break;
    }
    const inner = s.slice(open + 1, close);
    const html = looksLikeFormula(inner)
      ? renderKatex(inner.replace(/[\r\n]+/g, ' ').trim(), KATEX_OPTS_INLINE)
      : null;
    if (html) {
      inlineOut += s.slice(pos, open) + stash(html);
      pos = close + 1;
    } else {
      inlineOut += s.slice(pos, open) + (isStrayDollar(inner) ? '' : '$');
      pos = open + 1;
    }
  }
  s = inlineOut;

  // 4. "Sửa tự động" CHỈ trên phần chữ thường (công thức đã được tách hết).
  s = s
    // AI quên dấu \ : "a neq 1", "A Leftrightarrow B"
    .replace(/([a-zA-Z0-9])\s*\bneq\s*([0-9a-zA-Z])/g, '$1 \\neq $2')
    .replace(/(^|\s)neq(?=\s*[0-9a-zA-Z])/g, '$1\\neq')
    .replace(/(^|\s)(Leftrightarrow|Rightarrow)(?=\s|$)/g, '$1\\$2');
  // Ký hiệu đơn lẻ còn sót ngoài $...$ -> render riêng từng ký hiệu
  s = s.replace(STANDALONE_SYMBOL_RE, (m) => {
    const html = renderKatex(m, KATEX_OPTS_INLINE);
    return html ? stash(html) : m;
  });

  // 5. Thoát < > còn lại (VD "0<a<1" viết ngoài $) - nếu để nguyên, trình
  // duyệt hiểu "<a<1 ..." là thẻ HTML và nuốt mất phần chữ phía sau.
  s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 6. Dọn dòng rác, in đậm/nghiêng Markdown.
  s = s
    .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, () => stash('<hr class="mr-hr" />'))
    .replace(/^[\s]*\*\*[\s]*$/gm, '')
    .replace(/^[\s]*\*[\s]*$/gm, '')
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*([^*]|$)/g, '$1<em>$2</em>$3');

  // 7. Dựng tiêu đề / danh sách / đoạn văn theo từng dòng.
  const out = [];
  for (const rawLine of s.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^___HTML_TOKEN_\d+___$/.test(line)) {
      out.push(line);
      continue;
    }

    let m = line.match(/^#\s+(.+)$/);
    if (m) { out.push(`<h2 class="mr-h1">${m[1]}</h2>`); continue; }
    m = line.match(/^##\s+(.+)$/);
    if (m) { out.push(`<h3 class="mr-h2">${m[1]}</h3>`); continue; }
    m = line.match(/^###\s+(.+)$/);
    if (m) { out.push(`<div class="mr-h3">${m[1]}</div>`); continue; }
    m = line.match(/^#{4,6}\s+(.+)$/);
    if (m) { out.push(`<div class="mr-h4">${m[1]}</div>`); continue; }

    // "1. Tiêu đề" -> số thứ tự trong ô vuông nhỏ
    m = line.match(/^([1-9]\d*)\.\s+(.*)$/);
    if (m) {
      out.push(`<div class="mr-num"><span class="mr-num-badge">${m[1]}</span><div class="mr-num-body">${m[2]}</div></div>`);
      continue;
    }

    // Gạch đầu dòng cấp 1: "- ", "• ", "* "
    m = line.match(/^[-•*]\s+(.*)$/);
    if (m) {
      out.push(`<div class="mr-li"><span class="mr-li-dot" aria-hidden="true"></span><div class="mr-li-body">${m[1]}</div></div>`);
      continue;
    }

    // Gạch đầu dòng cấp 2: "+ ", "▸ "
    m = line.match(/^[+▸]\s+(.*)$/);
    if (m) {
      out.push(`<div class="mr-li mr-li-2"><span class="mr-li-dot" aria-hidden="true"></span><div class="mr-li-body">${m[1]}</div></div>`);
      continue;
    }

    out.push(`<div class="mr-p">${line}</div>`);
  }

  // 8. Khôi phục thẻ HTML gốc và công thức đã render (dùng hàm thay thế để
  // các ký tự "$" trong nội dung không bị hiểu là mẫu thay thế của JS).
  let result = out.join('');
  for (let pass = 0; pass < 3 && TOKEN_RE.test(result); pass += 1) {
    TOKEN_RE.lastIndex = 0;
    result = result.replace(TOKEN_RE, (m, idx) => (htmlTokens[Number(idx)] ?? m));
  }
  TOKEN_RE.lastIndex = 0;
  return result;
}

export default renderMath;
