---
name: Gift List
type: architecture-spine
purpose: build-substrate
altitude: feature
paradigm: modular-monolith-layered
scope: "Gift List Раунд 1 — веб: аккаунт, два списка, дружба, бронь «куплю сам», ссылки на списки. Без оплаты."
status: final
created: 2026-09-30
updated: 2026-10-10
language: ru
workflow: bmad-architecture
round: 1
working_mode: fast-path
binds:
  - FR-1..FR-15
  - FR-17
  - FR-23..FR-28
  - FR-29..FR-32
  - D-10
  - D-11
  - D-12
  - D-13
  - A-24
sources:
  - _bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/prd.md
  - _bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/addendum.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/EXPERIENCE.md
  - _bmad-output/planning-artifacts/briefs/brief-gift-list-2026-09-29/brief.md
companions: []
decisions_locked:
  - mutual-friendship-D-10
  - list-share-links-D-11
  - round-1-no-payments-A-24
  - palette-forest-paper
---

# Architecture Spine — Gift List (Раунд 1)

## Design Paradigm

**Modular monolith · layered Next.js App Router.** Один деплойный юнит; правила домена не живут в React и не дублируются в двух API.

| Слой | Каталог | Может зависеть от |
|------|---------|-------------------|
| UI / routes | `src/app/` | actions, components |
| Application | `src/actions/`, `src/lib/auth/` | domain, db |
| Domain | `src/domain/` | ничего внешнего (чистые правила + порты ошибок) |
| Persistence | `src/db/` | Prisma client only |

```mermaid
flowchart TB
  UI["app/ UI + RSC"] --> ACT["actions/ use-cases"]
  RH["app/api cron (внешний планировщик)"] --> ACT
  ACT --> DOM["domain/"]
  ACT --> DB["db/ Prisma"]
  DOM -->|"GiftStatusService пишет статус"| DB
```

Зависимости только **вниз**. Клиент не импортирует Prisma и не обходит `VisibilityPolicy` / `GiftStatusService`.

## Invariants & Rules

### AD-1 — Слои и направление зависимостей

- **Binds:** all
- **Prevents:** бизнес-логика в UI; параллельный SQL из компонентов/cron в обход сервисов
- **Rule:** Мутации продукта — Server Actions; cron/будущие webhooks — Route Handlers, которые **вызывают те же domain/application методы**. Domain не импортирует React/Next. Prisma — из `db/` и application/domain-writer сервисов по AD-8.

### AD-2 — Starter и UI-стек `[ADOPTED UX-A1]`

- **Binds:** frontend, design tokens
- **Prevents:** расхождение UI-библиотеки
- **Rule:** Холодный старт: `create-next-app@latest` (App Router, TypeScript, Tailwind, ESLint) → `shadcn@latest init` → brand delta Forest Paper из UX DESIGN.md.

### AD-3 — Аутентификация `[ASSUMPTION]`

- **Binds:** FR-1..FR-3, A-1..A-3
- **Prevents:** два источника сессии; OAuth в R1
- **Rule:** **Better Auth** — email + пароль, database sessions (cookie httpOnly). Сброс пароля и опциональное confirm-письмо — Resend. Ответы login/register/forgot **не** раскрывают, существует ли email (одинаковый UX). OAuth вне R1. Сессия обязательна для подарков и брони.

### AD-4 — Система записи `[ASSUMPTION]`

- **Binds:** all persistent state
- **Prevents:** разрозненные store
- **Rule:** PostgreSQL — единственный SoR. Prisma ORM **7.10.0** + миграции. Prod: managed Postgres (Neon preferred).

### AD-5 — Деплой и окружения `[ASSUMPTION]`

- **Binds:** ops envelope R1
- **Prevents:** разные хосты без явного решения
- **Rule:** Web → Vercel; DB → managed Postgres; email → Resend; секреты — env Vercel. Таймеры брони (D-12) — обычный Route Handler `api/cron/reservation-timers` (защищён секретом), который вызывает **любой внешний планировщик** (не Vercel Cron — правило переносимости; сейчас, например, GitHub Actions schedule, после переезда — cron хоста; раз в час, ARCH-A15) → **только** `GiftStatusService.processReservationTimers()`: ACTIVE→AWAITING_GIVER при `dueAt ≤ now`; AWAITING_GIVER→AWAITING_OWNER при `phaseAt ≤ now−72h`; AWAITING_OWNER→OPEN при `phaseAt ≤ now−168h AND bought=false`. Email — Resend. Staging = preview + отдельная DB.

