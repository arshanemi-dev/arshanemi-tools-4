// Safe arithmetic evaluator for Formula-type headers (Template Settings'
// GroupTabsStep, "Formula" field type). Never eval()/Function() on user
// input — a small hand-rolled tokenizer + recursive-descent parser over a
// deliberately restricted grammar: [Column Label] references (resolved
// against a row + that sheet's headers, matched by label so a formula reads
// naturally, e.g. "[Cost] * 1.5"), number literals, + - * / ^, parens, and
// the word "power" as an alias for ^ (e.g. "[Col1] power [Col2]").
const TOKEN_RE = /(\[[^\]]+\])|(\d+(?:\.\d+)?)|(power)|([+\-*/^()])/gi

function tokenize(formula) {
  const tokens = []
  TOKEN_RE.lastIndex = 0
  let m
  while ((m = TOKEN_RE.exec(formula))) {
    if (m[1]) tokens.push({ type: 'ref', label: m[1].slice(1, -1).trim() })
    else if (m[2]) tokens.push({ type: 'num', value: parseFloat(m[2]) })
    else if (m[3]) tokens.push({ type: 'op', value: '^' })
    else if (m[4] === '(') tokens.push({ type: 'lparen' })
    else if (m[4] === ')') tokens.push({ type: 'rparen' })
    else if (m[4]) tokens.push({ type: 'op', value: m[4] })
  }
  return tokens
}

// Precedence climbing: + - (lowest) < * / < ^ (right-associative, highest),
// unary minus bound tighter than everything but a parenthesized group.
function parse(tokens) {
  let pos = 0
  const peek = () => tokens[pos]
  const next = () => tokens[pos++]

  function parseExpr() {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }
  function parseTerm() {
    let left = parsePower()
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = next().value
      const right = parsePower()
      left = op === '*' ? left * right : left / right
    }
    return left
  }
  function parsePower() {
    const base = parseUnary()
    if (peek()?.type === 'op' && peek().value === '^') {
      next()
      return Math.pow(base, parsePower())
    }
    return base
  }
  function parseUnary() {
    if (peek()?.type === 'op' && peek().value === '-') {
      next()
      return -parseUnary()
    }
    return parseFactor()
  }
  function parseFactor() {
    const t = next()
    if (!t) throw new Error('Unexpected end of formula')
    if (t.type === 'num') return t.value
    if (t.type === 'ref') return t.resolvedValue
    if (t.type === 'lparen') {
      const v = parseExpr()
      if (peek()?.type !== 'rparen') throw new Error('Missing )')
      next()
      return v
    }
    throw new Error('Unexpected token')
  }

  if (tokens.length === 0) throw new Error('Empty formula')
  const result = parseExpr()
  if (pos !== tokens.length) throw new Error('Unexpected trailing tokens')
  return result
}

// Resolves a `[Label]` reference against a row, matching the header whose
// label equals it case-insensitively (consistent with how connected-header
// linking already matches by group+id, but formulas are typed by the user
// as plain text, so label matching is the only thing that makes sense here).
function resolveRef(label, row, headers) {
  const header = headers.find((h) => h.label?.trim().toLowerCase() === label.toLowerCase())
  if (!header) return NaN
  const n = parseFloat(row?.[header.id])
  return Number.isFinite(n) ? n : NaN
}

// Evaluates one formula string against one row. Returns a number (rounded
// to 2 decimals to avoid float noise) or '' on anything unresolvable —
// missing/blank reference, divide-by-zero, malformed syntax — never throws,
// since this runs on every keystroke while a template is still being filled
// in and a half-typed row is the normal case, not an error.
export function evaluateFormula(formula, row, headers) {
  if (!formula || !String(formula).trim()) return ''
  try {
    const tokens = tokenize(formula).map((t) =>
      t.type === 'ref' ? { ...t, resolvedValue: resolveRef(t.label, row, headers) } : t
    )
    const result = parse(tokens)
    return Number.isFinite(result) ? Math.round(result * 100) / 100 : ''
  } catch {
    return ''
  }
}

// Recomputes every Formula-type header in `headers` for one row, returning
// {[headerId]: value} to merge into that row — same {[id]: value} shape
// components/listing/linkedHeaders.js's resolveLinkedFill returns, so a
// caller (SheetGrid) can chain both after any cell edit.
export function recomputeFormulas(headers, row) {
  const extra = {}
  for (const h of headers) {
    if (h.dataType !== 'formula' || !h.formula) continue
    extra[h.id] = String(evaluateFormula(h.formula, row, headers))
  }
  return Object.keys(extra).length ? extra : null
}
