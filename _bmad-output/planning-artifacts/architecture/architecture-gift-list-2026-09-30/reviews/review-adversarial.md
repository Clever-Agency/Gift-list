---
name: Adversarial architecture review — Gift List spine
type: architecture-review
review_kind: adversarial-builder-divergence
target: ARCHITECTURE-SPINE.md
date: 2026-09-30
verdict: fail-open-holes
language: ru
locked_untouched:
  - D-10 mutual-friendship
  - D-11 list-links-FO-explanation-not-404
  - A-24 no-payments-R1
  - path-/l/{token}-opaque
  - CAS-reserve
---

# Adversarial review — Architecture Spine (Gift List R1)

## Verdict

**FAIL — open holes.** The spine’s direction (layered monolith, single visibility gate, CAS reserve, mutual friendship, opaque `/l/{token}`) is sound and respects locked product decisions. It is **not yet a sufficient build contract**: two competent teams can obey every AD *to the letter* and still ship incompatible shared-data shapes, dual mutation authorities, FO/Block divergences, and reservation races beyond the single CAS statement.

Locked product context was **not** reopened: D-10, D-11 (FO explanation ≠ 404), A-24, `/l/{token}` opaque, CAS reserve.

## Method

For each hole: **Builder α** and **Builder β** implement R1 epics/stories independently. Both cite the same ADs. Their artifacts cannot integrate (schema, action contracts, authz, or race outcomes diverge). Each hole ends with a **tightened AD** proposal (additive precision — not a product reopen).

---

## Hole 1 — FO gate payload & list-title leak (shared-data + FO)

### AD letters both obey

- **AD-7:** `FriendsOnlyGate` = metadata of owner / list type **without** gift rows / titles / count; FO non-friend gets explanation not `NotFound`.
- **AD-12:** list-by-token with gate is `{ ok: true, data }` with `access: …`, not `NOT_FOUND`.
- **AD-14:** notifications must not carry FO gift titles without FO access.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| Gate DTO | `access: "FriendsOnlyGate"`, `{ owner: { nick, avatarUrl }, list: { type, title }, message }` | `access: "friends_only"`, `{ ownerNick, listType }` only |
| Rationale α | «метаданные … типа списка» includes human list title; titles ban applies to **gifts** only | Title is list content adjacent to FO surface; only `type` + owner identity are gate-safe |
| Profile FO | Non-friend profile shows chip «есть закрытый список: {title}» via same metadata reading | Non-friend profile omits FO list entirely (PRD FR-8 spirit); only `/l/{token}` yields gate |

**Clash:** UI and any BFF cannot share one gate renderer; α leaks FO **list name** (and existence framing) where β does not. Gift-title ban is satisfied by both while privacy outcomes differ. `access` string vocabulary is unenum’d → wire incompatibility even when fields align.

### Tightened AD (propose)

**AD-7b — Gate & list-read DTOs (normative shapes)**

1. `VisibilityPolicy.resolve` result discriminant **exactly**: `gifts | friends_only_gate | anon_gate | not_found` (snake_case in JSON `access`).
2. `friends_only_gate.data` **may** include: `owner: { id, nick, avatarUrl? }`, `list: { type: "FRIENDS_ONLY" }` (and stable UX copy key). **Must not** include: `list.title`, `list.id` (optional: allow `list.id` only if product later needs support deep-links — default **omit**), gift ids, titles, descriptions, counts, images, `priceCents`, `reservedBy*`.
3. `anon_gate` / `gifts` shapes likewise fixed in spine companion schema (or OpenAPI stub): `gifts` includes gift cards only after resolve = `gifts`.
4. Profile enumeration for non-friends: **must not** surface FO list title or FO list row; discoverable may render gifts only after the same policy (or link-out to `/l/{token}` — pick one in AD-15 below).

---

## Hole 2 — Block vs `/l/{token}` (two authz owners / FO–discoverable leak path)

### AD letters both obey

