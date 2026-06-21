# Velnor — Launch Checklist (pre-launch waitlist)

Ordered by dependency. Top to bottom. Legend: **[you]** = your action, **[me]** = I can do it in a session, **[$]** = costs money, **[free]**.

> Status as of now: name **Velnor** chosen; trademark clear in EU register + US fintech classes (9/36/42); in-app + landing + login + 4 ad creatives + logos already rebranded to Velnor; campaign spec written; Gmail avatar made.

---

## Phase 1 — Lock the brand foundation

- [ ] **1. Buy the domain** — `velnor.app` (primary) + `velnor.eu` (defensive, fits your sp. z o.o.). Register at **Cloudflare** or Namecheap, WHOIS privacy on. `velnor.com` is parked/premium — skip unless cheap. **[you] [$ ~$30/yr]**
- [ ] **2. Reserve social handles** — `@velnor` / `@velnorapp` on X, Instagram, TikTok. **[you] [free]**
- [ ] **3. Create the brand Google account** (e.g. hello@ or contact@) and set the profile photo to `velnor-gmail.png`. **[you] [free]**

## Phase 2 — Site + legal prerequisites (free, mostly me)

- [ ] **4. Privacy Policy + Terms pages** (GDPR-compliant — required by your Polish entity AND by Meta's lead form). Added as `/privacy` + `/terms` in the app. *Have a lawyer skim before launch.* **[me] [free]**
- [ ] **5. Update domain references** — swap `vela.finance` → `velnor.app` in backend config (`FROM_EMAIL`, `ALLOWED_ORIGINS`) and the Meta spec. *(after #1)* **[me] [free]**
- [ ] **6. Deploy the site to `velnor.app`** + set up email forwarding `hello@velnor.app`. *(after #1)* **[you/me] [free tier]**

## Phase 3 — Marketing infrastructure (free)

- [ ] **7. Create Meta Business account + Facebook Page** for Velnor (no card needed yet). **[you] [free]**
- [ ] **8. Set up Meta-Leads → Supabase connector** (Zapier/Make free tier) so lead-form signups land in the `waitlist` table. **[you/me] [free]**
- [ ] **9. (Optional, stage for later) Meta Pixel** scaffolded on the site, reads Pixel ID from env. Not needed for the round-0 lead form; useful for retargeting later. **[me] [free]**

## Phase 4 — Launch the $100 test (per `docs/marketing/meta-campaign-spec.md`)

- [ ] **10. Build the campaign** — Objective: Leads → Instant Form. Broad US. CBO $7/day. Lead form uses the `/privacy` URL from #4. **[you] [free to build]**
- [ ] **11. Add payment method + launch** — submit Ad ④ (manifesto, safe approve) first, then Ad ① (behavior; may hit review over the +712%). ~14 days. **[you] [$ ~$100]**
- [ ] **12. Post the building-in-public welcome** + keep a light cadence (one post every few days). **[you] [free]**

## Phase 5 — Read + iterate

- [ ] **13. Read results after ~5–7 days** — cost-per-lead is the headline metric; CTR diagnoses the creative. Smoke test, not a winner-picker at this budget. **[you/me]**
- [ ] **14. If cost-per-lead is sane** → install Pixel optimization, raise budget, run the real 4-angle test (creatives ②/③ included). **[me/you] [$]**
- [ ] **15. At ~100+ signups** → build a Lookalike audience off the lead list (your first real targeting asset). **[you] [free]**

---

## Side track — do when ready (not blocking the waitlist test)

- [ ] **Register the Polish sp. z o.o.** (the legal entity) — needed before real revenue, banking, or app-store publishing. **[you] [€€]**
- [ ] **File the EU trademark** (EUIPO, classes 9 + 36 + 42) to lock the mark across the EU. Cheapest now while it's clear. **[you] [~€1,050]**
- [ ] **Upgrade to `velnor.com`** if it ever frees up or you raise funding. **[optional] [$$]**

---

## What's blocked on what
- Everything domain-related (#5, #6, lead-form link) waits on **#1 (buy domain)**.
- The ad launch (#11) waits on **#4 (privacy policy)** + **#6 (live site)** + **#7 (Meta account)**.
- The only thing gating the *next free work session* is nothing — **#4 (privacy + terms)** can be done right now without spending a cent.
