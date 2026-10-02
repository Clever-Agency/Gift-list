---
reviewer: rubric-walker
gate: architecture-reviewer
artifact: ARCHITECTURE-SPINE.md
artifact_path: planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md
reviewed_at: 2026-09-30
rubric: good-spine
verdict: pass-with-fixes
language: ru
---

# Rubric Walker Review — Architecture Spine (Gift List R1)

**Verdict: pass-with-fixes**

Spine is a strong feature-altitude build substrate: paradigm, R1 divergence points, ops envelope, and enforceable AD Rules are largely in place. npm pins claimed for 2026-09-30 verify. Residual gaps are fixable before lock — none are R1-blocking alone, but several checklist cells are incomplete.

---

## Checklist scorecard

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | Fixes real divergence points for epics/stories; no critical R1 misses | **Pass (minor gaps)** | Visibility, friendship, reserve CAS, list tokens, payment seam, auth/session — covered. FR-4 not in capability map; FR-19 R1/R2 slice fuzzy. |
| 2 | Every AD Rule enforceable and prevents stated divergence | **Pass (minor)** | AD-1..AD-14 have Binds/Prevents/Rule. AD-2/`shadcn@latest` and soft “код владеет деталями” slightly weaken pin-time enforceability. |
| 3 | Nothing under Deferred lets two units diverge incompatibly | **Pass-with-caution** | Core model deferred items aligned with AD-11/AD-8. Soft risk: per-gift/OG/share-sheet and Redis rate-limit if stories invent parallel URL or limiter contracts. |
| 4 | Named tech verified-current (2026-09-30 npm pins) | **Pass** | Verified via `npm view` same calendar day — see § Pins. |
| 5 | Covers PRD R1 capabilities (as bound by spine) | **Pass (minor)** | Frontmatter binds + capability map cover claimed R1 FRs; map omits FR-4; payment FRs correctly unbound / AD-11. |
| 6 | Every owned dimension decided \| deferred \| open — esp. ops/deploy | **Fail cell → fixes** | Ops/deploy (AD-5) decided. **Testing/QA strategy** neither decided, deferred, nor open. Observability beyond status-audit thin. |
| 7 | No template HTML comments; AD IDs stable with Binds/Prevents/Rule | **Pass** | No `<!-- -->` leftovers. AD-1..AD-14 present and structured. |

---

## 1. Divergence points for level below

### Covered well (critical for R1)

| Divergence | Mechanism |
|------------|-----------|
| Business logic in UI / dual API paths | AD-1 layers + Server Actions / RH only |
| Session source & R1 auth surface | AD-3 Better Auth email+password, DB sessions |
| SoR / store sprawl | AD-4 Postgres + Prisma only |
| List URL vs nick URL; nick rename | AD-6 `/l/{publicToken}` CUID2 vs `/u/{nick}` |
| FO soft-deny vs 404; gift leakage | AD-7 single `VisibilityPolicy` |
| Gift state machine drift UI↔API | AD-8 + `GiftStatusService` |
| Double reserve | AD-9 CAS + CONFLICT |
| Directed FO / duplicate edges | AD-10 canonical undirected Friendship |
| Payments leaking into R1 or breaking R2 | AD-11 |
| Error shape / FO as NOT_FOUND | AD-12 |
| Nick-as-PK / case collisions | AD-13 |
| FO titles in notifications | AD-14 |
| Deploy/cron/email envelope | AD-5 |

### Gaps / soft misses

1. **FR-4 absent from Capability → Architecture Map** while frontmatter binds `FR-1..FR-15`. Registration → two lists is implied in AD-6 (“выдаётся при создании двух списков на регистрации”) but epics need an explicit map row (lives in / governed by).
2. **FR-19 ambiguity:** AD-9 binds `FR-19 (R1)`; Deferred says «полное FR-19 → Раунд 2». Without a one-line R1 slice definition, two stories can argue whether exclusivity-with-COLLECTION or only CAS-reserve is in scope.
3. **FR-25** mapped; good. Payment FR-16/18..22 correctly deferred via AD-11 — no critical R1 capability hole for bound FRs.

**Critical R1 miss?** No single missing AD that would let epics ship incompatible core product behavior. Score: pass with minor map/clarify fixes.

