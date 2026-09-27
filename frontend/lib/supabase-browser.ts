import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import { supabasePublicKey } from "@/lib/supabase-key";

export function createBrowserClient() {
  return _createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublicKey(),
  );
}
