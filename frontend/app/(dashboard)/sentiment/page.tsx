"use client";

import { useState, useMemo } from "react";
import PageTransition from "@/components/celestial/PageTransition";
import FloatingCard from "@/components/celestial/FloatingCard";
import RevealOnScroll from "@/components/celestial/RevealOnScroll";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie,
} from "recharts";
import {
  MessageCircle, TrendingUp, TrendingDown, Zap,
  AlertTriangle, ThumbsUp, ThumbsDown, Minus, Search,
  Flame, Info, HelpCircle,
} from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";

/* ── types & helpers ────────────────────────────────────────── */

type Sentiment = "bullish" | "bearish" | "neutral";

interface TickerSentiment {
  ticker: string;
  name: string;
  overall: number;
  sentiment: Sentiment;
  mentions: number;
  mentionChange: number;
  buzz: number;
  sources: { reddit: number; twitter: number; news: number; stocktwits: number };
  trending: boolean;
  keywords: string[];
  weeklyHistory: number[];
  marketCap: number;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : fmt(n);

function sentimentColor(score: number): string {
  if (score >= 40) return "text-emerald-400";
  if (score >= 10) return "text-emerald-400/70";
  if (score > -10) return "text-zinc-400";
  if (score > -40) return "text-rose-400/70";
  return "text-rose-400";
}

function sentimentBg(score: number): string {
  if (score >= 40) return "bg-emerald-500/15";
  if (score >= 10) return "bg-emerald-500/10";
  if (score > -10) return "bg-zinc-500/10";
  if (score > -40) return "bg-rose-500/10";
  return "bg-rose-500/15";
}

function sentimentLabel(score: number): string {
  if (score >= 60) return "Very Bullish";
  if (score >= 30) return "Bullish";
  if (score >= 10) return "Slightly Bullish";
  if (score > -10) return "Neutral";
  if (score > -30) return "Slightly Bearish";
  if (score > -60) return "Bearish";
  return "Very Bearish";
}

function sentimentIcon(score: number) {
  if (score >= 10) return <ThumbsUp className="w-3.5 h-3.5" />;
  if (score > -10) return <Minus className="w-3.5 h-3.5" />;
  return <ThumbsDown className="w-3.5 h-3.5" />;
}

/* ── seed data generator ───────────────────────────────────── */

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MARKET_CAPS: Record<string, number> = {
  AAPL: 3400, MSFT: 3200, NVDA: 3100, GOOGL: 2100, AMZN: 2000,
  META: 1500, TSLA: 800, BRK: 780, AVGO: 700, LLY: 680,
  JPM: 600, V: 560, MA: 420, UNH: 500, XOM: 470,
  HD: 380, PG: 370, COST: 360, JNJ: 380, ABBV: 310,
  WMT: 480, MRK: 280, AMD: 220, PLTR: 140, SOFI: 12,
  GME: 8, SMCI: 18, RIVN: 14, LCID: 5, MARA: 4,
  COIN: 50, SQ: 35, SHOP: 90, SNOW: 45, CRM: 280,
};

function getMcapTier(mcap: number) {
  if (mcap > 500) return { baseMentions: 20000 + (mcap / 500) * 15000, volatilityFactor: 0.7 };
  if (mcap > 100) return { baseMentions: 5000 + (mcap / 100) * 3000, volatilityFactor: 0.85 };
  if (mcap > 20) return { baseMentions: 1000 + (mcap / 20) * 800, volatilityFactor: 1.0 };
  if (mcap > 2) return { baseMentions: 200 + (mcap / 2) * 150, volatilityFactor: 1.3 };
  return { baseMentions: 50 + mcap * 75, volatilityFactor: 1.8 };
}

const RETAIL_FAVORITES = new Set(["GME", "AMC", "TSLA", "PLTR", "SOFI", "RIVN", "LCID", "MARA", "COIN", "NIO"]);

function generateSentiment(ticker: string, name: string): TickerSentiment {
  const h = hashCode(ticker);
  const mcap = MARKET_CAPS[ticker] || (1 + (h % 300));
  const { baseMentions, volatilityFactor } = getMcapTier(mcap);

  const rawSentiment = ((h % 200) - 100);
  const overall = Math.max(-100, Math.min(100, Math.round(rawSentiment * 0.6 + ((h * 7 % 40) - 20) * 0.4)));

  const mentionNoise = 0.7 + (h % 60) / 100;
  let mentions = Math.round(baseMentions * mentionNoise);
  if (RETAIL_FAVORITES.has(ticker)) mentions = Math.round(mentions * (2 + (h % 30) / 10));

  const buzz = Math.min(100, Math.round(((h * 13) % 100) * volatilityFactor));

  const isRetail = RETAIL_FAVORITES.has(ticker) || mcap < 20;
  const rBase = isRetail ? 35 + (h % 15) : 15 + (h % 10);
  const tBase = 20 + (h % 15);
  const nBase = isRetail ? 10 + (h % 10) : 30 + (h % 15);
  const sBase = isRetail ? 25 + (h % 10) : 15 + (h % 10);
  const srcTotal = rBase + tBase + nBase + sBase;

  const weeklyHistory = Array.from({ length: 7 }, (_, i) => {
    const dayNoise = ((h * (i + 1) * 17) % 30) - 15;
    const drift = ((h * (i + 3)) % 10) - 5;
    return Math.max(-100, Math.min(100, overall + dayNoise + drift * (i / 7)));
  });

  const bullKw = ["upgrade", "beat", "growth", "momentum", "breakout", "buy"];
  const bearKw = ["downgrade", "miss", "decline", "resistance", "sell", "risk"];
  const neutralKw = ["hold", "consolidation", "range-bound", "earnings", "guidance", "volume"];
  const kwPool = overall >= 20 ? bullKw : overall <= -20 ? bearKw : neutralKw;

  return {
    ticker, name,
    overall,
    sentiment: overall >= 10 ? "bullish" : overall <= -10 ? "bearish" : "neutral",
    mentions,
    mentionChange: Math.round(((h * 23) % 120) - 60),
    buzz,
    sources: {
      reddit: Math.round((rBase / srcTotal) * mentions),
      twitter: Math.round((tBase / srcTotal) * mentions),
      news: Math.round((nBase / srcTotal) * mentions),
      stocktwits: Math.round((sBase / srcTotal) * mentions),
    },
    trending: buzz > 75 || RETAIL_FAVORITES.has(ticker),
    keywords: [kwPool[h % kwPool.length], kwPool[((h >> 4) % kwPool.length)], kwPool[((h >> 8) % kwPool.length)]]
      .filter((kw, i, arr) => arr.indexOf(kw) === i).slice(0, 3),
    weeklyHistory,
    marketCap: mcap,
  };
}

const TRENDING_TICKERS = [
  { ticker: "AAPL", name: "Apple Inc." },
  { ticker: "NVDA", name: "NVIDIA Corp." },
  { ticker: "TSLA", name: "Tesla Inc." },
  { ticker: "MSFT", name: "Microsoft Corp." },
  { ticker: "AMD", name: "Advanced Micro Devices" },
  { ticker: "AMZN", name: "Amazon.com" },
  { ticker: "META", name: "Meta Platforms" },
  { ticker: "GOOGL", name: "Alphabet Inc." },
  { ticker: "PLTR", name: "Palantir Technologies" },
  { ticker: "GME", name: "GameStop Corp." },
  { ticker: "SOFI", name: "SoFi Technologies" },
  { ticker: "SMCI", name: "Super Micro Computer" },
];

/* ── Sparkline ──────────────────────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 24, w = 60;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Gauge ──────────────────────────────────────────────────── */

function SentimentGauge({ score }: { score: number }) {
  const normalized = (score + 100) / 200;
  const needleAngle = Math.PI * (1 - normalized);
  const cx = 100, cy = 90, r = 70, needleLen = 55;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy - needleLen * Math.sin(needleAngle);
  const arcPt = (a: number) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });

  const segments = [
    { from: Math.PI, to: Math.PI * 0.75, color: "#ef4444" },
    { from: Math.PI * 0.75, to: Math.PI * 0.55, color: "#f97316" },
    { from: Math.PI * 0.55, to: Math.PI * 0.45, color: "#a3a3a3" },
    { from: Math.PI * 0.45, to: Math.PI * 0.25, color: "#34d399" },
    { from: Math.PI * 0.25, to: 0, color: "#10b981" },
  ];
  const needleColor = score >= 10 ? "#14b8a6" : score > -10 ? "#a3a3a3" : "#ef4444";

  return (
    <div className="w-44 h-28 mx-auto">
      <svg viewBox="0 0 200 110" className="w-full h-full">
        <path d={`M ${arcPt(Math.PI).x} ${arcPt(Math.PI).y} A ${r} ${r} 0 0 1 ${arcPt(0).x} ${arcPt(0).y}`}
          fill="none" stroke="#27272a" strokeWidth="14" strokeLinecap="round" />
        {segments.map((seg, i) => {
          const start = arcPt(seg.from), end = arcPt(seg.to);
          return (
            <path key={i}
              d={`M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`}
              fill="none" stroke={seg.color} strokeWidth="14" strokeLinecap="butt" opacity="0.5" />
          );
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill={needleColor} />
        <circle cx={cx} cy={cy} r="2.5" fill="#18181b" />
        <text x="18" y="105" fill="#71717a" fontSize="9" textAnchor="middle">-100</text>
        <text x={cx} y="108" fill="#71717a" fontSize="9" textAnchor="middle">0</text>
        <text x="182" y="105" fill="#71717a" fontSize="9" textAnchor="middle">+100</text>
      </svg>
    </div>
  );
}

/* ── Mentions Bar Chart ─────────────────────────────────────── */

function MentionsChart({ data }: { data: TickerSentiment[] }) {
  const chartData = useMemo(() =>
    [...data].sort((a, b) => b.mentions - a.mentions).slice(0, 12).map((s) => ({
      ticker: s.ticker,
      mentions: s.mentions,
      fill: s.sentiment === "bullish" ? "#34d399" : s.sentiment === "bearish" ? "#f87171" : "#71717a",
    })), [data]);

  if (chartData.length === 0) return null;

  return (
    <div>
      <h3 className="font-display font-semibold text-zinc-100 mb-1">Mentions by Ticker</h3>
      <p className="text-[10px] text-zinc-600 mb-3">
        Volume scales with market cap — mega-caps dominate. Outlier small-caps signal unusual retail interest.
      </p>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 9 }}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
              axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="ticker" tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 500 }}
              width={44} axisLine={false} tickLine={false} />
            <Tooltip cursor={false}
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => [fmt(v), "Mentions"]} />
            <Bar dataKey="mentions" radius={[0, 4, 4, 0]} barSize={14}>
              {chartData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.7} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */

