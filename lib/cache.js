import { gzipSync, gunzipSync } from 'node:zlib'
import { Redis } from 'ioredis'
import { env } from './env'

// Server-side cache for stored data that is read far more often than it
// changes (today: Listing Tools' JSON files in Dropbox — every read of one is
// a round trip to Dropbox, see lib/listingTemplates.js). Kept in Redis, so
// every instance of this app shares one copy.
//
// Each namespace has a generation number. A write bumps it (invalidate), and
// an entry only counts while it carries the current one — so a read that was
// already on its way to storage when the write landed can't put the old data
// back afterwards. The TTL is only the safety net for a change that never
// passes through this app (a script, a file edited in Dropbox by hand).
//
// Nothing here is ever written from a caller's own copy of the data: the only
// thing stored is what `load` read back from storage. A cache that can't be
// reached is never an error either — reads go straight to `load`, and Redis
// is left alone for RETRY_AFTER_MS so a dead server costs one timeout, not
// one per request.

const PREFIX = `cache:${env.TOOLS_NAME}`
const RETRY_AFTER_MS = 30_000

// Without Redis the only copy would be this process's own memory, which
// another instance of the app can neither see nor invalidate — it would hand
// a user who just saved through one instance the rows from before that save.
// So that mode is for `next dev` (one process) only: in production, no
// REDIS_URL means nothing is cached and every read goes to storage, as before.
const MEMORY = !env.REDIS_URL && env.NODE_ENV !== 'production'

// On globalThis, not module scope: each route can be bundled with its own
// copy of this module, and the route that invalidates has to reach the same
// memory (and reuse the same Redis connection) as the route that reads.
const state = (globalThis.__barmetoCache ??= { memory: new Map(), loading: new Map(), redis: null, retryAt: 0 })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// `evenIfDown` — for invalidations, which have to be attempted whatever the
// last read found.
function redisClient({ evenIfDown = false } = {}) {
  if (!evenIfDown && Date.now() < state.retryAt) return null
  // A connection that was lost is not re-dialled in the background (see
  // retryStrategy): the next call that gets this far makes a new one.
  if (state.redis?.status === 'end') state.redis = null
  if (!state.redis) {
    const client = new Redis(env.REDIS_URL, {
      protocol: 2, // RESP2 — also spoken by Redis servers older than 6
      connectTimeout: 2000,
      // Also bounds a command waiting for the connection. Generous on
      // purpose: against a hosted Redis a write is occasionally well over a
      // second, and a timeout here is read as "Redis is down" (redisFailed).
      commandTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    })
    // Without a listener ioredis prints a connection failure itself; a failed
    // command is reported once per outage by redisFailed below.
    client.on('error', () => {})
    // Neither an idle connection nor a lost one may be what keeps a process
    // alive — a one-off script (scripts/*.mjs) that touched the cache still
    // has to exit. Hence no background reconnecting, and no hold on the socket.
    client.on('connect', () => client.stream?.unref?.())
    state.redis = client
  }
  return state.redis
}

function redisFailed(err) {
  // The server answered, with an error of its own (a value over its size
  // limit, say): it is up, there is no outage to wait out.
  if (err?.name === 'ReplyError') {
    console.error(`[cache] Redis refused a command: ${err.message}`)
    return
  }
  state.retryAt = Date.now() + RETRY_AFTER_MS
  console.error(`[cache] Redis unavailable (${err?.message || err}) — bypassing the cache for ${RETRY_AFTER_MS / 1000}s`)
}

const genKey = (ns) => `${PREFIX}:${ns}:gen`
const dataKey = (ns) => `${PREFIX}:${ns}:data`

// Entries go to Redis gzipped: a template's content is hundreds of KB of
// very repetitive JSON, and over the network the time a read takes is the
// bytes moved — a small fraction as many this way, for a few ms of CPU.
// Anything still larger than this is simply not cached.
const MAX_STORED_BYTES = 4 * 1024 * 1024
const pack = (entry) => gzipSync(JSON.stringify(entry))
function unpack(raw) {
  if (!raw) return null
  try {
    return JSON.parse(gunzipSync(raw).toString())
  } catch {
    return null // not something this code stored — treated as nothing cached
  }
}

// → { gen, entry } (entry null when nothing is stored), or null when there is
// no cache to use right now.
async function read(ns) {
  if (MEMORY) {
    const held = state.memory.get(ns)
    const live = held?.entry && Date.now() < held.until
    // A copy, as a read from Redis would be — a caller changing what it was
    // handed must not change what the next caller is handed.
    return { gen: held?.gen ?? 0, entry: live ? structuredClone(held.entry) : null }
  }
  const client = env.REDIS_URL ? redisClient() : null
  if (!client) return null
  try {
    const [gen, raw] = await client.mgetBuffer(genKey(ns), dataKey(ns))
    return { gen: Number(gen?.toString()) || 0, entry: unpack(raw) }
  } catch (err) {
    redisFailed(err)
    return null
  }
}

async function write(ns, entry, ttl) {
  if (MEMORY) {
    state.memory.set(ns, { gen: state.memory.get(ns)?.gen ?? 0, entry: structuredClone(entry), until: Date.now() + ttl * 1000 })
    return
  }
  const client = redisClient()
  if (!client) return
  const body = pack(entry)
  if (body.length > MAX_STORED_BYTES) return
  try {
    await client.set(dataKey(ns), body, 'EX', ttl)
  } catch (err) {
    redisFailed(err)
  }
}

// Call after anything that may have changed what `ns` holds. One that doesn't
// land would leave the old copy counting until its TTL, so it is tried twice,
// and whatever the last read found.
export async function invalidate(ns) {
  if (MEMORY) {
    const held = state.memory.get(ns)
    state.memory.set(ns, { ...held, gen: (held?.gen ?? 0) + 1 })
    return
  }
  if (!env.REDIS_URL) return
  let failure
  for (const wait of [0, 300]) {
    if (wait) await sleep(wait)
    try {
      await redisClient({ evenIfDown: true }).incr(genKey(ns))
      return
    } catch (err) {
      failure = err
    }
  }
  redisFailed(failure)
}

// The value for `ns`: from the cache while its entry still counts, from
// `load()` otherwise. → { value, state } — 'hit' (from the cache), 'miss'
// (just loaded, and stored for `ttl` seconds) or 'bypass' (no cache in use —
// just loaded). Throws whatever `load` throws.
//
// Callers that arrive while a load is under way are handed that same load's
// result — the same object — so `value` is to be read, never changed.
export async function cached(ns, { ttl }, load) {
  const found = await read(ns)
  if (!found) return { value: await load(), state: 'bypass' }
  const { gen, entry } = found
  if (entry && entry.gen === gen && Date.now() - entry.at < ttl * 1000) return { value: entry.value, state: 'hit' }

  // A burst of misses shares one load — per generation, so a request that
  // arrives after an invalidation never joins a load that started before it.
  const flight = `${ns}:${gen}`
  let loading = state.loading.get(flight)
  if (!loading) {
    loading = (async () => {
      const value = await load()
      await write(ns, { gen, at: Date.now(), value }, ttl)
      return value
    })().finally(() => state.loading.delete(flight))
    loading.catch(() => {}) // every waiting caller gets the failure; this is not a second, unhandled one
    state.loading.set(flight, loading)
  }
  return { value: await loading, state: 'miss' }
}
