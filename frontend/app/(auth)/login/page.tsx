"use client";

import { useState } from "react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="vela-card space-y-6">
      {/* Logo + brand */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="text-xl font-display font-black text-zinc-950 leading-none">V</span>
          </div>
          <span className="text-3xl font-display font-bold tracking-tight text-zinc-100">
            <span className="text-vela-teal">V</span>ela
          </span>
        </div>
        <p className="text-zinc-400 text-sm">Your wealth, in motion.</p>
      </div>

      <h1 className="text-lg font-semibold text-zinc-100">Sign in</h1>

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 border border-vela-border rounded-md py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-vela-border" />
        <span className="text-xs text-zinc-500">or</span>
        <div className="flex-1 border-t border-vela-border" />
      </div>

      {/* Email / password */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-zinc-900 border border-vela-border rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-vela-teal transition-colors"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="w-full bg-zinc-900 border border-vela-border rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-vela-teal transition-colors"
          />
        </div>

        {error && (
          <p className="text-loss text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link href="/register" className="text-vela-teal hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
