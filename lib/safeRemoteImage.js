// Fetching an image from a link a USER typed into a cell — the AI fill
// routes read a row's image server-side to show it to the model. A typed link
// can point anywhere, so a plain fetch() would let anyone with a login make
// this server request internal addresses (localhost, 10.x, the cloud metadata
// address, …) or pull an arbitrarily large file into memory. Everything here
// exists to make that one fetch safe:
//  - http/https only, no credentials in the URL
//  - the host must resolve to public addresses only — checked for the first
//    request and again for every redirect hop (redirects are followed by hand)
//  - the answer must be an image, within a size cap, within a time limit
// SERVER-ONLY (node:dns / node:net).
import { lookup } from 'node:dns/promises'
import net from 'node:net'

export const MAX_REMOTE_IMAGE_MB = 10
const TIMEOUT_MS = 15000
// File hosts hop a few times from a share link to their CDN (this app's own
// Dropbox image links do).
const MAX_REDIRECTS = 5
// A host that serves an image without saying so (application/octet-stream,
// or no type at all) is still accepted when the link itself ends in one of
// these — some file CDNs do exactly that.
const TYPE_BY_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp' }

function isPrivateV4(ip) {
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    || (a === 169 && b === 254) // link-local, cloud metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0))
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224 // multicast, reserved, broadcast
}

export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return isPrivateV4(ip)
  if (!net.isIPv6(ip)) return true
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
  if (mapped) return isPrivateV4(mapped[1])
  if (v.startsWith('::ffff:')) return true // hex-form IPv4-mapped — never a real image host
  return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) // unique-local, link-local
}

// The parsed URL, once it is known to lead somewhere public. Throws a
// message safe to show the user otherwise.
async function assertPublicUrl(rawUrl) {
  let url
  try {
    url = new URL(String(rawUrl))
  } catch {
    throw new Error('That image link is not a valid URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Image links must start with http:// or https://')
  if (url.username || url.password) throw new Error('Image links cannot carry a username or password')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  let addresses
  try {
    addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  } catch {
    throw new Error('Could not find the server that image link points to')
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error('That image link points to a private address')
  }
  return url
}

// `urls` — the link as given and the address it finally redirected to; a CDN
// address often has no file extension left, the original link does.
function imageTypeOf(res, urls) {
  const declared = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (declared.startsWith('image/')) return declared
  if (declared && declared !== 'application/octet-stream' && declared !== 'binary/octet-stream') return null
  for (const url of urls) {
    const type = TYPE_BY_EXT[url.pathname.split('.').pop().toLowerCase()]
    if (type) return type
  }
  return null
}

// → { buffer, mimeType }. Throws with a user-facing message on anything that
// isn't a reachable, public, reasonably sized image.
export async function fetchRemoteImage(rawUrl) {
  const firstUrl = await assertPublicUrl(rawUrl)
  let url = firstUrl
  let res
  for (let hop = 0; ; hop++) {
    res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) })
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!location) break
    if (hop >= MAX_REDIRECTS) throw new Error('That image link redirects too many times')
    url = await assertPublicUrl(new URL(location, url).href)
  }
  if (!res.ok) throw new Error(`Could not fetch image (${res.status})`)

  const mimeType = imageTypeOf(res, [url, firstUrl])
  if (!mimeType) throw new Error('That link is not an image')

  const maxBytes = MAX_REMOTE_IMAGE_MB * 1024 * 1024
  const tooBig = new Error(`That image is larger than ${MAX_REMOTE_IMAGE_MB}MB`)
  if (Number(res.headers.get('content-length') || 0) > maxBytes) throw tooBig
  // Read with the cap enforced as bytes arrive — a missing or false
  // content-length must not be a way around it.
  const chunks = []
  let total = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw tooBig
    }
    chunks.push(value)
  }
  return { buffer: Buffer.concat(chunks), mimeType }
}