---

## 2. AD Rule enforceability

| AD | Enforceable? | Prevents claimed divergence? |
|----|--------------|------------------------------|
| AD-1 | Yes (import boundaries / review) | Yes |
| AD-2 | Partial — scaffold recipe clear; `shadcn@latest` + “код владеет деталями” allows post-scaffold drift | Mostly |
| AD-3 | Yes | Yes |
| AD-4 | Yes | Yes |
| AD-5 | Yes (platform choices) | Yes for R1 ops envelope |
| AD-6 | Yes (path + token rules) | Yes |
| AD-7 | Yes (single function + forbidden raw findMany) | Yes — strong |
| AD-8 | Yes (enum + service-only transitions) | Yes |
| AD-9 | Yes (SQL CAS contract + CONFLICT) | Yes — strong |
| AD-10 | Yes (schema UNIQUE pair + Block rules) | Yes |
| AD-11 | Yes (no payment tables/UI; extension path named) | Yes |
| AD-12 | Yes (result envelope + gate ≠ NOT_FOUND) | Yes |
| AD-13 | Yes | Yes |
| AD-14 | Yes | Yes |

**Findings**

- Every AD has stable **Binds / Prevents / Rule** triad — checklist form satisfied.
- AD-7 and AD-9 are exemplary: preventable divergence is named and the Rule is operational for implementers.
- AD-2 should pin “scaffold-time CLI” or state “shadcn components frozen after init commit” so two cold starts days apart do not fork component primitives.

---

## 3. Deferred incompatibilities

| Deferred item | Incompatible divergence risk | Assessment |
|---------------|------------------------------|------------|
| ЮKassa / ledger / Contribution | Low — AD-11 forbids R1 stubs and preserves AD-6/7/10 | OK |
| `COLLECTION` + full FR-19 | Low if enum slot only + GiftStatusService owns mutex later | OK; clarify FR-19 R1 slice |
| OAuth / Push / native | Low — non-goals | OK |
| Share-sheet / per-gift links / OG | **Medium-soft** — could invent `/g/...` or alternate list URLs | Add rule: no alternate share URL schemes that bypass AD-6 |
| Self-serve report / hard-delete | Low — ARCH-A1/A3 decide manual | OK (also listed Deferred — redundant, not conflicting) |
| i18n / dark | Low | OK |
| Redis/KV rate-limit | Soft — two units could ship different limiter APIs | Tie to AD-12 `RATE_LIMITED` + “in-process until deferred upgrade” |
| Prisma 8 | Low — explicit revisit | OK |
| Brand/domain | Low — ARCH-A2 | OK |

**Nothing under Deferred currently forces incompatible domain models** if AD-6/7/8/10/11 are honored. Soft guardrails recommended for share-URL and rate-limit deferred rows.

---

## 4. Named tech — verification (2026-09-30)

Spine claim: versions checked via `npm view` / Next security release 2026-09-30.

| Package | Spine pin | `npm view` (review day) | Match |
|---------|-----------|-------------------------|-------|
| `next` | 16.3.8 | 16.3.8 | ✓ |
| `react` | 19.3.0 | 19.3.0 | ✓ |
| `better-auth` | 1.7.6 | 1.7.6 | ✓ |
| `prisma` / `@prisma/client` | 7.10.0 | 7.10.0 exists; dist-tag latest is 8.x RC | ✓ (intentional pin; Deferred Prisma 8 correct) |
| `zod` | 4.6.5 | 4.6.5 | ✓ |
| `@paralleldrive/cuid2` | 3.3.0 | 3.3.0 | ✓ |
| `resend` | 6.31.0 | 6.31.0 | ✓ |
| `tailwindcss` | 4.3.3 | 4.3.3 | ✓ |
| TypeScript | “(из create-next-app default)” | not pinned | ⚠ soft pin |
| shadcn/ui | “latest CLI at scaffold” | floating | ⚠ soft pin |

**Criterion 4: Pass** for claimed hard pins. Note floating TypeScript/shadcn as consistency nits, not verification failures.

---

## 5. PRD R1 capability coverage (spine-driven)

Evaluated against spine `binds` + Capability map + Deferred (PRD file not re-opened per walker scope).

