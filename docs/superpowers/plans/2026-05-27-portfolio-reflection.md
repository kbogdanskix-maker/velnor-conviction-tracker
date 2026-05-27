# Portfolio Reflection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static optimizer page with a persistent AI-powered portfolio reflection chat that opens with a context-aware question, tailors its tone to the user's sophistication level, and draws on live macro data, thesis notes, and a two-tier notes library.

**Architecture:** A `POST /ai/reflect` backend endpoint receives the conversation history plus profile/notes/thesis from the frontend, enriches it server-side with holdings (from DB), goals, net worth, and live macro data, then streams a Claude response using a carefully constructed system prompt. The frontend persists the conversation and notes in cloud KV (`useCloudStore`), auto-generates an opening message on first load, and displays a two-column layout: context panel + chat.

**Tech Stack:** FastAPI + Anthropic Python SDK (backend), Next.js 14 App Router + TypeScript + Tailwind + SWR + `useCloudStore` (frontend), Redis for macro data caching.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `frontend/hooks/useProfile.ts` | Add `sophistication` field + `Sophistication` type |
| Modify | `frontend/app/(dashboard)/profile/page.tsx` | Add sophistication selector UI |
| Modify | `frontend/components/shared/Sidebar.tsx` | Rename Optimizer → Reflect, swap icon |
| Create | `frontend/hooks/useReflectionNotes.ts` | Two-tier notes library (flagged + ephemeral) with cloud KV |
| Create | `frontend/hooks/useReflectionChat.ts` | Chat message persistence with cloud KV, 50-message cap |
| Modify | `backend/app/services/ai_service.py` | Add `_build_reflection_system_prompt()` + `stream_reflection()` |
| Modify | `backend/app/routers/ai.py` | Add `POST /ai/reflect` endpoint with Pydantic model |
| Rewrite | `frontend/app/(dashboard)/optimizer/page.tsx` | Full Reflect page: context panel + streaming chat |

---

## Task 1: Add `sophistication` to UserProfile

**Files:**
- Modify: `frontend/hooks/useProfile.ts`

- [ ] **Open `frontend/hooks/useProfile.ts` and add the `Sophistication` type and field**

Replace the existing file content with:

```typescript
"use client";

import { useCloudStore } from "./useCloudStore";

export type RiskTolerance = "conservative" | "moderate" | "aggressive";
export type Sophistication = "beginner" | "intermediate" | "advanced";

export interface UserProfile {
  age: number;
  dependents: number;
  isHomeowner: boolean;
  isUsCitizen: boolean;
  marginalTaxRate: number;
  riskTolerance: RiskTolerance;
  sophistication: Sophistication;
}

export const DEFAULT_PROFILE: UserProfile = {
  age: 30,
  dependents: 0,
  isHomeowner: false,
  isUsCitizen: true,
  marginalTaxRate: 22,
  riskTolerance: "moderate",
  sophistication: "intermediate",
};

export const US_TAX_BRACKETS = [
  { rate: 10,  label: "10% — up to $11,600" },
  { rate: 12,  label: "12% — $11,601–$47,150" },
  { rate: 22,  label: "22% — $47,151–$100,525" },
  { rate: 24,  label: "24% — $100,526–$191,950" },
  { rate: 32,  label: "32% — $191,951–$243,725" },
  { rate: 35,  label: "35% — $243,726–$609,350" },
  { rate: 37,  label: "37% — over $609,350" },
];

export function useProfile() {
  const { data, save, isLoading } = useCloudStore<UserProfile>("user_profile");

  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    ...(data && typeof data === "object" && !Array.isArray(data) ? data : {}),
  };

  function update(patch: Partial<UserProfile>) {
    save({ ...profile, ...patch });
  }

  return { profile, update, isLoading };
}
```

- [ ] **Commit**

```bash
git add frontend/hooks/useProfile.ts
git commit -m "feat: add sophistication field to UserProfile"
```

---

## Task 2: Add sophistication selector to Profile page

**Files:**
- Modify: `frontend/app/(dashboard)/profile/page.tsx`

- [ ] **Add the `SOPHISTICATION_OPTIONS` constant after the existing `RISK_OPTIONS` array** (around line 32, before the `Toggle` function):

```typescript
const SOPHISTICATION_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    desc: "New to investing. Explain concepts, avoid jargon.",
    color: "border-blue-500/40 bg-blue-500/5 text-blue-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    desc: "Comfortable with fundamentals. Brief explanations when needed.",
    color: "border-teal-500/40 bg-teal-500/5 text-teal-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    desc: "Institutional-level fluency. No hand-holding.",
    color: "border-amber-500/40 bg-amber-500/5 text-amber-400",
    inactive: "border-zinc-700 hover:border-zinc-600",
  },
];
```

- [ ] **Add `Sophistication` to the profile import at the top of the file**

```typescript
import { useProfile, US_TAX_BRACKETS, type Sophistication } from "@/hooks/useProfile";
```

- [ ] **Add the sophistication selector section to the JSX — place it directly after the Risk Tolerance section**

Find the closing `</FloatingCard>` of the Risk Tolerance card and add after it:

