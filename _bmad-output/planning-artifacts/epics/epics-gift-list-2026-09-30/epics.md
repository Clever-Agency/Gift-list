---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/prd.md
  - _bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/EXPERIENCE.md
  - _bmad-output/planning-artifacts/briefs/brief-gift-list-2026-09-29/brief.md
project_name: Gift List
round: 1
language: ru
workflow: bmad-create-epics-and-stories
working_mode: coordinator-autonomous
status: final
created: 2026-09-30
updated: 2026-09-30
decisions_locked:
  - mutual-friendship-D-10
  - list-share-links-D-11
  - round-1-no-payments-A-24
  - palette-forest-paper
---

# Gift List - Epic Breakdown

## Overview

Этот документ — полный разбор эпиков и историй для **Gift List Раунд 1**: аккаунт, два списка, дружба, бронь «куплю сам», ссылки на списки. Без оплаты (A-24). Источники: PRD, UX (DESIGN + EXPERIENCE), Architecture Spine. Документы на русском; AC цитируют `FR-*` и `AD-*`.

**Режим:** coordinator-autonomous — набор входов и locked-решения подтверждены заданием Sergey; интерактивные меню step-файлов пройдены как подтверждённые входом.

## Requirements Inventory

### Functional Requirements

**В scope Раунда 1:**

- FR-1: Регистрация по email (email, пароль, имя, Ник) → аутентифицирован; два пустых Списка
- FR-2: Вход и выход; неверный пароль не раскрывает существование email
- FR-3: Сброс пароля по одноразовой email-ссылке; одинаковый UX для неизвестного email
- FR-5: Назначение и смена Ника; case-insensitive unique; после смены `/u/{старый}` → не найден; Ссылки на списки не ломаются (A-26)
- FR-6: Поиск по Нику/имени; не возвращает `hideFromSearch`; пустой результат — empty state
- FR-7: Профиль `/u/{ник}` — Discoverable виден auth; Friends-only только Другу; несуществующий ник → не найден
- FR-8: Опция «не показывать в поиске»; прямые `/u/` и `/l/` работают по правилам
- FR-9: Ровно два Списка (Discoverable + Friends-only) при регистрации; у каждого Ссылка на список; нельзя создать третий
- FR-10: CRUD Подарка (название, описание, опц. цена ≥ 0, опц. URL); перенос между списками только при `открыт`; удаление `забронирован` с confirm + снятие брони + notify
- FR-11: Просмотр по VisibilityPolicy (Профиль / дружба / Ссылка); не-друг не видит FO-подарки; FO-ссылка → объяснение (не 404)
- FR-12: Статусы `открыт` / `забронирован` / `закрыт` одинаковы для всех зрителей Подарка; прогресса сбора нет
- FR-13: Отправка Приглашения; до accept FO скрыт; no duplicate pending; при дружбе — no-op
- FR-14: Принятие/отклонение; после accept оба видят FO; повтор после reject ≥ 24ч (A-16)
- FR-15: Список друзей, исходящие pending, входящие; empty states
- FR-17: Бронь «куплю сам» OPEN→RESERVED; снятие держателем; владелец снимает; TTL 14 суток (A-9); закрытие владельцем; имя держателя видно (A-23); гонка — один успех
- FR-23: Unfriend → FO сразу недоступен; FO-ссылка → объяснение FR-27; активные брони по A-14
- FR-24: Block/unblock → взаимная невидимость профилей; дружба рвётся; pending отменяются; инвайты через блок запрещены
- FR-25: «Мои брони» — активные брони и снятие после потери видимости списка
- FR-26: In-app: входящий инвайт; accept/reject; новая бронь владельцу; снятие/TTL; запрос закрыть; badge; без утечки FO titles
- FR-27: Открытие `/l/{token}` — только этот Список; Discoverable/FO/anon/не-друг/invalid по D-11
- FR-28: Владелец копирует разные URL для двух Списков; без share-sheet

**Вне Раунда 1 (не покрывать stories R1; зафиксировано для трассировки):**

- FR-4: Email confirm gate на платежи — R2
- FR-16, FR-18–FR-22: Оплата, Сбор, ЮKassa, возвраты — R2 (A-24)
- FR-19 (полная форма Сбор↔Бронь) — R2; в R1 инвариант «одна активная бронь» закрыт через FR-17 + AD-9

### NonFunctional Requirements