### AD-6 — Списки, токены, профиль (A-25 / A-26) `[ASSUMPTION]`

- **Binds:** D-11, FR-9, FR-27, FR-28, A-25, A-26
- **Prevents:** URL от ника; ротация ссылок; третий список; расхождение профиля и `/l/...`
- **Rule:**
  1. У пользователя **ровно два** списка: `DISCOVERABLE` и `FRIENDS_ONLY`. DB: `UNIQUE(ownerId, type)`. Создаются при регистрации; API создания/удаления списков в R1 **нет**.
  2. Path шаринга = `/l/:publicToken`. `List.publicToken` = opaque CUID2, глобально UNIQUE, **immutable** после insert (без ротации в R1). Смена ника не трогает token.
  3. Профиль = `/u/:nick` отдельно. Для допустимого зрителя Discoverable грузится через тот же `VisibilityPolicy`, что и token-route. Friends-only **не** показывается строкой на профиле не-другу (gate только на `/l/:token`).
  4. Публичная схема URL только `/l/:publicToken` — без query/`listId` альтернатив.

### AD-7 — Модель видимости (единый gate)

- **Binds:** FR-7, FR-8, FR-11, FR-27, FR-31, D-11, D-13, A-11, A-12, A-14, NFR privacy
- **Prevents:** 404 как soft-deny для не-друга; Block-bypass через ссылку; утечка FO; второй read-owner для подарков
- **Rule:** Единственная `VisibilityPolicy.resolve(viewer, list)` → discriminant JSON `access`: `gifts | friends_only_gate | anon_gate | not_found`.

  **Порядок:**
  1. Список/token не найден → `not_found`.
  2. Есть `Block` в любую сторону между viewer и owner → `not_found` (для **обоих** типов списков и для профиля). Не `friends_only_gate` (не подтверждать существование).
  3. Владелец → `gifts`.
  4. Аноним → `anon_gate` (без подарков).
  5. Friends-only + принятая `Friendship` → `gifts`.
  6. Friends-only + auth не-друг → `friends_only_gate`.
  7. Discoverable + auth → `gifts`.

  **DTO gate:**
  - `friends_only_gate`: `owner: { id, nick, displayName }`, `list: { type: "FRIENDS_ONLY" }`, UX copy key. **Запрещено:** `list.title`, gift ids/titles/descriptions/counts/images/prices/reserved*.
  - `anon_gate`: тип списка можно не раскрывать сверх «войдите»; без подарков.
  - `gifts`: gift cards по AD-12.

  **Матрица чтения подарка:**
  | Контекст | Поля |
  |----------|------|
  | `access=gifts` | Полная gift card (AD-12) |
  | Viewer = `reservedById` и `status=RESERVED` (A-14 / FR-25) | **Только reservation card:** `giftId`, `titleSnapshot` (снимок на момент брони), `status`, `listType`, `ownerNick`, CTA снять. Без siblings FO, без browse списка |
  | gate / not_found | Нет gift-полей |
  | Owner своих списков | Полные карточки |

  **Поля брони по роли зрителя (D-13):**
  | Поле | Держатель | Владелец | Другие с `access=gifts` |
  |------|-----------|----------|--------------------------|
  | status | да | да | да |
  | reservedBy | да | только `holderVisibleToOwner` | только `holderVisibleToOthers` |
  | bought | да | **нет** | да |
  | phase | да | только `AWAITING_OWNER` / `GIVEN` (как `ownerAction`) | только `GIVEN` (как label) |
  | dueAt | да | нет | нет |
  | visibility toggles | да | нет | нет |

  Исключение для Владельца: preflight снятия брони / удаления подарка возвращает `warning: "BOUGHT" | "GIVEN" | null` — только в ответ на это действие.
  Reservation card держателя (A-14) дополняется полями `dueAt`, `phase`, `bought`, `holderVisibleToOwner`, `holderVisibleToOthers`.

  Любой list/gift read API (включая профиль) вызывает тот же `resolve`; сырой `findMany` по `listId` без policy запрещён. FR-25 — исключение только через reservation-card матрицу выше.