- **AD-10:** Block = separate entity; breaks friendship; kills pending; blocks new invites; **mutual profile invisibility**.
- **AD-7:** resolve rules list only invalid token / anon / discoverable+auth / FO+friend|owner / FO+auth non-friend — **no Block clause**.
- **AD-6:** share path remains `/l/{publicToken}`.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| `VisibilityPolicy` | First checks `Block` either direction → `not_found` for **all** lists of the blocked user (profile + both tokens) | Block enforced only in profile/`/u/{nick}` loaders; `resolve(viewer, list)` ignores Block |
| Discoverable after block | `/l/{token}` → `not_found` (treat as mutual invisibility) | `/l/{token}` → `gifts` (AD-7 Discoverable+auth) — **gift contents still readable** via copied link |
| FO after block | Friendship removed → gate or not_found | Friendship removed → `friends_only_gate` (D-11 preserved) while discoverable still open |

**Clash:** α and β disagree on whether Block is a second owner of list-read authz beside Friendship/VisibilityPolicy. β obeys AD-7 literally and creates a **Block bypass** for Discoverable gifts via opaque links — catastrophic product asymmetry with «взаимная невидимость профилей».

### Tightened AD (propose)

**AD-7c — Block is part of resolve**

`VisibilityPolicy.resolve(viewer, list)`:

1. If either direction `Block(viewer, owner)` exists → **`not_found`** (same as invalid token) for **both** list types, including valid tokens. Rationale: mutual invisibility extends to list share URLs; do **not** use `friends_only_gate` here (would confirm list existence to the blocked party).
2. Else existing AD-7 ladder (owner → gifts; FO+friend → gifts; FO+auth → friends_only_gate; discoverable+auth → gifts; anon → anon_gate; bad token → not_found).
3. Single implementation module; profile and `/l/[token]` **must** call the same function — no parallel «profile-only block» check.

*(D-11 FO explanation remains for non-friend **without** Block; Block is a different outcome.)*

---

## Hole 3 — Reservation model fork (clashing shared-data shapes)

### AD letters both obey

- **AD-8:** status enum `OPEN | RESERVED | CLOSED`; transitions via `GiftStatusService`.
- **AD-9:** CAS `UPDATE … WHERE id AND status = 'OPEN'`; *«partial unique index на активную бронь, если бронь вынесена в строку; иначе инвариант держит CAS на status»*.
- **AD-4:** Postgres + Prisma SoR.
- Consistency ERD shows `reservedById` / `reservedAt` **on Gift** — but AD-9 explicitly allows a separate reservation row.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| Schema | `Gift.reservedById`, `Gift.reservedAt`; CAS alone | `Reservation` table (`giftId`, `userId`, `reservedAt`, `releasedAt`) + `Gift.status`; partial unique `(giftId) WHERE releasedAt IS NULL` |
| FR-25 «Мои брони» | `gifts WHERE reservedById = me AND status = RESERVED` | `reservations WHERE userId = me AND releasedAt IS NULL` JOIN gifts |
| A-14 after unfriend | Same gift row still RESERVED | Reservation row remains authority; gift status synced in service |
| R2 seam (AD-11) | Add COLLECTION on gift | Reservation vs Contribution parallel ledgers — different migration story |

**Clash:** Prisma schemas, migrations, and query contracts diverge while both claim AD-9. ERD «seed» and AD-9 footnote disagree → two legal SoR shapes.

### Tightened AD (propose)

**AD-9b — Single reservation representation (R1)**

1. **R1 normative:** reservation state lives **on `Gift`**: `status`, `reservedById`, `reservedAt` (nullable). **No** `Reservation` table in R1.
2. Remove the AD-9 fork sentence («если бронь вынесена в строку»). Optional partial unique is **not** used; CAS on `status = OPEN` is the sole concurrency control for reserve.
3. FR-25 reads gifts by `reservedById` + `status = RESERVED` (and historical: see Hole 5 for release clearing rules).
4. R2 may introduce `Contribution` / ledger tables per AD-11 without reinventing R1 reserve storage.

---

## Hole 4 — Non-reserve status mutations without CAS (reservation races)

### AD letters both obey

- **AD-9:** specifies CAS **only** for `OPEN → RESERVED`.
- **AD-8:** `RESERVED → OPEN` (holder | owner | cron); `RESERVED → CLOSED` (owner); all «through `GiftStatusService`».
- **AD-5:** cron → Route Handler.

### Incompatible pair

