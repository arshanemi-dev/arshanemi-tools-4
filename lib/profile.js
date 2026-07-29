// Shared shape for "current user" API responses (GET/PATCH /api/auth/me,
// contact-change verification) — keeps the wallet math and field list in one place.
// `walletExpiresAt` is optional — the caller fetches it separately (an extra
// query, only worth doing where it's actually displayed) via
// getLatestWalletExpiry(user.id) and passes it through; omitted callers just
// get `null` here rather than an extra round trip. Mirrors
// arshanemi-admin-pannels' lib/profile.js.
export function serializeProfile(user, company, walletExpiresAt = null) {
  const total = user.wallet_credits_total ?? 0
  const used = user.wallet_credits_used ?? 0
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    address1: user.address1,
    address2: user.address2,
    addressCity: user.address_city,
    addressState: user.address_state,
    addressCountry: user.address_country,
    addressPincode: user.address_pincode,
    // Free-text invoicing/GST business name the user enters themselves —
    // distinct from companyName below, which is the platform tenant relation.
    businessName: user.company_name,
    gstNumber: user.gst_number,
    role: user.role,
    isActive: user.is_active,
    otpEnabled: user.otp_enabled,
    companyId: user.company_id,
    companyName: company?.name || company?.email || null,
    walletCreditsTotal: total,
    walletCreditsUsed: used,
    // Unclamped — a metered charge (e.g. a future storage-billing cron) can
    // push this negative (debt); clamping here would silently hide that from
    // the user. See arshanemi-admin-pannels' storage_billing_migration.sql.
    walletCreditsRemaining: total - used,
    walletExpiresAt,
    createdAt: user.created_at,
  }
}
