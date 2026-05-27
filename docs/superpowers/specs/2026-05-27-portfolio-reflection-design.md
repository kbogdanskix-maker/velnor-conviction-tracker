# Portfolio Reflection — Design Spec

**Date:** 2026-05-27  
**Status:** Approved  
**Route:** `/optimizer` (sidebar label changes to "Reflect")

---

## Overview

Replace the existing optimizer page (which displays a fabricated efficient frontier and static model portfolios) with an AI-powered portfolio reflection feature. The feature is a persistent, context-aware conversational interface — not a critique or grading system, but a thinking partner that observes the user's portfolio, surfaces connections to live market data and the user's own notes, and asks focused questions to help the user articulate and examine their own reasoning.

The AI approach is **Reflective Analyst**: it opens with a data-driven observation, shares a concise read, then asks one focused question. Tone and depth are calibrated to the user's declared sophistication level.

---

## Page Structure

- **Route:** `/optimizer` (unchanged, avoids broken links)
- **Sidebar label:** "Reflect" (replaces "Optimizer")
- **Page heading:** "Reflect"
- **Layout:** Two-column — context panel (240px fixed) on the left, chat on the right
- **Responsive:** Single-column stack on mobile (context panel collapses above chat)

---

## Context Panel (left, 240px)

Displays everything the AI knows about the user. All data is read-only here — editing lives in its respective page.

### Sections (top to bottom)

**Portfolio**
- Total market value, total return %
- Sharpe ratio, annualised volatility, position count
- Source: SWR portfolio summary cache

**Holdings**
- All positions: ticker, days held (calculated from `holding.created_at` — when the holding was first added to Vela, used as a proxy for entry date), weight %, unrealised P&L %
- Sorted by weight descending
- Profit in emerald-400, loss in rose-500
- Days held shown in zinc-500 next to ticker — surfaces stated-vs-actual behavior gap for the AI
- Source: SWR portfolio summary

**Thesis**
- Count of written theses with teal dot indicator
- "View →" link navigating to `/thesis`
- Nudge note: "More thesis notes = more accurate reflection of your actual reasoning"
- Source: `useCloudStore("theses")`

**Goals**
- Primary goal: name, target amount, target date
- Progress bar + funded % + years remaining
- Source: SWR goals

**Profile**
- Pills: risk tolerance, sophistication level, age, tax bracket, avg hold time
- Avg hold time derived from transaction history (or falls back to "unknown")
- Sophistication pill in teal, avg hold in amber (signals behavioral pattern)
- Source: `useProfile()`

**Quick Notes**
- A two-tier knowledge library that feeds the AI as background context — not a chat input, not directly quoted back to the user
- **Flagged (permanent):** standing convictions and investment worldview — always included in AI context, never auto-pruned. Example: "I always hold NVDA through earnings regardless of short-term volatility."
- **Ephemeral:** working observations, market thoughts, half-baked ideas — auto-pruned when count exceeds 30 notes or note age exceeds 60 days (whichever comes first)
- The reflect page context panel shows a count preview and a "capture" input for quick entry
- Full library management (view, edit, flag, delete) lives in the upcoming Notes tab
- Persisted to `useCloudStore("reflection_notes")` as `{ flagged: Note[], ephemeral: Note[] }`
- `Note`: `{ id, content, created_at, updated_at }`
- AI receives flagged notes always + recent ephemeral notes (last 14 days or last 10, whichever is smaller)

---

## Chat (right panel)

### Conversation persistence
- Stored in `useCloudStore("portfolio_reflection_chat")`
- Schema: `{ messages: Message[], started_at: string, last_active: string }`
- `Message`: `{ role: "user" | "assistant", content: string, timestamp: string }`
- Capped at 50 messages (oldest trimmed first when limit is exceeded)
- "Clear chat" button in top bar resets to empty, triggers a new AI opening message

### Opening message
- On first load (or after clear), the AI generates an opening message automatically
- No user action required — the page feels alive immediately
- Priority order for signal selection:
  1. **Recent notes × live news/macro** — if the user has recent ephemeral notes or flagged convictions that connect to something in today's macro/news feed, open with that connection
  2. **Portfolio event** — a position that moved significantly since last session, or one that just crossed a meaningful threshold (e.g. weight crossed 30%)
  3. **Behavioral gap** — fallback only if nothing notable in notes or market; surfaces the stated-vs-actual hold time pattern
- Concentration alone is never the opening signal — it's too static and would repeat every session

### Message streaming
- Uses `apiStreamPost` — POST to `/ai/reflect` with full context payload
- SSE stream, same pattern as earnings insights (`data: {"text": "..."}` chunks)
- Typing indicator (3-dot bounce animation) while streaming

