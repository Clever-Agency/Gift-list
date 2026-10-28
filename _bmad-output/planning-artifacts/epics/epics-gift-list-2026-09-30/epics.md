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
updated: 2026-10-28
decisions_locked:
  - mutual-friendship-D-10
  - list-share-links-D-11
  - round-1-no-payments-A-24
  - palette-forest-paper
  - birthday-reminders-D-18
---

# Gift List - Epic Breakdown

## Overview

Этот документ — разбор эпиков и историй для **Gift List MVP**: аккаунт, один вишлист, дружба и подписка, бронь единичного желания, публичная ссылка, нативный клиент, даты и напоминания. Без оплаты и без денежных сборов (A-24, D-25). Источники: PRD после D-20…D-33, UX, Architecture Spine. Документы на русском. Истории ниже, где ещё сказано «два списка», заменены правками 2026-10-28 в самих AC.

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
- FR-9: Ровно один вишлист при регистрации; одна ссылка; второй список создать нельзя (D-23)
- FR-10: CRUD Подарка (название, описание, опц. цена ≥ 0, опц. URL); перенос между списками только при `открыт`; удаление `забронирован` с confirm (+ предупреждения «Купил» / «Подарил») + снятие брони + notify ✉︎; правка забронированного → notify держателя ✉︎
- FR-11: Просмотр по VisibilityPolicy (Профиль / дружба / Ссылка); не-друг не видит FO-подарки; FO-ссылка → объяснение (не 404)
- FR-12: Статусы `открыт` / `забронирован` / `закрыт` одинаковы для всех зрителей Подарка; прогресса сбора нет; имя держателя и подписи — по D-13 (FR-31)
- FR-13: Отправка Приглашения; до accept FO скрыт; no duplicate pending; при дружбе — no-op
- FR-14: Принятие/отклонение; после accept оба видят FO; повтор после reject ≥ 24ч (A-16)
- FR-15: Список друзей, исходящие pending, входящие; empty states
- FR-17: Бронь «куплю сам» OPEN→RESERVED со Сроком (по умолчанию +7, ≤ +30) и переключателями видимости; снятие держателем и владельцем (с предупреждениями); гонка — один успех (D-12)
- FR-23: Unfriend → FO сразу недоступен; FO-ссылка → объяснение FR-27; активные брони по A-14
- FR-24: Block/unblock → взаимная невидимость профилей; дружба рвётся; pending отменяются; инвайты через блок запрещены
- FR-25: «Мои брони» — активные брони, Срок, фаза, «Купил», переключатели; продлить / Купил / Подарил / снять; reservation card после потери видимости
- FR-26: In-app: инвайты, accept/reject, новая бронь, снятие; in-app + email: события брони (перечень FR-26 PRD); badge; без утечки FO titles и идентичности держателя
- FR-27: Открытие `/l/{token}` — только этот Список; Discoverable/FO/anon/не-друг/invalid по D-11
- FR-28: Владелец копирует разные URL для двух Списков; без share-sheet
- FR-29: Срок брони и цикл истечения: уведомление держателю ✉︎ → 72 ч → запрос владельцу ✉︎ → 168 ч → авто-снятие только без «Купил»; продления без лимита; пояс дарителя (A-27)
- FR-30: Отметки «Купил» / «Подарил»; подтверждение владельцем «Получил» / «Не получал»; без автозакрытия
- FR-31: Видимость держателя: «видим владельцу» (выкл.) / «видим другим» (вкл.); скрытие на уровне API/уведомлений/email; «Купил» скрыт от владельца
- FR-32: Закрытие владельцем из открыт/забронирован; отмена 10 с; секция «Получено»; «Хочу ещё такой» с выбором Списка
- FR-33: ДР в Профиле — день и месяц (год опционален, виден только владельцу); «Показывать друзьям» (вкл.); виден только Друзьям; 29.02 → 28.02 в невисокосный год (D-18)
- FR-34: Напоминание дарителю за 14 дней до ДР Друга ✉︎ — только при ≥ 1 открытом видимом Подарке; одно в год на пару; без держателей и RESERVED/CLOSED
- FR-35: Напоминание владельцу за 30 дней до своего ДР ✉︎ «обновите списки»
- FR-36: Настройки напоминаний (2 переключателя), отписка в один клик без входа + `List-Unsubscribe`; ≤ 1 письма-напоминания в день (дайджест); письма брони не затрагиваются
- FR-37: Часовой пояс пользователя (IANA) — из браузера при первом заходе, fallback UTC, правка в настройках; для Срока брони (A-27) и напоминаний (A-28)

**Вне Раунда 1 (не покрывать stories R1; зафиксировано для трассировки):**

- FR-4: Email confirm gate на платежи — R2
- FR-16, FR-18–FR-22: Оплата, Сбор, ЮKassa, возвраты — R2 (A-24)
- FR-19 (полная форма Сбор↔Бронь) — R2; в R1 инвариант «одна активная бронь» закрыт через FR-17 + AD-9
- FR-38 (Личные даты) — MVP (D-22). FR-39 (Интересы) — Раунд 1.5
- FR-40, FR-46, FR-47, FR-50, FR-51 — телефон, подписка, приглашение, контакты, удаление аккаунта — MVP
- FR-41, FR-42, FR-44, FR-48, FR-49, FR-52 — тип желания, срок, теги, идея, админка, каналы — MVP
- FR-43 — настройки видимости профиля — MVP

### NonFunctional Requirements

- NFR-1 (Корректность состояний): ≤ 1 активная бронь на Подарок при конкуренции; цель пилота — 0 двойных «куплю сам» (SM-2); брони с «Купил» / «Подарил» не снимаются автоматически
- NFR-2 (Безопасность): защищённые сессии; авторизация на уровне объекта Список/Подарок
- NFR-3 (Приватность): Friends-only не утекает через API, поиск, уведомления; FO-ссылка для не-друга — объяснение без gift fields (не маскировка под 404); идентичность держателя не уходит владельцу без согласия (FR-31)
- NFR-4 (Производительность): открытие Профиля/Списка < 2 с на 4G при ≤ 100 Подарках (ориентир)
- NFR-5 (Доступность): клавиатура на ключевых потоках; контраст; labels; WCAG 2.2 AA (UX-A10)
- NFR-6 (Наблюдаемость): аудит смены Gift.status (actor, from→to, at)