| Scenario | Builder α | Builder β |
|---|---|---|
| Release | `UPDATE … SET OPEN, clear reserved* WHERE id AND status=RESERVED AND (reservedById=$actor OR $actor=owner)` | `UPDATE … SET OPEN WHERE id` after `canTransition` in memory |
| Close | `WHERE status=RESERVED` (CAS) | Read status in RSC, then unconditional update |
| Cron vs owner close | Same CAS; one wins; loser CONFLICT | Cron sets OPEN; owner sets CLOSED without predicate → **CLOSED then overwritten to OPEN**, or double notifications |
| Holder release vs second reserve | α serialize; β window where status already OPEN in app memory but DB still RESERVED / vice versa |

**Clash:** Double-reserve is covered; **release/close/TTL races are not**. α and β both «use GiftStatusService» (validate vs execute) and produce different durable outcomes under concurrency — including resurrecting CLOSED gifts.

### Tightened AD (propose)

**AD-9c — CAS for every Gift status transition**

All writes that change `Gift.status` run in one DB transaction inside `GiftStatusService` with compare-and-set on **expected** status (and actor predicates):

| Transition | Predicate (normative) |
|---|---|
| `OPEN → RESERVED` | `status=OPEN` (+ actor ≠ owner **or** explicit allow — see Hole 6); set `reservedById`, `reservedAt` |
| `RESERVED → OPEN` (holder) | `status=RESERVED AND reservedById=actor`; clear `reservedById`, `reservedAt` |
| `RESERVED → OPEN` (owner or cron TTL) | `status=RESERVED` (+ cron: `reservedAt <= now()-14d`); clear reserved fields |
| `RESERVED → CLOSED` | `status=RESERVED`; set CLOSED; **keep or clear** reservedBy — **must pick one** (recommend: keep `reservedById` for audit, set `reservedAt` unchanged; status CLOSED wins over cron because cron predicate requires RESERVED) |

`rowCount ≠ 1` → `CONFLICT`. Cron and owner close **cannot** reopen CLOSED. Route Handler cron **must** call the same service method (no parallel SQL in the handler).

---

## Hole 5 — «Мои брони» vs VisibilityPolicy (FO gift leak / dual read owners)

### AD letters both obey

- **AD-7:** «Любой read API подарков обязан пройти тот же policy; запрещены сырые findMany по listId».
- **A-14 / map:** reservations remain manageable after visibility loss; capability map points FR-25 at queries by `reservedById`.
- **AD-14:** FO titles banned in **notifications** without access — not clearly in reservation APIs.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| FR-25 read | `findMany` by `reservedById` **without** `VisibilityPolicy` (justified: «not a list read»; A-14) | Every gift DTO hydrated only if `resolve` = `gifts` **or** viewer is `reservedBy` (explicit exemption) |
| After unfriend | Ex-friend still sees **live** FO gift title/description via «Мои брони» | Snapshot columns `reservedGiftTitle` at reserve time; live FO fields hidden; or strip description after loss of FO |
| Gift detail deep link | `/gifts/[id]` allows reserver to open FO gift by id forever | Detail uses policy; reserver gets limited card (title snapshot + release CTA only) |

**Clash:** α treats reservations as a **second owner** of gift reads and re-exposes FO content after unfriend/block edge cases. β can still satisfy A-14 with snapshots. AD-7’s «any gift read» vs FR-25 exemption is unresolved → FO leak by letter-lawyering.

### Tightened AD (propose)

**AD-7d — Gift read matrix**

| Reader context | Allowed fields |
|---|---|
| `resolve = gifts` | Full gift card per UX |
| Viewer is `reservedBy` and `status=RESERVED` (A-14 path) | **Reservation card only:** gift id, **title snapshot** (or live title — pick **snapshot**), status, list type, owner nick, release CTA. **No** other FO siblings, no list browse |
| `friends_only_gate` / `anon_gate` / `not_found` | No gift fields |
| Owner | Full on own lists |

Normative: persist `Gift.title` changes do not need to rewrite snapshots if snapshot-at-reserve is chosen; document choice. Notifications (AD-14) follow the same FO rule; reservation reminders to the reserver may use the snapshot.

---

## Hole 6 — Mutation authority split: Service vs Action vs Cron (conflicting state-mutation paths)

### AD letters both obey