- NFR-1 (Корректность состояний): ≤ 1 активная бронь на Подарок при конкуренции; цель пилота — 0 двойных «куплю сам» (SM-2)
- NFR-2 (Безопасность): защищённые сессии; авторизация на уровне объекта Список/Подарок
- NFR-3 (Приватность): Friends-only не утекает через API, поиск, уведомления; FO-ссылка для не-друга — объяснение без gift fields (не маскировка под 404)
- NFR-4 (Производительность): открытие Профиля/Списка < 2 с на 4G при ≤ 100 Подарках (ориентир)
- NFR-5 (Доступность): клавиатура на ключевых потоках; контраст; labels; WCAG 2.2 AA (UX-A10)
- NFR-6 (Наблюдаемость): аудит смены Gift.status (actor, from→to, at)

### Additional Requirements

Из Architecture Spine (R1):

- ARCH-R1: Starter AD-2 — `create-next-app@latest` (Next.js 16 App Router + TS + Tailwind + ESLint) → `shadcn init`; pin next ^16.3.8; Prisma 7.10.0; Better Auth 1.7.6; PostgreSQL; Zod 4; cuid2; Resend
- ARCH-R2: Слои AD-1 — `app` → `actions` → `domain` → `db`; клиент без Prisma
- ARCH-R3: Auth AD-3 — Better Auth email+password, database sessions; OAuth вне R1
- ARCH-R4: Hosting AD-5 — Vercel + managed Postgres (Neon preferred) + Resend; cron TTL → Route Handler → GiftStatusService
- ARCH-R5: AD-6 — path `/l/:publicToken`; token CUID2 immutable UNIQUE; ровно два списка UNIQUE(ownerId, type); профиль `/u/:nick`
- ARCH-R6: AD-7 — VisibilityPolicy.resolve → `gifts | friends_only_gate | anon_gate | not_found`; Block→not_found; FO gate DTO без gift fields; reservation-card матрица после unfriend
- ARCH-R7: AD-8 — GiftStatusService sole writer; enum OPEN|RESERVED|CLOSED; нет self-reserve; нет CLOSED→OPEN в R1 [ASSUMPTION ARCH-A5]
- ARCH-R8: AD-9 — CAS на все переходы статуса; бронь на колонках Gift; CONFLICT при rowCount≠1
- ARCH-R9: AD-10 — Friendship undirected после accept; auto-accept встречного pending [ASSUMPTION ARCH-A12]; Block protocol
- ARCH-R10: AD-11 — запрет платёжных таблиц/UI-заглушек оплаты в R1; `priceCents` nullable
- ARCH-R11: AD-12 — wire `{ok,data}|{ok:false,code,message}`; gift card с `reservedBy` non-null при RESERVED
- ARCH-R12: AD-13 — nick 3–24 `[a-z0-9_]`; hideFromSearch; PK cuid2
- ARCH-R13: AD-14 — in-app Notification; payload без FO titles без доступа
- ARCH-R14: AD-15 — обязательные тесты: (1) parallel reserve → 1 success; (2) FO+non-friend → gate без gifts; (3) Block+valid discoverable token → not_found; (4) unfriend+бронь → reservation card без siblings
- ARCH-A1..A5, A12: [ASSUMPTION] нет self-serve репорта; имя Gift List; ручное удаление аккаунта; цена опциональна; нет reopen CLOSED; auto-accept

### UX Design Requirements

- UX-DR1: Theme Forest Paper — CSS variables primary `#2F5D3A`, accent `#D4A017`, background `#F4F1EA` и связанные токены из DESIGN.md; light only (UX-A8)
- UX-DR2: Typography — Fraunces (display) + DM Sans (body/label/caption); один display на экран
- UX-DR3: Brand components — Gift card, Status pill (open/reserved/closed), Friends-only gate panel, List type chip, button-reserve «Куплю сам»
- UX-DR4: App chrome — desktop top nav; mobile bottom tab-bar (Списки · Поиск · Друзья · Брони · Ещё)
- UX-DR5: Copy/voice — канон Friends-only gate и Anon gate из EXPERIENCE.md; без CTA оплаты в R1
- UX-DR6: Empty/loading/error — skeleton; empty gifts/friends; сеть → toast; гонка брони → toast «Кто-то только что забрал…»
- UX-DR7: Forms — nick rules UX-A6; price optional UX-A5; focus rings primary
- UX-DR8: A11y — WCAG 2.2 AA на регистрация, бронь, FO gate, копирование ссылки
- UX-DR9: Settings copy — «Написать автору» (ARCH-A1); ручной запрос удаления (ARCH-A3); без self-serve delete/report
- UX-DR10: Responsive — mobile first; на lg две колонки списков только у владельца «Мои списки»

### FR Coverage Map

