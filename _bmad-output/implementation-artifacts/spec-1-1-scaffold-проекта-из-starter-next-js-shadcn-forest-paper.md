---
title: '1.1 Scaffold проекта из starter (Next.js + shadcn + Forest Paper)'
type: 'chore'
created: '2026-09-30'
baseline_commit: '91b279af6703ff85e9bc07f3457e47e32031d221'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** В репозитории есть только BMAD planning-артефакты; runnable приложение и слои AD-1 отсутствуют, поэтому Epic 1 (auth, списки) некуда писать.

**Approach:** Поднять корневой Next.js App Router scaffold по AD-2, инициализировать shadcn, заложить каталоги слоёв AD-1, подключить токены Forest Paper (light only) и Prisma 7.10.0 + PostgreSQL client с README `dev`/`migrate` — без auth/CRUD/оплаты.

## Boundaries & Constraints

**Always:**
- Next.js ^16.3.8, React 19, Tailwind 4, TypeScript, ESLint; scaffold через `create-next-app` → `shadcn init`.
- Слои: `src/app`, `src/actions`, `src/domain`, `src/db` (+ заготовки `src/components`, `src/lib` под Structural Seed).
- CSS-токены Forest Paper и шрифты Fraunces + DM Sans; тема только light.
- Prisma + `@prisma/client` ровно 7.10.0 (не Prisma 8 RC); PostgreSQL datasource.
- README на русском: как запустить `dev` и `migrate`.
- Продукт в UI: «Gift List».

**Never:**
- Auth (Better Auth), CRUD списков/подарков, VisibilityPolicy, GiftStatusService, friendship, wire DTO, тесты AD-15 — только пустые слои/placeholder.
- Любой UI/код оплаты, ЮKassa, COLLECTION, платёжные таблицы (AD-11 / A-24).
- Dark mode, фичи Stories 1.2+.
- Переоткрытие принятых решений (два списка, D-10/D-11, стек R1, Forest Paper).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dev start | `npm run dev` при установленных deps | HTTP 200, страница Gift List с Forest Paper токенами | Ошибки сборки/порт — исправить до merge |
| Prisma generate | `npx prisma generate` с pin 7.10.0 | Client генерируется без Prisma 8 | Не ставить bare `prisma@latest` |
| No payment surface | grep / UI audit | Нет ЮKassa/оплаты/COLLECTION | Удалить случайно добавленное |

</frozen-after-approval>

## Code Map

