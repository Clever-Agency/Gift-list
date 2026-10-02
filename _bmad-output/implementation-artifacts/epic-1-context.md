# Epic 1 Context: Аккаунт и два пустых списка

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Пользователь регистрируется, входит и получает рабочую сессию с ровно двумя пустыми Списками (Discoverable и Friends-only) со стабильными `publicToken`. Эпик закладывает starter-стек (Next.js 16, shadcn, Prisma, Better Auth, Forest Paper) только в объёме, нужном auth и созданию списков при регистрации — без оплаты и без CRUD подарков.

## Stories

- Story 1.1: Scaffold проекта из starter (Next.js + shadcn + Forest Paper)
- Story 1.2: Регистрация и создание двух Списков
- Story 1.3: Вход и выход
- Story 1.4: Сброс пароля по email

## Requirements & Constraints

- Регистрация: email, пароль, имя (displayName), Ник → аутентифицированная сессия.
- При успешной регистрации в одной транзакции создаются ровно два List: `DISCOVERABLE` и `FRIENDS_ONLY`; у каждого immutable `publicToken` (CUID2, глобально UNIQUE). API создания/удаления третьего списка в R1 нет.
- Ник: 3–24 символа `[a-z0-9_]`, уникальность case-insensitive; дубликат email или nick → VALIDATION.
- Вход/выход по email+пароль; неверный пароль и неизвестный email дают одинаковый UX без enumeration.
- Сброс пароля: запрос с любым email показывает одинаковый успех; для существующего аккаунта — одноразовая time-limited ссылка по email; просроченная/использованная ссылка отклоняется.
- Сессии защищённые (cookie database session); локаль RU; light only.
- В R1 запрещены UI/код оплаты, ЮKassa, COLLECTION и платёжные таблицы.
- Имя продукта в UI: «Gift List».

## Technical Decisions

- Слои: `src/app` → `src/actions` → `src/domain` → `src/db`; клиент не импортирует Prisma.
- Starter: `create-next-app@latest` (App Router, TS, Tailwind, ESLint) → `shadcn init`; pin Next.js ^16.3.8, React 19, Tailwind 4, Prisma 7.10.0, Better Auth 1.7.6, Zod 4, cuid2, Resend.
- Auth: Better Auth email+password, database sessions (httpOnly cookie); OAuth вне R1; сброс пароля через Resend.
- SoR: PostgreSQL (managed Neon preferred); Prisma + миграции; секреты в env; typed `env.ts` (zod).
- Маршруты auth: `(auth)/login|register|forgot|reset/`; home после входа — «Мои списки» (или заглушка до Epic 2).
- Списки: `UNIQUE(ownerId, type)`; path шаринга `/l/:publicToken` (token не ротируется; смена ника позже не ломает ссылки).
- Мутации: envelope `{ ok: true, data } | { ok: false, code, message }` с закрытым набором кодов; PK сущностей — CUID2.
- Hosting envelope: Vercel + managed Postgres + Resend (для пилота).

## UX & Interaction Patterns

- Тема Forest Paper: primary `#2F5D3A`, accent `#D4A017`, background `#F4F1EA`; light only; без dark mode в R1.
- Шрифты: Fraunces (display, один на экран) + DM Sans (body/label/caption); shadcn as-is + brand delta.
- Формы регистрации/входа/сброса: focus ring primary; на регистрации — превью `@ник` и правила ника.
- Primary-кнопки (Войти / Создать аккаунт) — forest green; без CTA оплаты.
- WCAG 2.2 AA на потоке регистрации (клавиатура, контраст, labels).
- После успешной регистрации/входа — home «Мои списки» с двумя пустыми списками (empty state «Пока пусто» допустим как заглушка до Epic 2).

## Cross-Story Dependencies

- 1.1 (scaffold + токены + Prisma) → обязательно до 1.2–1.4.
- 1.2 создаёт User + два List; 1.3/1.4 опираются на тот же Better Auth и сессии.
- Epic 2 ожидает аутентифицированного владельца с двумя списками и home «Мои списки»; VisibilityPolicy, дружба и бронь — вне этого эпика.