- FR-1: Epic 1 — регистрация
- FR-2: Epic 1 — вход/выход
- FR-3: Epic 1 — сброс пароля
- FR-5: Epic 3 — ник и смена
- FR-6: Epic 3 — поиск
- FR-7: Epic 3 — профиль
- FR-8: Epic 3 — скрыть из поиска
- FR-9: Epic 1 — два списка при регистрации
- FR-10: Epic 2 — CRUD подарков
- FR-11: Epic 3 (+ Epic 4 unlock FO) — видимость
- FR-12: Epic 2 + Epic 5 — отображение статусов
- FR-13: Epic 4 — приглашение
- FR-14: Epic 4 — accept/reject
- FR-15: Epic 4 — списки дружбы
- FR-17: Epic 5 — бронь/снятие/закрытие/TTL
- FR-23: Epic 4 — unfriend
- FR-24: Epic 4 — block
- FR-25: Epic 5 — мои брони
- FR-26: Epic 6 — уведомления
- FR-27: Epic 3 — ссылка на список
- FR-28: Epic 2 — копирование ссылок
- FR-4, FR-16, FR-18–FR-22: **deferred R2** (не в epics R1)

## Epic List

### Epic 1: Аккаунт и два пустых списка

Пользователь создаёт аккаунт, входит и сразу имеет ровно два пустых Списка со стабильными Ссылками (tokens). Закладывает starter-стек и auth.

**FRs covered:** FR-1, FR-2, FR-3, FR-9

### Epic 2: Владелец наполняет вишлист

Владелец управляет подарками в обоих Списках, видит статусы и копирует Ссылки на списки.

**FRs covered:** FR-10, FR-12 (owner), FR-28

### Epic 3: Обнаружение и открытие списков

Пользователи находят друг друга и открывают Списки по правилам VisibilityPolicy (D-11 / AD-7), без утечки Friends-only.

**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-11, FR-27

### Epic 4: Дружба in-service

Пользователи приглашают, принимают, ведут список друзей, удаляют и блокируют — взаимный доступ к Friends-only (D-10 / AD-10).

**FRs covered:** FR-13, FR-14, FR-15, FR-23, FR-24

### Epic 5: Бронь «куплю сам» и закрытие

Дарители бронируют без двойной покупки; владелец закрывает; «Мои брони» и TTL; sole writer + CAS (AD-8/9); обязательные тесты AD-15.

**FRs covered:** FR-17, FR-25, FR-12 (gifters), FR-19-R1 (concurrency via AD-9)

### Epic 6: Уведомления и оболочка пилота

In-app события без утечки FO; chrome/навигация; настройки контакта/удаления; a11y ключевых потоков.

**FRs covered:** FR-26 (+ UX-DR4/8/9, NFR-5)

---

## Epic 1: Аккаунт и два пустых списка

Пользователь может зарегистрироваться, войти и получить рабочую сессию с двумя пустыми Списками. Технический фундамент (Next.js 16, shadcn, Prisma, Better Auth) создаётся только в объёме, нужном этим историям.

### Story 1.1: Scaffold проекта из starter (Next.js + shadcn + Forest Paper)

As a разработчик пилота,
I want поднять приложение из официального starter со стеком R1 и палитрой Forest Paper,
So that дальнейшие stories пишутся в согласованной структуре (AD-1, AD-2).

**Acceptance Criteria:**

**Given** пустой репозиторий приложения (planning artifacts уже есть)
**When** выполняется scaffold по AD-2 (`create-next-app` App Router + TS + Tailwind + ESLint → `shadcn init`)
**Then** проект на Next.js ^16.3.8, React 19, Tailwind 4, TypeScript; структура слоёв готова под `src/app`, `src/actions`, `src/domain`, `src/db` (AD-1)
**And** подключены CSS-токены Forest Paper (UX-DR1) и шрифты Fraunces + DM Sans (UX-DR2); тема light only (UX-A8)
**And** Prisma 7.10.0 + PostgreSQL client настроены для локального/managed Postgres (AD-4); pin версий из Architecture Stack
**And** нет UI/кода оплаты, ЮKassa, COLLECTION (AD-11 / A-24)
**And** README описывает `dev`/`migrate` для локального запуска

### Story 1.2: Регистрация и создание двух Списков

As a новый пользователь,
I want зарегистрироваться с email, паролем, именем и Ником,
So that я сразу попадаю в сервис с двумя пустыми Списками (FR-1, FR-9).

**Acceptance Criteria:**

**Given** форма регистрации (email, пароль, displayName, nick)
**When** пользователь успешно регистрируется через Better Auth (AD-3)
**Then** создаётся сессия (cookie database session) и пользователь аутентифицирован (FR-1)
**And** в одной транзакции создаются ровно два List: `DISCOVERABLE` и `FRIENDS_ONLY` с UNIQUE(ownerId, type); у каждого immutable `publicToken` CUID2 UNIQUE (FR-9, AD-6)
**And** дубликат email или nick (case-insensitive) отклоняется с VALIDATION (FR-1, AD-13)
**And** nick соответствует 3–24 `[a-z0-9_]` (UX-DR7 / UX-A6 / AD-13)
**And** нет API создания/удаления третьего списка (AD-6)
**And** [ASSUMPTION ARCH-A2] продукт отображается как «Gift List»

