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
    const matchedText = m[0]
    const isBracketed = matchedText.startsWith('[') && matchedText.endsWith(']')

    if (m[1] !== undefined) {
      // [Label] bracketed reference
      tokens.push({ type: 'ref', label: m[1].trim(), bracketed: true })
    } else if (m[2] !== undefined) {
      // Bare label reference
      tokens.push({ type: 'ref', label: m[2].trim(), bracketed: false })
    } else if (m[3] !== undefined) {
      tokens.push({ type: 'num', value: parseFloat(m[3]), raw: m[3] })
    } else if (m[4] !== undefined) {
      tokens.push({ type: 'op', value: '^', raw: m[4] })
    } else if (m[5] === '(') {
      tokens.push({ type: 'lparen', raw: '(' })
    } else if (m[5] === ')') {
      tokens.push({ type: 'rparen', raw: ')' })
    } else if (m[5] !== undefined) {
      tokens.push({ type: 'op', value: m[5], raw: m[5] })
    }
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

function splitMultiValue(raw) {
  return String(raw ?? '').split(',').map((v) => v.trim()).filter(Boolean)
}

// The first Multi Select reference in this formula whose current row value holds more than one
// option — the "fan out" driver for evaluateFormula below. At most one such header drives the
// fan-out (the real use case, matching expandMultiSelectRows.js's own scope, is one such column
// at a time); any other multi-valued Multi Select reference in the same formula is left as its
// raw comma-joined string on every pass.
function findMultiValueRef(formula, row, headers) {
  const tokens = tokenize(formula, headers || [])
  for (const t of tokens) {
    if (t.type !== 'ref') continue
    const header = findHeaderByLabel(t.label, headers || [])
    if (header?.dataType !== 'multiselect') continue
    const options = splitMultiValue(row?.[header.id])
    if (options.length > 1) return { header, options }
  }
  return null
}

// Whether `formula` references `targetHeader` at all (bracketed or bare) — used by
// expandMultiSelectRows.js to find which Formula headers need to fan out in lockstep with a
// Multi Select column's own per-option row expansion at export time.
export function formulaReferencesHeader(formula, targetHeader, headers) {
  if (!formula || !targetHeader) return false
  return tokenize(formula, headers || []).some(
    (t) => t.type === 'ref' && findHeaderByLabel(t.label, headers || [])?.id === targetHeader.id
  )
}


// Evaluates internal arithmetic inside a single bracket if present
function evaluateInnerBracket(label, row, headers) {
  // First, try direct match against actual header label
  const directHeader = findHeaderByLabel(label, headers)
  if (directHeader) {
    const raw = row?.[directHeader.id]
    if (raw === undefined || raw === null || String(raw).trim() === '') return null
    return String(raw).trim()
  }

  // If no literal header match, tokenize & parse the inner string as an arithmetic formula
  try {
    const innerTokens = tokenize(label, headers)
    const resolved = []
    for (const t of innerTokens) {
      if (t.type !== 'ref') { resolved.push(t); continue }
      const h = findHeaderByLabel(t.label, headers)
      if (!h) return null
      const raw = row?.[h.id]
      if (raw === undefined || raw === null || String(raw).trim() === '') return null
      const str = String(raw).trim()
      resolved.push({ type: 'num', value: parseFloat(str) })
    }
    const result = parse(resolved)
    return Number.isFinite(result) ? Math.round(result * 100) / 100 : null
  } catch {
    return null
  }
}

// Evaluates one formula string against one row. Returns a number (rounded
// to 2 decimals, arithmetic mode), a string (text-join mode), or '' when
// unresolvable — missing/blank reference, or malformed syntax — never
// throws, since this runs on every keystroke while a row is still being
// filled in and a half-typed formula/row is the normal case, not an error.
export function evaluateFormula(formula, row, headers) {
  if (!formula || !String(formula).trim()) return ''

  // 0. A referenced Multi Select column with more than one option picked fans this formula out —
  // computed once per option (e.g. Variations "34, 35, 36" against "[Product Number]-
  // [Variations]" evaluates three times, Variations standing in for just "34", then "35", then
  // "36" each pass) and comma-joins the results — same separator MultiSelectCell.jsx itself
  // writes — so a formula header built from a Multi Select column becomes multi-valued too, in
  // the same order. That's what lets expandMultiSelectRows.js fan this header out in lockstep
  // with the Multi Select column driving it, instead of every expanded row repeating the same
  // (wrong) computed value. Recurses at most one level deep: the substituted row carries a
  // single option for that header, so the recursive call finds nothing left to fan out.
  const multiRef = findMultiValueRef(formula, row, headers)
  if (multiRef) {
    const results = multiRef.options.map((opt) => evaluateFormula(formula, { ...row, [multiRef.header.id]: opt }, headers))
    return results.some((r) => r === '') ? '' : results.join(', ')
  }

  // 1. Check if the ENTIRE formula is enclosed in a single bracket pair e.g., "[Cost + 250]"
  const trimmed = formula.trim()
  const isPureSingleBracket = trimmed.startsWith('[') && trimmed.endsWith(']') && 
                              trimmed.indexOf(']', 1) === trimmed.length - 1

  // If it's a single arithmetic bracket, calculate arithmetic result
  if (isPureSingleBracket) {
    const innerContent = trimmed.slice(1, -1).trim()
    const innerResult = evaluateInnerBracket(innerContent, row, headers)
    return innerResult !== null ? innerResult : ''
  }

  // 2. Otherwise, treat outer tokens as literal string text and join them
  const tokens = tokenize(formula, headers || [])
  if (!tokens.length) return ''

  let resultString = ''

  for (const t of tokens) {
    if (t.type === 'ref') {
      const val = evaluateInnerBracket(t.label, row, headers)
      if (val === null) return '' // Unresolvable cell
      resultString += val
    } else {
      // Anything outside brackets (+, -, *, /, numbers) becomes literal text
      resultString += t.raw || t.value || ''
    }
  }

  return resultString
}

// Recomputes every Formula-type header in `headers` for one row — unconditionally, so a formula
// stays in sync with whatever it references: editing Cost re-runs Selling Price, editing
// Variations re-runs SKU, a connected-header cascade landing new values re-runs anything that
// depends on them, and so on, every time this is called. The one exception is `changedHeaderId`
// — the header actually being typed into right now, if any — which is left alone so a user
// isn't fought mid-keystroke on the very formula cell they're editing (formula cells are still
// directly editable, see SheetGrid.jsx); the next edit to *anything else* in the row recomputes
// it again regardless. Returns {[headerId]: value} to merge into that row — same {[id]: value}
// shape linkedHeaders.js's resolveLinkedFill returns, so a caller (SheetGrid) can chain both
// after any cell edit.
export function recomputeFormulas(headers, row, changedHeaderId) {
  const extra = {}
  for (const h of headers) {
    if (h.dataType !== 'formula' || !h.formula) continue
    if (h.id === changedHeaderId) continue
    const computed = evaluateFormula(h.formula, row, headers)
    if (computed !== '') extra[h.id] = String(computed)
  }
  return Object.keys(extra).length ? extra : null
}
