'use client'

import { useState, useCallback } from 'react'

const MAX_ATTEMPTS = 3
const MAX_MB = 5

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// Uploads product images to Dropbox (via /api/listing-tools/[templateId]/images)
// strictly one file at a time — each file's request is fully awaited before
// the next starts, unlike tools-1's useUpload.js which fires all files in
// parallel. Retry-with-backoff per file mirrors tools-1's contract: retry
// transient failures (network error / 5xx), give up immediately on 4xx.
//
// uploads: [{ id, file, progress, status: queued|uploading|retrying|done|error, error, attempt }]
// onFileDone(result) fires as soon as each individual file finishes — callers
// use it to paste the returned Dropbox URL into its matching row/cell right
// away instead of waiting for the whole batch.
export function useListingImageUpload(uploadUrl) {
  const [uploads, setUploads] = useState([])
  const [uploading, setUploading] = useState(false)

  const uploadFiles = useCallback(async (fileList, { onFileDone } = {}) => {
    const files = Array.from(fileList || []).filter(Boolean)
    if (files.length === 0 || !uploadUrl) return []

    const entries = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'queued',
      error: null,
      attempt: 0,
    }))
    setUploads(entries)
    setUploading(true)

    const results = []

    for (const entry of entries) {
      if (entry.file.size > MAX_MB * 1024 * 1024) {
        setUploads((prev) => prev.map((u) =>
          u.id === entry.id ? { ...u, status: 'error', error: `Exceeds ${MAX_MB}MB` } : u
        ))
        results.push({ id: entry.id, ok: false, filename: entry.file.name })
        continue
      }

      const result = await new Promise((resolve) => {
        let attempt = 0

        function tryUpload() {
          attempt++
          setUploads((prev) => prev.map((u) =>
            u.id === entry.id
              ? { ...u, status: attempt > 1 ? 'retrying' : 'uploading', attempt, progress: 0, error: null }
              : u
          ))

          const fd = new FormData()
          fd.append('files', entry.file)

          const xhr = new XMLHttpRequest()
          xhr.open('POST', uploadUrl)

          xhr.upload.onprogress = (ev) => {
            if (!ev.lengthComputable) return
            const pct = Math.round((ev.loaded / ev.total) * 100)
            setUploads((prev) => prev.map((u) => (u.id === entry.id ? { ...u, progress: pct } : u)))
          }

          xhr.onload = () => {
            if (xhr.status === 200) {
              let payload = {}
              try { payload = JSON.parse(xhr.responseText) } catch {}
              const uploaded = payload.files?.[0]

              if (uploaded?.url) {
                setUploads((prev) => prev.map((u) =>
                  u.id === entry.id ? { ...u, progress: 100, status: 'done' } : u
                ))
                resolve({ id: entry.id, ok: true, url: uploaded.url, filename: uploaded.filename ?? entry.file.name })
                return
              }

              setUploads((prev) => prev.map((u) =>
                u.id === entry.id ? { ...u, status: 'error', error: uploaded?.error || 'Upload failed' } : u
              ))
              resolve({ id: entry.id, ok: false, filename: entry.file.name })
              return
            }

            let errorMsg = 'Upload failed'
            try { errorMsg = JSON.parse(xhr.responseText)?.error ?? errorMsg } catch {}

            // Retry on server errors (5xx); don't retry 400/401/403/404 — those are permanent.
            if (attempt < MAX_ATTEMPTS && (xhr.status === 0 || xhr.status >= 500)) {
              delay(800 * 2 ** (attempt - 1) + Math.random() * 400).then(tryUpload)
            } else {
              setUploads((prev) => prev.map((u) =>
                u.id === entry.id ? { ...u, status: 'error', error: errorMsg } : u
              ))
              resolve({ id: entry.id, ok: false, filename: entry.file.name })
            }
          }

          xhr.onerror = () => {
            if (attempt < MAX_ATTEMPTS) {
              delay(800 * 2 ** (attempt - 1) + Math.random() * 400).then(tryUpload)
            } else {
              setUploads((prev) => prev.map((u) =>
                u.id === entry.id ? { ...u, status: 'error', error: 'Network error' } : u
              ))
              resolve({ id: entry.id, ok: false, filename: entry.file.name })
            }
          }

          xhr.send(fd)
        }

        tryUpload()
      })

      results.push(result)
      if (result.ok) onFileDone?.(result)
    }

    setUploading(false)
    setTimeout(() => setUploads([]), 2500)
    return results
  }, [uploadUrl])

  return { uploads, uploading, uploadFiles }
}