### Story 1.3: Вход и выход

As a зарегистрированный пользователь,
I want войти по email/паролю и завершить сессию,
So that доступ к спискам защищён (FR-2, NFR-2).

**Acceptance Criteria:**

**Given** существующий аккаунт
**When** пользователь вводит верные credentials
**Then** создаётся валидная сессия и открывается home «Мои списки» (или заглушка home до Epic 2)
**Given** неверный пароль или неизвестный email
**When** пользователь пытается войти
**Then** сессия не создаётся и UI **не** раскрывает, существует ли email (FR-2, AD-3)
**When** пользователь выходит
**Then** текущая сессия на клиенте инвалидируется (FR-2)

### Story 1.4: Сброс пароля по email

As a пользователь, забывший пароль,
I want запросить сброс и задать новый пароль по одноразовой ссылке,
So that я восстанавливаю доступ без поддержки (FR-3).

**Acceptance Criteria:**

**Given** форма «Забыли пароль»
**When** пользователь указывает любой email (существующий или нет)
**Then** UI показывает одинаковый успех без enumeration (FR-3, AD-3)
**And** для существующего аккаунта Resend отправляет одноразовую time-limited ссылку (FR-3, AD-5)
**When** пользователь задаёт новый пароль по валидной ссылке
**Then** пароль обновляется и ссылка больше не действует
**And** просроченная/использованная ссылка отклоняется с понятным сообщением

---

## Epic 2: Владелец наполняет вишлист

Владелец наполняет Discoverable и Friends-only подарками, видит статусы и копирует Ссылки на списки.

### Story 2.1: Экран «Мои списки» с gift-card и status pill

As a владелец,
I want видеть оба своих Списка с карточками подарков и статусами,
So that я понимаю, что актуально (FR-12, UX-DR3).

**Acceptance Criteria:**

**Given** аутентифицированный владелец с двумя Списками (Epic 1)
**When** открывает home «Мои списки»
**Then** видны оба Списка с List type chip «Открытый» / «Только друзья» (UX-DR3)
**And** на `lg` допускаются две колонки; на mobile — Tabs/stacked (UX-DR10)
**And** empty state «Пока пусто» + CTA «Добавить подарок» на Fraunces (UX-DR6)
**And** gift-card и status-pill используют токены open/reserved/closed (UX-DR1/3); прогресс сбора не показывается (FR-12)
**And** cold load показывает skeleton (UX-DR6)

### Story 2.2: Создание и редактирование Подарка

As a владелец,
I want создавать и редактировать Подарки с опциональной ценой,
So that желания описаны без платёжных обязательств (FR-10, ARCH-A4).

**Acceptance Criteria:**

**Given** владелец на экране «Мои списки»
**When** создаёт Подарок (title required; description?; priceCents? ≥ 0; linkUrl?)
**Then** Подарок принадлежит ровно одному Списку и имеет status `OPEN` (FR-10, AD-8)
**And** цена опциональна, label «Цена (необязательно), ₽» — не required [ASSUMPTION ARCH-A4 / UX-A5] (UX-DR7)
**And** мутация идёт через Server Action → domain/db; envelope AD-12 (`ok` / codes)
**When** редактирует поля своего Подарка
**Then** изменения сохраняются; клиент не пишет в Prisma напрямую (AD-1, AD-12)

### Story 2.3: Перенос и удаление Подарка (OPEN)

As a владелец,
I want переносить открытые Подарки между Списками и удалять ненужные,
So that Discoverable и Friends-only отражают нужную видимость (FR-10).

**Acceptance Criteria:**

**Given** Подарок со status `OPEN`
**When** владелец переносит его в другой свой Список
**Then** перенос успешен (FR-10, AD-8)
**Given** Подарок со status `RESERVED` или `CLOSED`
**When** владелец пытается перенести
**Then** операция отклоняется (FORBIDDEN/VALIDATION) — перенос только из `OPEN` (FR-10)
**Given** Подарок `OPEN`
**When** владелец удаляет
**Then** Подарок удаляется
**And** удаление `RESERVED` (confirm + release через GiftStatusService + notify) закрывается в Story 5.3 — до появления броней в R1 путь RESERVED ещё не достижим из UI Epic 2

### Story 2.4: Копирование Ссылки на список

As a владелец,
I want скопировать отдельную Ссылку для каждого Списка,
So that могу шарить Discoverable и Friends-only без share-sheet (FR-28, D-11).

