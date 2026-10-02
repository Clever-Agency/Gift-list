---
cursor:
  subagentId: "bc-1651e7f3-7e21-5275-9fcd-2d98972cd34b"
---
name: PRD → Architecture spine reconcile
type: architecture-review
review_kind: prd-reconcile
target: ARCHITECTURE-SPINE.md
sources:
  - prd-gift-list-2026-09-30/prd.md
  - prd-gift-list-2026-09-30/addendum.md
  - ux-gift-list-2026-09-30/EXPERIENCE.md (skim, routes)
date: 2026-09-30
language: ru
verdict: gaps-present
locked_covered:
  - D-10
  - D-11
  - A-24
  - A-25
  - A-26
---

# PRD reconcile — Architecture Spine (Gift List R1)

## Verdict

Locked decisions **D-10 / D-11 / A-24 / A-25 / A-26** and the load-bearing R1 spine (visibility gate, CAS reserve, opaque `/l/{token}`, mutual friendship, no payments) **did land**. Several quieter R1 requirements from the PRD are **absent or only named in binds without a Rule** — enough that a builder can miss them.

## Method

Compared PRD R1 FRs, NFRs, D-10/D-11/A-24, A-25/A-26, addendum R1 notes, and EXPERIENCE list routes against spine ADs, conventions, ER seed, capability map, Deferred, and Open assumptions. R2-only items counted as **correctly deferred**, not misses.

## Covered (no gap)

| Input | Where in spine |
|-------|----------------|
| D-10 mutual friendship | AD-10 |
| D-11 list links + FO explanation ≠ 404/blank | AD-6, AD-7, AD-12 |
| A-24 no payments R1 | AD-11, Deferred |
| A-25 path/token for list URL | AD-6 `/l/{publicToken}` CUID2 |
| A-26 nick change ≠ break list links | AD-6, AD-13 |
| Auth email+password, reset, optional confirm (A-1..A-3) | AD-3 |
| Two lists at registration + tokens | AD-6 |
| Visibility single gate (FR-7/11/27) | AD-7 |
| Gift statuses + owner close + 14d TTL (FR-17, A-9) | AD-8, AD-5 |
| Concurrent reserve = one winner (FR-17/19 R1, SM-2) | AD-9 |
| Unfriend / block (FR-23/24, A-11/A-12) | AD-10 |
| My reservations after FO loss (FR-25, A-14) | Capability map |
| FO titles not in notifications (FR-26 privacy) | AD-14 |
| R2 seam without stubs (addendum) | AD-8 COLLECTION slot, AD-11 |
| Routes `/l/{token}`, `/u/{nick}`, reservations, friends | Structural Seed ≈ EXPERIENCE |

## Misses — did NOT land (or landed as bind-only)

### High

| # | PRD / quiet req | Gap in spine |
|---|-----------------|--------------|
| H1 | **A-23** — имя держателя Брони видно Владельцу и всем, кто видит Подарок | Ни в одном AD Rule, ни в binds frontmatter. ER имеет `reservedById`, но нет контракта сериализации/видимости имени для gift viewers. Легко сделать «тайную бронь» против PRD/UX. |
| H2 | **FR-8** — «не показывать в поиске»; прямые `/u/{ник}` и Ссылки на списки остаются | Capability map помечает FR-5..8, но AD-7/AD-13 не описывают флаг/`hideFromSearch`, индекс поиска или исключение из выдачи. В ER/`User` поля нет. |
| H3 | **A-16** — повторный инвайт после отказа ≥ **24 ч** | AD-10 **binds** A-16, но Rule молчит: нет cooldown, хранения rejected-at, кода ответа. Builder может сделать мгновенный re-invite. |

### Medium