### Additional Requirements

Из Architecture Spine (R1):

- ARCH-R1: Starter AD-2 — `create-next-app@latest` (Next.js 16 App Router + TS + Tailwind + ESLint) → `shadcn init`; pin next ^16.3.8; Prisma 7.10.0; Better Auth 1.7.6; PostgreSQL; Zod 4; cuid2; Resend
- ARCH-R2: Слои AD-1 — `app` → `actions` → `domain` → `db`; клиент без Prisma
- ARCH-R3: Auth AD-3 — Better Auth email+password, database sessions; OAuth вне R1
- ARCH-R4: Hosting AD-5 — Vercel (Hobby) только на этапе разработки, целевая схема — Docker-образ на собственном сервере в РБ или РФ (D-15); managed Postgres (Neon preferred) + Resend; платформенные сервисы Vercel запрещены (AD-16, D-16); таймеры брони — Route Handler, вызываемый внешним cron → GiftStatusService
- ARCH-R5: AD-6 — path `/l/:publicToken`; token CUID2 immutable UNIQUE; ровно два списка UNIQUE(ownerId, type); профиль `/u/:nick`
- ARCH-R6: AD-7 — VisibilityPolicy.resolve → `gifts | friends_only_gate | anon_gate | not_found`; Block→not_found; FO gate DTO без gift fields; reservation-card матрица после unfriend
- ARCH-R7: AD-8 — GiftStatusService sole writer; enum OPEN|RESERVED|CLOSED; нет self-reserve; нет reopen CLOSED в R1, кроме отмены владельцем 10 с [ASSUMPTION ARCH-A5]
- ARCH-R8: AD-9 — CAS на все переходы статуса; бронь на колонках Gift (dueAt, timeZone, phase, bought, toggles, closedAt/closedFromStatus); CONFLICT при rowCount≠1
- ARCH-R9: AD-10 — Friendship undirected после accept; auto-accept встречного pending [ASSUMPTION ARCH-A12]; Block protocol
- ARCH-R10: AD-11 — запрет платёжных таблиц/UI-заглушек оплаты в R1; `priceCents` nullable
- ARCH-R11: AD-12 — wire `{ok,data}|{ok:false,code,message}`; gift card с `reservedBy` по матрице AD-7 / D-13 (может быть null при RESERVED)
- ARCH-R12: AD-13 — nick 3–24 `[a-z0-9_]`; hideFromSearch; PK cuid2
- ARCH-R13: AD-14 — in-app Notification + email по событиям брони и напоминаниям о ДР (дайджест, отписка `List-Unsubscribe`); `deliverAfter`; payload без FO titles без доступа и без идентичности держателя для владельца
- ARCH-R14: AD-15 — обязательные тесты: (1) parallel reserve → 1 success; (2) FO+non-friend → gate без gifts; (3) Block+valid discoverable token → not_found; (4) unfriend+бронь → reservation card без siblings; (5) анонимность держателя; (6) cron не снимает «Купил»/GIVEN; (7) гонка cron и пользователя; (8) отмена после 10 с → CONFLICT
- ARCH-A1..A5, A12, A14, A15: [ASSUMPTION] нет self-serve репорта; имя Gift List; ручное удаление аккаунта; цена опциональна; нет reopen CLOSED (кроме отмены 10 с); auto-accept; Срок в поясе Профиля дарителя (`User.timeZone`, A-27); таймеры брони — внешний планировщик раз в час

### UX Design Requirements

- UX-DR1: Theme Forest Paper — CSS variables primary `#2F5D3A`, accent `#D4A017`, background `#F4F1EA` и связанные токены из DESIGN.md; light only (UX-A8)
- UX-DR2: Typography — Fraunces (display) + DM Sans (body/label/caption); один display на экран
- UX-DR3: Brand components — Gift card, Status pill (open/reserved/closed), Friends-only gate panel, List type chip, button-reserve «Куплю сам», Reservation confirm (дата + два переключателя), Reservation phase labels, Owner action marker, Undo toast, секция «Получено»
- UX-DR4: App chrome — левый sidebar (Мои списки · Поиск · Друзья · Мои брони · Уведомления, «Недавние списки», карточка пользователя с меню); `< 900px` — drawer по ☰; верхней полосы и нижней tab-bar нет
- UX-DR5: Copy/voice — канон Friends-only gate и Anon gate из EXPERIENCE.md; без CTA оплаты в R1
- UX-DR6: Empty/loading/error — skeleton; empty gifts/friends; сеть → toast; гонка брони → toast «Кто-то только что забрал…»; закрытие → toast «Отменить» 10 с
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
- FR-17: Epic 5 — бронь со Сроком и видимостью, снятие
- FR-23: Epic 4 — unfriend
- FR-24: Epic 4 — block
- FR-25: Epic 5 — мои брони
- FR-26: Epic 6 — уведомления in-app + email
- FR-27: Epic 3 — ссылка на список
- FR-28: Epic 2 — копирование ссылок
- FR-29: Epic 5 — цикл истечения Срока
- FR-30: Epic 5 — «Купил» / «Подарил» и подтверждение
- FR-31: Epic 3 (матрица полей) + Epic 5 — видимость держателя
- FR-32: Epic 5 — закрытие, отмена, «Хочу ещё такой»
- FR-33: Epic 7 — ДР в Профиле
- FR-34: Epic 7 — напоминание дарителю
- FR-35: Epic 7 — напоминание владельцу
- FR-36: Epic 7 — настройки и отписка
- FR-37: Epic 1 (захват пояса) + Epic 7 (правка в настройках)
- FR-4, FR-16, FR-18–FR-22: **deferred R2** (не в epics R1)
- FR-38, FR-39: **deferred Раунд 1.5** (не в epics R1)