**Acceptance Criteria:**

**Given** владелец на «Мои списки»
**When** нажимает «Скопировать ссылку» у Discoverable и у Friends-only
**Then** в буфер попадают **разные** URL вида `/l/{publicToken}` (FR-28, AD-6)
**And** Toast «Ссылка скопирована» (UX-DR5); share-sheet не требуется
**And** смена ника (Epic 3) не меняет `publicToken` — ссылки остаются валидными (A-26, AD-6)

---

## Epic 3: Обнаружение и открытие списков

Пользователи находят людей и открывают Списки строго через VisibilityPolicy.

### Story 3.1: Смена Ника в настройках

As a пользователь,
I want сменить Ник с проверкой уникальности,
So that ссылка профиля актуальна, а Ссылки на списки не ломаются (FR-5, A-26).

**Acceptance Criteria:**

**Given** аутентифицированный пользователь в `/settings`
**When** задаёт новый валидный nick (3–24 `[a-z0-9_]`)
**Then** nickNormalized уникален case-insensitive; превью `@ник` (FR-5, AD-13, UX-DR7)
**And** `/u/{старый-ник}` → «пользователь не найден» (FR-5)
**And** `List.publicToken` не изменяется — `/l/{token}` продолжают работать (A-26, AD-6)
**When** nick занят
**Then** inline error «Этот ник уже занят» (EXPERIENCE)

### Story 3.2: VisibilityPolicy и wire DTO доступа

As a система,
I want единый `VisibilityPolicy.resolve(viewer, list)` с wire DTO,
So that все read-пути списков/подарков не утекают Friends-only (AD-7, AD-12, NFR-3).

**Acceptance Criteria:**

**Given** любой server read Список/Подарков (профиль, `/l/:token`, будущие actions)
**When** вызывается resolve
**Then** результат — discriminant `access`: `gifts | friends_only_gate | anon_gate | not_found` (AD-7)
**And** порядок: missing→not_found; Block any direction→not_found; owner→gifts; anon→anon_gate; FO+friendship→gifts; FO+auth non-friend→friends_only_gate; Discoverable+auth→gifts (AD-7)
**And** `friends_only_gate` DTO содержит только owner `{id,nick,displayName}` + `list.type=FRIENDS_ONLY` + copy key; **запрещены** gift ids/titles/counts/prices/reserved* (AD-7, FR-27, NFR-3)
**And** сырой `findMany` по listId без policy запрещён (AD-7)
**And** action/read envelope соответствует AD-12

### Story 3.3: Маршрут `/l/:publicToken` (D-11)

As a посетитель со Ссылкой на список,
I want открыть только этот Список по правилам видимости,
So that Discoverable шарится широко, а Friends-only не утекает (FR-27, D-11).

**Acceptance Criteria:**

**Given** валидный Discoverable token и auth viewer (не Block)
**When** открывает `/l/:publicToken`
**Then** `access=gifts` — видит только этот Список и Подарки; второй Список не показан (FR-27, AD-6)
**Given** аноним на любом валидном token
**When** открывает ссылку
**Then** `anon_gate` — copy «Войдите…»; без Подарков; CTA Войти/Регистрация; после входа тот же URL (FR-27, UX-DR5)
**Given** валидный Friends-only token и auth **не-друг**
**When** открывает ссылку
**Then** `friends_only_gate` — канон copy EXPERIENCE («Список только для друзей…»); **не** blank, **не** «не найдено», **не** gift rows (FR-27, D-11, UX-DR3/5)
**Given** невалидный/отсутствующий token
**When** открывает `/l/...`
**Then** `not_found` — «Список не найден» (FR-27) — это состояние **не** используется для отказа не-другу по валидному FO token
**Given** Block между viewer и owner
**When** открывает валидный Discoverable token
**Then** `not_found` (AD-7) — не friends_only_gate

### Story 3.4: Профиль `/u/:nick`

As a аутентифицированный пользователь,
I want открыть Профиль человека и увидеть Discoverable,
So that могу найти желания без Ссылки на список (FR-7, FR-11).

**Acceptance Criteria:**

**Given** существующий nick и auth viewer без Block
**When** открывает `/u/:nick`
**Then** видит карточку (displayName, nick) и Discoverable-подарки через VisibilityPolicy (FR-7, AD-7)
**And** Friends-only **не** показывается строкой/секцией не-другу; другу (после Epic 4) — можно показать FO секцию или ссылку (FR-7, FR-11, AD-6)
**Given** несуществующий nick
**When** открывает профиль
**Then** «Пользователь не найден» (FR-7)
**Given** Block
**When** открывает `/u/:nick`
**Then** not_found / «не найден» (AD-7) — без подтверждения существования через soft-deny