### AD-8 — Статусы подарка; единственный writer

- **Binds:** FR-10, FR-12, FR-17, FR-29..FR-32, D-12, D-13, UX-A11
- **Prevents:** dual mutation paths; self-reserve; reopen без решения; авто-снятие купленной брони
- **Rule:** Enum DB: `OPEN | RESERVED | CLOSED`. **Только** `GiftStatusService` выполняет Prisma/SQL, меняющий `status` и любые колонки брони / закрытия (AD-9). Actions и cron — тонкие вызовы сервиса.

  Переходы R1:
  - `OPEN → RESERVED` — даритель ≠ владелец; `dueAt`, `timeZone`, toggles обязательны
  - `RESERVED → RESERVED` (смена фазы / атрибутов) — держатель (продлить, bought, given, toggles); владелец (T6 «оставить», T10 «не получал»); cron (таймеры)
  - `RESERVED → OPEN` — держатель | владелец | cron (только `phase=AWAITING_OWNER AND bought=false`)
  - `OPEN | RESERVED → CLOSED` — владелец; reserved* **сохраняются** для аудита; пишутся `closedAt`, `closedFromStatus`; FR-25 активные = `status=RESERVED`
  - `CLOSED → closedFromStatus` — только владелец, только при `closedAt > now()-10s` (отмена) `[ARCH-A5]`
  - Остальные `CLOSED → *` запрещены
  - Владелец **не** может `OPEN → RESERVED` на своём подарке → `FORBIDDEN`
  - `COLLECTION` не используется в R1

  Gift CRUD: поля `title`, `description?`, `priceCents?`, `linkUrl?`; перенос между списками только при `OPEN`; правка полей при `RESERVED` разрешена и порождает событие держателю; удаление `RESERVED` снимает бронь + событие держателю; «Хочу ещё такой» — обычное создание OPEN-копии в выбранном списке.

### AD-9 — Сериализация всех переходов статуса

- **Binds:** FR-17, FR-19 (R1), FR-29..FR-32, SM-2, D-12
- **Prevents:** двойная бронь; гонки release/close/cron; fork схемы брони
- **Rule:** R1 хранит бронь **на `Gift`** (таблицы `Reservation` в R1 **нет**):
  `status`, `reservedById`, `reservedAt`, `reservationDueAt timestamptz`, `reservationTimeZone text` (IANA),
  `reservationPhase enum(ACTIVE|AWAITING_GIVER|AWAITING_OWNER|GIVEN)`, `reservationPhaseAt timestamptz`,
  `reservationBought bool default false`, `holderVisibleToOwner bool default false`, `holderVisibleToOthers bool default true`,
  `titleSnapshotOnReserve`, `closedAt timestamptz`, `closedFromStatus enum(OPEN|RESERVED)`.
  Индексы для cron: `(status, reservationPhase, reservationDueAt)`, `(status, reservationPhase, reservationPhaseAt)`.

  Каждый переход — одна транзакция с CAS на ожидаемый статус (+ предикат актора):

  | Transition | Predicate |
  |------------|-----------|
  | OPEN→RESERVED | `status=OPEN`; set reserved*, `phase=ACTIVE` |
  | holder: extend / bought / given / toggles | `status=RESERVED AND reservedById=actor` (+ `phase<>GIVEN` для given) |
  | owner: keep (T6) / not received (T10) | `status=RESERVED AND phase=AWAITING_OWNER` / `phase=GIVEN` |
  | cron: ACTIVE→AWAITING_GIVER | `status=RESERVED AND phase=ACTIVE AND dueAt<=now()` |
  | cron: AWAITING_GIVER→AWAITING_OWNER | `phase=AWAITING_GIVER AND phaseAt<=now()-72h` |
  | cron: AWAITING_OWNER→OPEN | `phase=AWAITING_OWNER AND phaseAt<=now()-168h AND bought=false`; clear reserved* |
  | RESERVED→OPEN (holder) | `status=RESERVED AND reservedById=actor`; clear reserved* |
  | RESERVED→OPEN (owner) | `status=RESERVED`; clear reserved* |
  | OPEN/RESERVED→CLOSED | `status = expected`; set CLOSED, `closedAt`, `closedFromStatus`; keep reserved* |
  | CLOSED→undo | `status=CLOSED AND closedAt>now()-10s AND owner=actor`; restore `closedFromStatus` |

  `dueAt` = конец выбранной даты в `reservationTimeZone`, вычисляется на сервере; валидация `today ≤ date ≤ today+30` в том же поясе (ARCH-A14).

  `rowCount ≠ 1` → `CONFLICT`. Клиентский optimistic UI не авторитетен.

