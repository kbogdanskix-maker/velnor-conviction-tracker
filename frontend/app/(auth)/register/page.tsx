"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import VelnorMark from "@/components/shared/VelnorMark";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="vela-card text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-vela-teal/10 flex items-center justify-center mx-auto">
          <svg className="w-6 h-6 text-vela-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Check your email</h2>
        <p className="text-zinc-400 text-sm">
          We sent a confirmation link to <span className="text-zinc-200">{email}</span>.
          Click it to activate your account.
        </p>
        <Link href="/login" className="text-vela-teal text-sm hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="vela-card space-y-6">
      <div className="text-center space-y-1">
        <VelnorMark className="w-11 h-8 text-vela-teal mx-auto mb-2" />
        <div className="text-3xl font-display font-bold tracking-tight text-zinc-100">
          <span className="text-vela-teal">V</span>elnor
        </div>
        <p className="text-zinc-400 text-sm">Start your journey.</p>
      </div>

      <h1 className="text-lg font-semibold text-zinc-100">Create account</h1>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400 uppercase tracking-wider">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-zinc-900 border border-vela-border rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-vela-teal transition-colors"
          />
        </div>

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
            minLength={8}
            className="w-full bg-zinc-900 border border-vela-border rounded-md px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-vela-teal transition-colors"
          />
        </div>

        {error && <p className="text-loss text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-vela-teal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
