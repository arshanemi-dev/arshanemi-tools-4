'use client'
import { useRef } from 'react'

// Six single-digit boxes with auto-advance/backspace — shared by every inline
// OTP-verification flow (change mobile, change email, change password).
export default function OtpDigitsInput({ value, onChange, autoFocus }) {
  const inputRefs = useRef([])

  function handleChange(val, idx) {
    if (!/^\d?$/.test(val)) return
    const next = [...value]
    next[idx] = val
    onChange(next)
    if (val && idx < value.length - 1) inputRefs.current[idx + 1]?.focus()
  }

  function handleKeyDown(e, idx) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) inputRefs.current[idx - 1]?.focus()
  }

  return (
    <div className="flex gap-2">
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="w-10 h-11 text-center text-lg font-bold rounded-lg border border-divider-light bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
        />
      ))}
    </div>
  )
}
