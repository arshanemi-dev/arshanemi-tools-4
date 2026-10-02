'use client'
import { useRef, useMemo, useEffect } from 'react'

// Idle-debounce wrapper for autosave call sites (grid edits, wizard steps).
// Always calls the latest `callback` (via a ref) even if the identity passed
// in changes between renders, so callers don't need to memoize it themselves.
export default function useDebouncedCallback(callback, delay = 1000) {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef(null)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  // flush/cancel are attached while the function is still local to the
  // memo — mutating it after useCallback returned it is a hook-value
  // mutation (react-hooks/immutability).
  return useMemo(() => {
    const debounced = (...args) => {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay)
    }
    debounced.flush = (...args) => {
      clearTimeout(timeoutRef.current)
      callbackRef.current(...args)
    }
    debounced.cancel = () => clearTimeout(timeoutRef.current)
    return debounced
  }, [delay])
}
