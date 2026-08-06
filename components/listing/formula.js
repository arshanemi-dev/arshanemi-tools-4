// Evaluator for Formula-type headers (Template Settings' GroupTabsStep,
// "Formula" field type). Never eval()/Function() on user input.
//
// Two modes, auto-detected per call (not per-template — the same formula
// can go either way depending on what's actually in the row):
//  - Arithmetic, when every [Label] reference resolves to a number — e.g.
//    "[MRP] * 1.5", "[Cost] + 250", "[Cost+250]" (see below) — evaluated by
//    a small recursive-descent parser (+ - * / ^, parens, the word "power"
//    as a ^ alias).
//  - Text join, when at least one reference resolves to something
//    non-numeric — e.g. "[Product Number]-[Variations]" building a SKU out
//    of two text fields. Every reference becomes its literal string value;
//    every other token (operators, numbers, parens) becomes its own
//    literal text; the whole thing is concatenated in order, no arithmetic
//    applied.
//
// References match against the *current* sheet's header labels directly —
// bracket-wrapped ("[Cost]") or bare ("Cost"), and (since a header label
// can itself contain characters like "+" that would otherwise look like an
// operator) matching is longest-label-first against the sheet's actual
// labels rather than assuming "[" and "]" are the only reference
// delimiters. That's what makes "[Cost+250]" resolve as ref(Cost) + 250
// instead of failing to find a header literally named "Cost+250" — the
// label match wins over treating "+250" as part of the bracket content.
// A reference that's missing entirely, or whose row value is still blank,
// makes the whole formula unresolvable (blank result) — there's nothing
// sane to compute or join from data that isn't there yet.

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Fixed capture-group positions regardless of whether the sheet has any
// labels at all, so tokenize() never has to guess which group fired.
// Group 1/2: label reference (bracketed / bare). 3: number. 4: the word
// "power". 5: +-*/^()  — `[^\s\S]` is a standard "never matches anything"
// placeholder, used when there are no labels to build a real alternation.
function buildTokenRegex(headers) {
  const labels = [...new Set((headers || []).map((h) => h.label?.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
  const labelGroup = labels.length ? labels.join('|') : '[^\\s\\S]'
  return new RegExp(`\\[(${labelGroup})\\]|(${labelGroup})|(\\d+(?:\\.\\d+)?)|(power)|([+\\-*/^()])`, 'gi')
}

function tokenize(formula, headers) {
  const re = buildTokenRegex(headers)
  const tokens = []
  let m
  re.lastIndex = 0
  while ((m = re.exec(formula))) {
    if (m[1] !== undefined) tokens.push({ type: 'ref', label: m[1].trim() })
    else if (m[2] !== undefined) tokens.push({ type: 'ref', label: m[2].trim() })
    else if (m[3] !== undefined) tokens.push({ type: 'num', value: parseFloat(m[3]) })
    else if (m[4] !== undefined) tokens.push({ type: 'op', value: '^' })
    else if (m[5] === '(') tokens.push({ type: 'lparen' })
    else if (m[5] === ')') tokens.push({ type: 'rparen' })
    else if (m[5] !== undefined) tokens.push({ type: 'op', value: m[5] })
  }
  return tokens
}

// Precedence climbing over already-resolved (ref-free, purely num/op/paren)
// tokens: + - (lowest) < * / < ^ (right-associative, highest), unary minus
// bound tighter than everything but a parenthesized group.
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

function findHeaderByLabel(label, headers) {
  return headers.find((h) => h.label?.trim().toLowerCase() === label.toLowerCase())
}

// Evaluates one formula string against one row. Returns a number (rounded
// to 2 decimals, arithmetic mode), a string (text-join mode), or '' when
// unresolvable — missing/blank reference, or malformed syntax — never
// throws, since this runs on every keystroke while a row is still being
// filled in and a half-typed formula/row is the normal case, not an error.
export function evaluateFormula(formula, row, headers) {
  if (!formula || !String(formula).trim()) return ''
  const tokens = tokenize(formula, headers || [])
  if (!tokens.length) return ''

  const resolved = []
  for (const t of tokens) {
    if (t.type !== 'ref') { resolved.push(t); continue }
    const header = findHeaderByLabel(t.label, headers || [])
    if (!header) return ''
    const raw = row?.[header.id]
    if (raw === undefined || raw === null || String(raw).trim() === '') return ''
    const str = String(raw).trim()
    resolved.push({ type: 'ref', raw: str, numeric: parseFloat(str) })
  }

  const allNumeric = resolved.every((t) => t.type !== 'ref' || Number.isFinite(t.numeric))
  if (allNumeric) {
    try {
      const arithTokens = resolved.map((t) => (t.type === 'ref' ? { type: 'num', value: t.numeric } : t))
      const result = parse(arithTokens)
      return Number.isFinite(result) ? Math.round(result * 100) / 100 : ''
    } catch {
      return ''
    }
  }

  // Text-join mode — at least one reference is real data but not a number
  // (e.g. a Product Number like "PN-100"), so there's nothing to compute
  // arithmetically; join everything as literal text instead, in the order
  // it was written.
  return resolved.map((t) => {
    if (t.type === 'ref') return t.raw
    if (t.type === 'num') return String(t.value)
    if (t.type === 'op') return t.value
    if (t.type === 'lparen') return '('
    if (t.type === 'rparen') return ')'
    return ''
  }).join('')
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

// Fills every Formula-type header in `headers` for one row — but only the
// ones currently *blank*, same "fill if missing, never overwrite" rule
// SKU assignment already uses (lib/listingTemplates.js's assignSkusToRows:
// `if (row.sku || isRowEmpty(row)) return row`). Once a formula cell holds a
// value — whether this function put it there on an earlier row change, or
// the user typed over it directly (formula cells are editable, see
// SheetGrid.jsx) — it's sticky: further row changes never silently
// recompute over it. Clearing the cell back to blank is what re-enables
// auto-fill. Returns {[headerId]: value} to merge into that row — same
// {[id]: value} shape linkedHeaders.js's resolveLinkedFill returns, so a
// caller (SheetGrid) can chain both after any cell edit.
export function recomputeFormulas(headers, row) {
  const extra = {}
  for (const h of headers) {
    if (h.dataType !== 'formula' || !h.formula) continue
    if (!isBlank(row?.[h.id])) continue
    const computed = evaluateFormula(h.formula, row, headers)
    if (computed !== '') extra[h.id] = String(computed)
  }
  return Object.keys(extra).length ? extra : null
}