## Epic List

### Epic 1: Аккаунт и один пустой вишлист

Пользователь создаёт аккаунт и сразу имеет один пустой вишлист со стабильной ссылкой. Стек веба уже поднят в Story 1.1.

**FRs covered:** FR-1, FR-2, FR-3, FR-9, FR-37 (захват пояса)

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

Дарители бронируют со Сроком и выбором видимости без двойной покупки; цикл истечения Срока; «Купил» / «Подарил» и подтверждение владельцем; закрытие с отменой; «Мои брони»; sole writer + CAS (AD-8/9); обязательные тесты AD-15.

**FRs covered:** FR-17, FR-25, FR-29, FR-30, FR-31, FR-32, FR-12 (gifters), FR-19-R1 (concurrency via AD-9)

### Epic 6: Уведомления и оболочка пилота

In-app и email события без утечки FO и идентичности держателя; chrome/навигация; настройки контакта/удаления; a11y ключевых потоков.

**FRs covered:** FR-26 (+ UX-DR4/8/9, NFR-5)

### Epic 7: Дни рождения и напоминания

Пользователь указывает ДР; Друзья получают одно напоминание, когда у него есть что забронировать; владелец — напоминание обновить списки; отписка в один клик (D-18). Идёт после Epic 6: использует Notification, Resend и cron Route Handler.

**FRs covered:** FR-33, FR-34, FR-35, FR-36, FR-37 (правка пояса)

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

### Story 1.2: Регистрация и один вишлист

As a новый пользователь,
I want зарегистрироваться с email, паролем, именем и Ником,
So that я сразу попадаю в один пустой вишлист (FR-1, FR-9, D-23).

Статус реализации: код двух списков уже на ревью. Его нельзя принимать. Боевых данных нет. Спека `spec-1-2` описывает старое поведение и помечена как ожидающую переписывания.

**Acceptance Criteria:**

**Given** форма регистрации (email, пароль, displayName, nick) без телефона и пола
**When** пользователь успешно регистрируется через Better Auth (AD-3)
**Then** создаётся сессия и пользователь аутентифицирован (FR-1, D-21)
**And** в одной транзакции создаётся ровно один List с immutable `publicToken` (FR-9, AD-6)
**And** колонки типа DISCOVERABLE/FRIENDS_ONLY нет
**And** дубликат email или nick отклоняется с VALIDATION
**And** нет API второго списка

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

### Story 1.5: Часовой пояс пользователя

As a пользователь,
I want, чтобы сервис знал мой часовой пояс,
So that Сроки брони и напоминания считались по моему времени (FR-37, A-27).

**Acceptance Criteria:**

**Given** аутентифицированный пользователь с пустым `User.timeZone`
**When** открывается любая auth-страница
**Then** клиент передаёт IANA-пояс браузера (`Intl.DateTimeFormat().resolvedOptions().timeZone`), сервер валидирует его по списку IANA и сохраняет (FR-37)
**And** при невалидном или отсутствующем поясе сохраняется `UTC`
**And** уже заданный пояс автоматически не перезаписывается (правка — Story 7.2)
**And** Story 1.2 не меняется: новые аккаунты получают пояс при первом заходе
**And** история готова до Story 5.1 (Срок брони берёт пояс из `User.timeZone`)

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

### Story 2.3: Видимость и удаление желания

As a владелец,
I want менять видимость открытого желания и удалять ненужное,
So that «всем», «друзьям» и «секрет» стоят на самом желании (FR-10, FR-11, D-23).

**Acceptance Criteria:**

**Given** желание `OPEN`
**When** владелец ставит PUBLIC, FRIENDS или SECRET
**Then** изменение сохраняется
**Given** желание `RESERVED` или `CLOSED`
**When** владелец меняет видимость
**Then** операция отклоняется
**Given** желание `OPEN`
**When** владелец удаляет
**Then** желание удаляется
**And** удаление `RESERVED` закрывается в Story 5.4

### Story 2.4: Копирование ссылки на вишлист

As a владелец,
I want скопировать одну ссылку,
So that могу отправить вишлист без share-sheet (FR-28, D-23).

**Acceptance Criteria:**

**Given** владелец на «Мой вишлист»
**When** нажимает «Скопировать ссылку»
**Then** в буфере один URL `/l/{publicToken}` (AD-6)
**And** Toast «Ссылка скопирована»
**And** смена ника token не меняет (A-26)

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
**Then** результат — `{ access: gifts | not_found, gifts }` по AD-7 (D-23). Гейтов friends_only_gate и anon_gate нет
**And** в `gifts` только желания, которые зритель может видеть: SECRET — владелец; FRIENDS — владелец и друг; PUBLIC — владелец, друг, подписчик, ContactMatch, любой с ссылкой включая анонима
**And** число и названия отфильтрованных желаний запрещены (NFR-3)
**And** сырой `findMany` по listId без policy запрещён (AD-7)
**And** поля брони в gift card отдаются по роли зрителя (держатель / владелец / другие) по матрице AD-7 D-13; `reservedBy` может быть `null` при `RESERVED` (FR-31, AD-12) — колонки брони появятся в Epic 5, policy готова принять их без смены контракта
**And** action/read envelope соответствует AD-12

### Story 3.3: Маршрут `/l/:publicToken` (D-29)

As a посетитель со ссылкой,
I want увидеть публичные желания без регистрации и забронировать после неё,
So that ссылка работает как в п. 12 видения (FR-27, D-29).

**Acceptance Criteria:**