```tsx
{/* Sophistication */}
<RevealOnScroll>
  <FloatingCard>
    <div className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Investment Sophistication</h2>
        <p className="text-sm text-zinc-500 mt-0.5">Shapes how the AI reflection feature talks to you</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SOPHISTICATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => update({ sophistication: opt.value })}
            className={`rounded-xl border p-4 text-left transition-all ${
              profile.sophistication === opt.value ? opt.color : opt.inactive + " text-zinc-400"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-sm">{opt.label}</span>
              {profile.sophistication === opt.value && <CheckCircle2 className="w-4 h-4" />}
            </div>
            <p className="text-xs opacity-70 leading-relaxed">{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  </FloatingCard>
</RevealOnScroll>
```

- [ ] **Verify the profile page loads and the selector renders at http://localhost:3000/profile**

- [ ] **Commit**

```bash
git add frontend/app/\(dashboard\)/profile/page.tsx
git commit -m "feat: add investment sophistication selector to profile page"
```

---

## Task 3: Update sidebar entry

**Files:**
- Modify: `frontend/components/shared/Sidebar.tsx`

- [ ] **Change the optimizer entry label and icon**

`Brain` is already imported in the file (used for `/behavior`). `Crosshair` is used only for `/optimizer`.

Find this line (around line 143):
```typescript
{ href: "/optimizer", label: "Optimizer", icon: Crosshair, tier: "navigator" },
```

Replace with:
```typescript
{ href: "/optimizer", label: "Reflect", icon: Brain, tier: "navigator" },
```

- [ ] **Remove `Crosshair` from the lucide-react import if it is no longer used elsewhere**

Check with:
```bash
grep -n "Crosshair" frontend/components/shared/Sidebar.tsx
```
If the only remaining reference is the import line itself, remove `Crosshair` from the import.

- [ ] **Verify the sidebar shows "Reflect" with the Brain icon at http://localhost:3000**

- [ ] **Commit**

```bash
git add frontend/components/shared/Sidebar.tsx
git commit -m "feat: rename Optimizer to Reflect in sidebar, swap icon to Brain"
```

---

## Task 4: Create `useReflectionNotes` hook

**Files:**
- Create: `frontend/hooks/useReflectionNotes.ts`

- [ ] **Create the file**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useCloudStore } from "./useCloudStore";

export interface ReflectionNote {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ReflectionNotesStore {
  flagged: ReflectionNote[];
  ephemeral: ReflectionNote[];
}

const EPHEMERAL_MAX = 30;
const EPHEMERAL_MAX_AGE_DAYS = 60;

function pruneEphemeral(notes: ReflectionNote[]): ReflectionNote[] {
  const cutoff = Date.now() - EPHEMERAL_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const fresh = notes.filter((n) => new Date(n.created_at).getTime() > cutoff);
  // Keep most recent EPHEMERAL_MAX
  return fresh.slice(-EPHEMERAL_MAX);
}

export function useReflectionNotes() {
  const { data, save, isLoading } = useCloudStore<ReflectionNotesStore>("reflection_notes");
  const [notes, setNotes] = useState<ReflectionNotesStore>({ flagged: [], ephemeral: [] });
  const synced = useRef(false);

  useEffect(() => {
    if (data && !synced.current) {
      const pruned: ReflectionNotesStore = {
        flagged: data.flagged ?? [],
        ephemeral: pruneEphemeral(data.ephemeral ?? []),
      };
      setNotes(pruned);
      synced.current = true;
    }
  }, [data]);

  function persist(updated: ReflectionNotesStore) {
    setNotes(updated);
    save(updated);
  }

  function addEphemeral(content: string) {
    if (!content.trim()) return;
    const note: ReflectionNote = {
      id: crypto.randomUUID(),
      content: content.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const updated: ReflectionNotesStore = {
      ...notes,
      ephemeral: pruneEphemeral([...notes.ephemeral, note]),
    };
    persist(updated);
  }

  function flagNote(id: string) {
    const note = notes.ephemeral.find((n) => n.id === id);
    if (!note) return;
    persist({
      flagged: [...notes.flagged, { ...note, updated_at: new Date().toISOString() }],
      ephemeral: notes.ephemeral.filter((n) => n.id !== id),
    });
  }

  function unflagNote(id: string) {
    const note = notes.flagged.find((n) => n.id === id);
    if (!note) return;
    persist({
      flagged: notes.flagged.filter((n) => n.id !== id),
      ephemeral: pruneEphemeral([...notes.ephemeral, { ...note, updated_at: new Date().toISOString() }]),
    });
  }

  function deleteNote(id: string) {
    persist({
      flagged: notes.flagged.filter((n) => n.id !== id),
      ephemeral: notes.ephemeral.filter((n) => n.id !== id),
    });
  }

  // Recent ephemeral = last 14 days or last 10, whichever is smaller
  const recentEphemeral = (() => {
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return notes.ephemeral
      .filter((n) => new Date(n.created_at).getTime() > cutoff)
      .slice(-10);
  })();

  return {
    notes,
    recentEphemeral,
    addEphemeral,
    flagNote,
    unflagNote,
    deleteNote,
    isLoading,
  };
}
```

- [ ] **Commit**

```bash
git add frontend/hooks/useReflectionNotes.ts
git commit -m "feat: add useReflectionNotes hook with two-tier flagged/ephemeral library"
```

---

## Task 5: Create `useReflectionChat` hook

**Files:**
- Create: `frontend/hooks/useReflectionChat.ts`

- [ ] **Create the file**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useCloudStore } from "./useCloudStore";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatStore {
  messages: ChatMessage[];
  started_at: string;
  last_active: string;
}

const MAX_MESSAGES = 50;

export function useReflectionChat() {
  const { data, save, isLoading } = useCloudStore<ChatStore>("portfolio_reflection_chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const synced = useRef(false);

  useEffect(() => {
    if (data && !synced.current) {
      setMessages(data.messages ?? []);
      synced.current = true;
    }
  }, [data]);

  function persist(updated: ChatMessage[]) {
    setMessages(updated);
    save({
      messages: updated,
      started_at: data?.started_at ?? new Date().toISOString(),
      last_active: new Date().toISOString(),
    });
  }

  function appendMessage(msg: ChatMessage) {
    const updated = [...messages, msg].slice(-MAX_MESSAGES);
    persist(updated);
    return updated;
  }

  function appendChunkToLast(chunk: string): ChatMessage[] {
    const updated = messages.map((m, i) =>
      i === messages.length - 1 && m.role === "assistant"
        ? { ...m, content: m.content + chunk }
        : m
    );
    setMessages(updated);
    return updated;
  }

  function finaliseLastMessage(updated: ChatMessage[]) {
    persist(updated);
  }

  function clearChat() {
    synced.current = false;
    persist([]);
  }

  return {
    messages,
    appendMessage,
    appendChunkToLast,
    finaliseLastMessage,
    clearChat,
    isLoading,
  };
}
```

- [ ] **Commit**

```bash
git add frontend/hooks/useReflectionChat.ts
git commit -m "feat: add useReflectionChat hook with KV persistence and 50-message cap"
```

---

## Task 6: Backend — `stream_reflection()` in ai_service.py

**Files:**
- Modify: `backend/app/services/ai_service.py`

- [ ] **Add the following functions at the end of `backend/app/services/ai_service.py`**

```python
# ── Portfolio Reflection ─────────────────────────────────────────────────────

def _build_reflection_system_prompt(
    profile: dict,
    holdings: list[dict],
    goals: list[dict],
    nw: dict,
    quick_notes_flagged: list[str],
    quick_notes_ephemeral: list[str],
    thesis_notes: list[dict],
    macro: dict,
    is_opening: bool,
) -> str:
    age = profile.get("age", 30)
    risk = profile.get("riskTolerance", "moderate")
    sophistication = profile.get("sophistication", "intermediate")
    tax = profile.get("marginalTaxRate", 22)

    # Build sophistication instruction
    if sophistication == "advanced":
        tone_instruction = (
            "Write at an institutional level. No hand-holding, no definitions. "
            "Reference NIM, duration risk, sector rotation, yield curve dynamics, "
            "carry trades, factor exposures freely. Assume full fluency."
        )
    elif sophistication == "beginner":
        tone_instruction = (
            "Keep language accessible. Briefly explain any technical term when first used. "
            "Avoid jargon unless you define it in the same sentence."
        )
    else:
        tone_instruction = (
            "Intermediate level — briefly explain concepts when first used, "
            "but don't over-explain things a reasonably informed investor would know."
        )

    # Build holdings block
    now = __import__("datetime").datetime.utcnow()
    holdings_lines = []
    for h in sorted(holdings, key=lambda x: float(x.get("weight_pct", 0)), reverse=True):
        ticker = h.get("ticker", "")
        weight = h.get("weight_pct", 0)
        pnl = h.get("unrealized_pnl_pct")
        days = h.get("days_held")
        line = f"  • {ticker}: {weight:.1f}% weight"
        if pnl is not None:
            line += f", {pnl:+.1f}% unrealised P&L"
        if days is not None:
            line += f", held {days}d"
        holdings_lines.append(line)
    holdings_block = "\n".join(holdings_lines) if holdings_lines else "  No holdings data available."

    # Build goals block
    goals_lines = [
        f"  • {g['name']}: target ${float(g['target_amount']):,.0f} by {g['target_date']} "
        f"({float(g['current_amount']) / float(g['target_amount']) * 100:.0f}% funded)"
        for g in goals
    ] if goals else ["  No goals set."]
    goals_block = "\n".join(goals_lines)

    # Build macro block
    ten_year = next((s["value"] for s in macro.get("yields", []) if s["series_id"] == "DGS10"), None)
    two_year = next((s["value"] for s in macro.get("yields", []) if s["series_id"] == "DGS2"), None)
    spread = next((s["value"] for s in macro.get("yields", []) if s["series_id"] == "T10Y2Y"), None)
    fed_funds = next((s["value"] for s in macro.get("fed", []) if s["series_id"] == "DFEDTARU"), None)

    macro_lines = []
    if ten_year is not None:
        macro_lines.append(f"  • 10Y Treasury: {ten_year:.2f}%")
    if two_year is not None:
        macro_lines.append(f"  • 2Y Treasury: {two_year:.2f}%")
    if spread is not None:
        macro_lines.append(f"  • 10Y–2Y Spread: {spread:.2f}% ({'inverted' if spread < 0 else 'normal'})")
    if fed_funds is not None:
        macro_lines.append(f"  • Fed Funds Target: {fed_funds:.2f}%")
    macro_block = "\n".join(macro_lines) if macro_lines else "  Macro data unavailable."

    # Build notes blocks
    flagged_block = "\n".join(f"  [STANDING CONVICTION] {n}" for n in quick_notes_flagged) if quick_notes_flagged else "  None."
    ephemeral_block = "\n".join(f"  • {n}" for n in quick_notes_ephemeral) if quick_notes_ephemeral else "  None."

    # Build thesis block
    thesis_lines = [
        f"  • {t['ticker']} ({t['stance']}): {t['title']} — {t['body'][:200]}"
        for t in thesis_notes
    ] if thesis_notes else ["  No thesis notes written."]
    thesis_block = "\n".join(thesis_lines)

    prompt = f"""You are Vela's portfolio reflection assistant. Your role is to help the user think clearly about their portfolio — not to critique or grade them, but to observe, ask focused questions, and surface connections they may not have made.

Investor profile:
  • Age: {age}, Risk tolerance: {risk}, Tax bracket: {tax}%
  • Sophistication: {sophistication}

Tone instruction: {tone_instruction}

Portfolio:
{holdings_block}

Net worth: assets ${float(nw.get('total_assets', 0)):,.0f} | liabilities ${float(nw.get('total_liabilities', 0)):,.0f} | net ${float(nw.get('net_worth', 0)):,.0f}

Goals:
{goals_block}

User's standing convictions (flagged notes — always relevant):
{flagged_block}

User's recent working notes (ephemeral — current observations):
{ephemeral_block}

User's thesis notes:
{thesis_block}

Live macro context:
{macro_block}

Behavioural rules — follow these exactly:
  1. Ask one question at a time. Never ask two questions in one message.
  2. Keep responses under 120 words unless the user explicitly asks you to elaborate.
  3. Never tell the user they made a mistake. Ask questions that help them reach their own conclusions.
  4. Never add generic financial disclaimers, "consult a financial advisor", or boilerplate caveats.
  5. When the user's notes mention a market theme, actively connect it to their actual portfolio holdings.
  6. Reference specific tickers and real numbers from their portfolio — never speak in generalities."""

    if is_opening:
        prompt += """

OPENING MESSAGE INSTRUCTIONS:
Generate a single opening message. Use this priority order for signal selection:
  1. FIRST: Cross-reference the user's notes (flagged convictions + recent working notes) with live macro data. If any note connects to a current macro signal, open with that connection specifically.
  2. SECOND: If a position has moved significantly or crossed a notable threshold (e.g. weight > 30%), surface that.
  3. FALLBACK ONLY: If nothing notable in notes or market, surface the behavioural gap (stated risk tolerance vs. actual avg hold time implied by holdings duration).
Never open by simply listing the largest position — it is too static and will repeat every session.
Start with the observation. End with exactly one focused question. Max 80 words total."""

    return prompt


async def stream_reflection(
    messages: list[dict],
    system_prompt: str,
    is_opening: bool,
) -> AsyncGenerator[str, None]:
    """Stream a portfolio reflection response from Claude Sonnet."""
    client = _get_client()

    # For opening message, inject a synthetic trigger since Claude requires ≥1 user message
    if is_opening or not messages:
        convo = [{"role": "user", "content": "Begin."}]
    else:
        convo = [{"role": m["role"], "content": m["content"]} for m in messages]

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=300,
            system=system_prompt,
            messages=convo,
        ) as stream:
            async for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text, 'done': False})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error("Reflection stream failed: %s", e)
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
```

- [ ] **Verify the file parses correctly**

```bash
cd /Users/krzys/Claude/wealth-platform/backend
python -c "from app.services import ai_service; print('OK')"
```
Expected: `OK`

- [ ] **Commit**

```bash
git add backend/app/services/ai_service.py
git commit -m "feat: add stream_reflection() and system prompt builder to ai_service"
```

---

## Task 7: Backend — `POST /ai/reflect` endpoint

**Files:**
- Modify: `backend/app/routers/ai.py`

- [ ] **Add imports at the top of `backend/app/routers/ai.py`** (after existing imports):

```python
from datetime import datetime, timezone
from app.models.db import Transaction
from app.services.macro_service import get_macro_dashboard
from sqlalchemy import func as sqlfunc
```

- [ ] **Add the Pydantic request models and endpoint after the existing `_build_user_context` function at the bottom of `backend/app/routers/ai.py`**

```python
# ── Portfolio Reflection ─────────────────────────────────────────────────────

