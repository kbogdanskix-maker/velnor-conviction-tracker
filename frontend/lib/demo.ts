import { createBrowserClient } from "@/lib/supabase-browser";

/**
 * Sign in anonymously and provision the sample portfolio.
 *
 * Supabase anonymous sign-in returns an ordinary ES256 access token carrying
 * `is_anonymous: true`, which the backend verifies against the same JWKS as any
 * other session. The seed call is idempotent, so a double click is harmless.
 */
export async function enterDemo(): Promise<void> {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Could not start the demo: ${error.message}`);

  const token = data.session?.access_token;
  if (!token) throw new Error("Could not start the demo: no session returned");

  const res = await fetch("/api/v1/demo/seed", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Could not prepare the demo portfolio (${res.status})`);
  }
}
