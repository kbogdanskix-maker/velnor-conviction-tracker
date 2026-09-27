/**
 * The public Supabase key used by the browser, server and proxy clients.
 *
 * This is a publishable key (`sb_publishable_...`). The legacy `anon` key it
 * replaced was itself a JWT signed by the project's legacy JWT secret, which
 * is why that secret could not be revoked while anything still presented it.
 * Legacy API keys were disabled on 2026-09-27, so there is deliberately no
 * fallback here: one key path, and a clear failure if it is unset.
 *
 * Safe to expose. It identifies the project and carries no privileges of its
 * own; access is decided by RLS and the user's JWT.
 */
export function supabasePublicKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.local.example " +
        "to .env.local and set it from Supabase > Settings > API Keys.",
    );
  }
  return key;
}