- **AD-1:** mutations via Server Actions (or Route Handlers for cron).
- **AD-8:** transitions **only through** `GiftStatusService`.
- **AD-9:** shows raw SQL CAS (implies someone runs SQL).

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| `GiftStatusService` | Owns Prisma transaction + CAS; actions are thin | Pure functions `assertTransition` / `canReserve`; **actions and cron embed SQL** |
| Owner self-reserve | Forbidden in service | Allowed (not banned by AD-8) |
| Close semantics | Service requires owner + RESERVED | Action checks owner; service only checks enum edge |

**Clash:** Two codepaths mutate status; cron «forgets» service in β; ownership rules for self-reserve diverge; integration tests cannot share fixtures.

### Tightened AD (propose)

**AD-8b — Sole writer**

1. **Only** `GiftStatusService` may issue SQL/Prisma writes that change `Gift.status` or reservation columns. Actions/cron call service methods; handlers contain zero status SQL.
2. **Owner cannot** `OPEN → RESERVED` on own gifts (`FORBIDDEN`). Owner uses release-on-behalf and close only.
3. Domain service accepts `(actorId, giftId, command)` and returns AD-12 envelope codes.

---

## Hole 7 — Exactly-two lists & discoverable entry (URL scheme / two owners of «the» list)

### AD letters both obey

- **AD-6:** `/l/{publicToken}`; token per list at registration of **two** lists; nick change doesn’t break token.
- **AD-7:** `/l/...` must not mix the second list; Discoverable+auth → gifts.
- PRD (bound): profile shows Discoverable; exactly two lists created at signup; owner doesn’t delete them — **not restated as a hard AD uniqueness rule**.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| Cardinality | `@@unique([ownerId, type])` — exactly one DISCOVERABLE + one FRIENDS_ONLY | Multiple lists per type allowed; «starter» two + user-created extras |
| Token rotation | `publicToken` immutable | Settings «сбросить ссылку» → new CUID2 (AD-6 only forbids nick coupling) |
| Profile discoverable | Renders gifts inline via `resolve` on the unique discoverable list | Profile only links to `/l/{token}`; gifts never by `ownerId+type` on profile |
| Which token is «the» discoverable share | Unique | Ambiguous if two DISCOVERABLE rows exist |

**Clash:** URL scheme stays `/l/{token}` (locked) but **entity ownership** of discoverable-on-profile and share-link stability diverge; β’s rotation silently breaks copied links (FR-28) without violating AD-6 text.

### Tightened AD (propose)

**AD-6b — List cardinality & token lifecycle**

1. Each user has **exactly two** lists: one `DISCOVERABLE`, one `FRIENDS_ONLY`. DB: `UNIQUE(ownerId, type)`. No create/delete list APIs in R1; seed at registration only.
2. Each list has exactly one `publicToken` (CUID2, unique global). **No rotation in R1** (immutable after insert). Nick changes never rewrite token (unchanged).
3. Canonical share URL: `https://{host}/l/{publicToken}` only — no alternate query/listId public schemes.
4. **AD-15 (profile entry):** Profile `/u/{nick}` for allowed viewers loads the single discoverable list through `VisibilityPolicy` (same as token route). FO list is omitted from profile for non-friends (not a gate card on profile — only on `/l/{token}`). Block → profile `not_found` per AD-7c.

---

## Hole 8 — Friendship accept / dual edge writers (two owners of one entity)

### AD letters both obey

- **AD-10:** pending = directed `FriendshipInvite`; accepted = undirected `Friendship` with `(userLowId, userHighId)` UNIQUE; FO ↔ Friendship exists.

### Incompatible pair

| | Builder α | Builder β |
|---|---|---|
| Accept | Insert `Friendship`, **delete** invite rows both directions | Set invite `status=ACCEPTED`, insert `Friendship`; leave the other directed pending if cross-invited |
| Cross-invite race | Second invite while pending → `CONFLICT` or auto-accept | Two pendings allowed; accept either; UNIQUE on Friendship saves DB but FO checks might still look at invites |
| FO source of truth | Only `Friendship` table | Some UI treats `Invite.status=ACCEPTED` as friendship |

**Clash:** Dual writers/readers for «are we friends?» → intermittent FO grants, duplicate notifications, unfriend that clears Friendship but not ACCEPTED invites.

### Tightened AD (propose)

**AD-10b — Friendship write protocol**

