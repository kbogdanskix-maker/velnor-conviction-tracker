"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import {
  ArrowLeftRight, RefreshCw, Info, Wifi, WifiOff,
} from "lucide-react";
import { api } from "@/lib/api";
import PageTransition from "@/components/celestial/PageTransition";
import TierGate from "@/components/shared/TierGate";

// ── Currency metadata ────────────────────────────────────────────────────────

interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
}

const CURRENCIES: CurrencyMeta[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "MXN", name: "Mexican Peso", symbol: "$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
];

// Fallback static rates (1 unit → USD) used when API is unavailable
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0, EUR: 1.085, GBP: 1.265, JPY: 0.00667, CHF: 1.132,
  CAD: 0.735, AUD: 0.652, NZD: 0.608, CNY: 0.138, INR: 0.0119,
  KRW: 0.000735, SGD: 0.745, HKD: 0.128, SEK: 0.096, NOK: 0.094,
  MXN: 0.058, BRL: 0.174, PLN: 0.255, TRY: 0.031, ZAR: 0.055,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function convert(amount: number, fromCode: string, toCode: string, rates: Record<string, number>): number {
  const fromRate = rates[fromCode] ?? 1;
  const toRate = rates[toCode] ?? 1;
  // rates are "1 unit = X USD", so: amount * fromRate gives USD, / toRate gives target
  return (amount * fromRate) / toRate;
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface FxResponse {
  base: string;
  rates: Record<string, number>;
}

export default function FxPage() {
  const [amount, setAmount] = useState(1000);
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("EUR");

  const { data, isLoading, mutate } = useSWR<FxResponse>("/fx", api.get, {
    revalidateOnFocus: false,
    dedupingInterval: 300_000, // match the 5-min backend TTL
  });

  const isLive = !!data?.rates && Object.keys(data.rates).length > 1;
  const rates = isLive ? data!.rates : FALLBACK_RATES;

  const from = CURRENCIES.find((c) => c.code === fromCode) ?? CURRENCIES[0];
  const to = CURRENCIES.find((c) => c.code === toCode) ?? CURRENCIES[1];

  const result = useMemo(() => convert(amount, fromCode, toCode, rates), [amount, fromCode, toCode, rates]);
  const rate = useMemo(() => convert(1, fromCode, toCode, rates), [fromCode, toCode, rates]);
  const inverseRate = useMemo(() => convert(1, toCode, fromCode, rates), [fromCode, toCode, rates]);

  const handleSwap = useCallback(() => {
    setFromCode(toCode);
    setToCode(fromCode);
  }, [fromCode, toCode]);

  // Cross rates table
  const majorCodes = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD"];
  const crossRates = useMemo(() => {
    return majorCodes.map((row) => {
      const cols: Record<string, string | number> = { code: row };
      for (const col of majorCodes) {
        cols[col] = convert(1, row, col, rates);
      }
      return cols;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates]);

  // Quick amounts
  const quickAmounts = [100, 500, 1000, 5000, 10000, 50000];

  return (
    <TierGate requiredTier="voyager">
    <PageTransition className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <h1 className="text-2xl font-display font-bold text-zinc-100">Currency Converter</h1>
          <div className="flex items-center gap-2 shrink-0">
            {isLive ? (
              <span className="flex items-center gap-1.5 text-xs text-gain">
                <Wifi className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Live rates</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <WifiOff className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{isLoading ? "Loading…" : "Static rates"}</span>
              </span>
            )}
            <button
              onClick={() => mutate()}
              disabled={isLoading}
              className="p-1.5 rounded-md text-zinc-400 hover:text-vela-teal hover:bg-zinc-800 transition-colors disabled:opacity-40"
              title="Refresh rates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mt-1">
          Convert between 20 major currencies with cross-rate reference table
        </p>
      </div>

      {/* Converter card */}
      <div className="vela-card p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* From */}
          <div className="flex-1 w-full">
            <label className="text-xs text-zinc-500 mb-1.5 block">From</label>
            <div className="flex gap-2">
              <select
                value={fromCode}
                onChange={(e) => setFromCode(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal min-w-[140px]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={amount || ""}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 tabular-nums focus:outline-none focus:ring-1 focus:ring-vela-teal"
              />
            </div>
          </div>

          {/* Swap button */}
          <button
            onClick={handleSwap}
            className="p-2.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-vela-teal hover:border-vela-teal/50 transition-colors mt-5 sm:mt-0"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          {/* To */}
          <div className="flex-1 w-full">
            <label className="text-xs text-zinc-500 mb-1.5 block">To</label>
            <div className="flex gap-2">
              <select
                value={toCode}
                onChange={(e) => setToCode(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-vela-teal min-w-[140px]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
              <div className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-vela-teal font-semibold tabular-nums">
                {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        {/* Rate info */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-400">
          <span>1 {from.code} = {rate.toFixed(4)} {to.code}</span>
          <span>1 {to.code} = {inverseRate.toFixed(4)} {from.code}</span>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Quick Reference</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickAmounts.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt)}
              className="p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors text-center"
            >
              <p className="text-sm font-medium text-zinc-200 tabular-nums">
                {from.symbol}{amt.toLocaleString()}
              </p>
              <p className="text-xs text-vela-teal tabular-nums mt-0.5">
                {to.symbol}{convert(amt, fromCode, toCode, rates).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cross rates table */}
      <div className="vela-card p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Major Cross Rates</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left text-xs text-zinc-500 font-medium py-2 pr-4"></th>
              {majorCodes.map((c) => (
                <th key={c} className="text-right text-xs text-zinc-500 font-medium py-2 px-2">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crossRates.map((row) => (
              <tr key={row.code} className="border-b border-zinc-800/50">
                <td className="py-2 pr-4 font-medium text-zinc-200">{row.code}</td>
                {majorCodes.map((col) => {
                  const val = row[col] as number;
                  const isSelf = row.code === col;
                  return (
                    <td key={col} className={`text-right tabular-nums py-2 px-2 ${isSelf ? "text-zinc-600" : "text-zinc-300"}`}>
                      {isSelf ? " -" : val < 1 ? val.toFixed(4) : val.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All currencies list */}
      <div className="vela-card p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">
          {from.code} to All Currencies ({from.symbol}{amount.toLocaleString()})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {CURRENCIES.filter((c) => c.code !== fromCode).map((c) => {
            const val = convert(amount, fromCode, c.code, rates);
            return (
              <button
                key={c.code}
                onClick={() => setToCode(c.code)}
                className={`flex items-center gap-2 p-2.5 rounded-lg text-left transition-colors ${
                  c.code === toCode ? "bg-vela-teal/10 border border-vela-teal/30" : "bg-zinc-800/30 hover:bg-zinc-800 border border-transparent"
                }`}
              >
                <span className="text-xs font-mono text-zinc-500 w-8 text-center">{c.code}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-zinc-400">{c.code}</span>
                  <p className="text-sm font-medium text-zinc-200 tabular-nums truncate">
                    {c.symbol}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
        <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
        <p className="text-xs text-zinc-500">
          {isLive
            ? "Live exchange rates from market data. Rates refresh every 5 minutes and may differ from your broker's rates."
            : "Showing approximate reference rates. Connect to the backend for live market data."
          }
        </p>
      </div>
    </PageTransition>
    </TierGate>
  );
}
