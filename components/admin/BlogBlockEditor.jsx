'use client'
import { useState, useRef } from 'react'
import {
  Plus, Trash2, MoveUp, MoveDown, Copy, ChevronDown, Bold,
  Italic, Code, Link2, Type, AlignLeft, List, Hash, Quote,
  Minus, Image as ImageIcon, Table2, ArrowRight, HelpCircle
} from 'lucide-react'
import ImageUpload from './ImageUpload'

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function newBlock(type) {
  switch (type) {
    case 'p': return { _key: uid(), type: 'p', html: '' }
    case 'h2': return { _key: uid(), type: 'h2', id: '', text: '' }
    case 'h3': return { _key: uid(), type: 'h3', id: '', text: '' }
    case 'h4': return { _key: uid(), type: 'h4', id: '', text: '' }
    case 'ul': return { _key: uid(), type: 'ul', items: [''] }
    case 'ol': return { _key: uid(), type: 'ol', items: [''] }
    case 'blockquote': return { _key: uid(), type: 'blockquote', text: '' }
    case 'hr': return { _key: uid(), type: 'hr' }
    case 'code': return { _key: uid(), type: 'code', code: '', lang: 'js' }
    case 'img': return { _key: uid(), type: 'img', src: null, alt: '', caption: '' }
    case 'table': return { _key: uid(), type: 'table', rows: [['Header 1', 'Header 2'], ['Cell', 'Cell']] }
    case 'interlink': return { _key: uid(), type: 'interlink', label: 'Read Also', links: [{ href: '', text: '' }] }
    case 'faq': return { _key: uid(), type: 'faq', items: [{ q: '', a: '' }] }
    default: return { _key: uid(), type: 'p', html: '' }
  }
}

const BLOCK_TYPES = [
  { value: 'p', label: 'Paragraph', icon: AlignLeft },
  { value: 'h2', label: 'Heading 2', icon: Type },
  { value: 'h3', label: 'Heading 3', icon: Type },
  { value: 'h4', label: 'Heading 4', icon: Type },
  { value: 'ul', label: 'Bullet List', icon: List },
  { value: 'ol', label: 'Numbered List', icon: List },
  { value: 'blockquote', label: 'Blockquote', icon: Quote },
  { value: 'hr', label: 'Divider', icon: Minus },
  { value: 'code', label: 'Code Block', icon: Code },
  { value: 'img', label: 'Image', icon: ImageIcon },
  { value: 'table', label: 'Table', icon: Table2 },
  { value: 'interlink', label: 'Read Also', icon: ArrowRight },
  { value: 'faq', label: 'FAQ Block', icon: HelpCircle },
]

const CODE_LANGS = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'python', 'bash', 'json', 'sql']

// ─── Inline HTML helpers for paragraph ───────────────────────────────────────

function InlineToolbar({ textareaRef, onChange, value }) {
  function wrap(before, after) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = value.slice(start, end)
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-surface border-b border-divider">
      <button type="button" onClick={() => wrap('<strong>', '</strong>')}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent-hover" title="Bold">
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('<em>', '</em>')}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent-hover" title="Italic">
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('<code>', '</code>')}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent-hover" title="Inline code">
        <Code className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('<a href="">', '</a>')}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent-hover" title="Link">
        <Link2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => wrap('', '<br>')}
        className="p-1 rounded hover:bg-accent/10 text-muted hover:text-accent-hover text-xs font-bold" title="Line break">
        ↵
      </button>
    </div>
  )
}

// ─── Individual block editors ─────────────────────────────────────────────────

function ParagraphEditor({ block, update }) {
  const ref = useRef(null)
  return (
    <div className="border border-divider rounded-lg overflow-hidden">
      <InlineToolbar textareaRef={ref} onChange={(html) => update({ html })} value={block.html || ''} />
      <textarea
        ref={ref}
        value={block.html || ''}
        onChange={(e) => update({ html: e.target.value })}
        rows={4}
        placeholder="Paragraph HTML… (use toolbar above for formatting)"
        className="w-full px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent"
      />
    </div>
  )
}

function HeadingEditor({ block, update }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <select
          value={block.type}
          onChange={(e) => update({ type: e.target.value })}
          className="text-sm border border-divider rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {['h2', 'h3', 'h4'].map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
        <input
          value={block.text || ''}
          onChange={(e) => update({ text: e.target.value, id: slugify(e.target.value) })}
          placeholder="Heading text"
          className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <input
        value={block.id || ''}
        onChange={(e) => update({ id: e.target.value })}
        placeholder="ID / anchor (used in TOC)"
        className="text-xs border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent text-subtle"
      />
    </div>
  )
}

