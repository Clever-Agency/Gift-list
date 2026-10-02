---
name: Adversarial architecture review R2 — Gift List spine (post-fix)
type: architecture-review
review_kind: adversarial-builder-divergence
round: 2
target: ARCHITECTURE-SPINE.md
prior: reviews/review-adversarial.md
date: 2026-09-30
verdict: pass
remaining_holes: 0
language: ru
---

# Adversarial review R2 — after AD-6..AD-15 amendments

## Verdict

**PASS.** All nine incompatible-builder holes from R1 are closed by the amended spine. Two builders citing AD-6..AD-15 to the letter converge on authz, reservation SoR, status CAS, FO surfaces, list cardinality, friendship writes, and wire shapes. **Remaining incompatible-builder holes: none.**

Locked product context still untouched: D-10, D-11, A-24, `/l/{token}` opaque, CAS (now extended to all status transitions).

## Method

Re-check each R1 hole against the updated `ARCHITECTURE-SPINE.md`. A hole stays open only if Builder α and Builder β can still obey every AD literally and ship unmergable schema, authz, race, or wire outcomes.

---

## Hole closure matrix

| R1 hole | Class | Closing AD text | Status |
|---|---|---|---|
| **Block bypass** (`/l/{token}` ignores Block) | authz / FO–discoverable leak | **AD-7** step 2: Block either direction → `not_found` for **both** list types + profile; not `friends_only_gate`. Same `resolve` for all reads. **AD-15**(3) tests Block + discoverable token → `not_found`. | **CLOSED** |
| **CAS only on reserve** | reservation races | **AD-9**: every transition one txn + CAS + actor predicates (OPEN→RESERVED, RESERVED→OPEN holder/owner/cron, RESERVED→CLOSED). `rowCount ≠ 1` → `CONFLICT`. Cron via same service (**AD-5**, **AD-8**). | **CLOSED** |
| **FR-25 FO leak** | FO gift leak / dual read owners | **AD-7** read matrix: reserver gets **reservation card only** (`giftId`, `titleSnapshot`, `status`, `listType`, `ownerNick`, release CTA); no FO siblings / browse. **AD-14** allows holder notify via `titleSnapshot` only. **AD-15**(4) unfriend + active reserve → card without siblings. | **CLOSED** |
| **Reservation schema fork** | shared-data shapes | **AD-9**: R1 state **on `Gift`** (`status`, `reservedById`, `reservedAt`); **no** `Reservation` table. ERD matches. FR-25 = `reservedById` + `status=RESERVED`. | **CLOSED** |
| **Gate DTO / list-title leak** | shared-data + FO | **AD-7**: discriminant exactly `gifts \| friends_only_gate \| anon_gate \| not_found`. `friends_only_gate` allows `owner: { id, nick, displayName }`, `list: { type: "FRIENDS_ONLY" }`, copy key; **forbids** `list.title` and all gift fields. **AD-6**(3): FO not shown as profile row to non-friend. | **CLOSED** |
| **Sole writer** (Service vs Action SQL) | mutation paths | **AD-8**: **only** `GiftStatusService` writes `status` / `reservedById` / `reservedAt`; actions/cron thin. Owner **cannot** `OPEN→RESERVED` → `FORBIDDEN`. **AD-1** cron/handlers call same methods. | **CLOSED** |
| **List cardinality / token rotate** | URL & entity ownership | **AD-6**: exactly two lists, `UNIQUE(ownerId, type)`; no create/delete APIs; `publicToken` immutable (no R1 rotation); share URL only `/l/{publicToken}`; profile Discoverable via same `VisibilityPolicy`. | **CLOSED** |
| **Friendship protocol** | two owners one entity | **AD-10**: FO ↔ `Friendship` row only; accept = one txn insert UNIQUE + delete **all** pair invites; reverse-pending → **auto-accept**; unfriend/Block clears Friendship+invites (+ Block insert). | **CLOSED** |
| **Wire schema** | shared-data | **AD-12**: closed error codes; gates `ok: true` + `access`; gift card `{ id, title, description, priceCents, linkUrl, status, reservedBy, reservedAt }`; `RESERVED` ⇒ `reservedBy` non-null; `priceCents` only (no money-object); English status enums. Seed `contracts.ts`. | **CLOSED** |

R1 Hole 10 (clear vs keep `reservedById` on CLOSE) folded into **AD-8** / **AD-9**: keep `reservedById` on CLOSED; FR-25 active = `status=RESERVED` only. **CLOSED.**

---

## Spot-checks (no reopen)

- **D-11 preserved:** non-friend **without** Block still gets `friends_only_gate`, not 404; Block is a distinct ladder step.
- **A-14 preserved:** reservation card + `titleSnapshot` path after visibility loss; not full FO list read.
- **AD-15** binds the four critical races/privacy cases to runnable tests — reduces “forgot in epic” drift without being a fifth SoR.

## Remaining incompatible-builder holes

**None.**

Minor non-blocking notes (do **not** fail the spine; not α/β forks if ADs are followed):

- Success envelope nesting of `access` vs gift-card array key (`items` vs `gifts`) is implied rather than exemplified; freeze in `contracts.ts` at scaffold.
- ERD column `titleSnapshotOnReserve` vs prose `titleSnapshot` — one Prisma field name to pick at schema time; behavior is mandated (snapshot at reserve).

## Recommendation

Spine is sufficient as R1 build contract for parallel epic work on lists + friends + reserve. Implement `VisibilityPolicy`, `GiftStatusService`, and zod contracts first; keep AD-15 tests in the critical path.