### Story 3.5: Поиск пользователей и «скрыть из поиска»

As a пользователь,
I want искать людей по нику/имени и скрывать себя из поиска,
So that обнаружение работает без телефонной книги (FR-6, FR-8).

**Acceptance Criteria:**

**Given** auth пользователь на `/search`
**When** ищет по nick (exact/prefix) или displayName (fuzzy + limit)
**Then** результаты соответствуют AD-13; пользователи с `hideFromSearch=true` не в выдаче (FR-6, FR-8)
**And** пустой результат — понятный empty state, не ошибка (FR-6)
**When** владелец включает «не показывать в поиске» в настройках
**Then** поиск перестаёт возвращать его; `/u/:nick` и `/l/:token` продолжают работать по AD-7 (FR-8)
**And** поиск не раскрывает Friends-only состав (NFR-3)

---

## Epic 4: Дружба in-service

Взаимная дружба открывает Friends-only обеим сторонам (D-10).

### Story 4.1: Отправка Приглашения

As a аутентифицированный пользователь,
I want отправить Приглашение из Профиля или поиска,
So that могу запросить взаимную дружбу (FR-13, AD-10).

**Acceptance Criteria:**

**Given** A и B не друзья и нет Block
**When** A отправляет invite B
**Then** создаётся направленный `FriendshipInvite` pending; FO друг друга **не** видны (FR-13, D-10, AD-10)
**When** повторный invite при pending
**Then** дубликат не создаётся (FR-13)
**When** уже есть Friendship
**Then** no-op с пояснением (FR-13)
**Given** Block между A и B
**When** A пытается пригласить
**Then** FORBIDDEN (FR-24, AD-10)
**And** [ASSUMPTION ARCH-A12] если существует встречный pending B→A, срабатывает auto-accept тем же протоколом, что Story 4.2 (AD-10)

### Story 4.2: Принятие и отклонение Приглашения

As a получатель Приглашения,
I want принять или отклонить,
So that после принятия оба видят Friends-only (FR-14, D-10).

**Acceptance Criteria:**

**Given** pending invite A→B
**When** B принимает
**Then** одна транзакция: insert `Friendship(userLowId,userHighId)` UNIQUE; удалить **все** инвайты между парой (FR-14, AD-10)
**And** оба видят Friends-only друг друга (в т.ч. `/l` FO → `gifts`) (FR-14, FR-11, AD-7)
**When** B отклоняет
**Then** инвайт удалён; FO не открыт; A видит статус отклонено (FR-14)
**And** повторный invite A→B не раньше 24 часов (A-16, AD-10)

### Story 4.3: Списки друзей и заявок

As a пользователь,
I want видеть друзей, входящие и исходящие заявки,
So that управляю кругом доступа к Friends-only (FR-15).

**Acceptance Criteria:**

**Given** `/friends`
**When** открывает раздел
**Then** видит друзей, входящие, исходящие pending (FR-15)
**And** empty states «Пока нет друзей…» / нет заявок (UX-DR6, FR-15)
**And** входящая строка: Принять (primary) / Отклонить (ghost) (EXPERIENCE)

### Story 4.4: Удаление из друзей

As a пользователь,
I want удалить друга,
So that Friends-only сразу закрывается с обеих сторон (FR-23, A-11).

**Acceptance Criteria:**

**Given** принятая Friendship A↔B
**When** любая сторона делает unfriend
**Then** Friendship (+ инвайты пары) удаляются; FO сразу `friends_only_gate` по валидной FO-ссылке — **не** «не найдено» (FR-23, FR-27, AD-7, AD-10)
**And** Discoverable остаётся по правилам AD-7
**And** повторная дружба только через новое принятое Приглашение (FR-23)
**And** если у бывшего друга была активная бронь на FO-подарок — бронь сохраняется для FR-25 / AD-7 reservation-card (полный UI в Epic 5); policy уже отдаёт reservation-card поля держателю (AD-7 матрица)

### Story 4.5: Блокировка и разблокировка

As a пользователь,
I want заблокировать человека,
So that профили взаимно невидимы и инвайты невозможны (FR-24, A-12).

**Acceptance Criteria:**

**Given** A блокирует B
**When** блок создан
**Then** Friendship рвётся; pending отменяются; insert Block; VisibilityPolicy → `not_found` для профилей и list tokens в обе стороны (FR-24, AD-7, AD-10)
**And** новые Приглашения через блок запрещены (FR-24)
**When** A разблокирует B
**Then** Block снимается; доступ не восстанавливает дружбу автоматически — нужна новая дружба

---

## Epic 5: Бронь «куплю сам» и закрытие