class ThesisNote(BaseModel):
    ticker: str
    stance: str
    title: str
    body: str


class ReflectMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ReflectNote(BaseModel):
    id: str
    content: str
    created_at: str


class ReflectRequest(BaseModel):
    messages: list[ReflectMessage] = []
    profile: dict = {}
    flagged_notes: list[ReflectNote] = []
    ephemeral_notes: list[ReflectNote] = []
    thesis_notes: list[ThesisNote] = []
    is_opening: bool = False


@router.post("/reflect")
async def portfolio_reflect(
    body: ReflectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream an AI portfolio reflection response."""
    # ── Fetch holdings from DB ──────────────────────────────────────────────
    portfolio_result = await db.execute(
        select(Portfolio).where(
            Portfolio.user_id == user.id,
            Portfolio.is_default.is_(True),
        )
    )
    portfolio = portfolio_result.scalar_one_or_none()

    holdings_ctx: list[dict] = []
    if portfolio:
        holdings_result = await db.execute(
            select(Holding).where(Holding.portfolio_id == portfolio.id)
        )
        raw_holdings = holdings_result.scalars().all()

        # Get earliest buy transaction date per ticker for days_held
        tx_result = await db.execute(
            select(
                Transaction.ticker,
                sqlfunc.min(Transaction.executed_at).label("first_buy"),
            ).where(
                Transaction.portfolio_id == portfolio.id,
                Transaction.transaction_type == "buy",
            ).group_by(Transaction.ticker)
        )
        first_buys: dict[str, datetime] = {
            row.ticker: row.first_buy for row in tx_result
        }

        # Try enriched cache for market values and P&L
        cached_summary = await cache_get(f"portfolio_summary:{portfolio.id}")
        cached_by_ticker: dict[str, dict] = {}
        if cached_summary and "holdings" in cached_summary:
            cached_by_ticker = {h["ticker"]: h for h in cached_summary["holdings"]}
            total_value = cached_summary.get("total_value") or 1

        for h in raw_holdings:
            days_held: int | None = None
            if h.ticker in first_buys and first_buys[h.ticker]:
                fb = first_buys[h.ticker]
                if fb.tzinfo is None:
                    fb = fb.replace(tzinfo=timezone.utc)
                days_held = (datetime.now(timezone.utc) - fb).days

            cached = cached_by_ticker.get(h.ticker, {})
            weight_pct = (
                (cached.get("market_value") or 0) / total_value * 100
                if cached_summary and total_value
                else None
            )
            holdings_ctx.append({
                "ticker": h.ticker,
                "days_held": days_held,
                "weight_pct": weight_pct,
                "unrealized_pnl_pct": cached.get("unrealized_pnl_pct"),
            })

    # ── Fetch goals ─────────────────────────────────────────────────────────
    context = await _build_user_context(user, db)
    goals = context.get("goals", [])
    nw = context.get("net_worth", {})

    # ── Fetch macro data ─────────────────────────────────────────────────────
    macro = await get_macro_dashboard()

    # ── Build system prompt ──────────────────────────────────────────────────
    system_prompt = ai_service._build_reflection_system_prompt(
        profile=body.profile,
        holdings=holdings_ctx,
        goals=goals,
        nw=nw,
        quick_notes_flagged=[n.content for n in body.flagged_notes],
        quick_notes_ephemeral=[n.content for n in body.ephemeral_notes],
        thesis_notes=[t.model_dump() for t in body.thesis_notes],
        macro=macro,
        is_opening=body.is_opening,
    )

    messages = [m.model_dump() for m in body.messages]

    return StreamingResponse(
        ai_service.stream_reflection(messages, system_prompt, body.is_opening),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
```

- [ ] **Verify the endpoint imports parse correctly**

```bash
cd /Users/krzys/Claude/wealth-platform/backend
python -c "from app.routers import ai; print('OK')"
```
Expected: `OK`

- [ ] **Start the backend and smoke-test the endpoint**

```bash
# In a second terminal, start the backend if not running:
# uvicorn app.main:app --port 8000 --reload

# Get a token from localStorage in the browser, then:
curl -s -X POST http://localhost:8000/api/v1/ai/reflect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{"messages":[],"profile":{"age":30,"riskTolerance":"aggressive","sophistication":"advanced","marginalTaxRate":22},"is_opening":true}' \
  --no-buffer | head -5
```
Expected: lines starting with `data: {"text":` streaming back.

- [ ] **Commit**

```bash
git add backend/app/routers/ai.py
git commit -m "feat: add POST /ai/reflect streaming endpoint"
```

---

## Task 8: Frontend — Reflect page (full rewrite)

**Files:**
- Rewrite: `frontend/app/(dashboard)/optimizer/page.tsx`

- [ ] **Replace the entire contents of `frontend/app/(dashboard)/optimizer/page.tsx`** with the following:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Brain, BookOpen, Target, ChevronRight, X, Flag, Send } from "lucide-react";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useRiskMetrics } from "@/hooks/useRiskMetrics";
import { useProfile } from "@/hooks/useProfile";
import { useGoals } from "@/hooks/useGoals";
import { useCloudStore } from "@/hooks/useCloudStore";
import { useReflectionNotes } from "@/hooks/useReflectionNotes";
import { useReflectionChat, type ChatMessage } from "@/hooks/useReflectionChat";
import { apiStreamPost } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import PageTransition from "@/components/celestial/PageTransition";
import DashboardSkeleton from "@/components/shared/DashboardSkeleton";

// ── Streaming helper ──────────────────────────────────────────────────────────

async function streamReflect(
  payload: object,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  try {
    const res = await apiStreamPost("/ai/reflect", payload);
    if (!res.ok || !res.body) { onError("Failed to connect."); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const msg = JSON.parse(raw);
          if (msg.text) onChunk(msg.text);
          if (msg.done) onDone();
          if (msg.error) onError(msg.error);
        } catch { /* ignore malformed */ }
      }
    }
  } catch (e) {
    onError(e instanceof Error ? e.message : "Network error");
  }
}

// ── Context panel ─────────────────────────────────────────────────────────────

function ContextPanel() {
  const { summary, portfolio, loading } = useDefaultPortfolio();
  const { data: risk } = useRiskMetrics(portfolio?.id);
  const { profile } = useProfile();
  const { goals } = useGoals();
  const { notes, recentEphemeral, addEphemeral } = useReflectionNotes();

  const [quickInput, setQuickInput] = useState("");
  const [saved, setSaved] = useState(false);

  function handleAddNote() {
    if (!quickInput.trim()) return;
    addEphemeral(quickInput);
    setQuickInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const primaryGoal = goals?.[0];
  const fundedPct = primaryGoal
    ? Math.min(100, (Number(primaryGoal.current_amount) / Number(primaryGoal.target_amount)) * 100)
    : 0;

  const avgHoldLabel = (() => {
    if (!summary?.holdings?.length) return null;
    // Rough proxy: average days_held across holdings (not available in summary directly, show nothing)
    return null;
  })();

  return (
    <div className="w-60 min-w-60 border-r border-zinc-900 bg-[#080808] flex flex-col overflow-y-auto">
      <div className="p-3.5 flex flex-col gap-3 flex-1">
        <p className="text-[9.5px] font-semibold text-zinc-600 uppercase tracking-widest">Your context</p>

        {/* Portfolio */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <p className="text-[9.5px] text-zinc-500 mb-1 font-medium">Portfolio</p>
          {loading ? (
            <div className="h-8 bg-zinc-800/30 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-[15px] font-semibold text-zinc-100 tabular-nums tracking-tight">
                {summary ? formatCurrency(summary.total_value ?? 0) : "—"}
              </p>
              {summary?.total_return_pct != null && (
                <p className={`text-[11px] tabular-nums mt-0.5 ${summary.total_return_pct >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                  {summary.total_return_pct >= 0 ? "+" : ""}{summary.total_return_pct.toFixed(2)}% total return
                </p>
              )}
              <div className="flex gap-2.5 mt-2 pt-2 border-t border-[#161616]">
                {risk?.sharpe_ratio != null && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Sharpe</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{risk.sharpe_ratio.toFixed(2)}</p>
                  </div>
                )}
                {risk?.annualized_volatility != null && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Volatility</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{risk.annualized_volatility.toFixed(1)}%</p>
                  </div>
                )}
                {summary?.holdings && (
                  <div>
                    <p className="text-[9px] text-zinc-600">Positions</p>
                    <p className="text-[11px] text-zinc-400 tabular-nums">{summary.holdings.length}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Holdings */}
        {summary?.holdings && summary.holdings.length > 0 && (
          <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
            <p className="text-[9.5px] text-zinc-500 mb-1.5 font-medium">Holdings</p>
            {(() => {
              const total = summary.holdings.reduce((s, h) => s + (h.market_value ?? 0), 0);
              return summary.holdings
                .slice()
                .sort((a, b) => (b.market_value ?? 0) - (a.market_value ?? 0))
                .slice(0, 6)
                .map((h) => {
                  const wt = total > 0 ? ((h.market_value ?? 0) / total) * 100 : 0;
                  const pnl = h.unrealized_pnl_pct ?? null;
                  return (
                    <div key={h.ticker} className="flex justify-between items-center py-[3px]">
                      <span className="text-[11.5px] font-medium text-zinc-300 font-mono">{h.ticker}</span>
                      <div className="flex flex-col items-end gap-px">
                        <span className="text-[10px] text-zinc-500 tabular-nums">{wt.toFixed(0)}%</span>
                        {pnl != null && (
                          <span className={`text-[11px] tabular-nums font-medium ${pnl >= 0 ? "text-emerald-400" : "text-rose-500"}`}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
            })()}
            {summary.holdings.length > 6 && (
              <p className="text-[9.5px] text-zinc-600 mt-1">+{summary.holdings.length - 6} more</p>
            )}
          </div>
        )}

        {/* Thesis */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-[5px] h-[5px] rounded-full bg-teal-500 shadow-[0_0_6px_#14b8a660]" />
              <span className="text-[12px] text-zinc-300">
                {/* thesis count pulled from cloud store in parent */}
                Thesis notes
              </span>
            </div>
            <Link href="/thesis" className="text-[10px] text-teal-500 hover:text-teal-400 transition-colors">
              View →
            </Link>
          </div>
          <p className="text-[9.5px] text-zinc-600 mt-1.5 leading-relaxed border-t border-[#161616] pt-1.5">
            More thesis notes = more accurate reflection of your actual reasoning
          </p>
        </div>

        {/* Goals */}
        {primaryGoal && (
          <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
            <p className="text-[9.5px] text-zinc-500 mb-1 font-medium">Primary goal</p>
            <p className="text-[12px] text-zinc-300 mb-1.5">{primaryGoal.name}</p>
            <div className="h-[3px] bg-[#161616] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-600 to-teal-500 rounded-full" style={{ width: `${fundedPct}%` }} />
            </div>
            <p className="text-[9.5px] text-zinc-500 mt-1">{fundedPct.toFixed(0)}% funded</p>
          </div>
        )}

        {/* Profile pills */}
        <div className="bg-[#0f0f0f] border border-[#161616] rounded-[9px] p-2.5">
          <p className="text-[9.5px] text-zinc-500 mb-1.5 font-medium">Profile</p>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-teal-500/30 text-teal-500 bg-teal-500/5 font-medium capitalize">{profile.riskTolerance}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-teal-500/30 text-teal-500 bg-teal-500/5 font-medium capitalize">{profile.sophistication}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700 text-zinc-400">Age {profile.age}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-zinc-700 text-zinc-400">{profile.marginalTaxRate}% tax</span>
          </div>
        </div>

        {/* Quick notes capture */}
        <div>
          <p className="text-[9.5px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">Quick notes</p>
          <div className="relative">
            <textarea
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); } }}
              placeholder="Jot a market observation or conviction…"
              rows={3}
              className="w-full bg-[#0c0c0c] border border-[#161616] focus:border-teal-500/40 rounded-[8px] px-2.5 py-2 text-[11.5px] text-zinc-300 placeholder-zinc-700 resize-none outline-none transition-colors leading-relaxed"
            />
            <button
              onClick={handleAddNote}
              disabled={!quickInput.trim()}
              className="absolute bottom-2 right-2 text-[10px] text-teal-500 disabled:text-zinc-700 hover:text-teal-400 transition-colors"
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>
          {(notes.flagged.length > 0 || recentEphemeral.length > 0) && (
            <p className="text-[9.5px] text-zinc-600 mt-1">
              {notes.flagged.length} pinned · {notes.ephemeral.length} working
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chat message bubble ───────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  return (
    <div className={`flex gap-2.5 max-w-[88%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
      <div className={`w-[25px] h-[25px] min-w-[25px] rounded-full flex items-center justify-center text-[10px] font-semibold mt-0.5 shrink-0 ${
        msg.role === "assistant"
          ? "bg-gradient-to-br from-teal-600 to-indigo-500 text-white shadow-[0_0_10px_#14b8a628]"
          : "bg-zinc-900 text-zinc-500 border border-zinc-800"
      }`}>
        {msg.role === "assistant" ? "V" : ""}
      </div>
      <div className={`px-3.5 py-2.5 rounded-[13px] text-[12.5px] leading-[1.65] ${
        msg.role === "assistant"
          ? "bg-[#0f0f0f] border border-[#181818] rounded-tl-[4px] text-zinc-300 shadow-[0_2px_10px_#00000035]"
          : "bg-[#0c1a1a] border border-teal-500/[0.15] rounded-tr-[4px] text-zinc-300"
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 max-w-[88%]">
      <div className="w-[25px] h-[25px] min-w-[25px] rounded-full flex items-center justify-center bg-gradient-to-br from-teal-600 to-indigo-500 text-white text-[10px] font-semibold shadow-[0_0_10px_#14b8a628] shrink-0">V</div>
      <div className="px-3.5 py-3 rounded-[13px] rounded-tl-[4px] bg-[#0f0f0f] border border-[#181818]">
        <div className="flex gap-1 items-center h-[14px]">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-[5px] h-[5px] rounded-full bg-teal-500"
              style={{ animation: `blink 1.2s ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReflectPage() {
  const { portfolio, summary, loading } = useDefaultPortfolio();
  const { profile } = useProfile();
  const { notes, recentEphemeral } = useReflectionNotes();
  const { messages, appendMessage, appendChunkToLast, finaliseLastMessage, clearChat, isLoading: chatLoading } = useReflectionChat();
  const { data: thesesData } = useCloudStore<unknown[]>("theses");

  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const openingFired = useRef(false);

  // Build the payload sent to /ai/reflect
  const buildPayload = useCallback((userMessages: ChatMessage[], isOpening: boolean) => {
    const theses = Array.isArray(thesesData) ? thesesData.map((t: any) => ({
      ticker: t.ticker ?? "",
      stance: t.stance ?? "neutral",
      title: t.title ?? "",
      body: t.body ?? "",
    })) : [];

    return {
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
      profile: {
        age: profile.age,
        riskTolerance: profile.riskTolerance,
        sophistication: profile.sophistication,
        marginalTaxRate: profile.marginalTaxRate,
      },
      flagged_notes: notes.flagged.map((n) => ({ id: n.id, content: n.content, created_at: n.created_at })),
      ephemeral_notes: recentEphemeral.map((n) => ({ id: n.id, content: n.content, created_at: n.created_at })),
      thesis_notes: theses,
      is_opening: isOpening,
    };
  }, [profile, notes, recentEphemeral, thesesData]);

  // Fire opening message once when chat is empty and data is ready
  useEffect(() => {
    if (openingFired.current) return;
    if (chatLoading || loading) return;
    if (messages.length > 0) { openingFired.current = true; return; }

    openingFired.current = true;
    setStreaming(true);

    const placeholder: ChatMessage = { role: "assistant", content: "", timestamp: new Date().toISOString() };
    const withPlaceholder = appendMessage(placeholder);

    let accumulated = "";
    streamReflect(
      buildPayload([], true),
      (chunk) => {
        accumulated += chunk;
        appendChunkToLast(chunk);
      },
      () => {
        setStreaming(false);
        finaliseLastMessage(withPlaceholder.map((m, i) =>
          i === withPlaceholder.length - 1 ? { ...m, content: accumulated } : m
        ));
      },
      (err) => {
        setStreaming(false);
        console.error("Reflection opening failed:", err);
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLoading, loading, messages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function handleSend() {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    const withUser = appendMessage(userMsg);
    setInput("");
    setStreaming(true);

    const placeholder: ChatMessage = { role: "assistant", content: "", timestamp: new Date().toISOString() };
    const withPlaceholder = [...withUser, placeholder];
    appendMessage(placeholder);

    let accumulated = "";
    streamReflect(
      buildPayload(withUser, false),
      (chunk) => {
        accumulated += chunk;
        appendChunkToLast(chunk);
      },
      () => {
        setStreaming(false);
        finaliseLastMessage(withPlaceholder.map((m, i) =>
          i === withPlaceholder.length - 1 ? { ...m, content: accumulated } : m
        ));
      },
      (err) => {
        setStreaming(false);
        console.error("Reflection failed:", err);
      },
    );
  }

  function handleClear() {
    openingFired.current = false;
    clearChat();
  }

  if (loading && messages.length === 0) return <DashboardSkeleton />;

  return (
    <PageTransition className="h-[calc(100vh-4rem)] flex flex-col">
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>

      {/* Shell */}
      <div className="flex-1 flex flex-col border border-zinc-900 rounded-xl overflow-hidden shadow-[0_0_0_1px_#ffffff06,0_32px_64px_-16px_#000000cc,0_0_120px_-40px_#14b8a612] min-h-0">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-gradient-to-b from-zinc-950 to-transparent shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-[7px] h-[7px] rounded-full bg-teal-500 shadow-[0_0_10px_#14b8a670]" />
            <span className="text-[14px] font-semibold text-zinc-100 tracking-tight">Reflect</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-700 font-mono">claude-sonnet</span>
            <button
              onClick={handleClear}
              className="text-[11px] text-zinc-700 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 rounded transition-all"
            >
              Clear chat
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          <ContextPanel />

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(ellipse_at_top_right,#14b8a609_0%,transparent_70%)] pointer-events-none" />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 pt-5 pb-2 flex flex-col gap-4 relative z-10">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {streaming && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3.5 pb-3.5 pt-2 border-t border-zinc-900 flex gap-2 items-end relative z-10 shrink-0">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={streaming}
                placeholder="Your thoughts… (⌘↵ to send)"
                rows={1}
                style={{ maxHeight: "96px" }}
                className="flex-1 bg-[#0f0f0f] border border-[#181818] focus:border-teal-500/30 rounded-[9px] px-3 py-2.5 text-[12.5px] text-zinc-300 placeholder-zinc-700 resize-none outline-none transition-colors font-[Geist,sans-serif] leading-relaxed disabled:opacity-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="w-[34px] h-[34px] bg-teal-500 hover:bg-teal-400 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-[8px] flex items-center justify-center transition-colors shrink-0 shadow-[0_0_14px_#14b8a628] disabled:shadow-none"
              >
                <Send className="w-[14px] h-[14px] text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
```

- [ ] **Verify the page compiles with no TypeScript errors**

```bash
cd /Users/krzys/Claude/wealth-platform/frontend
npx tsc --noEmit 2>&1 | grep -i "optimizer\|reflect\|useReflection" | head -20
```
Fix any type errors before continuing.

- [ ] **Open http://localhost:3000/optimizer in the browser and verify:**
  - Page loads with context panel on the left and chat on the right
  - AI opening message streams in automatically
  - Typing a message and pressing ⌘↵ (or the send button) streams a reply
  - "Clear chat" resets the conversation and triggers a new opening message
  - Sidebar shows "Reflect" with the Brain icon

- [ ] **Commit**

```bash
git add frontend/app/\(dashboard\)/optimizer/page.tsx
git commit -m "feat: replace optimizer page with AI portfolio reflection chat"
```

---

## Self-Review Checklist

- [x] **`sophistication` field** — Task 1 adds it to `useProfile.ts`, Task 2 adds the selector UI, Task 8 sends it in the payload
- [x] **Sidebar label + icon** — Task 3
- [x] **Two-tier notes** — Task 4 (`useReflectionNotes`) with flagged/ephemeral split, pruning, and `recentEphemeral` for AI context
- [x] **Chat persistence with 50-message cap** — Task 5 (`useReflectionChat`)
- [x] **Opening message auto-generation** — Task 8, fires when `messages.length === 0`
- [x] **Opening message priority (notes × macro first)** — Encoded in `_build_reflection_system_prompt` when `is_opening=True`
- [x] **Streaming via SSE** — Task 6 backend + `streamReflect()` in Task 8 frontend
- [x] **Macro context** — Task 7 fetches `get_macro_dashboard()` and extracts DGS10, DGS2, T10Y2Y, DFEDTARU
- [x] **Days held from first buy transaction** — Task 7 backend queries `min(executed_at)` per ticker
- [x] **Thesis notes injected** — Task 8 reads `useCloudStore("theses")` and sends in payload
- [x] **Context panel all sections** — Task 8 (`ContextPanel` component): portfolio, holdings, thesis link, goals, profile pills, quick capture
- [x] **`Cmd+Enter` to send** — Task 8 input `onKeyDown` handler
- [x] **Clear chat resets and fires new opening** — Task 8 `handleClear` + `openingFired.current = false`
- [x] **Type consistency** — `ChatMessage`, `ReflectionNote`, `ReflectionNotesStore` defined once in their hook files and imported everywhere