### AD-10 — Дружба `[ADOPTED D-10]`

- **Binds:** FR-13..FR-15, FR-23, FR-24, A-11, A-12, A-16
- **Prevents:** invite как источник FO; дубли рёбер; Block в обход policy
- **Rule:**
  1. FO ↔ существует строка `Friendship` (не статус инвайта).
  2. Pending = `FriendshipInvite` (направленный). Accept = одна транзакция: insert `Friendship(userLowId,userHighId)` UNIQUE, удалить **все** инвайты между парой. Если встречный pending при создании инвайта — **auto-accept** тем же протоколом.
  3. Reject/cancel удаляет инвайт. Повтор после reject — не раньше 24ч (A-16).
  4. Unfriend: delete Friendship + инвайты пары. Block: то же + insert `Block`; новые инвайты запрещены; видимость — AD-7 шаг 2.

### AD-11 — Шов Раунда 2 без реализации

- **Binds:** A-24, A-17..A-21, FR-4, FR-16, FR-18..22
- **Prevents:** ledger в R1 **или** модель, ломающая платежи
- **Rule:** Нет таблиц платежей / ЮKassa / Contribution в R1. `priceCents` nullable. R2 добавит таблицы + `COLLECTION` + взаимоисключение внутри `GiftStatusService` без смены AD-6/7/10. FR-4 email-gate на деньги — R2. Заглушки оплаты в UI запрещены.

### AD-12 — Wire-контракт мутаций и карточек

- **Binds:** all write/read DTOs, D-13, FR-31, UJ-2
- **Prevents:** разнобой shapes; FO gate как NOT_FOUND; утечка имени держателя владельцу
- **Rule:** Action result: `{ ok: true, data } | { ok: false, code, message }`. Коды **закрытый** набор: `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION | RATE_LIMITED`. Gate-ответы — `ok: true` с `access`.

  Gift card при `access=gifts`:
  `{ id, title, description, priceCents: number|null, linkUrl, status: "OPEN"|"RESERVED"|"CLOSED", reservedBy: null | { id, nick, displayName }, reservationLabel: null | "BOUGHT" | "GIVEN", ownerAction: null | "CONFIRM_GIVEN" | "EXPIRED_NO_REPLY" }`.
  `reservedBy` заполняется по матрице AD-7 (D-13) и может быть `null` при `RESERVED`. `reservationLabel` — только не-владельцу; `ownerAction` — только владельцу. Держателю дополнительно — `reservation: { dueAt, phase, bought, holderVisibleToOwner, holderVisibleToOthers }`. Деньги только `priceCents` integer|null — без money-object.

### AD-13 — Идентификаторы, ник, поиск

- **Binds:** FR-5, FR-6, FR-8, A-5, A-6, A-26, UX-A6
- **Prevents:** nick как PK; утечка через поиск
- **Rule:** PK = CUID2. Ник: 3–24 `[a-z0-9_]`, уникальность case-insensitive (`nickNormalized`). Поиск: точный/префикс ник + нечёткое displayName с лимитом; `hideFromSearch=true` исключает из выдачи, прямые `/u/...` и `/l/...` работают по AD-7. Timestamps `timestamptz` UTC.

### AD-14 — Уведомления `[ASSUMPTION A-22]`

- **Binds:** FR-26, FR-31, SM-C1, NFR privacy
- **Prevents:** push-scope; FO leak в нотификациях; утечка держателя владельцу; повторные «пинги»
- **Rule:** R1 — in-app `Notification` + email (Resend) по событиям брони из FR-26 (+ email auth). Одно событие → одна запись `Notification` (+ одно письмо, если событие в email-перечне).
  `Notification.deliverAfter timestamptz` — для закрытия (= `closedAt + 10 s`); отмена удаляет недоставленную запись. Доставка отложенных писем — механизм на выбор dev (after-response task или cron), допустимая задержка ≤ 1 ч.
  Payload и письма: не содержат FO titles для получателя без FO; держателю — `titleSnapshot`; владельцу — без идентичности держателя без `holderVisibleToOwner` и без `bought`.

