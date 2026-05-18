"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";

/* ─── tiny SVG icons (no dependency) ────────────────────────────────────── */
const icons = {
  portfolio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16l4-6 4 3 5-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  valuation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  planning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  tax: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M2 9l10-6 10 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 13h4" strokeLinecap="round" />
    </svg>
  ),
  whatif: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9" strokeLinecap="round" />
      <path d="M21 12c0-4.97-4.03-9-9-9" strokeLinecap="round" strokeDasharray="4 3" />
      <path d="M16 16l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M3 12h4l3-8 4 16 3-8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M5 12h14m-6-6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const FEATURES = [
  { icon: icons.portfolio, title: "Portfolio Intelligence", desc: "Personalized daily briefings on your holdings. Earnings, news, and signals — curated for what you own." },
  { icon: icons.valuation, title: "Valuation Tools", desc: "DCF, reverse DCF, and Monte Carlo simulations. Know what a stock is worth before you buy." },
  { icon: icons.planning, title: "Financial Planning", desc: "Goals, retirement modeling, debt payoff strategies, and affordability analysis in one place." },
  { icon: icons.tax, title: "Tax Optimization", desc: "Tax-loss harvesting finder, Roth conversion analysis, and projected tax liability — year-round." },
  { icon: icons.whatif, title: '"What If" Simulator', desc: "Model life decisions before you make them. New job, big purchase, extra savings — see the impact instantly." },
  { icon: icons.pulse, title: "Market Pulse", desc: "Live indices, sector rotation, and sentiment — always know what the market is doing and why it matters to you." },
];

const COMPETITORS = [
  { name: "Stock Analysis", focus: "Research", missing: "No financial planning" },
  { name: "Screener Tools", focus: "Screening", missing: "No portfolio context" },
  { name: "Wealth Advisors", focus: "Advisory", missing: "No DIY research tools" },
  { name: "Budget Apps", focus: "Budgeting", missing: "No investment analysis" },
];