**Given** валидный token и аноним
**When** открывает `/l/:publicToken`
**Then** видит только PUBLIC-желания, без счётчика остальных (FR-27)
**And** «Куплю сам» ведёт на регистрацию и возвращает на тот же URL; дружба не создаётся (AD-21)
**Given** принятый друг
**When** открывает ту же ссылку
**Then** видит PUBLIC и FRIENDS
**Given** нет ни одного видимого желания
**When** открывает ссылку
**Then** пустое состояние «нет открытых желаний», не «список закрыт»
**Given** невалидный token или Block
**When** открывает ссылку
**Then** «не найдено»

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
**And** вкладки «Друзья» и «Запросы» (badge входящих); в «Запросах» входящие выше исходящих; исходящая строка — «Ожидает ответа» + «Отменить» (EXPERIENCE)
**And** вкладка «Друзья»: закреплённая строка поиска по имени и @нику (без учёта регистра, `@` необязателен), счётчик «N из M», empty-результат «Никого не нашли по «…»» (EXPERIENCE)
**And** список друзей открыт сразу; серверная пагинация по курсору порциями по 15, подгрузка при прокрутке; поиск работает по всему списку, а не по загруженной части (EXPERIENCE, AD-13)
**And** статус загрузки объявляется через `aria-live="polite"` («Загружаем…», «Показаны все (N)»)

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
**And** если у бывшего друга была активная бронь на FO-подарок — бронь сохраняется со всем циклом FR-29/FR-30 для FR-25 / AD-7 reservation-card (полный UI в Epic 5); блок владельцем бронь не снимает (A-14); policy уже отдаёт reservation-card поля держателю (AD-7 матрица)

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

Координация подарков без оплаты: единственная бронь со Сроком и выбором видимости, цикл истечения Срока, отметки «Купил» / «Подарил», закрытие владельцем, «Мои брони», обязательные privacy/race тесты.

### Story 5.1: GiftStatusService — бронь CAS со Сроком и видимостью

As a даритель,
I want нажать «Куплю сам», указать, к какой дате подарю, и выбрать, кто увидит моё имя,
So that статус станет однозначным для всех, двойной брони не будет, а сюрприз сохранится (FR-17, FR-31, D-12, D-13, AD-8, AD-9, NFR-1).

**Acceptance Criteria:**

**Given** auth даритель ≠ владелец; Подарок `OPEN`; viewer имеет `access=gifts`
**When** жмёт «Куплю сам»
**Then** confirm-dialog: дата «Подарю до» (по умолчанию сегодня + 7; допустимо сегодня…сегодня + 30 в поясе Профиля дарителя — `User.timeZone`, Story 1.5), чекбоксы «Показать владельцу, что это я» (выкл.) и «Показать другим, кто берёт» (вкл.), подсказка «Если купите заранее, отметьте «Купил» — бронь не снимется сама» (FR-17, FR-31, EXPERIENCE)
**When** подтверждает → Server Action → **только** `GiftStatusService` (AD-8)
**Then** CAS `WHERE id=? AND status=OPEN` → `RESERVED`; set `reservedById`, `reservedAt`, `titleSnapshotOnReserve`, `reservationDueAt` (конец даты в IANA-поясе), `reservationTimeZone` (снимок `User.timeZone`), `reservationPhase=ACTIVE`, `reservationPhaseAt`, toggles (AD-9, ARCH-A13, ARCH-A14)
**And** сервер отклоняет дату вне диапазона с VALIDATION
**And** gift card: владелец видит `RESERVED` с `reservedBy=null`, если «видим владельцу» выкл.; другие — `reservedBy` по «видим другим» (AD-7, AD-12, FR-31)
**And** владельцу событие «Кто-то забронировал «Y»» (имя — по toggle; доставка Epic 6)
**And** optimistic + откат; при CONFLICT toast «Кто-то только что забрал этот подарок» (UX-DR5/6)
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
So that Подарок снова `открыт` (FR-17).

**Acceptance Criteria:**

**Given** Подарок `RESERVED` в любой фазе
**When** `reservedById` снимает бронь (confirm «Снять бронь? Подарок снова станет открытым.»)
**Then** CAS RESERVED→OPEN с предикатом holder; clear reserved* (AD-9); статус `OPEN`; событие владельцу (FR-17)
**When** владелец снимает чужую бронь
**Then** preflight возвращает `warning` (`BOUGHT` | `GIVEN` | null) без иных полей брони (AD-7); confirm показывает: при BOUGHT — «Даритель отметил, что подарок уже куплен. Если снять бронь, его может купить кто-то ещё»; при GIVEN — «Даритель отметил, что уже вручил» и основными действиями «Получил» / «Не получал» (Story 5.7)
**And** CAS RESERVED→OPEN (owner predicate); событие держателю in-app + email (FR-17, FR-26; доставка Epic 6)
**And** все переходы только через GiftStatusService (AD-8)
**And** ветка `GIVEN` (кнопки «Получил» / «Не получал») достижима только после Story 5.7; до неё preflight возвращает `BOUGHT` | null

### Story 5.3: Закрытие Подарка владельцем, отмена и «Хочу ещё такой»

As a владелец,
I want отметить подарок полученным в любой момент, отменить промах и при желании добавить такой же снова,
So that список отражает реальность, даже если подарок пришёл не через сервис (FR-32, ARCH-A5).

**Acceptance Criteria:**

**Given** Подарок `OPEN` или `RESERVED` (любая фаза)
**When** владелец жмёт «Отметить полученным» и подтверждает (confirm «Подарок «Y» получен?» + при брони «Бронь будет закрыта, бронировавший получит уведомление»)
**Then** CAS → `CLOSED`; reserved* сохраняются; пишутся `closedAt`, `closedFromStatus` (AD-8, AD-9)
**And** toast «Отмечено полученным · Отменить», фиксированные 10 с
**When** владелец жмёт «Отменить» в течение 10 с
**Then** CAS восстанавливает прежнее состояние полностью (бронь, фаза, bought, dueAt); событие держателю не доставляется — недоставленная запись удаляется (AD-14)
**When** окно отмены прошло
**Then** держателю (если был) событие in-app + email: «Владелец отметил «Y» полученным. Если вы его ещё не вручали — подарок пришёл от кого-то другого» (из фазы GIVEN — «Владелец подтвердил получение «Y»»)
**And** попытка отмены после 10 с → CONFLICT (AD-15-8)
**And** закрытые Подарки — в конце Списка в свёрнутой секции «Получено (N)» у владельца и «Уже подарено» у зрителей, без действий; имя держателя владельцу не раскрывается без toggle (FR-31)
**When** владелец выбирает «Хочу ещё такой» на закрытом Подарке
**Then** диалог «В какой список добавить?» (по умолчанию список оригинала) → создаётся копия `OPEN` (title, description, priceCents, linkUrl)
**And** удаление закрытого Подарка — confirm
**And** audit log смены статуса (NFR-6)