| Bound area | Spine coverage |
|------------|----------------|
| FR-1..3 Auth | AD-3, map ✓ |
| FR-5..8 Profile/search | AD-7/13, map ✓ |
| FR-9..12 Lists/gifts | AD-1/8, map ✓ |
| FR-13..15, 23..24 Friendship/block | AD-10, map ✓ |
| FR-17 Reserve | AD-8/9/12, map ✓ |
| FR-25 Reservations list | map ✓ |
| FR-26 Notifications | AD-14, map ✓ |
| FR-27..28 List links | AD-6/7, map ✓ |
| D-10 / D-11 / A-24 | AD-10 / AD-6 / AD-11 ✓ |
| Payments FR-16/18..22 | Unbound + Deferred + AD-11 ✓ |

**Fix:** add capability-map row for **FR-4** (and any other bound FR in 1..15 not named). **Clarify** FR-19 R1 vs “полное FR-19” R2 in Deferred.

---

## 6. Dimension completeness (feature altitude)

| Dimension | Status in spine |
|-----------|-----------------|
| Paradigm / layering | **Decided** AD-1 |
| Auth | **Decided** AD-3 |
| Persistence / ORM | **Decided** AD-4 |
| Deploy / env / cron / email | **Decided** AD-5 |
| Domain visibility / gifts / friendship | **Decided** AD-7..10 |
| R2 payment seam | **Deferred** AD-11 |
| Errors / IDs / notifications | **Decided** AD-12..14 |
| Consistency conventions | **Decided** table |
| Open product assumptions | **Open** ARCH-A1..A11 |
| **Testing / QA strategy** (unit/integration/e2e, where CAS & VisibilityPolicy proven) | **MISSING** — not decided, deferred, or open |
| Monitoring / alerting / error tracking | **Thin** — audit log line only |
| CI beyond Vercel preview | Implied by AD-5, not explicit |

Ops/deploy envelope — **satisfied** (AD-5 is clear and R1-adequate).

Testing dimension gap is the main reason this criterion does not full-pass.

---

## 7. Template / AD structure hygiene

- No HTML comment templates (`<!-- ... -->`) found.
- AD IDs **AD-1..AD-14** contiguous and stable.
- Each AD has **Binds**, **Prevents**, **Rule**.
- Frontmatter altitude `feature`, paradigm, binds, decisions_locked — coherent.
- `status: draft` is lifecycle, not a rubric fail; lock after fixes.

---

## Required fixes (before Gate lock)

1. **Add Testing/QA dimension** as decided, deferred, or open (minimum: VisibilityPolicy + GiftStatusService CAS must have automated tests; e2e auth/FO path deferred or in-pilot).
2. **Capability map: FR-4** (registration → two lists / tokens) with lives-in / governed-by.
3. **Disambiguate FR-19:** one sentence — R1 = reserve exclusivity via CAS/status; R2 = full FR-19 including COLLECTION mutex.
4. **Deferred soft guards:** share/OG/per-gift must not introduce list URL schemes outside AD-6; rate-limit upgrades keep AD-12 `RATE_LIMITED` contract.
5. *(Optional)* Pin TypeScript version or state “TS version = create-next-app lockfile at scaffold commit”; freeze shadcn after init.

---

## Non-blocking observations

- Domain ⇢ DB dotted “типы/ошибки” vs “domain depends on nothing external” — OK if shared types live outside Prisma client import; worth one clarifying phrase for epics.
- ARCH-A1/A3 appear both under Deferred and Open assumptions — consistent outcomes, slight duplication.
- `status: draft` + `working_mode: fast-path` appropriate; bump to `ready`/`locked` only after fixes above.

---

## Verdict rationale

**pass-with-fixes** — not **pass**, because checklist cell 6 (owned dimensions) is incomplete without a testing entry, and FR-4 / FR-19 clarity gaps can still cause epic-level thrash. **Not fail**: critical R1 divergence points, enforceable ADs, verified npm pins, ops envelope, and deferred payment seam are solid enough that epics can proceed after the listed fixes.

**Walker recommendation:** apply fixes 1–4, re-scan cells 1/5/6, then Gate may promote to pass.
