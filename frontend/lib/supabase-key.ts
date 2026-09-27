/**
 * The public Supabase key used by the browser, server and proxy clients.
 *
 * Supabase replaced the legacy `anon` key with publishable keys
 * (`sb_publishable_...`). The legacy key is a JWT signed by the project's
 * legacy JWT secret, so that secret cannot be revoked while anything still
 * uses it. Preferring the publishable key here is what unblocks revoking it.
 *
 * The fallback keeps a checkout with only the old variable set working, so the
 * migration does not have to be atomic across environments.
 */
export function supabasePublicKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) {
    throw new Error(
      "Missing Supabase public key: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY) in .env.local",
    );
  }
  return key;
}
