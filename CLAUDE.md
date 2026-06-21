# Velnor Wealth Platform

## Frontend Design Guidelines

**The single source of truth for visual design is [`frontend/design-system.md`](frontend/design-system.md)** — the
opinionated "Instrument" anti-slop system. Read it (or paste the relevant section) before building or
redesigning any frontend surface. The notes below are a summary; the doc wins on any conflict.

### Core direction
- **Instrument, not SaaS dashboard.** Celestial-navigation soul, expressed as a disciplined accent in-app
  and a showpiece only on the landing page.
- **Silence = AI defaults.** Be explicit. Honor the "Do Not Use" list in the design system.

### Typography
- Display: **Bricolage Grotesque** · Body: **Hanken Grotesk** · Figures: **JetBrains Mono** (tabular-nums).
- **Geist is dropped.** Never reintroduce Geist/Inter/Roboto as the typeface.

### Color & Theme
- Dark base (`vela-bg #050A16`). **Teal `#14B8A6` is the only brand accent.**
- `gain`/`loss`/`amber` are **semantic only** — never decoration. No indigo / blue / purple anywhere.

### Surfaces, shape & motion
- **Solid surfaces + 1px hairline borders.** No liquid glass (`backdrop-filter` as decoration), no glow,
  no multi-layer shadows, no hover card-lift.
- Crisp radius: 4px buttons/inputs, 6px cards, 0 panels. No `rounded-2xl`/pills (avatars keep `rounded-full`).
- Motion: 150–220ms, ease-out, transform/opacity only; honor `prefers-reduced-motion`. Borrow animation
  *mechanics* from 21st.dev but re-skin to our tokens (design system §9). 21st is bones, never taste.

### Visual details
- Atmosphere via a quiet teal-only constellation/wash that never reduces text contrast — not gradient
  meshes or dramatic shadows.
- Signature motifs: mono eyebrow labels, hairline rules instead of nested cards, tabular figures,
  bearing/heading language.

### Anti-patterns to avoid
- Generic shadcn pill sidebar; cookie-cutter cards with no hierarchy; "clean & spacious" 50px padding as a
  substitute for hierarchy; emoji as icons.
- Forgetting that financial data needs clear visual hierarchy and scanability.

> Redesign is phased (app-first). See `frontend/design-system.md` changelog and
> `docs/superpowers/plans/` for current phase status.
