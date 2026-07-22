"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import { MailCheck } from "lucide-react";
import {
  AuthHeading,
  AuthField,
  AuthSubmit,
  AuthError,
} from "@/components/auth";

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
      <div className="space-y-6">
        <MailCheck className="w-7 h-7 shrink-0 text-vela-teal" aria-hidden="true" />
        <AuthHeading
          eyebrow="One step left"
          title="Check your email"
          sub={`We sent a confirmation link to ${email}. Click it to activate your account.`}
        />
        <div className="h-px w-full bg-vela-border" />
        <Link href="/login" className="text-sm text-vela-teal hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AuthHeading eyebrow="Start the log" title="Create account" />

      <form onSubmit={handleRegister} className="space-y-5">
        <AuthField
          id="name"
          label="Name"
          type="text"
          value={name}
          onChange={setName}
          placeholder="Your name"
          autoComplete="name"
          required={false}
        />
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
          autoComplete="new-password"
          minLength={8}
          hint="8 characters minimum"
        />

        <AuthError message={error} />

        <AuthSubmit
          loading={loading}
          idle="Create account"
          busy="Creating account"
        />

        <p className="text-xs text-vela-muted leading-relaxed">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="text-vela-teal hover:underline">Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-vela-teal hover:underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="text-sm text-vela-body">
        Already have an account?{" "}
        <Link href="/login" className="text-vela-teal hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