### Story 5.4: Удаление и правка забронированного Подарка

As a владелец,
I want удалить или поправить подарок, на котором есть бронь,
So that держатель узнаёт об этом сразу и может, например, вернуть покупку (FR-10, D-12).

**Acceptance Criteria:**

**Given** Подарок `RESERVED`
**When** владелец удаляет
**Then** сильный confirm; при `warning=BOUGHT` — предупреждение «уже куплен»; при `GIVEN` основное действие — «Отметить полученным» (Story 5.3), удаление вторично
**And** release через GiftStatusService + удаление; держателю in-app + email «Владелец удалил «Y» из списка» (FR-10, AD-8) — закрывает путь из Story 2.3
**When** владелец редактирует title / description / linkUrl / priceCents
**Then** в форме подсказка «Подарок забронирован — бронировавший получит уведомление»; после сохранения держателю in-app + email «Владелец изменил «Y»» со списком изменённых полей (FR-10)
**And** перенос между Списками по-прежнему только из `OPEN` (FR-10)

### Story 5.5: «Мои брони»: продление, «Купил», видимость, reservation card

As a даритель,
I want в одном месте видеть свои брони, продлевать их, отмечать покупку и вручение и менять видимость,
So that бронь соответствует моим планам, даже если я потерял доступ к списку (FR-25, FR-29, FR-30, FR-31, A-14, AD-7).

**Acceptance Criteria:**

**Given** у пользователя есть Подарки `RESERVED`, где он `reservedById`
**When** открывает `/reservations`
**Then** видит по каждой: titleSnapshot, ownerNick, Срок (в своём поясе), фазу (метка «Срок истёк» для AWAITING_*; «Ждёт подтверждения» для GIVEN), «Купил», переключатели (FR-25)
**And** действия: «Продлить до…» (≤ сегодня + 30, пересчёт dueAt и снимок `reservationTimeZone` из текущего `User.timeZone`, phase → ACTIVE), «Купил» / снять отметку, «Подарил» (Story 5.7), смена переключателей (подсказка при включении «видим владельцу»), «Снять бронь» (Story 5.2) — те же действия в карточке Подарка
**And** продление из AWAITING_OWNER делает запрос владельцу неактуальным (`ownerAction=null`; уведомление владельца помечается «Даритель уже ответил»)
**And** снятие «Купил» в фазе AWAITING_OWNER не сбрасывает `phaseAt`
**And** кнопка «Подарил» и метка «Ждёт подтверждения» появляются вместе со Story 5.7; метка «Срок истёк» — вместе со Story 5.6
**Given** unfriend или блок при активной FO-брони
**When** бывший друг открывает FO `/l/:token`
**Then** `friends_only_gate` без gift rows; в «Мои брони» — reservation card с полями AD-7 (+ dueAt, phase, bought, toggles) и всеми действиями — **без** siblings FO и browse списка (FR-25, FR-23, AD-7, AD-15-4)

### Story 5.6: Цикл истечения Срока брони (cron)

As a система,
I want по наступлении Срока по шагам выяснять судьбу брони,
So that «мёртвые» брони освобождаются, а купленные подарки не открываются снова (FR-29, D-12, AD-5).

**Acceptance Criteria:**

**Given** внешний планировщик (не Vercel Cron — правило переносимости; например, GitHub Actions schedule) раз в час вызывает Route Handler `api/cron/reservation-timers`; endpoint защищён секретом (NFR-2, AD-5, ARCH-A15)
**When** Handler вызывает **только** `GiftStatusService.processReservationTimers()` (AD-5, AD-8)
**Then** CAS ACTIVE→AWAITING_GIVER при `dueAt ≤ now`; событие держателю in-app + email с действиями «Подарил» / «Купил, ещё не вручил» / «Продлить до…» / «Снять бронь»
**And** CAS AWAITING_GIVER→AWAITING_OWNER при `phaseAt ≤ now−72h`; событие владельцу in-app + email «Срок брони «Y» истёк, даритель пока не ответил. Подарок уже у вас?» с действиями «Получил» (Story 5.3) / «Не получал, оставить бронь» / «Снять бронь» (Story 5.2); имя — по FR-31; без `bought`
**And** «Не получал, оставить бронь» → CAS phase=ACTIVE, dueAt = сегодня + 7 в `reservationTimeZone`; держателю in-app «Владелец продлил вашу бронь «Y» до DD.MM»
**And** CAS AWAITING_OWNER→OPEN при `phaseAt ≤ now−168h AND bought=false`; держателю и владельцу in-app + email «Бронь «Y» снята: срок истёк, ответа не было»
**And** брони с `bought=true` в AWAITING_OWNER не меняются; новых событий нет; у владельца `ownerAction=EXPIRED_NO_REPLY` (метка «Срок брони истёк»)
**And** каждое событие создаётся ровно один раз (идемпотентность при повторном запуске cron)
**And** гонка таймера с действием пользователя → ровно один переход (AD-15-7)

### Story 5.7: «Подарил» и подтверждение получения владельцем

As a даритель и владелец,
I want отметить вручение и подтвердить или опровергнуть его,
So that подарок закрывается только с подтверждения владельца и не открывается заново после покупки (FR-30, D-12).

**Acceptance Criteria:**

