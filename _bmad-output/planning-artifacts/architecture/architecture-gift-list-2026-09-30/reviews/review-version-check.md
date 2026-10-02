---
review_type: version-reality-check
artifact: ARCHITECTURE-SPINE.md
date: 2026-09-30
reviewer: finalize-version-check
verdict: pass
---

# Version / Reality Check — Architecture Spine

**Verdict: PASS** — Stack pins and AD-2/3/4/5 technology choices match live npm + current docs as of **2026-09-30**. No outdated pins. Claims of `npm view` / Next.js security-release verification are corroborated, not training-data assertions.

## Method

| Source | Used for |
| --- | --- |
| `npm view <pkg> version` + `dist-tags` | Exact pin existence / latest |
| https://nextjs.org/blog/september-2026-security-release | Next.js 16.3.8 security claim |
| https://ui.shadcn.com/docs/tailwind-v4 | shadcn + Tailwind v4 |
| https://better-auth.com/docs/integrations/next , Prisma adapter docs | AD-3 Better Auth |
| https://www.prisma.io/docs/orm/release-status | Prisma 7 GA vs 8 RC |
| Vercel Cron docs + Resend / Neon usage patterns | AD-5 hosting |

Spine claim (Stack footnote): *«Версии проверены `npm view` / Next.js security release 2026-09-30. Prisma 7.10.0 (GA), не Prisma 8 RC.»* — **confirmed**.

Memlog `(version)` / `(event) Versions web-verified 2026-09-30` aligns with the same pins.

## Stack table — pin audit

| Package | Spine pin | Exists on npm? | `latest` tag today | Status |
| --- | --- | --- | --- | --- |
| `next` | 16.3.8 | yes | **16.3.8** | **exact match** (Active LTS patch) |
| `react` | 19.3.0 | yes | **19.3.0** | **exact match** |
| `tailwindcss` | 4.3.3 | yes | **4.3.3** | **exact match** |
| `better-auth` | 1.7.6 | yes | **1.7.6** | **exact match** (published 2026-09-24) |
| `prisma` | 7.10.0 | yes | **8.0.0-rc.19** (RC) | **intentional GA pin** — see Prisma note |
| `@prisma/client` | 7.10.0 | yes | **7.10.0** | **exact match** (v7 client line) |
| `zod` | 4.6.5 | yes | **4.6.5** | **exact match** |
| `@paralleldrive/cuid2` | 3.3.0 | yes | **3.3.0** | **exact match** |
| `resend` | 6.31.0 | yes | **6.31.0** | **exact match** |
| TypeScript | create-next-app default | n/a | unpinned by design | OK for scaffold; not a frozen pin |
| shadcn/ui | latest CLI at scaffold | n/a | unpinned by design | OK; CLI is the product surface |
| PostgreSQL | 16+ managed | n/a | platform choice | OK |
| Hosting | Vercel + Neon preferred | n/a | ops choice | OK (AD-5) |

**Outdated pins found: none.**

### Prisma nuance (not a fail — important for implementers)

Live tags (2026-09-30):

```text
prisma           latest = 8.0.0-rc.19   prev = 7.10.0
@prisma/client   latest = 7.10.0
```

- Spine correctly refuses Prisma 8 RC; Deferred row «Prisma 8 upgrade — RC на дату spine» is accurate.
- Prisma docs warn: bare `npm install prisma` / `npx prisma` now resolves the **ORM 8 RC CLI**, which is a different product surface from Prisma 7 (`schema.prisma` / `migrate` workflow).
- Pinning **both** `prisma@7.10.0` and `@prisma/client@7.10.0` (as the Stack table does) is the right safeguard.
- Better Auth peerDeps allow `prisma` / `@prisma/client` `^5 || ^6 || ^7` — **not** Prisma 8 — further validating AD-4’s stay-on-7 choice.

**Soft recommendation (non-blocking):** Stack footnote could add one line: *install with `prisma@7.10.0` explicitly; do not trust bare `latest` for the CLI.* Deferred already covers the upgrade revisit.

### Next.js 16.3.8 security claim

Official blog **September 2026 Security Release** (published 2026-09-30) names **`next@16.3.8`** as the Active LTS patch and `15.5.27` as Maintenance LTS. Spine pin matches the security release, not an arbitrary minor.

