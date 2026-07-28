"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-browser";
import SailInstrument from "@/components/celestial/SailInstrument";
import VelnorMark from "@/components/shared/VelnorMark";

/* ─── icons ─────────────────────────────────────────────────────────────── */
const icons = {
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-4 h-4">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <path d="M5 12h14m-6-6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="w-5 h-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" strokeLinejoin="round" />
    </svg>
  ),
};

/* ─── "Set your bearing" — the differentiator, made interactive ─────────────
   Same portfolio. Flip your objective. Watch Velnor re-read it.            */
const BEARINGS = [
  {
    key: "growth",
    label: "Maximize growth",
    deg: "041°",
    reply:
      "You're young with a long runway, so concentration isn't the enemy here, conviction drift is. The real question: would you buy NVDA at today's price with fresh cash? If yes, the weight is earning its place. If you're hesitating, that's the signal worth acting on, not the percentage.",
  },
  {
    key: "income",
    label: "Generate income",
    deg: "118°",
    reply:
      "Built for income, this book is light on yield. Your largest positions pay almost nothing, so the portfolio is asking you to wait for price, not cash. That can be the right call, but it should be a choice. Where is this income actually meant to come from?",
  },
  {
    key: "preserve",
    label: "Preserve capital",
    deg: "337°",
    reply:
      "If the job is protecting what you have, one name carrying this much of the book is the thing to look at first. A bad quarter there moves your whole net worth. Not wrong, but worth deciding on purpose: how much of a drawdown in that position could you sit through without flinching?",
  },
];

/* ─── Wind currents — drifting flow lines behind the hero ───────────────── */
function WindCurrents() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 w-full h-full z-0"
      preserveAspectRatio="none"
      viewBox="0 0 1200 800"
      aria-hidden
    >
      <defs>
        <linearGradient id="wind" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1AA8BB" stopOpacity="0" />
          <stop offset="45%" stopColor="#1AA8BB" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[120, 230, 360, 470, 600, 690].map((y, i) => (
        <path
          key={y}
          d={`M-100 ${y} C 300 ${y - 70 - i * 6}, 700 ${y + 60 + i * 5}, 1300 ${y - 30}`}
          fill="none"
          stroke="url(#wind)"
          strokeWidth={1.1}
          className="wind-line"
          style={{ animationDelay: `${i * 0.9}s`, animationDuration: `${11 + i * 1.4}s` }}
        />
      ))}
    </svg>
  );
}

/* ─── Constellation background (the night sky you navigate by) ──────────── */
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
      const count = Math.floor((canvas!.width * canvas!.height) / 17000);
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
        const alpha = 0.22 + 0.34 * Math.sin(s.phase + t * s.speed);
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
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" style={{ opacity: 0.6 }} />;
}

/* ─── Reveal-on-scroll ──────────────────────────────────────────────────── */
function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reveal above-the-fold content immediately (robust to flaky/slow observers);
    // only defer to the scroll observer for content that starts below the fold.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 },
    );
    obs.observe(el);
    // Safety net: never leave content hidden if the observer never fires.
    const t = setTimeout(() => setVisible(true), 1200);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ─── Waitlist form (unchanged logic — Supabase insert) ─────────────────── */
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
        if (error.code === "23505") { setState("success"); return; }
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
      <div className={`flex items-center gap-3 ${large ? "text-base" : "text-sm"}`}>
        <span className="flex items-center justify-center w-8 h-8 rounded bg-gain/15">
          <span className="text-gain">{icons.check}</span>
        </span>
        <span className="text-zinc-200">You&apos;re on the list. We&apos;ll email you the moment early access opens.</span>
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
        className={`glass-input flex-1 ${large ? "px-5 py-3.5 text-base" : "px-4 py-3 text-sm"} rounded`}
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className={`btn-primary whitespace-nowrap ${large ? "px-8 py-3.5 text-base" : "px-6 py-3 text-sm"} rounded font-semibold tracking-wide disabled:opacity-50 flex items-center gap-2 justify-center`}
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