**Given** держатель брони в фазе ACTIVE / AWAITING_GIVER / AWAITING_OWNER
**When** жмёт «Подарил» (карточка, «Мои брони», уведомление)
**Then** CAS phase → GIVEN; уведомления об истечении Срока для этой брони больше не создаются; зрители видят label «Подарен»
**And** владельцу in-app + email «Даритель отметил, что вручил «Y». Подарок у вас?» с действиями «Получил» / «Не получал»; имя — по FR-31
**When** владелец жмёт «Получил»
**Then** переход как в Story 5.3 (с окном отмены); держателю «Владелец подтвердил получение «Y»»
**When** владелец жмёт «Не получал»
**Then** CAS phase → ACTIVE, bought=true, dueAt = сегодня + 7; держателю in-app «Владелец пока не отметил получение «Y». Бронь снова активна до DD.MM»; Подарок остаётся `RESERVED`
**Given** владелец не отвечает
**Then** автозакрытия нет, повторов нет; на карточке владельца `ownerAction=CONFIRM_GIVEN` — метка «Ждёт вашего подтверждения» с кнопками

### Story 5.8: Обязательные автотесты гонки, privacy и анонимности (AD-15)

As a команда пилота,
I want автотесты инвариантов брони, видимости и анонимности,
So that SM-2, NFR-3 и FR-31 не регрессируют (AD-15).

**Acceptance Criteria:**

**Given** test runner выбран командой (уровень — integration/domain)
**When** прогоняется suite AD-15
**Then** (1) две параллельные reserve → ровно одна success
**And** (2) FO token + non-friend → gate DTO **без** gift fields
**And** (3) Block + valid discoverable token → `not_found`
**And** (4) unfriend + активная бронь → reservation card без siblings
**And** (5) владелец при `holderVisibleToOwner=false` не получает идентичность держателя в gift card, Notification и письме; `bought` владельцу не отдаётся
**And** (6) cron не переводит в OPEN брони с `bought=true` и в фазе GIVEN
**And** (7) гонка cron-таймера и действия пользователя → ровно один переход
**And** (8) отмена закрытия после 10 с → CONFLICT
**And** suite обязателен в CI/локальном gate перед merge историй Epic 5

---

## Epic 6: Уведомления и оболочка пилота

События R1, навигация, настройки контакта, a11y.

### Story 6.1: Уведомления R1: in-app и email

As a пользователь,
I want видеть события дружбы и брони в приложении, а важные события брони — ещё и на почте,
So that не пропускаю приглашения и не теряю бронь из-за того, что давно не заходил (FR-26, AD-14).

**Acceptance Criteria:**

**Given** события R1 из FR-26 (инвайты; accept/reject; новая бронь; снятие; события цикла брони, отметок, закрытия, удаления и правки)
**When** событие происходит
**Then** создаётся ровно одна `Notification`; badge непрочитанных (FR-26)
**And** для событий email-перечня FR-26 отправляется одно письмо через Resend с тем же текстом и ссылкой на действие в приложении (вход по сессии; действия в письме не выполняются без входа)
**And** in-app уведомления об истечении Срока и запросы владельцу содержат кнопки действий; устаревший запрос показывает «Даритель уже ответил» без кнопок
**And** `deliverAfter` соблюдается: событие закрытия не видно и письмо не уходит до конца окна отмены; отмена удаляет недоставленное событие (AD-14)
**And** payload и письма **не** содержат FO titles для получателя без FO access; держателю — `titleSnapshot`; владельцу — без идентичности держателя без toggle и без `bought` (FR-26, FR-31, AD-14, NFR-3)
**And** нет push/SMS, нет напоминаний до Срока и повторов (A-22, SM-C1)
**And** UI `/notifications` или sheet по EXPERIENCE IA

### Story 6.2: App chrome и мобильная навигация

As a пользователь на вебе (в т.ч. mobile),
I want устойчивую навигацию по ключевым разделам,
So that UJ-1…UJ-5 достижимы без тупиков (UX-DR4).

**Acceptance Criteria:**

**Given** auth сессия
**When** пользуется приложением
**Then** `≥ 900px`: постоянный левый sidebar 264 px — логотип → Мои списки; пункты Мои списки, Поиск, Друзья (badge входящих), Мои брони, Уведомления (badge); блок «Недавние списки» (2–5 друзей, без ссылки «Все друзья»); активный пункт `aria-current="page"` (UX-DR4)
**And** внизу sidebar карточка пользователя (Avatar, имя, @ник) → меню: Настройки, Мой профиль, Связаться с нами, Выйти; закрывается кликом вне и `Esc` (UX-DR4)
**And** `< 900px`: верхняя sticky-полоса (☰, логотип, Avatar); ☰ открывает sidebar как drawer со scrim, закрытие — scrim / `Esc` / переход по пункту, фокус возвращается на ☰ (UX-DR4)
**And** нижней tab-bar и верхней навигации нет; anon-экраны без sidebar (логотип, Войти, Создать аккаунт)
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
**And** процедура ручного удаления аккаунта (ARCH-A3) описывает брони: удаляемый держатель → его брони снимаются с уведомлением владельцам; удаляемый владелец → держателям «Подарок «Y» больше недоступен»

### Story 6.4: A11y ключевых потоков

As a пользователь с клавиатурой / AT,
I want пройти регистрацию, бронь, закрытие подарка, FO gate и копирование ссылки,
So that пилот соответствует WCAG 2.2 AA на ключевых потоках (NFR-5, UX-DR8).

**Acceptance Criteria:**

**Given** ключевые потоки: регистрация, «Куплю сам» (confirm с датой и двумя переключателями), «Отметить полученным» + toast отмены (объявляется `aria-live`, «Отменить» достижима с клавиатуры; основная защита — confirm), Friends-only gate, копирование ссылки
**When** проверяются клавиатура, labels, фокус-кольцо `{colors.ring}`, контраст токенов
**Then** потоки соответствуют WCAG 2.2 AA floor (UX-A10, UX-DR8)
**And** FO gate и anon gate доступны без потери смысла copy (UX-DR5)

## Epic 7: Дни рождения и напоминания

ДР в Профиле, напоминание дарителю (T-14) и владельцу (T-30), отписка. Раунд 1, после Epic 6 (D-18).