`create-next-app@latest` → also **16.3.8** today — AD-2 scaffold path is consistent with the pin.

## AD reality checks

### AD-2 — Starter / UI (`create-next-app` → `shadcn@latest` → Forest Paper)

| Claim | Reality check | Result |
| --- | --- | --- |
| App Router + TS + Tailwind via `create-next-app@latest` | Current cna ships Next 16.3.8 + Tailwind 4 line | **pass** |
| shadcn + Tailwind v4 | Official shadcn Tailwind v4 docs; CLI initializes v4/React 19 projects | **pass** |
| Brand delta after scaffold | Process choice; no version conflict | **pass** |

No evidence of an obsolete “manual Tailwind v3 bootstrap” path. Decision is current-practice, not asserted folklore.

### AD-3 — Better Auth (email/password, DB sessions, Resend)

| Claim | Reality check | Result |
| --- | --- | --- |
| Better Auth for Next.js App Router | Official Next integration docs; peers include `next ^14\|\|^15\|\|^16`, `react ^18\|\|^19` | **pass** |
| Prisma + PostgreSQL adapter | Official Prisma adapter; Prisma guide wires Better Auth + Next.js | **pass** |
| Email/password + database sessions (httpOnly cookie) | First-class `emailAndPassword` + Session model; not JWT-credentials-only | **pass** |
| Resend for reset / verify email | Compatible ops pattern with Next Server Actions / Route Handlers | **pass** |
| OAuth out of R1 | Scope cut; library supports it later — no stack conflict | **pass** |

`better-auth@1.7.6` is current `latest`. Choice is docs-backed, not training-data invention.

### AD-4 — PostgreSQL + Prisma ORM 7

| Claim | Reality check | Result |
| --- | --- | --- |
| Postgres as SoR | Standard; Neon/managed Postgres common for Vercel | **pass** |
| Prisma **7.10.0** GA | Release exists; `@prisma/client` latest still 7.10.0 | **pass** |
| Avoid Prisma 8 RC | Prisma release-status: 8 is RC; GA expected later; peer tooling (Better Auth) still on ^7 | **pass** |
| Migrations via Prisma 7 | Requires pinned `prisma@7` CLI — spine pin enables this | **pass** |

### AD-5 — Vercel + managed Postgres (Neon) + Resend + Vercel Cron

| Claim | Reality check | Result |
| --- | --- | --- |
| Next.js on Vercel | Default deployment target for App Router | **pass** |
| Neon (or equiv.) managed Postgres | Common pairing; soft “preferred” not exclusive — matches Open assumptions | **pass** |
| Resend for email | Current SDK 6.31.0; App Router / Server Action patterns documented | **pass** |
| Vercel Cron → protected Route Handler | Official Cron docs: App Router handler + `CRON_SECRET` Bearer check | **pass** |
| Staging = preview + separate DB / Neon branch | Standard Vercel/Neon branching pattern | **pass** |

## Research hygiene

| Signal | Assessment |
| --- | --- |
| Spine states versions checked via `npm view` on 2026-09-30 | **Corroborated** by re-run today — every numeric pin matches |
| Cites Next.js security release same day | **Corroborated** by nextjs.org blog |
| Explicit Prisma 7 vs 8 RC reasoning | **Corroborated** by npm dist-tags + Prisma release-status |
| Memlog records same version vector | Consistent audit trail |

**No technology decision in Stack / AD-2..5 appears asserted from stale training knowledge without a checkable live source.**

## Findings summary

| Severity | Finding | Action |
| --- | --- | --- |
| — | All numeric Stack pins current / intentional | None |
| Info | `prisma` npm `latest` = 8 RC while spine pins 7.10.0 | Keep pin; optional footnote for scaffolders |
| Info | TypeScript + shadcn left as “scaffold latest” | Acceptable for build-substrate; freeze at lockfile time |
| Info | Better Auth peers stop at Prisma ^7 | Reinforces AD-4 deferral of Prisma 8 |

## Conclusion

**PASS for finalize.** Stack and AD-2/3/4/5 were web-/registry-reality-checked. Re-verification on 2026-09-30 found **zero outdated version pins** and **no unverified stack assertions** in the reviewed scope.
