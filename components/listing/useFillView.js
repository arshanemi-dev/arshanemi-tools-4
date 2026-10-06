'use client'
import { useSyncExternalStore } from 'react'

// Which of the two layouts the fill pages (Auto Listing, Product Details)
// show — picked with FillViewToggle.jsx:
//   'boxes' — Product Details as the table, each product's other fields as
//             input boxes under its row (MergedRowFields)
//   'excel' — one full grid per group behind a tab strip, every column in
//             its row, the way the sheet itself looks (SheetTabs + SheetGrid)
// Both layouts edit the same rows, so switching never loses anything typed.
//
// The choice is remembered per browser (localStorage) and shared by both
// pages — read through useSyncExternalStore so the first client render
// matches the server's ('boxes') and no effect has to set state.
const STORAGE_KEY = 'listing-tools-fill-view'
const CHANGE_EVENT = 'listing-tools-fill-view-change'

// Only set when localStorage can't be written (blocked / private mode), so
// the switch still works for as long as the page is open.
let unsavedView = null

function subscribe(onChange) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function readView() {
  if (unsavedView) return unsavedView
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'excel' ? 'excel' : 'boxes'
  } catch {
    return 'boxes'
  }
}

export default function useFillView() {
  const view = useSyncExternalStore(subscribe, readView, () => 'boxes')
  function setView(next) {
    const value = next === 'excel' ? 'excel' : 'boxes'
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
      unsavedView = null
    } catch {
      unsavedView = value
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  return [view, setView]
}