| # | PRD / quiet req | Gap in spine |
|---|-----------------|--------------|
| M1 | **FR-10** — поля Подарка: название, описание, опц. цена, **опц. URL товара**; перенос между списками только при `открыт`; удаление `забронирован` → confirm + снятие брони + уведомление | ER: только `status` / `priceCents` / reserve fields. Нет `productUrl`/`description`/`title`; нет правила move-if-OPEN; нет delete-reserved side-effects. |
| M2 | **FR-26** каталог событий R1 | AD-14: канал + anti-leak. Нет enum/типов: входящий инвайт; accept/reject; новая бронь владельцу; снятие (в т.ч. TTL); запрос владельцу подтвердить получение. Бейдж непрочитанных не зафиксирован в домене. |
| M3 | **FR-2 / FR-3** anti-enumeration | «Неверный пароль не раскрывает email»; «сброс на неизвестный email — одинаковый UI». AD-3/AD-12 не требуют одинаковых ответов / timing. |
| M4 | **FR-6 / A-6** семантика поиска | Seed/map упоминают search; нет: точный/префиксный Ник, нечёткое display name, лимит выдачи, auth-only. |
| M5 | **FR-9** инварианты контейнеров | Создание двух списков есть (AD-6); нет явного «нельзя третий / нельзя удалить Список» в AD. |

### Low / soft NFR

| # | PRD / quiet req | Gap in spine |
|---|-----------------|--------------|
| L1 | NFR **производительность** — Профиль/Список &lt; 2 с на 4G при ≤ 100 подарках | Нет SLA/budget в spine. |
| L2 | NFR **доступность** — клавиатура, контраст, labels | Нет floor в architecture (есть в UX EXPERIENCE); для spine ок как «owned by UX», но PRD cross-cut не процитирован. |
| L3 | §7 / offline — понятная ошибка на mutate при потере сети | Нет контракта (UX toast есть; spine actions/errors молчат). |
| L4 | §9 / addendum — не обещать оплату «скоро» как CTA | AD-11 запрещает stubs оплаты; явного copy/CTA ban нет (UX Voice закрывает). |
| L5 | Frontmatter `binds` | Нет FR-19 (R1 часть в AD-9), A-23, FR-8 как отдельные binds; метаданные неполные. |

## Correctly deferred (not misses)

FR-4, FR-16, FR-18–FR-22, A-8, A-13, A-17–A-21, COLLECTION UI/API, OAuth, push/SMS, share-sheet, per-gift links, guest checkout — Deferred / AD-11 / Non-goals. Addendum payment flow correctly out of R1.

## UX route skim

EXPERIENCE routes (`/`, `/l/{token}`, `/u/{nick}`, `/search`, `/friends`, `/reservations`, `/notifications`, `/settings`, auth) align with Structural Seed. No route-level spine miss for list links; product gaps above are domain/data/authz, not missing paths.

## Suggested spine follow-ups (additive)

1. AD (or extend AD-8): **A-23** — `reservedBy` identity exposed on every gift card after `VisibilityPolicy = Gifts`.
2. AD-15 search: **FR-6/FR-8** — match rules + `User.hideFromSearch` + direct-link bypass.
3. Extend AD-10 Rule: **A-16** 24h re-invite after reject (store `rejectedAt` / throttle).
4. Extend Gift model + AD: **FR-10** fields and move/delete-reserved invariants.
5. Extend AD-14: **FR-26** event type enum + unread badge source.
6. Auth note under AD-3/AD-12: **enumeration-safe** login/reset responses.
7. Optional: cite NFR perf/a11y/offline as non-blocking budgets or «UX-owned».

## Severity roll-up

| Severity | Count | IDs |
|----------|-------|-----|
| High | 3 | H1 A-23, H2 FR-8, H3 A-16 |
| Medium | 5 | M1 FR-10, M2 FR-26 catalog, M3 enum auth, M4 search semantics, M5 list immutability |
| Low | 5 | L1–L5 soft NFR / metadata |

**Bottom line:** load-bearing locks landed; quiet R1 holes are **A-23 visibility of reserver name**, **FR-8 hide-from-search**, **A-16 invite cooldown**, plus gift CRUD field/side-effect detail and notification event catalog.