1. FO access checks **only** `Friendship` row existence (and Block via AD-7c). Invites never grant FO.
2. Accept = single transaction: insert `Friendship(userLowId,userHighId)`, delete **all** invites between the pair (both directions). Reject/cancel deletes the invite only.
3. Creating an invite when reverse pending exists → **auto-accept path** (same transaction as accept) or `CONFLICT` — pick **auto-accept** for UX; document it.
4. Unfriend / Block: delete `Friendship` + all invites between pair; Block also inserts `Block`.

---

## Hole 9 — Action envelope & gift card wire shape (shared-data)

### AD letters both obey

- **AD-12:** `{ ok:true,data } | { ok:false,code,message }` and named codes; gates are success payloads.
- Consistency table names entities but **does not** freeze gift/list JSON fields or error `code` enums as a schema.

### Incompatible pair

| Field | Builder α | Builder β |
|---|---|---|
| Money | `priceCents: number \| null` | `price: { amount: "1990.00", currency: "RUB" }` (still «display ₽», nullable orient) |
| Status | `OPEN` | `open` / UX Russian enums on the wire |
| Reserved actor | `reservedBy: { id, nick }` always when RESERVED | `isReserved: true` without actor except to owner |
| Errors | `code: "CONFLICT"` | `code: "RESERVE_TAKEN"` mapped in UI only |

UJ-2 expects others to see **who** reserved — unbound in ADs → α/β both «compliant» and UI-incompatible.

### Tightened AD (propose)

**AD-12b — Wire schema appendix**

Publish a normative appendix (zod types in spine or `contracts.md`):

- Gift card (gifts access): `{ id, title, description, priceCents, linkUrl, status, reservedBy: null | { id, nick }, reservedAt }`.
- When `status=RESERVED` and viewer has gifts access: **`reservedBy` required** (non-null) for R1 transparency (UJ-2).
- Error `code` enum closed set exactly as AD-12; no parallel codes.
- `priceCents` = integer minor units or null; no decimal money object in R1.

---

## Hole 10 — Who may clear reserved columns on CLOSE / audit (minor, related to 3–4)

Builder α nulls `reservedById` on CLOSE (FR-25 loses history). Builder β keeps them for audit logging (AD consistency «audit status changes»). Both match AD-8 transitions. **Fold into AD-9c** (keep ids for audit; FR-25 active list filters `status=RESERVED` only).

---

## Cross-hole map (priority)

| Pri | Hole | Class | Breaks if ignored |
|---|---|---|---|
| P0 | 2 Block vs `/l/{token}` | authz / FO–discoverable leak | Privacy vs A-12 |
| P0 | 4 CAS only on reserve | reservation races | CLOSED↔OPEN races; SM-1 |
| P0 | 5 FR-25 vs policy | FO gift leak | NFR privacy |
| P1 | 1 Gate DTO / list title | shared-data + FO | D-11 surface inconsistency |
| P1 | 3 Reservation table fork | shared-data shapes | Unmergable schemas |
| P1 | 6 Service vs Action SQL | mutation paths | Divergent invariants |
| P1 | 7 Two lists / token rotate | URL & entity ownership | FR-9/28, profile |
| P2 | 8 Friendship writers | two owners one entity | Flaky FO |
| P2 | 9 Wire schema | shared-data | FE/BE thrash |

---

## Proposed AD index (additions only)

| ID | Title | Patches holes |
|---|---|---|
| AD-7b | Gate & list-read DTOs | 1, 9 |
| AD-7c | Block inside `resolve` | 2 |
| AD-7d | Gift read matrix (incl. A-14) | 5 |
| AD-6b | Cardinality + immutable token + profile entry | 7 |
| AD-8b | Sole status writer + no self-reserve | 6 |
| AD-9b | Gift-column reservation only | 3 |
| AD-9c | CAS all transitions | 4, 10 |
| AD-10b | Friendship write protocol | 8 |
| AD-12b | Wire schema appendix | 9, 1 |

No change requested to locked product decisions D-10 / D-11 / A-24 / opaque `/l/{token}` / CAS-on-reserve (CAS is **extended**, not replaced).

## Recommendation

Do **not** start parallel epic implementation until P0 tightenings (AD-7c, AD-9c, AD-7d) and P1 schema freezes (AD-9b, AD-6b, AD-8b, AD-7b) are merged into the spine. Otherwise the first integration of «lists + friends + reserve» will rediscover these holes as production incidents.