### Story 7.1: День рождения в Профиле

As a пользователь,
I want указать свой день рождения и решить, видят ли его друзья,
So that друзья вовремя вспоминают про мои списки (FR-33).

**Acceptance Criteria:**

**Given** `/settings`
**When** пользователь вводит день и месяц (год опционально) и сохраняет
**Then** создаётся или обновляется `UserDate(kind=BIRTHDAY)`; ДР можно удалить; переключатель «Показывать друзьям» (по умолчанию вкл.) (FR-33)
**And** на `/u/:nick` принятый Друг видит «День рождения: 14 ноября» (без года); не-друг, аноним, Block — не видят; API без Дружбы не отдаёт поле (FR-33, AD-7, NFR-3)
**And** год виден только владельцу (подпись «Год видите только вы»)
**And** 29.02 валиден и отображается как есть
**When** «Показывать друзьям» выключен
**Then** ДР не виден никому, кроме владельца, и не участвует в напоминаниях Друзьям (Story 7.3)

### Story 7.2: Настройки напоминаний, часовой пояс и отписка

As a пользователь,
I want управлять напоминаниями и отписаться из письма одним кликом,
So that письма приходят по моему времени и только те, что мне нужны (FR-36, FR-37).

**Acceptance Criteria:**

**Given** `/settings`
**Then** есть переключатели «Дни рождения друзей» и «Напомнить обновить мой список» (оба вкл.) и выбор часового пояса (IANA, текущий — из Story 1.5) (FR-36, FR-37)
**Given** письмо-напоминание
**Then** в нём ссылка отписки и заголовки `List-Unsubscribe` / `List-Unsubscribe-Post` (one-click, RFC 8058) (FR-36)
**When** получатель переходит по ссылке без входа или почтовый клиент шлёт POST
**Then** соответствующий переключатель выключается; страница `/unsubscribe/:token` подтверждает «Вы отписались от …» и предлагает вернуть
**And** токен даёт только отписку (нет входа и нет данных аккаунта); неверный токен → нейтральное сообщение
**And** письма по событиям брони не затрагиваются (FR-26, R-3)

### Story 7.3: Напоминание дарителю о ДР Друга (T-14)

As a даритель,
I want получить одно напоминание перед днём рождения друга, когда у него есть что забронировать,
So that успеваю выбрать подарок без двойной покупки (FR-34, UJ-8).

**Acceptance Criteria:**

**Given** Route Handler `api/cron/date-reminders`, вызываемый внешним планировщиком раз в час (AD-16)
**When** у получателя около 10:00 по `User.timeZone` и до ДР Друга 14 дней (29.02 → 28.02 в невисокосный год) (A-28)
**Then** для каждой пары, где выполнены все условия FR-34 (Дружба принята; нет Block; ДР виден Друзьям; переключатель получателя вкл.; ≥ 1 `OPEN` Подарок, видимый получателю через VisibilityPolicy), создаётся одна `Notification` и одно письмо
**And** содержание: имя, дата без года, число открытых Подарков, до трёх названий, ссылка на `/u/:nick`; без держателей, без RESERVED/CLOSED (FR-34, FR-31, NFR-3)
**And** идемпотентность: не больше одного напоминания на (получатель, Друг, год) даже при повторном или параллельном вызове handler
**And** несколько напоминаний одного дня у получателя → одно письмо-дайджест; in-app уведомления раздельные (FR-36, SM-C1)
**And** если условий нет в момент окна, напоминание за год не отправляется и не досылается
**And** автотесты: нет открытых Подарков → нет письма; скрытый ДР → нет; Block → нет; повторный вызов → одно письмо; два ДР в один день → один дайджест

### Story 7.4: Напоминание владельцу о своём ДР (T-30)

As a владелец,
I want за месяц до дня рождения получить напоминание обновить списки,
So that друзья видят актуальные желания (FR-35).

**Acceptance Criteria:**

**Given** тот же handler `api/cron/date-reminders`
**When** до ДР владельца 30 дней, около 10:00 по его поясу, переключатель «Напомнить обновить мой список» вкл.
**Then** одна `Notification` и одно письмо «Скоро ваш день рождения — обновите списки» со ссылкой на «Мои списки» (FR-35)
**And** отправляется независимо от «Показывать друзьям» и от наполнения списков; одно в год; входит в дневной дайджест (FR-36)

---

## Дополнение MVP 2026-10-28

Новые истории. Старые Epic 4–7 остаются; дружба D-10 не отменяется. Бронь Epic 5 действует только для `SINGLE` (FR-41): Story 5.1 отклоняет `UNLIMITED` кодом VALIDATION до CAS.

### Story 2.5: Тип желания, теги и срок

**Given** форма желания
**When** владелец выбирает единичное или безлимитное, теги и необязательную дату окончания
**Then** сохраняются `quantity`, теги и `expiresOn` (FR-41, FR-44, FR-42)
**And** безлимитное не показывает «Куплю сам»
**And** свой тег виден на желании и не входит в агрегаты, пока админ его не одобрит (AD-22)

### Story 2.6: Архив по сроку

Предупреждение за 3 дня — часть D-26 (Q-12 закрыт). Это не Срок брони из Story 5.6.

**Given** желание `RESERVED`, у держателя локальная дата равна `expiresOn` минус 3 дня, окно ~10:00 по его `User.timeZone` (A-28)
**When** cron `wish-expiry`
**Then** одно уведомление `WISH_EXPIRY_SOON` (in-app и email, если канал email включён): «Срок желания «Y» через 3 дня» (FR-42, D-26)
**And** повторный запуск в тот же день не создаёт второе
**And** если бронь появилась уже после этого дня, раннее уведомление не досылается
**And** без активной брони раннего уведомления нет
**Given** `expiresOn` наступил, желание OPEN
**When** тот же cron
**Then** `archivedAt` ставится через GiftStatusService (AD-9)
**And** архив можно вернуть в OPEN или скопировать
**Given** желание RESERVED, bought=false, срок наступил
**Then** бронь снимается и желание архивируется одной транзакцией, держатель получает уведомление, что срок вышел
**Given** bought=true или фаза GIVEN
**Then** статус не меняется, держателю предлагают отметить вручение

