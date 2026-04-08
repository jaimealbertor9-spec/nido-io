// ═══════════════════════════════════════════════════════════════
// BUSINESS CONSTANTS — Shared across server actions & API routes
// ═══════════════════════════════════════════════════════════════

// Business rule: All purchased wallets expire 30 days after purchase.
// This is the deadline to SPEND credits — NOT the listing visibility duration.
export const WALLET_EXPIRY_DAYS = 30;