/* ─── Constellation background ──────────────────────────────────────────── */
function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const stars: { x: number; y: number; r: number; phase: number; speed: number }[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight * 4;
    }

    function init() {
      resize();
      stars.length = 0;
      const count = Math.floor((canvas!.width * canvas!.height) / 18000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          r: Math.random() * 1.2 + 0.3,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.005 + 0.002,
        });
      }
    }

    function draw(t: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      for (const s of stars) {
        const alpha = 0.25 + 0.35 * Math.sin(s.phase + t * s.speed);
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(148, 163, 184, ${alpha})`;
        ctx!.fill();
      }
      animId = requestAnimationFrame(draw);
    }

    init();
    animId = requestAnimationFrame(draw);
    window.addEventListener("resize", init);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", init);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.6 }}
    />
  );
}

/* ─── Reveal-on-scroll wrapper ──────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Email form (reusable) ─────────────────────────────────────────────── */
function WaitlistForm({ id, large = false }: { id: string; large?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("error");
      setErrorMsg("Please enter a valid email.");
      return;
    }

    setState("loading");
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.from("waitlist").insert({
        email: email.toLowerCase().trim(),
        referral_source: typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") || "direct" : "direct",
      });

      if (error) {
        if (error.code === "23505") {
          setState("success");
          return;
        }
        throw error;
      }
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  if (state === "success") {
    return (
      <div className={`flex items-center gap-3 ${large ? "text-lg" : "text-sm"}`}>
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gain/15">
          <span className="text-gain">{icons.check}</span>
        </span>
        <span className="text-zinc-200">You&apos;re on the list. We&apos;ll be in touch.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
      <input
        id={id}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
        className={`glass-input flex-1 ${large ? "px-5 py-3.5 text-base" : "px-4 py-3 text-sm"} rounded-xl`}
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className={`btn-primary whitespace-nowrap ${large ? "px-8 py-3.5 text-base" : "px-6 py-3 text-sm"} rounded-xl font-semibold tracking-wide disabled:opacity-50 flex items-center gap-2 justify-center`}
      >
        {state === "loading" ? (
          <span className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
        ) : (
          <>Join the waitlist {icons.arrow}</>
        )}
      </button>
      {state === "error" && <p className="text-loss text-xs sm:col-span-2">{errorMsg}</p>}
    </form>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard");
      else setChecked(true);
    });
  }, [router]);

  if (!checked) return null;

  return (
    <div className="atmospheric-bg noise-overlay min-h-screen text-zinc-100">
      <ConstellationBg />

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-vela-teal/20 flex items-center justify-center text-vela-teal font-bold text-sm border border-vela-teal/30">
            V
          </div>
          <span className="text-xl font-display font-semibold tracking-tight">Vela</span>
        </div>
        <a
          href="/login"
          className="btn-ghost text-sm font-medium"
        >
          Sign in
        </a>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-16 pb-28 md:pt-28 md:pb-40 max-w-4xl mx-auto">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-vela-teal/10 border border-vela-teal/20 text-vela-teal text-xs font-medium tracking-wide mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-vela-teal animate-[ambient-pulse_2s_ease-in-out_infinite]" />
            Coming soon
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Your investments{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-vela-teal via-emerald-400 to-teal-300">
              and
            </span>{" "}
            your life finances.
            <br />
            <span className="text-zinc-500">Finally together.</span>
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed mb-10">
            Portfolio intelligence, valuation tools, financial planning, and tax
            optimization — unified in one platform. Stop juggling apps.
            Start making better decisions.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <WaitlistForm id="hero-email" large />
        </Reveal>

        <Reveal delay={400}>
          <p className="text-zinc-600 text-xs mt-4">
            Free to join. No spam. Unsubscribe anytime.
          </p>
        </Reveal>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pb-28 max-w-6xl mx-auto">
        <Reveal>
          <p className="text-vela-teal text-sm font-medium tracking-widest uppercase mb-3 text-center">
            Everything you need
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            One platform. Zero compromises.
          </h2>
          <p className="text-zinc-500 text-center max-w-xl mx-auto mb-14">
            Every tool a serious investor needs, connected to every tool a
            smart financial planner needs.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="vela-card group h-full">
                <div className="w-10 h-10 rounded-xl bg-vela-teal/10 border border-vela-teal/20 flex items-center justify-center text-vela-teal mb-4 group-hover:bg-vela-teal/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-lg text-zinc-100 mb-2">
                  {f.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Why Vela — fragmentation ──────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pb-28 max-w-5xl mx-auto">
        <Reveal>
          <p className="text-vela-teal text-sm font-medium tracking-widest uppercase mb-3 text-center">
            The problem
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-4 tracking-tight">
            You shouldn&apos;t need four apps to manage your money.
          </h2>
          <p className="text-zinc-500 text-center max-w-xl mx-auto mb-14">
            Today&apos;s tools force you to context-switch between research,
            tracking, planning, and tax — each in a separate silo.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fragmented side */}
          <Reveal delay={100}>
            <div className="rounded-2xl p-6 border border-zinc-800/60 bg-zinc-900/30">
              <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-5">
                Without Vela
              </p>
              <div className="space-y-3">
                {COMPETITORS.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-zinc-800/30 border border-zinc-800/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-300">{c.name}</p>
                      <p className="text-xs text-zinc-600">{c.focus} only</p>
                    </div>
                    <span className="text-xs text-loss/80 bg-loss/10 px-2.5 py-1 rounded-full">
                      {c.missing}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-zinc-600 text-xs mt-4 text-center">4 subscriptions. 4 logins. Zero context.</p>
            </div>
          </Reveal>

          {/* Vela side */}
          <Reveal delay={200}>
            <div className="rounded-2xl p-6 border border-vela-teal/20 bg-vela-teal/[0.03] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-vela-teal/5 via-transparent to-transparent pointer-events-none" />
              <p className="text-sm font-medium text-vela-teal uppercase tracking-wider mb-5 relative">
                With Vela
              </p>
              <div className="space-y-3 relative">
                {[
                  "Portfolio tracking & intelligence",
                  "DCF, Monte Carlo & valuation",
                  "Goals, retirement & debt payoff",
                  "Tax harvesting & projections",
                  "Budgeting, net worth & cash flow",
                  "Screener, watchlist & market pulse",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-vela-teal/[0.06] border border-vela-teal/10"
                  >
                    <span className="text-vela-teal flex-shrink-0">{icons.check}</span>
                    <p className="text-sm text-zinc-200">{item}</p>
                  </div>
                ))}
              </div>
              <p className="text-vela-teal/60 text-xs mt-4 text-center relative">One platform. One login. Full picture.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Aspirational ──────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 py-24 md:py-32">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-5">
              Built for investors who{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-vela-teal to-emerald-400">
                think in decades
              </span>
              , not days.
            </h2>
            <p className="text-zinc-500 text-lg leading-relaxed max-w-2xl mx-auto">
              Vela is for people who take their money seriously — not day traders
              chasing tickers, but long-term builders who want clarity across
              their entire financial life.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-32">
        <Reveal>
          <div className="max-w-xl mx-auto text-center">
            <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Be the first to know.
            </h3>
            <p className="text-zinc-500 mb-8">
              Join the waitlist and get early access when we launch.
            </p>
            <div className="flex justify-center">
              <WaitlistForm id="bottom-email" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/40 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-600 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-vela-teal/15 flex items-center justify-center text-vela-teal font-bold text-[10px]">
              V
            </div>
            <span>Vela &copy; {new Date().getFullYear()}</span>
          </div>
          <p>Your wealth, in motion.</p>
        </div>
      </footer>
    </div>
  );
}