export default function SentimentPage() {
  const { summary } = useDefaultPortfolio();
  const holdings = summary?.holdings;
  const [searchTicker, setSearchTicker] = useState("");
  const [activeTab, setActiveTab] = useState<"portfolio" | "trending">("portfolio");
  const [showMethodology, setShowMethodology] = useState(false);

  const portfolioSentiment = useMemo(() => {
    if (!holdings?.length) return [];
    const seen = new Set<string>();
    return holdings
      .filter((h) => { if (seen.has(h.ticker)) return false; seen.add(h.ticker); return true; })
      .map((h) => generateSentiment(h.ticker, h.ticker))
      .sort((a, b) => b.mentions - a.mentions);
  }, [holdings]);

  const trendingSentiment = useMemo(
    () => TRENDING_TICKERS.map((t) => generateSentiment(t.ticker, t.name)).sort((a, b) => b.buzz - a.buzz), [],
  );

  const activeSentiment = activeTab === "portfolio" ? portfolioSentiment : trendingSentiment;
  const filteredSentiment = searchTicker
    ? activeSentiment.filter((s) => s.ticker.toLowerCase().includes(searchTicker.toLowerCase()))
    : activeSentiment;

  const avgSentiment = useMemo(() => {
    if (trendingSentiment.length === 0) return 0;
    const total = trendingSentiment.reduce((s, t) => s + t.mentions, 0);
    return total === 0 ? 0 : Math.round(trendingSentiment.reduce((s, t) => s + t.overall * t.mentions, 0) / total);
  }, [trendingSentiment]);

  const bullishCount = activeSentiment.filter((s) => s.sentiment === "bullish").length;
  const bearishCount = activeSentiment.filter((s) => s.sentiment === "bearish").length;
  const neutralCount = activeSentiment.filter((s) => s.sentiment === "neutral").length;

  const sourceData = useMemo(() => {
    const totals = { reddit: 0, twitter: 0, news: 0, stocktwits: 0 };
    activeSentiment.forEach((s) => {
      totals.reddit += s.sources.reddit;
      totals.twitter += s.sources.twitter;
      totals.news += s.sources.news;
      totals.stocktwits += s.sources.stocktwits;
    });
    return [
      { name: "Reddit", value: totals.reddit, fill: "#ff4500", desc: "r/wallstreetbets, r/stocks, r/investing" },
      { name: "Twitter/X", value: totals.twitter, fill: "#1da1f2", desc: "$CASHTAG mentions, FinTwit" },
      { name: "News", value: totals.news, fill: "#f59e0b", desc: "Reuters, Bloomberg, CNBC, SeekingAlpha" },
      { name: "StockTwits", value: totals.stocktwits, fill: "#14b8a6", desc: "Bull/bear tags, trending streams" },
    ];
  }, [activeSentiment]);

  const distributionData = [
    { name: "V. Bearish", count: activeSentiment.filter((s) => s.overall <= -60).length, fill: "#ef4444" },
    { name: "Bearish", count: activeSentiment.filter((s) => s.overall > -60 && s.overall <= -10).length, fill: "#f87171" },
    { name: "Neutral", count: activeSentiment.filter((s) => s.overall > -10 && s.overall < 10).length, fill: "#71717a" },
    { name: "Bullish", count: activeSentiment.filter((s) => s.overall >= 10 && s.overall < 60).length, fill: "#34d399" },
    { name: "V. Bullish", count: activeSentiment.filter((s) => s.overall >= 60).length, fill: "#10b981" },
  ];

  const topBuzz = [...activeSentiment].sort((a, b) => b.buzz - a.buzz).slice(0, 6);

  return (
    <PageTransition>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100">Social Sentiment</h1>
            <p className="text-zinc-400 text-sm mt-1">Crowd sentiment aggregated from social media, news & financial communities</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowMethodology(!showMethodology)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors">
              <HelpCircle className="w-3.5 h-3.5" /> How it works
            </button>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input value={searchTicker} onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
                placeholder="Filter ticker..."
                className="pl-8 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-vela-teal placeholder:text-zinc-600" />
            </div>
            <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
              {(["portfolio", "trending"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                    activeTab === tab ? "bg-vela-teal/15 text-vela-teal" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}>{tab}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Methodology Explainer ──────────────────────────── */}
        {showMethodology && (
          <FloatingCard delay={0}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-zinc-100 flex items-center gap-2">
                  <Info className="w-4 h-4 text-vela-teal" /> How Sentiment is Calculated
                </h2>
                <button onClick={() => setShowMethodology(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">Hide</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div>
                    <h3 className="text-zinc-200 font-medium text-xs mb-1">Score (−100 to +100)</h3>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      NLP analysis of posts, articles, and comments. Bullish language (upgrade, beat, growth) pushes positive;
                      bearish language (downgrade, miss, risk) pushes negative. Weighted by source credibility.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-zinc-200 font-medium text-xs mb-1">Mentions Count</h3>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Total posts mentioning the ticker. <span className="text-amber-400/80">Scales with market cap</span> — AAPL
                      gets 50k+ while small-caps get hundreds. Small stocks with unusually high mentions signal retail momentum.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-zinc-200 font-medium text-xs mb-1">Buzz Score (0–100)</h3>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Measures <span className="text-amber-400/80">unusual activity</span> vs. baseline — not raw volume.
                      A small stock with 500 mentions when it usually gets 50 scores higher than a mega-cap with steady 40k.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-zinc-200 font-medium text-xs mb-1">Source Weighting</h3>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Reddit/StockTwits dominate for small & meme stocks (retail-driven).
                      News dominates for mega-caps (institutional coverage). Each source has different signal-to-noise.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-[11px] text-zinc-500">
                  <span className="text-amber-400 font-medium">Demo mode:</span> Simulated data based on market cap weighting.
                  Production would connect to Reddit API, Twitter/X API, news aggregators & StockTwits with live NLP scoring.
                </p>
              </div>
            </div>
          </FloatingCard>
        )}

        {/* ── Market Mood ──────────────────────────────────────── */}
        <FloatingCard delay={0}>
          <div className="p-5 flex items-center justify-center gap-6">
            <SentimentGauge score={avgSentiment} />
            <div>
              <p className="text-zinc-400 text-xs font-medium mb-1">MARKET MOOD</p>
              <p className={`text-2xl font-display font-bold ${sentimentColor(avgSentiment)}`}>{sentimentLabel(avgSentiment)}</p>
              <p className={`text-xs mt-1 ${sentimentColor(avgSentiment)}`}>Score: {avgSentiment > 0 ? "+" : ""}{avgSentiment}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Weighted by mention volume</p>
            </div>
          </div>
        </FloatingCard>

        {/* ── Summary Cards ────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />, label: "BULLISH", value: bullishCount, color: "text-emerald-400" },
            { icon: <Minus className="w-3.5 h-3.5 text-zinc-400" />, label: "NEUTRAL", value: neutralCount, color: "text-zinc-300" },
            { icon: <ThumbsDown className="w-3.5 h-3.5 text-rose-400" />, label: "BEARISH", value: bearishCount, color: "text-rose-400" },
            { icon: <MessageCircle className="w-3.5 h-3.5 text-sky-400" />, label: "TOTAL MENTIONS", value: fmt(activeSentiment.reduce((s, t) => s + t.mentions, 0)), color: "text-zinc-100" },
          ].map((card, i) => (
            <FloatingCard key={card.label} delay={0.05 + i * 0.05}>
              <div className="p-5">
                <div className="flex items-center gap-2 text-zinc-400 text-xs font-medium mb-3">{card.icon} {card.label}</div>
                <p className={`text-2xl font-display font-bold tabular-nums ${card.color}`}>{card.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{i < 3 ? `of ${activeSentiment.length} tickers` : "across 4 sources"}</p>
              </div>
            </FloatingCard>
          ))}
        </div>

        {/* ── Hot Buzz Grid ───────────────────────────────────── */}
        <RevealOnScroll>
          <div>
            <h2 className="font-display font-semibold text-zinc-100 mb-1 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" /> Hottest Buzz
            </h2>
            <p className="text-[10px] text-zinc-600 mb-3">Tickers with unusual mention activity relative to their baseline</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {topBuzz.map((s, i) => (
                <FloatingCard key={s.ticker} delay={0.25 + i * 0.05}>
                  <div className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      {s.trending && <Zap className="w-3 h-3 text-amber-400 animate-pulse" />}
                      <span className="text-sm font-bold text-zinc-100">{s.ticker}</span>
                    </div>
                    <Sparkline data={s.weeklyHistory} color={s.overall >= 0 ? "#14b8a6" : "#ef4444"} />
                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sentimentBg(s.overall)} ${sentimentColor(s.overall)}`}>
                      {sentimentIcon(s.overall)} {s.overall > 0 ? "+" : ""}{s.overall}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">{fmtK(s.mentions)} mentions</p>
                    <p className="text-[9px] text-zinc-600">buzz: {s.buzz}/100</p>
                  </div>
                </FloatingCard>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        {/* ── Charts Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RevealOnScroll>
            <FloatingCard delay={0.35}>
              <div className="p-5"><MentionsChart data={activeSentiment} /></div>
            </FloatingCard>
          </RevealOnScroll>

          <RevealOnScroll>
            <FloatingCard delay={0.4}>
              <div className="p-5">
                <h2 className="font-display font-semibold text-zinc-100 mb-1">Mentions by Source</h2>
                <p className="text-[10px] text-zinc-600 mb-3">Where the conversation is happening</p>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75}
                        stroke="#09090b" strokeWidth={2}>
                        {sourceData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }}
                        formatter={(v: number, name: string) => [fmt(v), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {sourceData.map((d) => (
                    <div key={d.name} className="flex items-start gap-2">
                      <span className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: d.fill }} />
                      <div>
                        <span className="text-xs text-zinc-300 font-medium">{d.name}</span>
                        <span className="text-xs text-zinc-500 ml-1.5">{fmtK(d.value)}</span>
                        <p className="text-[10px] text-zinc-600 leading-tight">{d.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FloatingCard>
          </RevealOnScroll>
        </div>

        {/* ── Distribution ────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.42}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">Sentiment Distribution</h2>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" tick={{ fill: "#71717a", fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip cursor={false} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8 }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distributionData.map((d, i) => <Cell key={i} fill={d.fill} fillOpacity={0.7} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Ticker Table ────────────────────────────────────── */}
        <RevealOnScroll>
          <FloatingCard delay={0.45}>
            <div className="p-5">
              <h2 className="font-display font-semibold text-zinc-100 mb-4">
                {activeTab === "portfolio" ? "Portfolio" : "Trending"} Sentiment
              </h2>

              {filteredSentiment.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  {activeTab === "portfolio" ? <p>Add holdings to your portfolio to see sentiment data</p> : <p>No tickers match your filter</p>}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-zinc-400 text-xs">
                          <th className="text-left pb-3 font-medium">Ticker</th>
                          <th className="text-center pb-3 font-medium">Sentiment</th>
                          <th className="text-center pb-3 font-medium">7d Trend</th>
                          <th className="text-right pb-3 font-medium">Mentions</th>
                          <th className="text-right pb-3 font-medium">Buzz</th>
                          <th className="text-left pb-3 font-medium pl-4">Keywords</th>
                          <th className="text-right pb-3 font-medium"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff4500]" />Reddit</span></th>
                          <th className="text-right pb-3 font-medium"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#1da1f2]" />Twitter</span></th>
                          <th className="text-right pb-3 font-medium"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" />News</span></th>
                          <th className="text-right pb-3 font-medium"><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#14b8a6]" />StockTwits</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {filteredSentiment.map((s) => (
                          <tr key={s.ticker} className="hover:bg-white/[0.02] transition-colors">
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                {s.trending && <Zap className="w-3 h-3 text-amber-400" />}
                                <span className="font-medium text-zinc-100">{s.ticker}</span>
                                <span className="text-[9px] text-zinc-600">{s.marketCap >= 1000 ? `${(s.marketCap / 1000).toFixed(1)}T` : `${s.marketCap}B`}</span>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sentimentBg(s.overall)} ${sentimentColor(s.overall)}`}>
                                {sentimentIcon(s.overall)} {s.overall > 0 ? "+" : ""}{s.overall}
                              </span>
                            </td>
                            <td className="py-3 text-center">
                              <Sparkline data={s.weeklyHistory} color={s.overall >= 0 ? "#14b8a6" : "#ef4444"} />
                            </td>
                            <td className="py-3 text-right tabular-nums text-zinc-300">
                              {fmtK(s.mentions)}
                              <span className={`ml-1.5 text-[10px] ${s.mentionChange >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {s.mentionChange >= 0 ? "↑" : "↓"}{Math.abs(s.mentionChange)}%
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${s.buzz}%` }} />
                                </div>
                                <span className="text-xs tabular-nums text-zinc-400 w-6 text-right">{s.buzz}</span>
                              </div>
                            </td>
                            <td className="py-3 pl-4">
                              <div className="flex gap-1 flex-wrap">
                                {s.keywords.map((kw) => (
                                  <span key={kw} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">#{kw}</span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums text-zinc-400 text-xs">{fmtK(s.sources.reddit)}</td>
                            <td className="py-3 text-right tabular-nums text-zinc-400 text-xs">{fmtK(s.sources.twitter)}</td>
                            <td className="py-3 text-right tabular-nums text-zinc-400 text-xs">{fmtK(s.sources.news)}</td>
                            <td className="py-3 text-right tabular-nums text-zinc-400 text-xs">{fmtK(s.sources.stocktwits)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3">
                    {filteredSentiment.map((s) => (
                      <div key={s.ticker} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {s.trending && <Zap className="w-3 h-3 text-amber-400" />}
                            <span className="font-medium text-zinc-100">{s.ticker}</span>
                            <span className="text-[9px] text-zinc-600">{s.marketCap}B</span>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sentimentBg(s.overall)} ${sentimentColor(s.overall)}`}>
                            {sentimentIcon(s.overall)} {s.overall > 0 ? "+" : ""}{s.overall}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <Sparkline data={s.weeklyHistory} color={s.overall >= 0 ? "#14b8a6" : "#ef4444"} />
                          <div className="text-right">
                            <p className="text-xs text-zinc-400 tabular-nums">{fmtK(s.mentions)} mentions</p>
                            <div className="flex gap-1 mt-1 justify-end">
                              {s.keywords.slice(0, 2).map((kw) => (
                                <span key={kw} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500">#{kw}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </FloatingCard>
        </RevealOnScroll>

        {/* ── Disclaimer ──────────────────────────────────────── */}
        <RevealOnScroll>
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-sm text-zinc-400">
            <p className="font-medium text-amber-400 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Disclaimer
            </p>
            <p className="text-xs">
              Sentiment data reflects crowd opinion, not investment advice. Social sentiment can be manipulated.
              Mention volumes naturally correlate with market cap — larger companies generate more discussion.
              High buzz does not indicate a good investment.
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </PageTransition>
  );
}
