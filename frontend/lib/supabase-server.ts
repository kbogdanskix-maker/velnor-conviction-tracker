import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicKey } from "@/lib/supabase-key";

export async function createServerClient() {
  const cookieStore = await cookies();
  return _createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublicKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server component  - cookies can only be set in middleware
          }
        },
      },
    },
  );
}