### AD-15 — Тестирование инвариантов `[ASSUMPTION]`

- **Binds:** AD-7, AD-9, AD-14, SM-2, FR-31
- **Prevents:** «забытые» гонки и privacy в epics
- **Rule:** Обязательные автотесты (уровень ниже выбирает runner): (1) параллельные две брони → ровно одна success; (2) FO token + non-friend → gate без gift fields; (3) Block + valid discoverable token → `not_found`; (4) unfriend + активная бронь → reservation card без siblings; (5) владелец при `holderVisibleToOwner=false` не получает идентичность держателя ни в gift card, ни в Notification, ни в письме; `bought` владельцу не отдаётся; (6) cron не переводит в OPEN брони с `bought=true` и в фазе GIVEN; (7) гонка cron-таймера и действия держателя/владельца → ровно один переход; (8) отмена закрытия после 10 s → `CONFLICT`. Остальной test pyramid — на epics.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Naming entities | `User`, `List` (`DISCOVERABLE` \| `FRIENDS_ONLY`), `Gift`, `Friendship`, `FriendshipInvite`, `Block`, `Notification` |
| Files | kebab-case файлы; PascalCase типы; domain без React |
| Status on wire | English enum `OPEN\|RESERVED\|CLOSED`; UI labels из UX (открыт/…) |
| Money R1 | `priceCents: number \| null`; display ₽ |
| Errors | AD-12 closed codes |
| Authz | AD-7 + ownership; object-level |
| Logging | audit смены Gift.status (actor, from→to, at) |
| Config | typed `env.ts` (zod); секреты не в клиент |
| Locale / theme | RU only; light only |
| Hide from search | `User.hideFromSearch` boolean default false |

## Stack

| Name | Version |
| --- | --- |
| Next.js (App Router) | 16.3.8 |
| React | 19.3.0 |
| TypeScript | create-next-app default at scaffold |
| Tailwind CSS | 4.3.3 |
| shadcn/ui | CLI latest at scaffold |
| Better Auth | 1.7.6 |
| Prisma + `@prisma/client` | 7.10.0 (pin; не `latest` → 8 RC) |
| PostgreSQL | 16+ managed |
| Zod | 4.6.5 |
| `@paralleldrive/cuid2` | 3.3.0 |
| Resend | 6.31.0 |
| Hosting | Vercel + Neon (preferred) + Resend |

Проверено npm view / Next security release 2026-09-30.

## Structural Seed

```text
src/
  app/
    (auth)/login|register|forgot|reset/
    (app)/                    # lists, search, friends, reservations, settings, notifications
    u/[nick]/
    l/[token]/
    api/cron/reservation-timers/
  actions/
  domain/
    visibility.ts
    gift-status.ts
    friendship.ts
  db/
    schema.prisma
    client.ts
  components/
  lib/
    auth.ts
    env.ts
    errors.ts
    contracts.ts              # zod wire types AD-12
```

```mermaid
erDiagram
  User ||--o| List : DISCOVERABLE
  User ||--o| List : FRIENDS_ONLY
  List ||--o{ Gift : contains
  User ||--o{ Gift : reservedBy
  User ||--o{ FriendshipInvite : sends
  User ||--o{ Friendship : edge
  User ||--o{ Block : blocks
  User ||--o{ Notification : receives
  List {
    string id PK
    string publicToken UK
    enum type
    string ownerId
  }
  Gift {
    string id PK
    enum status
    int priceCents
    string reservedById
    datetime reservedAt
    datetime reservationDueAt
    string reservationTimeZone
    enum reservationPhase
    datetime reservationPhaseAt
    bool reservationBought
    bool holderVisibleToOwner
    bool holderVisibleToOthers
    string titleSnapshotOnReserve
    datetime closedAt
    enum closedFromStatus
  }
```

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> RESERVED: reserve CAS (dueAt, toggles)
  state RESERVED {
    [*] --> ACTIVE
    ACTIVE --> AWAITING_GIVER: cron dueAt
    AWAITING_GIVER --> AWAITING_OWNER: cron +72h
    AWAITING_GIVER --> ACTIVE: holder extend / bought
    AWAITING_OWNER --> ACTIVE: holder extend / owner keep
    ACTIVE --> GIVEN: holder given
    AWAITING_GIVER --> GIVEN: holder given
    AWAITING_OWNER --> GIVEN: holder given
    GIVEN --> ACTIVE: owner not received (bought=true)
  }
  RESERVED --> OPEN: holder / owner release; cron +168h if !bought
  OPEN --> CLOSED: owner received
  RESERVED --> CLOSED: owner received
  CLOSED --> OPEN: undo ≤10s (closedFromStatus)
  CLOSED --> RESERVED: undo ≤10s (closedFromStatus)
  CLOSED --> [*]
