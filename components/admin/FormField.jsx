'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required,
  placeholder,
  hint,
  rows,
  options,
  min,
  max,
  step,
  disabled,
  className = '',
}) {
  const base =
    'w-full rounded-lg border border-divider-light bg-card px-3 py-2 text-sm text-foreground placeholder-subtle focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors disabled:bg-surface disabled:text-subtle'

  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-muted">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {type === 'textarea' ? (
        <textarea
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows || 4}
          disabled={disabled}
          className={`${base} resize-none ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        />
      ) : type === 'select' ? (
        <select
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className={`${base} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        >
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === 'toggle' ? (
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange({ target: { name, value: !value } })}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value ? 'bg-accent' : 'bg-divider-light'
          } disabled:opacity-60`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-card shadow-sm transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      ) : type === 'password' ? (
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            name={name}
            value={value ?? ''}
            onChange={onChange}
            onBlur={onBlur}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            autoComplete="new-password"
            className={`${base} pr-10 ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-muted"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <input
          type={type}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={`${base} ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        />
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
    </div>
  )
}
