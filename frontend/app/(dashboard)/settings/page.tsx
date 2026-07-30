"use client";

import { useState, useEffect } from "react";
import { Settings as SettingsIcon, User, Shield, Palette, Sparkles, MessageSquare, Check, ShieldCheck } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { createBrowserClient } from "@/lib/supabase-browser";
import { useAnimationPrefs, type AnimationPrefs } from "@/contexts/AnimationContext";
import { useAIStylePrefs, TONE_OPTIONS, type AITone, type DebriefLength } from "@/contexts/AIStyleContext";
import { useAdmin } from "@/contexts/AdminContext";

export default function SettingsPage() {
  const { user } = useUser();
  const supabase = createBrowserClient();
  const { prefs, update: updatePrefs } = useAnimationPrefs();
  const { prefs: aiPrefs, update: updateAIPrefs } = useAIStylePrefs();
  const { adminMode, toggleAdmin } = useAdmin();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.display_name) {
      setDisplayName(user.user_metadata.display_name);
    }
  }, [user]);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: { display_name: displayName },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-vela-teal" />
          Settings
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="vela-card">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">Profile</h2>
        </div>

        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              disabled
              className="input-field w-full opacity-50 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="input-field w-full"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saved ? "Saved!" : saving ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      {/* Currency (read-only for now) */}
      <div className="vela-card">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">Preferences</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Base Currency</label>
            <select className="input-field w-full" defaultValue="USD">
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="PLN">PLN - Polish Zloty</option>
            </select>
          </div>
        </div>
      </div>

      {/* Animation & Effects */}
      <div className="vela-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">Animation &amp; Effects</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Tone down or disable visual effects. Changes apply instantly.
        </p>
        <div className="space-y-3">
          {([
            { key: "reduceMotion" as const, label: "Reduce motion", desc: "Disable all page transitions and card animations" },
            { key: "disableBackgroundEffects" as const, label: "Disable background effects", desc: "Turn off the starfield and ambient gradient orbs" },
            { key: "disableGlow" as const, label: "Disable glow effects", desc: "Remove hover glow and ambient backlighting on cards" },
            { key: "disableTypewriter" as const, label: "Disable typewriter effect", desc: "Show text instantly instead of typing in" },
          ] as { key: keyof AnimationPrefs; label: string; desc: string }[]).map((item) => (
            <label key={item.key} className="flex items-start gap-3 py-2 border-b border-vela-border last:border-0 cursor-pointer group">
              <input
                type="checkbox"
                checked={prefs[item.key]}
                onChange={(e) => updatePrefs({ [item.key]: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/30 focus:ring-offset-0 accent-teal-500"
              />
              <div>
                <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">{item.label}</p>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* AI Style & Debrief */}
      <div className="vela-card">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">AI Style &amp; Debrief</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Customize how Velnor communicates with you and what appears in your daily debrief.
        </p>

        {/* Tone selector */}
        <div className="mb-5">
          <label className="text-xs text-zinc-500 mb-2 block">Communication Tone</label>
          <div className="grid grid-cols-2 gap-2">
            {TONE_OPTIONS.map((opt) => (
              <div
                key={opt.value}
                role="button"
                tabIndex={0}
                onClick={() => updateAIPrefs({ tone: opt.value })}
                onKeyDown={(e) => e.key === "Enter" && updateAIPrefs({ tone: opt.value })}
                className={`relative text-left p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                  aiPrefs.tone === opt.value
                    ? "border-vela-teal/40 bg-vela-teal/5 ring-1 ring-vela-teal/20"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
                }`}
              >
                {aiPrefs.tone === opt.value && (
                  <Check className="absolute top-2 right-2 w-3.5 h-3.5 text-vela-teal" />
                )}
                <p className={`text-sm font-medium ${aiPrefs.tone === opt.value ? "text-vela-teal" : "text-zinc-300"}`}>
                  {opt.label}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</p>
                <p className="text-[10px] text-zinc-600 mt-1.5 italic leading-relaxed">&ldquo;{opt.example}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>

        {/* Debrief toggles */}
        <div className="space-y-3 pt-3 border-t border-vela-border">
          <label className="flex items-start gap-3 py-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={aiPrefs.showDebrief}
              onChange={(e) => updateAIPrefs({ showDebrief: e.target.checked })}
              className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/30 focus:ring-offset-0 accent-teal-500"
            />
            <div>
              <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">Show daily debrief on dashboard</p>
              <p className="text-xs text-zinc-500">A curated summary of market news and portfolio activity</p>
            </div>
          </label>

          {aiPrefs.showDebrief && (
            <>
              <div className="pl-7">
                <label className="text-xs text-zinc-500 mb-1.5 block">Debrief Length</label>
                <div className="flex gap-2">
                  {(["brief", "standard", "detailed"] as DebriefLength[]).map((len) => (
                    <div
                      key={len}
                      role="button"
                      tabIndex={0}
                      onClick={() => updateAIPrefs({ debriefLength: len })}
                      onKeyDown={(e) => e.key === "Enter" && updateAIPrefs({ debriefLength: len })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all ${
                        aiPrefs.debriefLength === len
                          ? "bg-vela-teal/15 text-vela-teal border border-vela-teal/30"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {len.charAt(0).toUpperCase() + len.slice(1)}
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-3 py-2 pl-7 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={aiPrefs.includeMacro}
                  onChange={(e) => updateAIPrefs({ includeMacro: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/30 focus:ring-offset-0 accent-teal-500"
                />
                <div>
                  <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">Include macro &amp; political news</p>
                  <p className="text-xs text-zinc-500">Fed decisions, geopolitical events, economic data</p>
                </div>
              </label>

              <label className="flex items-start gap-3 py-2 pl-7 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={aiPrefs.includePortfolioNews}
                  onChange={(e) => updateAIPrefs({ includePortfolioNews: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-vela-teal focus:ring-vela-teal/30 focus:ring-offset-0 accent-teal-500"
                />
                <div>
                  <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">Include portfolio-specific news</p>
                  <p className="text-xs text-zinc-500">Earnings, analyst upgrades, SEC filings for your holdings</p>
                </div>
              </label>
            </>
          )}
        </div>
      </div>

      {/* Admin Mode */}
      <div className={`vela-card ${adminMode ? "ring-1 ring-amber-500/30" : ""}`}>
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className={`w-4 h-4 ${adminMode ? "text-amber-400" : "text-zinc-400"}`} />
          <h2 className="text-sm font-medium text-zinc-300">Admin Mode</h2>
          {adminMode && <span className="text-[10px] font-medium bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">ACTIVE</span>}
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Enable admin mode to unlock all tiered features for testing and preview.
          Tier badges will be hidden and all V+ / N+ features become accessible.
        </p>
        <label className="flex items-start gap-3 py-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={adminMode}
            onChange={toggleAdmin}
            className="mt-0.5 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/30 focus:ring-offset-0 accent-amber-500"
          />
          <div>
            <p className="text-sm text-zinc-200 group-hover:text-zinc-100 transition-colors">
              Enable admin mode
            </p>
            <p className="text-xs text-zinc-500">Access all features regardless of tier</p>
          </div>
        </label>
      </div>

      {/* Account */}
      <div className="vela-card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-medium text-zinc-300">Account</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-vela-border">
            <div>
              <p className="text-sm text-zinc-200">Plan</p>
              <p className="text-xs text-zinc-500">Free tier - all features included during beta</p>
            </div>
            <span className="text-[10px] font-medium bg-vela-teal/15 text-vela-teal px-2 py-0.5 rounded">Beta</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-zinc-200">Member since</p>
              <p className="text-xs text-zinc-500">{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : " -"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