- `README.md` — секция запуска приложения + ссылки на planning.
- `_bmad/` / `_bmad-output/` / `.agents/` — методология; не ломать.
- Слои AD-1: `src/app/`, `src/actions/`, `src/domain/` (placeholders), `src/db/` (`schema.prisma`, `client.ts`), `src/components/`, `src/lib/`.
- UX tokens Forest Paper в `src/app/globals.css`; шрифты в `layout.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] Scaffold Next.js (App Router, TS, Tailwind, ESLint) в корень; pin `next@^16.3.8`, React 19, Tailwind 4
- [x] `shadcn init` + базовые CSS variables Forest Paper; Fraunces + DM Sans; light only
- [x] Каталоги AD-1: `src/app`, `src/actions`, `src/domain`, `src/db` (+ `components`, `lib`); placeholder domain/db без бизнес-логики
- [x] Prisma 7.10.0 + `@prisma/client@7.10.0`; `schema.prisma` PostgreSQL; `src/db/client.ts`; `.env.example` с `DATABASE_URL`
- [x] Минимальная home-страница «Gift List» (без auth/оплаты) для проверки темы
- [x] README: `dev` / `migrate` / env; обновить sprint-status story 1.1 → review, epic-1 → in-progress

**Acceptance Criteria:**
- Given planning-only repo, when scaffold complete, then Next ^16.3.8 + React 19 + Tailwind 4 + TS + ESLint + shadcn present
- Given AD-1, when tree inspected, then `src/app|actions|domain|db` exist without auth/CRUD features
- Given UX-DR1/DR2/A8, when CSS loaded, then Forest Paper tokens + Fraunces/DM Sans; no dark theme toggle
- Given AD-4, when deps inspected, then Prisma 7.10.0 pinned; README documents `dev` and `migrate`
- Given AD-11, when codebase searched, then no payment/YooKassa/COLLECTION UI or schema

## Implementation Notes

- Commits: `46dde0d` scaffold; `9b76fe1` review patches (a11y, fonts fallback, prisma guards, delete unused SVGs).
- Next 16.3.8 · React 19.2.8 · Tailwind 4.3.3 · Prisma 7.10.0 + `@prisma/adapter-pg` · shadcn base-nova.
- DM Sans / Fraunces: Google Fonts без кириллических subsets → system fallback для RU-глифов; brand «Gift List» (Latin) в Fraunces.
- Verified: lint, prisma validate/generate 7.10.0, build.

## Spec Change Log

## Review Triage Log

- blind: Cyrillic font subsets — `medium` → **patch**: Google Fonts не отдают cyrillic для DM Sans/Fraunces; добавлены system fallbacks (`9b76fe1`).
- blind: dark: variants / `@custom-variant dark` — `false`: нет dark toggle; shadcn defaults без dark theme surface.
- blind: package-lock missing from diff — `false`: lock есть в репозитории; исключён из review-diff намеренно.
- blind: spec checkboxes / status drift — `low` rejected: метаданные процесса; обновлены в этом проходе.
- blind: hooks alias without dir — `low` rejected: alias-only, каталог появится при первой фиче.
- blind: dual Fraunces on home — `medium` → **patch**: один `font-heading` на h1 бренда (`9b76fe1`).
- blind: brand not h1 — `medium` → **patch**: «Gift List» = sole h1 (`9b76fe1`).
- blind: inert actionable Button — `medium` → **patch**: `disabled` (`9b76fe1`).
- blind: default public SVGs — `low` → **patch**: удалены (`9b76fe1`).
- blind: env.ts unused vs client.ts — `false` / defer intent: stub для 1.2+ по Structural Seed.
- blind: no engines field — `low` rejected: README фиксирует Node floor.
- edge: whitespace DATABASE_URL in client — `medium` → **patch**: trim (`9b76fe1`).
- edge: whitespace DATABASE_URL in prisma.config — `medium` → **patch**: trim || fallback (`9b76fe1`).
- edge: idle pg pool error — `medium` → **patch**: `pool.on("error")` (`9b76fe1`).
- edge: client importable from Client Components — `medium` → **patch**: `import "server-only"` (`9b76fe1`).
- verification-gap: no findings.

### Review Findings

- [x] [Review][Defer] Prisma 7.10.0 приносит 4 high-severity advisory — deferred: нет исправленной Prisma 7; CLI используется только при разработке и сборке, а downgrade нарушает обязательный pin.
- [x] [Review][Patch] Не использовать fallback-БД для `prisma migrate dev`; без явного `DATABASE_URL` миграция сейчас может примениться к локальной `gift_list` [prisma.config.ts:10]
- [x] [Review][Patch] Перенести build-time CLI (`prisma`, `shadcn`, `dotenv`) из production dependencies в devDependencies [package.json:20]
- [x] [Review][Patch] Заменить внутренний текст про AD-1/Prisma/future stories на пользовательский текст [src/app/page.tsx:14]

#### Rejected

- `false` — порядок README `npm install` до `.env` не ломает установку: текущий `prisma generate` намеренно работает через fallback без живой БД.
- `false` — `status: done` в spec и `review` в sprint-status действительно расходятся, но исправление process-метаданных требует редактировать рассматриваемую spec и не является дефектом приложения.
- `false` — `review_loop_iteration: 0` относится к process-метаданным spec; triage не меняет рассматриваемую spec ради такого finding.
- `false` — Zod/env validation явно отложены в `deferred-work.md`, а Story 1.1 разрешает placeholder `src/lib/env.ts`; auth/secrets относятся к 1.2+.
- `false` — disabled-кнопка «Скоро: войти» намеренна по Design Notes и не обещает рабочий auth в Story 1.1.
- `false` — `dark:` utilities не активируются без класса `.dark`; dark toggle/theme surface отсутствуют, generated primitive осознанно оставлен без churn.
- `low` — `engines`/`packageManager` полезны, но README уже фиксирует Node floor, lockfile обеспечивает npm reproducibility, а metadata не гарантирует запрет несовместимого Node.
- `false` — отсутствие Docker Compose не нарушает AC: README требует установленный PostgreSQL 16+ и допускает managed Neon.
- `false` — требование дописать результаты verification меняет spec; фактическая повторная проверка review прошла (`lint`, Prisma validate/generate, `build`).
- `false` — смена `DATABASE_URL` внутри живого dev-process не является поддерживаемым runtime-сценарием; процесс перезапускается после изменения env.
- `low` — отдельный browser smoke test для статической scaffold-страницы дал бы защиту, но Story 1.1 не вводит test runner; build уже пререндерит `/`, а добавление browser harness несоразмерно.
- `false` — Acceptance Auditor повторил finding про Zod; Story 1.1 явно оставляет typed env stub до 1.2+.
- `false` — advisory `mysql2` не используется runtime PostgreSQL-клиентом приложения; риск учитывается отдельно через решение по Prisma CLI dependency, а не как самостоятельный runtime exploit.

## Design Notes

Scaffold в корень рядом с `_bmad`/`_bmad-output`. Domain placeholders без логики. Prisma schema без моделей (1.2+). Home — статичная витрина бренда.

## Verification

**Commands:**
- `npm run lint` — expected: exit 0
- `npx prisma validate` / `npx prisma generate` — expected: OK на 7.10.0
- `npm run build` — expected: успешная сборка
- `npm run dev` — expected: страница открывается на выбранном порту

**Manual checks (if no CLI):**
- Визуально: фон paper, primary forest; нет dark switch; нет оплаты в UI
- `package.json`: prisma/`@prisma/client` = 7.10.0; next = 16.3.8