### Story 4.6: Подписка

**Given** профиль человека, который не друг
**When** зритель жмёт «Подписаться»
**Then** создаётся Subscription без подтверждения и зритель видит только PUBLIC (FR-46, AD-19)
**And** цель может снять подписчика

### Story 4.7: Ссылка-приглашение

**Given** ссылка `/i/:token`
**When** новый пользователь регистрируется по ней
**Then** в той же транзакции создаётся Friendship, если нет Block (FR-47, AD-21)
**When** уже зарегистрированный открывает её
**Then** дружба появляется только после подтверждения

### Story 7.5: Личные даты

**Given** настройки
**When** владелец добавляет дату с названием и видимостью
**Then** дат не больше 10, помимо дня рождения (FR-38, D-22)
**And** по умолчанию видимость «друзья»
**And** друг видит только даты, открытые ему; подписчик не видит (D-31)

### Story 7.6: Напоминание о личной дате

**Given** тот же cron, что Story 7.3
**When** до видимой другу личной даты 14 дней и есть открытое видимое ему желание
**Then** одно напоминание на пару в год, по правилам FR-34
**And** владельцу отдельное «обнови список» по личной дате не шлётся (только ДР, D-18)

### Epic 8: Нативный клиент и контакты

Одна кодовая база Expo SDK 58. Не импортирует `src/`. Сервер — `app/api/v1` (AD-17).

### Story 8.1: HTTP-адаптер

**Given** use-case, который уже есть как Server Action
**When** его вызывает Expo
**Then** Route Handler `app/api/v1` валидирует конверт AD-12 и вызывает тот же метод, без второй копии правил

### Story 8.2: Вход в Expo

**Given** приложение Expo
**When** пользователь входит по email и паролю
**Then** сессия Better Auth живёт в SecureStore, сервер принимает bearer той же версии пакета (AD-3)
**And** SMS и OAuth нет

### Story 8.3: Телефон и книга контактов

**Given** пользователь указал свой номер в E.164 (FR-40)
**When** другой пользователь разрешил контакты и запустил сверку
**Then** сервер сопоставляет HMAC и создаёт ContactMatch без хранения чужих номеров (FR-50, AD-18)
**And** отказ в разрешении оставляет поиск по нику
**And** кнопки «пригласить всех» нет

### Story 8.4: Удаление аккаунта

**Given** настройки веба или Expo
**When** пользователь подтверждает удаление
**Then** выполняется одна команда `deleteAccount` (FR-51, AD-20)
**And** история обязательна до отправки в App Store

### Epic 9: Предложить идею

### Story 9.1: Отправка и принятие

**Given** контакт и текст идеи
**When** отправитель шлёт предложение и выбирает, раскрывать ли имя
**Then** получатель получает уведомление в каналы, которые включил (FR-48, FR-52)
**When** получатель принимает и выбирает видимость не SECRET
**Then** создаётся единичное OPEN-желание с `priorityReserverId`
**And** бронь сама не ставится
**And** при выборе SECRET право не создаётся
**And** пока Q-13 открыт, таймера права нет

### Epic 10: Админка

### Story 10.1: Роль и подборки

**Given** пользователь с ролью ADMIN на вебе
**When** открывает `/admin`
**Then** может вручную создать редакционную подборку (FR-49, AD-22)
**And** в приложении Expo админки нет

### Story 10.2: Модерация своих тегов

**Given** очередь своих тегов
**When** админ нормализует и одобряет тег
**Then** тег может войти в будущие агрегаты
**And** до одобрения он только подпись на желании (FR-44)

Раунд 1.5 и Раунд 2+ в истории не раскладываются: интересы (FR-39), блогеры после Q-14, push после отдельного решения, банк идей и наблюдения (D-24), Тайный Санта (D-32), целая оплата без сбора (A-24, D-25).

## Validation Notes (Step 4)

| Check | Result |
|-------|--------|
| Все FR R1 покрыты stories | ✅ FR-1..3,5..15,17,23..37 |
| FR R2 явно deferred | ✅ FR-4,16,18–22 |
| FR Раунда 1.5 явно deferred | ✅ FR-38, FR-39 |
| Epic 1 Story 1 = starter AD-2 | ✅ Story 1.1 |
| Сущности/таблицы по мере нужды | ✅ User/List в E1; Gift E2; Friendship E4; Notification E6; статусные поля Gift E5 |
| Нет forward-deps внутри эпиков | ✅ (ветки GIVEN в 5.2 и 5.5 явно помечены «достижимо после 5.7», как 2.3 → 5.4) |
| Epic independence | ✅ E2 работает без E3; E3 без E4 (FO=gate); E4 unlock FO; E5 бронь; E6 notify |
| AD-7/8/9/10/12/15 в AC | ✅ |
| A-24 / нет оплаты в stories | ✅ |
| UX-DR покрыты | ✅ токены E1; cards E2; gates E3; chrome/a11y/settings E6 |
| Correct course 2026-10-10 | ✅ D-12/D-13: Epic 5 → 8 историй; Story 6.1 + email (sprint-change-proposal-2026-10-10) |
| Correct course 2026-10-11 (даты) | ✅ D-18: Story 1.5; Epic 7 (7.1–7.4) |
| Correct course 2026-10-28 (видение MVP) | ✅ D-20…D-33: Story 1.2 один список; 2.3–2.6; 3.3 аноним видит PUBLIC; 4.6–4.7; 7.5–7.6; Epic 8–10. Story 1.2 на ревью не принимать |
| File churn | Принято: VisibilityPolicy/GiftStatusService наращиваются по эпикам — осознанно (policy до friendship; status service до reserve) |

**Workflow complete.** Следующий BMAD шаг: `bmad-sprint-planning` / implementation readiness.