```

## Capability → Architecture Map

| Capability / Area | Lives in | Governed by |
| --- | --- | --- |
| FR-1..3 Auth | `lib/auth`, `(auth)/*` | AD-3, AD-13 |
| FR-4 Email gate payments | — R2 | AD-11 |
| FR-5..8 Profile / search / hide | `u/[nick]`, search | AD-7, AD-13 |
| FR-9..12 Lists & gifts CRUD | actions + domain | AD-1, AD-6, AD-8 |
| FR-27..28 List links | `l/[token]`, `publicToken` | AD-6, AD-7 |
| FR-13..15,23..24 Friendship / block | `domain/friendship` | AD-10, AD-7 |
| FR-17 Reserve / release / close | `GiftStatusService` | AD-8, AD-9, AD-12 |
| FR-29..FR-32 Срок, отметки, видимость, закрытие | `GiftStatusService`, cron `reservation-timers` | AD-5, AD-7, AD-8, AD-9, AD-12, AD-14 |
| FR-25 My reservations | reservation card queries | AD-7 matrix, AD-9 |
| FR-26 Notifications | Notification + UI | AD-14 |
| A-24 / R2 payments | deferred | AD-11 |
| Race/privacy tests | test suite | AD-15 |
| Ops cron таймеры брони | cron → GiftStatusService | AD-5, AD-9 |

## Deferred

| Item | Why wait |
| --- | --- |
| ЮKassa, ledger, Contribution, payouts, refunds | A-24 / AD-11 |
| Статус COLLECTION + полное FR-19 | Раунд 2 |
| OAuth, Push/SMS, native | PRD non-goals |
| Share-sheet, per-gift links, OG design | D-11 out |
| Self-serve report / hard-delete account | ARCH-A1/A3 |
| i18n, dark mode | UX-A8/A9 |
| Redis rate-limit prod hardening | пилот; soft |
| Prisma 8 | RC; revisit after GA |
| Финальный бренд/домен | Q-2 открыт |
| Полная test pyramid / e2e tooling | epics; AD-15 задаёт минимум |

## Open assumptions (не блокеры)

| ID | Решение spine | Источник |
|----|---------------|----------|
| ARCH-A1 | Нет self-serve репорта; контакт Sergey | Q-1 / UX-A2 |
| ARCH-A2 | Имя Gift List; домен открыт | Q-2 |
| ARCH-A3 | Удаление аккаунта — ручной запрос | Q-3 / UX-A4 |
| ARCH-A4 | Цена опциональна | Q-6 / UX-A5 |
| ARCH-A5 | Нет reopen CLOSED в R1, кроме отмены владельцем в течение 10 s | UX-A11, D-12 |
| ARCH-A6..A11 | Ник UX-A6; RU; light; cron; soft RL; Vercel+Neon+Resend | UX + ops |
| ARCH-A12 | Auto-accept при встречном pending инвайте | AD-10 |
| ARCH-A13 | `titleSnapshot` на бронь для A-14 path и писем держателю | AD-7, AD-14 |
| ARCH-A14 | Срок брони = конец даты в IANA-поясе дарителя (из браузера, fallback UTC); хранится как `reservationDueAt timestamptz` | A-27 |
| ARCH-A15 | Таймеры брони вызываются внешним планировщиком раз в час (не Vercel Cron); вызов идемпотентен, пропуск запуска только сдвигает переходы | D-12, переносимость |
