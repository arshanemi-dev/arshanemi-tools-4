'use client'
import { useState, useEffect, useRef } from 'react'
import { Save, RefreshCw, Sun, Moon, Type, Sliders, Eye, ChevronDown, Check, Palette } from 'lucide-react'
import PageHeader from '@/components/admin/PageHeader'
import ThemePreview from '@/components/admin/ThemePreview'
import { useToast } from '@/components/admin/Toast'
import { defaultTheme } from '@/data/defaultTheme'
import { COLOR_GROUPS, COLOR_LABELS, FONT_OPTIONS, RADIUS_PRESETS, SCALE_MARKS } from '@/data/themeEditorConfig'
import { themePresets, contrastRatio, bestPresetFor, MIN_TEXT_CONTRAST, MIN_ACCENT_CONTRAST } from '@/data/themePresets'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return isNaN(r) ? null : `${r}, ${g}, ${b}`
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

const SYSTEM_FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif'

function loadGoogleFont(fontFamily) {
  if (fontFamily === 'Inter' || fontFamily === 'System') return
  const id = `gf-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800&display=swap`
  document.head.appendChild(link)
}

// ─── Color Swatch ─────────────────────────────────────────────────────────────

function ColorSwatch({ colorKey, value = '#000000', onChange }) {
  const isLight = luminance(value) > 0.5
  return (
    <label className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface cursor-pointer transition-colors">
      <div className="relative flex-shrink-0 w-8 h-8 rounded-md shadow-sm ring-1 ring-black/10 overflow-hidden"
        style={{ backgroundColor: value }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(colorKey, e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted truncate leading-tight">
          {COLOR_LABELS[colorKey] || colorKey}
        </p>
        <p className="text-[11px] font-mono text-subtle leading-tight">{value}</p>
      </div>
      <div className="w-4 h-4 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100"
        style={{ backgroundColor: value }}>
        <span className="text-[8px]" style={{ color: isLight ? '#000' : '#fff' }}>✏</span>
      </div>
    </label>
  )
}

// ─── Preset Card ──────────────────────────────────────────────────────────────

function PresetCard({ preset, mode, active, onSelect }) {
  const c = preset[mode]
  return (
    <button
      type="button"
      onClick={() => onSelect(preset)}
      className={`group flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all ${
        active ? 'border-accent shadow-sm' : 'border-divider hover:border-divider-light'
      }`}
    >
      <div className="h-9 w-full flex">
        <div className="flex-1" style={{ backgroundColor: c['accent-hover'] }} />
        <div className="flex-1" style={{ backgroundColor: c.accent }} />
        <div className="flex-1" style={{ backgroundColor: c['accent-vivid'] }} />
        <div className="flex-1" style={{ backgroundColor: c.cyan }} />
      </div>
      <div className="px-2.5 py-1.5 bg-card flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground truncate">{preset.name}</span>
        {active && <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
      </div>
    </button>
  )
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-card rounded-xl border border-divider overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-divider bg-surface">
        <Icon className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ThemePage() {
  const { addToast } = useToast()
  const [theme, setTheme] = useState(defaultTheme)
  const [mode, setMode] = useState('dark')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [fontDropOpen, setFontDropOpen] = useState(false)
  const fontRef = useRef(null)

  // Close font dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (fontRef.current && !fontRef.current.contains(e.target)) setFontDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch saved theme
  useEffect(() => {
    fetch('/api/admin/theme')
      .then(r => r.json())
      .then(data => {
        setTheme(data)
        setMode(data.mode || 'dark')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Live-apply color to document (public site preview via CSS vars)
  function applyColorVar(key, value) {
    document.documentElement.style.setProperty(`--color-${key}`, value)
    const rgb = hexToRgb(value)
    if (rgb) {
      if (key === 'accent')        document.documentElement.style.setProperty('--color-accent-rgb', rgb)
      if (key === 'accent-light')  document.documentElement.style.setProperty('--color-accent-light-rgb', rgb)
      if (key === 'accent-vivid')  document.documentElement.style.setProperty('--color-accent-vivid-rgb', rgb)
      if (key === 'cyan')          document.documentElement.style.setProperty('--color-cyan-rgb', rgb)
    }
  }

  // Applies a color edit, then auto-corrects it if it makes text unreadable
  // or the accent invisible against the current background — swapping in
  // restored defaults / the best-contrast preset rather than letting a
  // broken combination stand.
  function updateColor(key, value) {
    const next = { ...(theme[mode] || {}), [key]: value }
    const patch = { [key]: value }
    let warning = null

    if (key === 'accent' || key === 'foreground' || key === 'background') {
      if (contrastRatio(next.foreground, next.background) < MIN_TEXT_CONTRAST) {
        patch.foreground = defaultTheme[mode].foreground
        patch.background = defaultTheme[mode].background
        warning = 'Text and background were nearly identical — restored readable defaults.'
      }
      const bg = patch.background ?? next.background
      if (contrastRatio(next.accent, bg) < MIN_ACCENT_CONTRAST) {
        const suggestion = bestPresetFor(mode, bg)
        if (suggestion) {
          Object.assign(patch, suggestion[mode])
          warning = `That accent was hard to see — switched to "${suggestion.name}" for better contrast.`
        }
      }
    }

    setTheme(prev => ({ ...prev, [mode]: { ...prev[mode], ...patch } }))
    Object.entries(patch).forEach(([k, v]) => applyColorVar(k, v))
    setDirty(true)
    if (warning) addToast(warning, 'error')
  }

  // Applies a curated preset's accent family to both modes at once.
  function applyPreset(preset) {
    setTheme(prev => ({
      ...prev,
      dark:  { ...prev.dark,  ...preset.dark },
      light: { ...prev.light, ...preset.light },
    }))
    Object.entries(preset[mode]).forEach(([k, v]) => applyColorVar(k, v))
    setDirty(true)
    addToast(`Applied "${preset.name}" theme`, 'success')
  }

  function updateScale(value) {
    const scale = parseFloat(value)
    setTheme(prev => ({ ...prev, typography: { ...prev.typography, scale } }))
    document.documentElement.style.setProperty('--si-font-scale', scale)
    setDirty(true)
  }

  function updateFont(fontFamily) {
    loadGoogleFont(fontFamily)
    setTheme(prev => ({ ...prev, typography: { ...prev.typography, fontFamily } }))
    document.documentElement.style.setProperty(
      '--font-sans',
      fontFamily === 'System'
        ? SYSTEM_FONT_STACK
        : `${fontFamily}, ui-sans-serif, system-ui, sans-serif`
    )
    setFontDropOpen(false)
    setDirty(true)
  }

  function applyRadiusPreset(presetKey) {
    const preset = RADIUS_PRESETS[presetKey]
    if (!preset) return
    const next = { preset: presetKey, ...preset.values }
    setTheme(prev => ({ ...prev, borderRadius: next }))
    Object.entries(preset.values).forEach(([k, v]) => {
      const cssKey = k === 'base' ? '--radius' : `--radius-${k}`
      document.documentElement.style.setProperty(cssKey, v)
    })
    setDirty(true)
  }

  function updateSiteMode(newMode) {
    setMode(newMode)
    setTheme(prev => ({ ...prev, mode: newMode }))
    document.documentElement.setAttribute('data-theme', newMode)
    const modeColors = theme[newMode] || {}
    Object.entries(modeColors).forEach(([k, v]) => applyColorVar(k, v))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      // Bust client-side cache so ThemeContext picks up new values
      localStorage.removeItem('si-theme-config')
      addToast('Theme saved — changes are live!', 'success')
      setDirty(false)
    } catch (err) {
      addToast(err.message || 'Failed to save theme', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('Reset all theme settings to factory defaults?')) return
    setTheme(defaultTheme)
    // Re-apply defaults to document
    Object.entries(defaultTheme[mode]).forEach(([k, v]) => applyColorVar(k, v))
    document.documentElement.style.setProperty('--si-font-scale', '1')
    document.documentElement.style.setProperty('--font-sans', SYSTEM_FONT_STACK)
    await fetch('/api/admin/theme', { method: 'DELETE' })
    localStorage.removeItem('si-theme-config')
    addToast('Reset to defaults', 'success')
    setDirty(false)
  }

  const colors = theme[mode] || {}
  const { typography = {}, borderRadius = {} } = theme
  const scale = typography.scale ?? 1.0
  const fontFamily = typography.fontFamily || 'System'
  const fontFamilyCSS = fontFamily === 'System' ? SYSTEM_FONT_STACK : `${fontFamily}, sans-serif`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Theme Settings</h1>
          <p className="text-sm text-subtle mt-0.5">
            Customise colors, typography & layout — changes apply live to the public site.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* ── Site Mode Switch ── */}
          <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-surface rounded-xl border border-divider">
            <span className="text-[11px] text-subtle font-semibold uppercase tracking-wider pl-1 pr-0.5">
              Live Mode:
            </span>
            {['dark', 'light'].map(m => (
              <button key={m} onClick={() => updateSiteMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  theme.mode === m
                    ? m === 'dark'
                      ? 'bg-foreground text-background shadow-sm'
                      : 'bg-card text-foreground shadow-sm border border-divider'
                    : 'text-subtle hover:text-muted'
                }`}>
                {m === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                {m === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:bg-surface transition-colors border border-divider">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={handleSave} disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* Left — controls */}
        <div className="space-y-5">

          {/* ── Colors ──────────────────────────────────── */}
          <Section icon={Palette} title="Color Palette">
            {/* Quick Themes — curated presets, one click applies a full accent family */}
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-subtle mb-2">
                Quick Themes
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {themePresets.map(preset => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    mode={mode}
                    active={colors.accent === preset[mode].accent}
                    onSelect={applyPreset}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-subtle">
                Pick a starting point, then fine-tune individual colors below. If a manual edit
                makes text or the accent hard to read, we'll automatically swap in the closest
                readable option.
              </p>
            </div>

            {/* Palette editing tabs */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-1 p-1 bg-surface rounded-lg">
                {['dark', 'light'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      mode === m
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-subtle hover:text-muted'
                    }`}>
                    {m === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    {m === 'dark' ? 'Dark Palette' : 'Light Palette'}
                  </button>
                ))}
              </div>
              {theme.mode === mode && (
                <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                  ● Live on site
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
              {COLOR_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-subtle px-2 mb-1 mt-3">
                    {group.label}
                  </p>
                  {group.keys.map(key => (
                    <ColorSwatch
                      key={key}
                      colorKey={key}
                      value={colors[key] || '#000000'}
                      onChange={updateColor}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Section>

          {/* ── Typography ──────────────────────────────── */}
          <Section icon={Type} title="Typography">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Font family */}
              <div>
                <label className="block text-xs font-semibold text-muted mb-2">Font Family</label>
                <div ref={fontRef} className="relative">
                  <button
                    onClick={() => setFontDropOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-divider bg-card hover:border-divider-light text-sm font-medium text-foreground transition-colors"
                    style={{ fontFamily: fontFamilyCSS }}>
                    {fontFamily}
                    <ChevronDown className={`w-4 h-4 text-subtle transition-transform ${fontDropOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {fontDropOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-divider rounded-xl shadow-lg z-20 py-1 max-h-52 overflow-y-auto">
                      {FONT_OPTIONS.map(f => (
                        <button key={f.value} onClick={() => updateFont(f.value)}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface text-sm text-muted transition-colors"
                          style={{ fontFamily: f.value === 'System' ? SYSTEM_FONT_STACK : `${f.value}, sans-serif` }}>
                          <span>{f.label}</span>
                          {fontFamily === f.value && <Check className="w-4 h-4 text-accent" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-subtle">Applied to the entire public site.</p>
              </div>

              {/* Font scale */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-muted">UI Font Scale</label>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                    {(scale * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range" min="0.8" max="1.3" step="0.05"
                  value={scale}
                  onChange={e => updateScale(e.target.value)}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between mt-1">
                  {SCALE_MARKS.map(m => (
                    <span key={m.value}
                      className={`text-[10px] ${Math.abs(m.value - scale) < 0.01 ? 'text-accent font-bold' : 'text-subtle'}`}>
                      {m.label}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-subtle">
                  Scales the base font size (16px × scale). Affects all rem values.
                </p>
              </div>
            </div>

            {/* Font preview strip */}
            <div className="mt-4 p-3 rounded-lg bg-surface border border-divider" style={{ fontFamily: fontFamilyCSS }}>
              <p className="text-xs text-subtle mb-2 uppercase tracking-wider">Preview — {fontFamily}</p>
              <p className="text-2xl font-bold text-foreground leading-tight">Heading Bold 700</p>
              <p className="text-base font-medium text-muted">Semibold 600 — subheading text</p>
              <p className="text-sm text-subtle mt-1">Regular 400 — the quick brown fox jumps over the lazy dog.</p>
              <p className="text-xs text-subtle mt-1">Small 300 — caption and fine print text goes here</p>
            </div>
          </Section>

          {/* ── Border Radius ────────────────────────────── */}
          <Section icon={Sliders} title="Border Radius">
            <div>
              <p className="text-xs text-subtle mb-3">Choose a preset or apply a global corner style.</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Object.entries(RADIUS_PRESETS).map(([key, preset]) => {
                  const active = borderRadius.preset === key
                  const previewR = preset.values.lg
                  return (
                    <button key={key} onClick={() => applyRadiusPreset(key)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        active
                          ? 'border-accent bg-accent/10'
                          : 'border-divider hover:border-divider-light bg-card'
                      }`}>
                      <div className="w-10 h-10 border-2 border-current transition-colors"
                        style={{
                          borderRadius: previewR,
                          borderColor: active ? 'var(--color-accent)' : 'var(--color-divider-light)',
                        }} />
                      <span className={`text-xs font-semibold ${active ? 'text-accent-hover' : 'text-muted'}`}>
                        {preset.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Fine-tune values */}
              <details className="group">
                <summary className="text-xs font-semibold text-subtle cursor-pointer hover:text-muted flex items-center gap-1 list-none">
                  <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                  Fine-tune individual values
                </summary>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['sm', 'base', 'md', 'lg', 'xl', '2xl'].map(k => (
                    <div key={k}>
                      <label className="block text-[11px] font-medium text-subtle mb-1">
                        {k === 'base' ? 'rounded (base)' : `rounded-${k}`}
                      </label>
                      <input
                        type="text"
                        value={borderRadius[k] || ''}
                        onChange={e => {
                          const val = e.target.value
                          setTheme(prev => ({ ...prev, borderRadius: { ...prev.borderRadius, [k]: val } }))
                          const cssKey = k === 'base' ? '--radius' : `--radius-${k}`
                          document.documentElement.style.setProperty(cssKey, val)
                          setDirty(true)
                        }}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-divider rounded-md focus:outline-none focus:ring-1 focus:ring-accent"
                        placeholder="e.g. 8px"
                      />
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </Section>
        </div>

        {/* Right — sticky live preview */}
        <div className="xl:sticky xl:top-6 space-y-3">
          <div className="bg-card rounded-xl border border-divider p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Live Preview</h3>
              </div>
              <div className="flex items-center gap-1 p-0.5 bg-surface rounded-md">
                {['dark', 'light'].map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      mode === m ? 'bg-card text-foreground shadow-sm' : 'text-subtle'
                    }`}>
                    {m === 'dark' ? '☾' : '☀'} {m}
                  </button>
                ))}
              </div>
            </div>
            <ThemePreview theme={theme} mode={mode} />
          </div>

          {/* Scale preview badge */}
          <div className="bg-card rounded-xl border border-divider p-4">
            <p className="text-xs font-semibold text-muted mb-2">Scale Preview</p>
            <div className="space-y-1.5">
              {[{ size: `${(14 * scale).toFixed(1)}px`, label: 'text-sm', sample: 'Small text' },
                { size: `${(16 * scale).toFixed(1)}px`, label: 'text-base', sample: 'Base text' },
                { size: `${(18 * scale).toFixed(1)}px`, label: 'text-lg', sample: 'Large text' },
                { size: `${(24 * scale).toFixed(1)}px`, label: 'text-2xl', sample: 'Heading' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-muted font-medium" style={{ fontSize: r.size, fontFamily: fontFamilyCSS, lineHeight: 1.2 }}>
                    {r.sample}
                  </span>
                  <span className="text-[10px] text-subtle font-mono">{r.label} · {r.size}</span>
                </div>
              ))}
            </div>
          </div>

          {dirty && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 font-medium">
              ⚠ You have unsaved changes. Click "Save Changes" to publish.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