### Input
- Multi-line textarea (grows up to 4 lines)
- `Cmd+Enter` / `Ctrl+Enter` to send (Enter adds newline)
- Send button disabled while AI is responding
- Empty input blocked

---

## Backend — `/ai/reflect` endpoint

### Route
`POST /ai/reflect` — streaming SSE response

### Request body
```json
{
  "messages": [{ "role": "user|assistant", "content": "..." }],
  "profile": { "age": 30, "riskTolerance": "aggressive", "sophistication": "advanced", "marginalTaxRate": 22 },
  "quick_notes": "Yields rising — thinking large banks for NIM...",
  "thesis_notes": [{ "ticker": "NVDA", "stance": "bullish", "title": "...", "body": "..." }],
  "is_opening": false
}
```

### Backend enrichment (server-side, not in request body)
The backend fetches fresh from DB on each request:
- Full holdings with `avg_cost_basis`, `quantity`, `total_cost`, `ticker`
- Enriched portfolio summary from Redis cache (market values, P&L)
- Goals
- Net worth snapshot
- Macro context: 10Y yield, Fed Funds rate, VIX (via existing macro endpoint data)

### System prompt structure
```
You are Vela's portfolio reflection assistant. Your role is to help the user think clearly 
about their portfolio — not to critique or grade them, but to observe, ask focused questions, 
and surface connections they may not have made.

Investor profile:
- Age: {age}, Risk: {risk}, Sophistication: {sophistication}
- Tax bracket: {tax}%, Avg hold time: {avg_hold} (stated style: {risk})
- Note: if stated style conflicts with behavioral data, reflect this honestly

[If sophistication = advanced]: Write at an institutional level. No hand-holding. 
Reference NIM, duration risk, sector rotation, yield curve dynamics freely.
[If sophistication = intermediate]: Explain concepts briefly when first used.
[If sophistication = beginner]: Keep language accessible, explain jargon.

Portfolio:
{holdings with weights, P&L, days held}

Goals: {goals}
Net worth: {nw_summary}

User's quick notes: {quick_notes}
User's thesis notes: {thesis_notes}

Market context (live):
- 10Y yield: {ten_year}%, VIX: {vix}, Fed Funds: {fed_funds}%

Rules:
- Ask one question at a time. Never ask multiple questions in one message.
- Keep responses under 120 words unless the user asks you to elaborate.
- Never tell the user they made a mistake. Ask questions that help them reach their own conclusions.
- Never give generic financial advice or add disclaimer boilerplate.
- When the user's notes mention a market theme, connect it to their actual portfolio.
- Reference specific tickers and real numbers from their portfolio.
```

### Opening message generation
When `is_opening: true`, the system prompt adds:
```
Generate a single opening message using this priority order:
1. FIRST: Cross-reference the user's notes (flagged convictions + recent ephemeral) with 
   today's macro data and news. If any note connects to a live market signal, open with that.
2. SECOND: If a portfolio position moved significantly since the last session or just crossed 
   a notable threshold, surface that.
3. FALLBACK ONLY: Behavioral gap (stated long-term, actual avg hold {n} months) — use this 
   only if there is nothing notable in notes or market signals.
Never open with concentration alone — it is too static and will repeat every session.
Start with the observation, end with one question. Max 80 words.
```

---

## Profile changes

Add `sophistication` field to `UserProfile` in `useProfile.ts`:
```typescript
export type Sophistication = "beginner" | "intermediate" | "advanced";

export interface UserProfile {
  // ... existing fields
  sophistication: Sophistication;
}

export const DEFAULT_PROFILE: UserProfile = {
  // ... existing defaults
  sophistication: "intermediate",
};
```

Add sophistication selector to My Profile page alongside risk tolerance.

---

## Data flow summary

```
Page load
  → useCloudStore loads saved messages, quick_notes, theses, profile
  → SWR loads portfolio summary, goals
  → If messages empty: POST /ai/reflect { is_opening: true, ... }
  → Stream opening message, append to messages, save to cloud KV

User sends message
  → Append user message to state + cloud KV
  → POST /ai/reflect { messages: [...history], ...context }
  → Stream response, append chunks to last assistant message
  → On done: save final messages to cloud KV
```

---

## Sidebar update

- Label: "Optimizer" → "Reflect"  
- Icon: `Brain` (replaces `Crosshair`)
- Position: unchanged

---

## Out of scope (next spec)

- **Notes tab** — full library UI (view all notes, edit, flag/unflag, delete, attach images/links/charts); the reflect page only provides a quick-capture input and count preview
- Proactive notifications ("yields moved, check your note") — requires background job
- Per-holding conversation threads
- Auto-pruning job for ephemeral notes — for now, pruning runs client-side on page load
