// Bộ phân tích & tính giá trị biểu thức Toán học AN TOÀN, dùng để tự vẽ đồ
// thị hàm số từ công thức AI (Gemini) sinh ra - KHÔNG dùng eval()/Function()
// vì nội dung đến từ AI bên ngoài, nếu lỡ AI trả về mã độc (do prompt bị
// thao túng) thì eval() sẽ thực thi luôn trong trình duyệt của giáo viên/
// học sinh (rủi ro bảo mật thật sự). Bộ phân tích này chỉ hiểu đúng cú
// pháp Toán học cơ bản (số, + - * / ^, ngoặc, các hàm lượng giác/log/mũ
// thông dụng, hằng số pi/e, biến x) - không có cách nào chạy được mã JS
// tuỳ ý qua đây.

const FUNCTIONS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
};

const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const src = expr.replace(/\s+/g, '');
  while (i < src.length) {
    const c = src[i];
    if (/[0-9.]/.test(c)) {
      let num = c;
      i += 1;
      while (i < src.length && /[0-9.]/.test(src[i])) {
        num += src[i];
        i += 1;
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = c;
      i += 1;
      while (i < src.length && /[a-zA-Z0-9]/.test(src[i])) {
        name += src[i];
        i += 1;
      }
      tokens.push({ type: 'ident', value: name });
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      tokens.push({ type: 'op', value: c });
      i += 1;
      continue;
    }
    // Ký tự lạ không thuộc cú pháp Toán hỗ trợ -> báo lỗi, không cố đoán
    throw new Error(`Ký tự không hợp lệ trong biểu thức: "${c}"`);
  }
  return tokens;
}

// Recursive-descent parser theo đúng thứ tự ưu tiên toán tử chuẩn:
// + - (thấp nhất) < * / < ^ (cao nhất, kết hợp phải) < đơn nguyên (-x) < hàm/ngoặc/số
function parse(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }
  function consume(expected) {
    const t = tokens[pos];
    if (!t || (expected && t.value !== expected)) {
      throw new Error('Biểu thức không hợp lệ (thiếu hoặc thừa dấu ngoặc/toán tử).');
    }
    pos += 1;
    return t;
  }

  function parseExpr() {
    let node = parseTerm();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseTerm();
      node = { type: op, left: node, right };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value;
      const right = parseUnary();
      node = { type: op, left: node, right };
    }
    return node;
  }

  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '-') {
      consume();
      return { type: 'neg', value: parseUnary() };
    }
    if (peek() && peek().type === 'op' && peek().value === '+') {
      consume();
      return parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parseAtom();
    if (peek() && peek().type === 'op' && peek().value === '^') {
      consume();
      const exponent = parseUnary(); // kết hợp phải, cho phép 2^-1
      return { type: '^', left: base, right: exponent };
    }
    return base;
  }

  function parseAtom() {
    const t = peek();
    if (!t) throw new Error('Biểu thức bị thiếu.');

    if (t.type === 'num') {
      consume();
      return { type: 'num', value: t.value };
    }

    if (t.type === 'op' && t.value === '(') {
      consume('(');
      const node = parseExpr();
      consume(')');
      return node;
    }

    if (t.type === 'ident') {
      const name = t.value;
      consume();
      if (peek() && peek().type === 'op' && peek().value === '(') {
        consume('(');
        const args = [parseExpr()];
        while (peek() && peek().type === 'op' && peek().value === ',') {
          consume(',');
          args.push(parseExpr());
        }
        consume(')');
        return { type: 'call', name, args };
      }
      return { type: 'ident', name };
    }

    throw new Error('Biểu thức không hợp lệ.');
  }

  const result = parseExpr();
  if (pos < tokens.length) {
    throw new Error('Biểu thức không hợp lệ (còn dư ký tự).');
  }
  return result;
}

function evalNode(node, scope) {
  switch (node.type) {
    case 'num':
      return node.value;
    case 'neg':
      return -evalNode(node.value, scope);
    case '+':
      return evalNode(node.left, scope) + evalNode(node.right, scope);
    case '-':
      return evalNode(node.left, scope) - evalNode(node.right, scope);
    case '*':
      return evalNode(node.left, scope) * evalNode(node.right, scope);
    case '/':
      return evalNode(node.left, scope) / evalNode(node.right, scope);
    case '^':
      return Math.pow(evalNode(node.left, scope), evalNode(node.right, scope));
    case 'ident': {
      const key = node.name.toLowerCase();
      if (key in scope) return scope[key];
      if (key in CONSTANTS) return CONSTANTS[key];
      throw new Error(`Không rõ biến/hằng số "${node.name}".`);
    }
    case 'call': {
      const fn = FUNCTIONS[node.name.toLowerCase()];
      if (!fn) throw new Error(`Không hỗ trợ hàm "${node.name}".`);
      const args = node.args.map((a) => evalNode(a, scope));
      return fn(...args);
    }
    default:
      throw new Error('Node biểu thức không xác định.');
  }
}

/**
 * Phân tích 1 lần biểu thức thành cây cú pháp, trả về hàm compiled để gọi
 * lại nhiều lần với các giá trị x khác nhau (dùng khi vẽ đồ thị, tránh
 * parse lại chuỗi mỗi điểm lấy mẫu).
 */
export function compileExpression(expr) {
  const ast = parse(tokenize(expr));
  return (scope = {}) => evalNode(ast, scope);
}

/**
 * Tính giá trị 1 lần (parse + eval luôn) - dùng khi không cần lặp lại.
 */
export function evaluateExpression(expr, scope = {}) {
  return compileExpression(expr)(scope);
}
