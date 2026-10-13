// Production always displays the Coming Soon screen. Local development keeps
// the normal app, regardless of any legacy COMING_SOON environment setting.
// Shared by proxy.js, the root layout, and the Coming Soon route.
export const COMING_SOON = process.env.NODE_ENV === 'production'

export const COMING_SOON_PATH = '/coming-soon'