Координация подарков без оплаты: единственная бронь, CAS, «Мои брони», TTL, обязательные privacy/race тесты.

### Story 5.1: GiftStatusService — бронь CAS

As a даритель,
I want нажать «Куплю сам» на открытом Подарке,
So that статус станет однозначным для всех и двойной брони не будет (FR-17, AD-8, AD-9, NFR-1).

**Acceptance Criteria:**

**Given** auth даритель ≠ владелец; Подарок `OPEN`; viewer имеет `access=gifts`
**When** вызывает reserve через Server Action → **только** `GiftStatusService` (AD-8)
**Then** CAS: `UPDATE ... WHERE id=? AND status=OPEN` → `RESERVED`, set `reservedById`, `reservedAt`, `titleSnapshot` (AD-9, ARCH-A13)
**And** gift card wire: `status=RESERVED`, `reservedBy` non-null `{id,nick,displayName}` для всех с `access=gifts` (FR-17, A-23, AD-12, FR-12)
**And** UI CTA «Куплю сам» (button-reserve); optimistic + откат; при CONFLICT toast «Кто-то только что забрал этот подарок» (UX-DR5/6)
**Given** владелец своего Подарка
**When** пытается reserve
**Then** FORBIDDEN — no self-reserve (AD-8)
**Given** две параллельные reserve
**When** обе транзакции завершаются
**Then** ровно одна success; вторая CONFLICT (FR-17, AD-9, AD-15-1, SM-2)
**And** нет таблиц Reservation/Payment (AD-9, AD-11)

### Story 5.2: Снятие брони держателем и владельцем

As a держатель брони или владелец,
I want снять бронь,
So that Подарок снова `открыт` (FR-17, A-9).

**Acceptance Criteria:**

**Given** Подарок `RESERVED`
**When** `reservedById` снимает бронь
**Then** CAS RESERVED→OPEN с предикатом holder; clear reserved* (AD-9); статус `OPEN` (FR-17)
**When** владелец снимает чужую бронь
**Then** CAS RESERVED→OPEN (owner predicate); держатель получает путь к уведомлению (FR-17, A-9; доставка в Epic 6)
**And** все переходы только через GiftStatusService (AD-8)

### Story 5.3: Закрытие Подарка владельцем и удаление RESERVED

As a владелец,
I want подтвердить получение и закрыть забронированный Подарок,
So that желание снято с координации (FR-17, ARCH-A5).

**Acceptance Criteria:**

**Given** Подарок `RESERVED`
**When** владелец подтверждает закрытие (confirm copy UX-A11)
**Then** CAS RESERVED→CLOSED; `reservedById` сохраняется для аудита (AD-8, AD-9); UI «закрыт»
**And** [ASSUMPTION ARCH-A5 / UX-A11] CLOSED→OPEN в R1 **запрещён** — нет reopen
**Given** Подарок `RESERVED`
**When** владелец удаляет с подтверждением
**Then** release через GiftStatusService + notify держателя + удаление (FR-10, AD-8) — закрывает путь из Story 2.3
**And** audit log смены статуса (NFR-6)

### Story 5.4: «Мои брони» и reservation-card после unfriend

As a даритель,
I want видеть и снимать свои активные брони даже после потери видимости Списка,
So that UJ-5 / A-14 выполняются без утечки siblings FO (FR-25, AD-7).

**Acceptance Criteria:**

**Given** у пользователя есть Подарки `RESERVED` где он `reservedById`
**When** открывает `/reservations`
**Then** видит активные брони и может снять (FR-25)
**Given** unfriend при активной FO-брони
**When** бывший друг открывает FO `/l/:token`
**Then** `friends_only_gate` без gift rows; в «Мои брони» — **reservation card**: `giftId`, `titleSnapshot`, `status`, `listType`, `ownerNick`, CTA снять — **без** siblings FO и browse списка (FR-25, FR-23, AD-7, AD-15-4)

### Story 5.5: Cron TTL снятия брони (14 суток)

As a система,
I want автоматически снимать просроченные брони,
So that «забытые» брони не блокируют Подарок навсегда (FR-17, A-9, AD-5).

**Acceptance Criteria:**

**Given** `RESERVED` с `reservedAt <= now()-14d`
**When** Vercel Cron бьёт Route Handler expire-reservations
**Then** Handler вызывает **только** `GiftStatusService.releaseExpired()` с CAS (AD-5, AD-8, AD-9)
**And** статус → OPEN; путь уведомления держателю (доставка Epic 6)
**And** endpoint защищён от публичного вызова (секрет cron / NFR-2)

### Story 5.6: Обязательные автотесты гонки и privacy (AD-15)

