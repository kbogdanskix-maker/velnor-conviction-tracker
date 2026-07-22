"use client";

/**
 * Shared auth surface pieces, so /login and /register compose rather than
 * copy-paste class strings (design-system §12).
 *
 * Shape follows §6: inputs are a solid `vela-card` fill with a 1px hairline and
 * a 4px radius, the label sits visibly above the field (never placeholder-as-
 * label), and errors read below. One primary CTA per view; everything else is
 * ghost.
 */

import { Eyebrow } from "@/components/instrument";

/** Mono eyebrow + display heading, left aligned. */
export function AuthHeading({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="space-y-2">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="font-display text-3xl font-bold tracking-tight text-zinc-100">
        {title}
      </h1>
      {sub && <p className="text-sm text-vela-body leading-relaxed">{sub}</p>}
    </div>
  );
}

export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
  required = true,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className="w-full rounded bg-vela-card border border-vela-border px-3 py-2.5
          text-sm text-zinc-100 placeholder-vela-subtle
          focus:outline-none focus:border-vela-teal transition-colors duration-200"
      />
      {hint && <p className="font-mono text-[10px] text-vela-muted">{hint}</p>}
    </div>
  );
}

/** Ghost button. The brand mark stays teal; Google's own mark keeps its colours. */
export function GoogleButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 rounded border border-vela-border
        bg-transparent py-2.5 text-sm text-zinc-200
        hover:border-vela-teal/50 transition-colors duration-200 disabled:opacity-50"
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {loading ? "Redirecting" : label}
    </button>
  );
}

/** Hairline rule with a mono word set into it. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <div className="flex-1 border-t border-vela-border" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vela-muted">
        {label}
      </span>
      <div className="flex-1 border-t border-vela-border" />
    </div>
  );
}

export function AuthSubmit({
  loading,
  idle,
  busy,
}: {
  loading: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded bg-vela-teal py-2.5 text-sm font-medium text-vela-bg
        hover:bg-vela-teal-dim transition-colors duration-200 disabled:opacity-50"
    >
      {loading ? busy : idle}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-loss">
      {message}
    </p>
  );
}
