// Runs once in the browser before the app hydrates (Next.js
// instrumentation-client convention): PostHog for this tool. See
// lib/embedBridge.js for how it behaves inside the hub's iframe, in the
// desktop app and as a standalone site.
import { initToolAnalytics } from './lib/embedBridge'

initToolAnalytics({ toolSlug: 'ai-product-listing-generator' })
