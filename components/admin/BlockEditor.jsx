'use client'
import { useState } from 'react'
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react'

const BLOCK_TYPES = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'ul', label: 'Bullet List' },
  { value: 'ol', label: 'Numbered List' },
  { value: 'callout', label: 'Callout' },
]

function newBlock(type) {
  switch (type) {
    case 'p': return { type: 'p', html: '' }
    case 'h2': return { type: 'h2', id: '', text: '' }
    case 'h3': return { type: 'h3', id: '', text: '' }
    case 'ul': return { type: 'ul', items: [''] }
    case 'ol': return { type: 'ol', items: [''] }
    case 'callout': return { type: 'callout', text: '' }
    default: return { type: 'p', html: '' }
  }
}

function BlockItem({ block, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const update = (patch) => onChange({ ...block, ...patch })

  return (
    <div className="group border border-divider rounded-xl bg-card overflow-hidden">
      {/* Block toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-divider">
        <span className="text-xs font-medium text-subtle uppercase tracking-wide">
          {BLOCK_TYPES.find((t) => t.value === block.type)?.label || block.type}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            className="p-1 rounded text-subtle hover:text-accent hover:bg-accent/10 disabled:opacity-30">
            <MoveUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            className="p-1 rounded text-subtle hover:text-accent hover:bg-accent/10 disabled:opacity-30">
            <MoveDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete}
            className="p-1 rounded text-subtle hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {block.type === 'p' && (
          <textarea
            value={block.html || ''}
            onChange={(e) => update({ html: e.target.value })}
            rows={3}
            placeholder="Paragraph HTML…"
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          />
        )}

        {(block.type === 'h2' || block.type === 'h3') && (
          <div className="flex flex-col gap-2">
            <input
              value={block.text || ''}
              onChange={(e) => update({ text: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })}
              placeholder={`${block.type.toUpperCase()} text…`}
              className="w-full text-sm border border-divider rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <input
              value={block.id || ''}
              onChange={(e) => update({ id: e.target.value })}
              placeholder="ID / anchor (auto-generated)"
              className="w-full text-xs border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent text-subtle"
            />
          </div>
        )}

        {(block.type === 'ul' || block.type === 'ol') && (
          <div className="flex flex-col gap-1.5">
            {(block.items || []).map((item, ii) => (
              <div key={ii} className="flex gap-2 items-center">
                <span className="text-xs text-subtle w-4 shrink-0">{ii + 1}.</span>
                <input
                  value={item}
                  onChange={(e) => {
                    const items = [...(block.items || [])]
                    items[ii] = e.target.value
                    update({ items })
                  }}
                  placeholder={`Item ${ii + 1}`}
                  className="flex-1 text-sm border border-divider rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="button"
                  onClick={() => update({ items: block.items.filter((_, i) => i !== ii) })}
                  className="p-1 text-subtle hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button"
              onClick={() => update({ items: [...(block.items || []), ''] })}
              className="text-xs text-accent hover:text-accent-hover font-medium flex items-center gap-1 mt-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          </div>
        )}

        {block.type === 'callout' && (
          <textarea
            value={block.text || ''}
            onChange={(e) => update({ text: e.target.value })}
            rows={2}
            placeholder="Callout text…"
            className="w-full text-sm border border-divider rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent"
          />
        )}
      </div>
    </div>
  )
}

export default function BlockEditor({ value = [], onChange, label = 'Content Blocks' }) {
  const [addType, setAddType] = useState('p')

  const add = () => {
    onChange([...value, newBlock(addType)])
  }

  const update = (i, block) => onChange(value.map((b, idx) => (idx === i ? block : b)))
  const remove = (i) => onChange(value.filter((_, idx) => idx !== i))
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
      {label && <label className="text-sm font-medium text-muted">{label}</label>}

      <div className="flex flex-col gap-2">
        {value.map((block, i) => (
          <BlockItem
            key={i}
            block={block}
            onChange={(b) => update(i, b)}
            onDelete={() => remove(i)}
            onMoveUp={() => moveUp(i)}
            onMoveDown={() => moveDown(i)}
            isFirst={i === 0}
            isLast={i === value.length - 1}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value)}
          className="text-sm border border-divider-light rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Block
        </button>
      </div>
    </div>
  )
}