As a команда пилота,
I want автотесты инвариантов брони и видимости,
So that SM-2 и NFR-3 не регрессируют (AD-15).

**Acceptance Criteria:**

**Given** test runner выбран командой (уровень — integration/domain)
**When** прогоняется suite AD-15
**Then** (1) две параллельные reserve → ровно одна success
**And** (2) FO token + non-friend → gate DTO **без** gift fields
**And** (3) Block + valid discoverable token → `not_found`
**And** (4) unfriend + активная бронь → reservation card без siblings
**And** suite обязателен в CI/локальном gate перед merge историй Epic 5

---

## Epic 6: Уведомления и оболочка пилота

События R1, навигация, настройки контакта, a11y.

### Story 6.1: In-app уведомления R1

As a пользователь,
I want видеть in-app события дружбы и брони,
So that не пропускаю приглашения и статусы (FR-26, AD-14).

**Acceptance Criteria:**

**Given** события R1: входящий инвайт; accept/reject; новая бронь владельцу; снятие/TTL брони; запрос владельцу закрыть
**When** событие происходит
**Then** создаётся `Notification`; badge непрочитанных (FR-26)
**And** payload **не** содержит FO titles для получателя без FO access (FR-26, AD-14, NFR-3); держателю брони допустим `titleSnapshot`
**And** нет push/SMS (A-22)
**And** UI `/notifications` или sheet по EXPERIENCE IA

### Story 6.2: App chrome и мобильная навигация

As a пользователь на вебе (в т.ч. mobile),
I want устойчивую навигацию по ключевым разделам,
So that UJ-1…UJ-5 достижимы без тупиков (UX-DR4).

**Acceptance Criteria:**

**Given** auth сессия
**When** пользуется приложением
**Then** desktop: top nav — логотип Gift List, Поиск, Друзья (badge), Уведомления (badge), Мои брони, Avatar→settings (UX-DR4)
**And** `< md`: bottom tab-bar Списки · Поиск · Друзья · Брони · Ещё (UX-DR4)
**And** нет пунктов оплаты / «Мои взносы» / dark toggle (A-24, UX-A8)

### Story 6.3: Настройки — контакт и удаление аккаунта (копирайт)

As a пользователь,
I want в настройках найти контакт автора и способ запросить удаление,
So that Q-1/Q-3 закрыты без self-serve moderation (UX-DR9).

**Acceptance Criteria:**

**Given** `/settings`
**When** пользователь открывает раздел помощи/аккаунта
**Then** есть «Написать автору» (контакт Sergey) — **нет** self-serve репорта [ASSUMPTION ARCH-A1] (UX-DR9)
**And** копирайт удаления аккаунта — ручной запрос, без hard-delete flow [ASSUMPTION ARCH-A3] (UX-DR9)
**And** доступны смена имени/ника (уже Epic 3), hideFromSearch, выход

### Story 6.4: A11y ключевых потоков

As a пользователь с клавиатурой / AT,
I want пройти регистрацию, бронь, FO gate и копирование ссылки,
So that пилот соответствует WCAG 2.2 AA на ключевых потоках (NFR-5, UX-DR8).

**Acceptance Criteria:**

**Given** ключевые потоки: регистрация, «Куплю сам», Friends-only gate, копирование ссылки
**When** проверяются клавиатура, labels, фокус-кольцо `{colors.ring}`, контраст токенов
**Then** потоки соответствуют WCAG 2.2 AA floor (UX-A10, UX-DR8)
**And** FO gate и anon gate доступны без потери смысла copy (UX-DR5)

---

## Validation Notes (Step 4)

| Check | Result |
|-------|--------|
| Все FR R1 покрыты stories | ✅ FR-1..3,5..15,17,23..28 |
| FR R2 явно deferred | ✅ FR-4,16,18–22 |
| Epic 1 Story 1 = starter AD-2 | ✅ Story 1.1 |
| Сущности/таблицы по мере нужды | ✅ User/List в E1; Gift E2; Friendship E4; Notification E6; статусные поля Gift E5 |
| Нет forward-deps внутри эпиков | ✅ |
| Epic independence | ✅ E2 работает без E3; E3 без E4 (FO=gate); E4 unlock FO; E5 бронь; E6 notify |
| AD-7/8/9/10/12/15 в AC | ✅ |
| A-24 / нет оплаты в stories | ✅ |
| UX-DR покрыты | ✅ токены E1; cards E2; gates E3; chrome/a11y/settings E6 |
| File churn | Принято: VisibilityPolicy/GiftStatusService наращиваются по эпикам — осознанно (policy до friendship; status service до reserve) |

**Workflow complete.** Следующий BMAD шаг: `bmad-sprint-planning` / implementation readiness.