/* ─── Bearing demo ──────────────────────────────────────────────────────── */
function BearingDemo() {
  const [active, setActive] = useState(0);
  const b = BEARINGS[active];
  return (
    <div className="vela-card overflow-hidden">
      {/* preview tag */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-vela-teal/90 bg-vela-teal/10 border border-vela-teal/25 px-2 py-0.5 rounded">
          Preview · Reflect
        </span>
        <span className="text-[10px] text-vela-muted">a glimpse of Velnor&apos;s portfolio AI</span>
      </div>
      {/* chart header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-800/70">
        <div className="flex items-center gap-2.5 text-zinc-300">
          <span className="text-vela-teal">{icons.compass}</span>
          <span className="text-sm font-medium">Set your bearing</span>
        </div>
        <span className="font-mono text-[11px] text-vela-muted tabular-nums">HEADING {b.deg}</span>
      </div>

      {/* bearing selector */}
      <div className="flex flex-wrap gap-2 pt-4">
        {BEARINGS.map((opt, i) => (
          <button
            key={opt.key}
            onClick={() => setActive(i)}
            className={`text-xs px-3 py-1.5 rounded border transition-all ${
              i === active
                ? "border-vela-teal/50 bg-vela-teal/10 text-vela-teal"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* the read */}
      <div className="mt-4 flex gap-3">
        <div className="w-7 h-7 min-w-7 rounded-full bg-vela-teal flex items-center justify-center text-vela-bg text-[11px] font-semibold mt-0.5">
          V
        </div>
        <p key={b.key} className="bearing-reply text-[13.5px] leading-relaxed text-zinc-300">
          {b.reply}
        </p>
      </div>
      <p className="text-[11px] text-vela-body mt-4 pt-3 border-t border-zinc-800/70">
        Same portfolio. Different bearing. Velnor re-charts the read, grounded in your real numbers, never generic.
      </p>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Allow previewing the landing even while signed in: visit /?preview
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("preview")) {
      setChecked(true);
      return;
    }
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/dashboard");
      else setChecked(true);
    });
  }, [router]);

  if (!checked) return null;

  return (
    <div className="atmospheric-bg noise-overlay min-h-screen text-zinc-100 overflow-x-hidden">
      <ConstellationBg />

      {/* keyframes for the navigation/wind/sail motifs */}
      <style>{`
        @keyframes windDrift {
          0%   { stroke-dasharray: 8 600; stroke-dashoffset: 700; opacity: 0; }
          15%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { stroke-dasharray: 8 600; stroke-dashoffset: -700; opacity: 0; }
        }
        .wind-line { animation: windDrift linear infinite; }
        @keyframes sailBillow {
          0%, 100% { d: path("M40 18 C 220 70, 300 200, 196 344 L40 300 Z"); }
          50%      { d: path("M40 18 C 248 60, 286 210, 182 348 L40 300 Z"); }
        }
        .sail-billow { animation: sailBillow 7s ease-in-out infinite; transform-origin: 40px 180px; }
        @media (prefers-reduced-motion: reduce) { .sail-billow, .wind-line { animation: none; } }
        @keyframes seamShift { 0%,100% { opacity: .12 } 50% { opacity: .3 } }
        .sail-seam { animation: seamShift 7s ease-in-out infinite; }
        @keyframes mastTwinkle { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        .masthead-star { animation: mastTwinkle 2.4s ease-in-out infinite; }
        @keyframes replyIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        .bearing-reply { animation: replyIn .45s ease-out; }
        @keyframes courseDraw { to { stroke-dashoffset: 0 } }
      `}</style>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <VelnorMark className="w-8 h-6 text-vela-teal" />
          <div className="leading-none">
            <span className="text-xl font-display font-semibold tracking-tight">Velnor</span>
          </div>
          <span className="hidden sm:inline ml-2 font-mono text-[10px] text-vela-muted tracking-widest uppercase">Celestial navigation for your money</span>
        </div>
        <a href="/login" className="btn-ghost text-sm font-medium">Sign in</a>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pt-12 md:pt-20 pb-28 md:pb-36 max-w-6xl mx-auto">
        <WindCurrents />
        <div className="relative grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
          {/* copy */}
          <div className="relative">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded bg-vela-teal/10 border border-vela-teal/20 text-vela-teal text-[11px] font-medium tracking-wide mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-vela-teal animate-[ambient-pulse_2s_ease-in-out_infinite]" />
                Pre-launch · charting the course
              </div>
            </Reveal>
            <Reveal delay={90}>
              <h1 className="font-display text-[2.6rem] sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
                Hold your{" "}
                <span className="text-vela-teal italic">winners</span>.
                <br />
                <span className="text-zinc-500">Know if you were right.</span>
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <p className="text-zinc-400 text-lg max-w-xl leading-relaxed mb-9">
                Velnor is where your <span className="text-zinc-200">investing convictions</span>{" "}live.
                Write down why you bought, watch each thesis play out against the price, and see how
                right you&apos;ve actually been over time. Built for investors who make their own calls.
              </p>
            </Reveal>
            <Reveal delay={260}><WaitlistForm id="hero-email" large /></Reveal>
            <Reveal delay={340}>
              <p className="text-vela-muted text-xs mt-4 font-mono tracking-wide">Free to join. No spam. Unsubscribe anytime.</p>
            </Reveal>
          </div>

          {/* hero stage — slot for the show-stopper animation; minimal guiding-star placeholder for now */}
          <Reveal delay={200} className="relative hidden lg:block">
            <div className="relative h-[440px]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_45%,#1AA8BB10_0%,transparent_65%)]" />
              <SailInstrument />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Two waters, one current ───────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pb-28 max-w-5xl mx-auto">
        <Reveal>
          <h2 className="font-display text-3xl md:text-[2.5rem] font-bold text-center mb-4 tracking-tight leading-tight">
            Two waters most people row separately.
          </h2>
          <p className="text-zinc-500 text-center max-w-xl mx-auto mb-12">
            Your brokerage knows your stocks. Your budgeting app knows your spending. Neither knows
            both, so nothing can tell you what a trade actually means for your goals. Velnor connects them.
          </p>
        </Reveal>
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-stretch">
          <Reveal delay={80}>
            <div className="h-full rounded-lg p-5 border border-zinc-800/60 bg-zinc-900/30">
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-4">Markets &amp; research</p>
              <div className="space-y-2.5">
                {["Brokerage apps", "Stock screeners", "Valuation spreadsheets", "Research subscriptions"].map((x) => (
                  <div key={x} className="flex items-center justify-between py-2 px-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                    <span className="text-sm text-zinc-300">{x}</span>
                    <span className="text-[10px] text-loss/80 bg-loss/10 px-2 py-0.5 rounded">no life context</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* the merge node */}
          <Reveal delay={160} className="flex md:flex-col items-center justify-center gap-2">
            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-transparent to-vela-teal/40" />
            <div className="w-12 h-12 rounded bg-vela-teal/15 border border-vela-teal/40 flex items-center justify-center text-vela-teal shrink-0">
              {icons.compass}
            </div>
            <div className="hidden md:block w-px h-12 bg-gradient-to-b from-vela-teal/40 to-transparent" />
          </Reveal>

          <Reveal delay={240}>
            <div className="h-full rounded-lg p-5 border border-zinc-800/60 bg-zinc-900/30">
              <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-4">Life &amp; planning</p>
              <div className="space-y-2.5">
                {["Budgeting apps", "Net-worth trackers", "Retirement calculators", "Goal planners"].map((x) => (
                  <div key={x} className="flex items-center justify-between py-2 px-3 rounded bg-zinc-800/30 border border-zinc-800/50">
                    <span className="text-sm text-zinc-300">{x}</span>
                    <span className="text-[10px] text-loss/80 bg-loss/10 px-2 py-0.5 rounded">no markets</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={300}>
          <div className="mt-6 rounded-md p-5 border border-vela-teal/25 bg-vela-teal/[0.04] relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-vela-teal/[0.06] via-transparent to-transparent" />
            <p className="relative text-sm text-zinc-200">
              <span className="text-vela-teal font-medium">Velnor</span> puts your investing at the center,
              with the rest of your money in view, so every call ties to where you&apos;re actually headed.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Three waypoints on the course ─────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-12 pb-28 max-w-4xl mx-auto">
        <Reveal>
          <p className="text-vela-teal text-xs font-medium tracking-[0.2em] uppercase mb-3 text-center">The course</p>
          <h2 className="font-display text-3xl md:text-[2.5rem] font-bold text-center mb-14 tracking-tight">
            Three waypoints to clarity.
          </h2>
        </Reveal>

        <div className="relative">
          {/* charted course line */}
          <svg className="absolute left-[19px] md:left-1/2 md:-translate-x-1/2 top-2 bottom-2 h-[calc(100%-1rem)] w-6 z-0" viewBox="0 0 8 600" preserveAspectRatio="none" aria-hidden>
            <path d="M4 0 L4 600" stroke="#1AA8BB" strokeOpacity="0.3" strokeWidth="1.4" strokeDasharray="2 7" strokeLinecap="round" />
          </svg>

          <div className="space-y-5 relative z-10">
            {[
              { tag: "Waypoint I", title: "See the whole sky", body: "Portfolio, net worth, goals, and cash flow in one view. No more stitching four apps together just to figure out where you stand." },
              { tag: "Waypoint II", title: "Sail by real instruments", body: "A 5,000-ticker screener, DCF and reverse-DCF valuation, and company deep-dives. The real tools to judge what a stock is worth before you buy, not the toy charts in your brokerage app." },
              { tag: "Waypoint III", title: "See if you were right", body: "Every thesis you write becomes a track record. Velnor maps each holding's journey against the price, scores your hit-rate by how sure you were, and shows what happened after you sold. It engages your own reasoning, always tied to your real numbers, never made up, and never advice." },
            ].map((w, i) => (
              <Reveal key={w.title} delay={i * 90}>
                <div className="flex gap-4 md:gap-6 md:even:flex-row-reverse md:text-right md:even:text-left">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-vela-bg border border-vela-teal/40 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-vela-teal" />
                    </div>
                  </div>
                  <div className="vela-card flex-1 md:max-w-[440px]">
                    <p className="font-mono text-[10px] tracking-widest uppercase text-vela-teal/70 mb-1.5">{w.tag}</p>
                    <h3 className="font-display font-semibold text-lg text-zinc-100 mb-1.5">{w.title}</h3>
                    <p className="text-zinc-500 text-sm leading-relaxed">{w.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Set your bearing (interactive differentiator) ─────────────── */}
      <section className="relative z-10 px-6 md:px-12 pb-28 max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <Reveal>
            <h2 className="font-display text-3xl md:text-[2.4rem] font-bold tracking-tight leading-tight mb-5">
              Most tools give everyone the same answer. Velnor asks where <span className="text-vela-teal italic">you&apos;re headed</span> first.
            </h2>
            <p className="text-zinc-500 leading-relaxed mb-4">
              Pick what you&apos;re investing for, and the same portfolio reads completely differently.
              That&apos;s the point: it engages your objective and your own reasoning, not a
              one-size-fits-all risk score. Try it on the right.
            </p>
            <p className="text-vela-body text-sm">And it never makes up a number. If it doesn&apos;t have the figure, it tells you.</p>
          </Reveal>
          <Reveal delay={150}><BearingDemo /></Reveal>
        </div>
      </section>

      {/* ── For navigators (aspirational) ─────────────────────────────── */}
      <section className="relative z-10 px-6 py-20 md:py-28">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-5">
              For people who&apos;d rather{" "}
              <span className="text-vela-teal italic">navigate</span>{" "}
              than drift.
            </h2>
            <p className="text-zinc-500 text-lg leading-relaxed max-w-2xl mx-auto">
              Velnor is for serious self-directed investors. People who want to see their whole financial
              picture, make their own calls, and use tools that respect how much they care about getting it right.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Bottom CTA ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-32">
        <Reveal>
          <div className="max-w-xl mx-auto text-center relative">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-vela-teal mb-6 animate-[ambient-pulse_3s_ease-in-out_infinite]" />
            <h3 className="font-display text-2xl md:text-3xl font-bold tracking-tight mb-3 relative">Come aboard before we sail.</h3>
            <p className="text-zinc-500 mb-8">Join the waitlist for early access when Velnor launches.</p>
            <div className="flex justify-center"><WaitlistForm id="bottom-email" /></div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-zinc-800/40 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-vela-muted text-xs">
          <div className="flex items-center gap-2">
            <VelnorMark className="w-5 h-4 text-vela-teal" />
            <span>Velnor &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/privacy" className="font-mono tracking-wide hover:text-vela-teal transition-colors">Privacy</a>
            <a href="/terms" className="font-mono tracking-wide hover:text-vela-teal transition-colors">Terms</a>
            <p className="font-mono tracking-wide">Your wealth, in motion.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
