"use client";

import { useState } from "react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import {
  AuthHeading,
  AuthField,
  AuthDivider,
  AuthSubmit,
  AuthError,
  GoogleButton,
} from "@/components/auth";

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
    <div className="space-y-8">
      <AuthHeading eyebrow="Welcome back" title="Sign in" />

      <GoogleButton
        onClick={handleGoogleLogin}
        loading={googleLoading}
        label="Continue with Google"
      />

      <AuthDivider label="or" />

      <form onSubmit={handleEmailLogin} className="space-y-5">
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        <AuthError message={error} />

        <AuthSubmit loading={loading} idle="Sign in" busy="Signing in" />
      </form>

      <p className="text-sm text-vela-body">
        No account?{" "}
        <Link href="/register" className="text-vela-teal hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