function ListEditor({ block, update }) {
  const items = block.items || ['']
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 mb-1">
        {['ul', 'ol'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => update({ type: t })}
            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
              block.type === t
                ? 'bg-accent text-white border-accent'
                : 'bg-card text-muted border-divider-light hover:border-accent'
            }`}
          >
            {t === 'ul' ? 'Bullet' : 'Numbered'}
          </button>
        ))}
      </div>
      {items.map((item, ii) => (
        <div key={ii} className="flex gap-2 items-center">
          <span className="text-xs text-subtle w-5 shrink-0">
            {block.type === 'ol' ? `${ii + 1}.` : '•'}
          </span>
          <input
            value={item}
            onChange={(e) => {
              const next = [...items]
              next[ii] = e.target.value
              update({ items: next })
            }}
            placeholder={`Item ${ii + 1} (HTML allowed)`}
            className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="button" onClick={() => update({ items: items.filter((_, i) => i !== ii) })}
            className="p-1 text-subtle hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => update({ items: [...items, ''] })}
        className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 mt-1">
        <Plus className="w-3 h-3" /> Add item
      </button>
    </div>
  )
}

function CodeEditor({ block, update }) {
  return (
    <div className="flex flex-col gap-2">
      <select
        value={block.lang || 'js'}
        onChange={(e) => update({ lang: e.target.value })}
        className="w-32 text-sm border border-divider rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        {CODE_LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>
      <textarea
        value={block.code || ''}
        onChange={(e) => update({ code: e.target.value })}
        rows={6}
        placeholder="Code…"
        spellCheck={false}
        className="w-full font-mono text-sm border border-divider rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-accent bg-surface"
      />
    </div>
  )
}

function TableEditor({ block, update }) {
  const rows = block.rows || [['', ''], ['', '']]

  const setCell = (ri, ci, val) => {
    const next = rows.map((row, r) => row.map((cell, c) => (r === ri && c === ci ? val : cell)))
    update({ rows: next })
  }

  const addRow = () => update({ rows: [...rows, new Array(rows[0]?.length || 2).fill('')] })
  const addCol = () => update({ rows: rows.map((row) => [...row, '']) })
  const removeRow = (ri) => update({ rows: rows.filter((_, r) => r !== ri) })
  const removeCol = (ci) => update({ rows: rows.map((row) => row.filter((_, c) => c !== ci)) })

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-divider">
        <table className="text-sm">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? 'bg-surface' : ''}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-divider p-1">
                    <input
                      value={cell}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      placeholder={ri === 0 ? `Header ${ci + 1}` : `Cell`}
                      className={`w-24 px-2 py-1 text-xs focus:outline-none ${ri === 0 ? 'font-medium' : ''}`}
                    />
                  </td>
                ))}
                <td className="border border-divider p-1">
                  <button type="button" onClick={() => removeRow(ri)}
                    className="p-0.5 text-subtle hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={addRow}
          className="text-xs text-accent font-medium flex items-center gap-1 hover:text-accent-hover">
          <Plus className="w-3 h-3" /> Row
        </button>
        <button type="button" onClick={addCol}
          className="text-xs text-accent font-medium flex items-center gap-1 hover:text-accent-hover">
          <Plus className="w-3 h-3" /> Column
        </button>
        {rows[0]?.length > 1 && (
          <button type="button" onClick={() => removeCol(rows[0].length - 1)}
            className="text-xs text-red-500 font-medium flex items-center gap-1 hover:text-red-700">
            <Trash2 className="w-3 h-3" /> Last col
          </button>
        )}
      </div>
    </div>
  )
}

function InterlinkEditor({ block, update }) {
  const links = block.links || [{ href: '', text: '' }]
  return (
    <div className="flex flex-col gap-2">
      <input
        value={block.label || 'Read Also'}
        onChange={(e) => update({ label: e.target.value })}
        placeholder="Label (e.g. Read Also)"
        className="text-sm border border-divider rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {links.map((link, li) => (
        <div key={li} className="flex gap-2 items-center">
          <input
            value={link.text}
            onChange={(e) => {
              const next = [...links]
              next[li] = { ...next[li], text: e.target.value }
              update({ links: next })
            }}
            placeholder="Link text"
            className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <input
            value={link.href}
            onChange={(e) => {
              const next = [...links]
              next[li] = { ...next[li], href: e.target.value }
              update({ links: next })
            }}
            placeholder="/blog/some-post"
            className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button type="button" onClick={() => update({ links: links.filter((_, i) => i !== li) })}
            className="p-1 text-subtle hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => update({ links: [...links, { href: '', text: '' }] })}
        className="text-xs text-accent font-medium flex items-center gap-1 hover:text-accent-hover">
        <Plus className="w-3 h-3" /> Add link
      </button>
    </div>
  )
}

function FaqBlockEditor({ block, update }) {
  const items = block.items || [{ q: '', a: '' }]
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, ii) => (
        <div key={ii} className="flex flex-col gap-1.5 p-3 border border-divider rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-accent">Q{ii + 1}</span>
            <button type="button" onClick={() => update({ items: items.filter((_, i) => i !== ii) })}
              className="ml-auto p-1 text-subtle hover:text-red-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input
            value={item.q}
            onChange={(e) => {
              const next = [...items]
              next[ii] = { ...next[ii], q: e.target.value }
              update({ items: next })
            }}
            placeholder="Question"
            className="text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <textarea
            value={item.a}
            onChange={(e) => {
              const next = [...items]
              next[ii] = { ...next[ii], a: e.target.value }
              update({ items: next })
            }}
            rows={3}
            placeholder="Answer"
            className="text-sm border border-divider rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      ))}
      <button type="button" onClick={() => update({ items: [...items, { q: '', a: '' }] })}
        className="text-xs text-accent font-medium flex items-center gap-1 hover:text-accent-hover">
        <Plus className="w-3 h-3" /> Add Q&A pair
      </button>
    </div>
  )
}

// ─── Block wrapper ────────────────────────────────────────────────────────────

function BlockItem({ block, onChange, onDelete, onMoveUp, onMoveDown, onDuplicate, isFirst, isLast }) {
  const update = (patch) => onChange({ ...block, ...patch })
  const meta = BLOCK_TYPES.find((t) => t.value === block.type)

  return (
    <div className="border border-divider rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-divider">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-subtle uppercase tracking-wide">
          {meta?.icon && <meta.icon className="w-3.5 h-3.5" />}
          {meta?.label || block.type}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={isFirst} title="Move up"
            className="p-1.5 rounded text-subtle hover:text-accent hover:bg-accent/10 disabled:opacity-30 transition-colors">
            <MoveUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} title="Move down"
            className="p-1.5 rounded text-subtle hover:text-accent hover:bg-accent/10 disabled:opacity-30 transition-colors">
            <MoveDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDuplicate} title="Duplicate"
            className="p-1.5 rounded text-subtle hover:text-green-600 hover:bg-green-50 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} title="Delete"
            className="p-1.5 rounded text-subtle hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Block body */}
      <div className="p-3">
        {block.type === 'p' && <ParagraphEditor block={block} update={update} />}
        {(block.type === 'h2' || block.type === 'h3' || block.type === 'h4') && (
          <HeadingEditor block={block} update={update} />
        )}
        {(block.type === 'ul' || block.type === 'ol') && (
          <ListEditor block={block} update={update} />
        )}
        {block.type === 'blockquote' && (
          <textarea
            value={block.text || ''}
            onChange={(e) => update({ text: e.target.value })}
            rows={2}
            placeholder="Blockquote text…"
            className="w-full px-3 py-2 text-sm border border-divider rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          />
        )}
        {block.type === 'hr' && (
          <div className="py-2 text-center text-xs text-subtle">— Horizontal rule —</div>
        )}
        {block.type === 'code' && <CodeEditor block={block} update={update} />}
        {block.type === 'img' && (
          <div className="flex flex-col gap-2">
            <ImageUpload
              value={block.src}
              onChange={(url) => update({ src: url })}
              collection="blogs"
              label={null}
            />
            <input
              value={block.alt || ''}
              onChange={(e) => update({ alt: e.target.value })}
              placeholder="Alt text (required for accessibility)"
              className="text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              value={block.caption || ''}
              onChange={(e) => update({ caption: e.target.value })}
              placeholder="Caption (optional)"
              className="text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent text-subtle"
            />
          </div>
        )}
        {block.type === 'table' && <TableEditor block={block} update={update} />}
        {block.type === 'interlink' && <InterlinkEditor block={block} update={update} />}
        {block.type === 'faq' && <FaqBlockEditor block={block} update={update} />}
      </div>
    </div>
  )
}

// ─── Main BlogBlockEditor ─────────────────────────────────────────────────────

export default function BlogBlockEditor({ value = [], onChange }) {
  const [showDropdown, setShowDropdown] = useState(false)

  const addBlock = (type) => {
    onChange([...value, newBlock(type)])
    setShowDropdown(false)
  }

  const update = (i, block) => onChange(value.map((b, idx) => (idx === i ? block : b)))
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i))
  const duplicate = (i) => {
    const copy = { ...value[i], _key: uid() }
    const next = [...value]
    next.splice(i + 1, 0, copy)
    onChange(next)
  }
  const moveUp = (i) => {
    if (i === 0) return
    const arr = [...value]
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    onChange(arr)
  }
  const moveDown = (i) => {
    if (i === value.length - 1) return
    const arr = [...value]
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    onChange(arr)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Block list */}
      <div className="flex flex-col gap-2">
        {value.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-divider rounded-xl text-subtle">
            <Plus className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No blocks yet — add your first block below</p>
          </div>
        )}
        {value.map((block, i) => (
          <BlockItem
            key={block._key || i}
            block={block}
            onChange={(b) => update(i, b)}
            onDelete={() => remove(i)}
            onDuplicate={() => duplicate(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            isFirst={i === 0}
            isLast={i === value.length - 1}
          />
        ))}
      </div>

      {/* Add block dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown((o) => !o)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-accent/50 text-accent hover:bg-accent/10 text-sm font-medium transition-colors w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Block
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-card rounded-xl border border-divider shadow-xl z-50 p-2">
            <div className="grid grid-cols-3 gap-1">
              {BLOCK_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => addBlock(t.value)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted hover:bg-accent/10 hover:text-accent-hover transition-colors"
                >
                  <t.icon className="w-4 h-4 shrink-0" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
