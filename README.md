# Gift List

Сервис персональных вишлистов подарков (приложение для Android, iOS и браузера). Планирование ведётся по [BMAD Method](https://bmadcode.com/).

## Структура репозитория

Монорепозиторий на npm workspaces (D-41, AD-26):

- `apps/web` — Next.js: сервер, `app/api/v1`, cron, серверные страницы, админка, Prisma, env.
- `apps/mobile` — приложение Expo SDK 58 для Android, iOS и браузера (Story 1.3: заглушки маршрутов, токены Forest Paper, Lora и Manrope).
- `packages/contracts` — `@gift-list/contracts`: zod-схемы конверта ответа (AD-12), gift card, коды ошибок и каталоги переводов (AD-27); без React, Prisma и env.

Все команды ниже запускаются из корня. Lock-файл один — корневой `package-lock.json`.

## Локальная разработка

### Требования

- Node.js 24.22.1+ (линия 24.x, как на Vercel)
- PostgreSQL 16+ (локально или managed, например Neon)

### Установка

```bash
npm install
cp apps/web/.env.example apps/web/.env
# Отредактируйте DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL в apps/web/.env
# Для входа из Expo Go или dev client раскомментируйте AUTH_DEV_TRUSTED_ORIGINS (только для разработки)
# Для Expo web (npm run web) добавьте в него http-origin Metro, например http://localhost:8081: он же получит CORS на /api/v1
# Лимиты входа, регистрации и сброса пароля: AUTH_RATE_LIMIT_MAX и AUTH_RATE_LIMIT_WINDOW_SECONDS (по умолчанию 5 за 3600 с; в проде не меняйте)
```

`npm install` ставит все workspaces и запускает `prisma generate` в `apps/web`. Новую зависимость ставьте в нужный workspace: `npm install <pkg> -w @gift-list/web`.

### Запуск dev-сервера

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000). После сборки Next отдаёт веб-сборку приложения на `/` и `/login`; свои пути (`/api`, `/l`, `/i`, `/unsubscribe`, `/admin`, `/.well-known`) остаются у Next. Пока `apps/web/public/spa-index.html` нет, эти адреса не из чего отдать — файл появляется при `npm run build`.

Приложение Expo (Metro) отдельно от сервера Next:

```bash
npm run mobile:start   # Android, iOS и меню Expo
npm run mobile:web     # то же приложение в браузере
```

Имя на экранах берётся из `EXPO_PUBLIC_BRAND_NAME` (пустое значение → запасное имя только в `apps/mobile/src/config/env.ts`). Веб читает `BRAND_NAME` из `apps/web/.env`.

### Проверки

```bash
npm run typecheck   # tsc в web, mobile и packages/contracts
npm run lint        # ESLint web, mobile, contracts и границы AD-17
npm test            # Vitest во всех workspaces с тестами
npm run build       # expo export (web) + prisma generate + next build (output: 'standalone')
```

### Миграции БД

Схема — `apps/web/src/db/schema.prisma`, миграции — `apps/web/src/db/migrations`. После изменения схемы:

```bash
npm run migrate
```

Это алиас для `prisma migrate dev` в `apps/web` (интерактивное создание/применение миграций в development). Для CI/production: `npm exec -w @gift-list/web -- prisma migrate deploy`.

PIN: `prisma` и `@prisma/client` — **7.10.0** (не ставьте bare `prisma@latest` — он может указать на Prisma 8 RC).

### Деплой (Vercel)

В настройках проекта Vercel Root Directory = `apps/web`. Команду установки задаёт `apps/web/vercel.json`: `cd ../.. && npm ci`. Из `apps/web` npm ставит только зависимости `@gift-list/web`, а сборке нужен и `expo` из `apps/mobile`: `scripts/sync-spa.mjs` экспортирует веб-версию приложения в `public/`.

Сборка — `output: 'standalone'` с корнем трассировки в корне репозитория (AD-16), поэтому сервер лежит в `apps/web/.next/standalone/apps/web/server.js`. `apps/web/scripts/copy-standalone-assets.mjs` после сборки сам кладёт `.next/static` и `public` в `.next/standalone/apps/web`, вручную ничего копировать не нужно.

### Деплой вне Vercel

1. Соберите проект из корня: `npm run build`, не голый `next build`: удаление `.env*` и копирование статики и `public` в standalone делает `apps/web/scripts/copy-standalone-assets.mjs`.
2. Доставьте на сервер (в образ) каталог `apps/web/.next/standalone`: статика и `public` уже внутри.
3. Примените миграции до старта сервера: в standalone нет Prisma CLI и миграций, поэтому из полного чекаута или CI выполните `npm exec -w @gift-list/web -- prisma migrate deploy` с `DATABASE_URL` целевой базы.
4. Запускайте `node apps/web/.next/standalone/apps/web/server.js` из корня репозитория, а не `next start`. Если в образ скопировано только содержимое `standalone`, запускайте `node apps/web/server.js` из этого каталога.
5. Конфигурация и секреты рантайма — из окружения процесса, список переменных в `apps/web/.env.example`. Исключение: `BRAND_NAME` вшивается ещё при сборке в страницы, которые Next.js пререндерит (`/`, 404: `apps/web/src/app/layout.tsx` берёт `getBrandName()` в metadata), а `EXPO_PUBLIC_*` — в SPA в `public/` (`sync-spa`). Задайте их и в окружении сборки, с тем же значением, что в рантайме.

`PORT` и `HOSTNAME` по умолчанию — `3000` и `0.0.0.0`. В Docker задайте `HOSTNAME=0.0.0.0` явно: Docker подставляет в `HOSTNAME` id контейнера, и сервер не будет слушать 127.0.0.1 внутри контейнера.

Сборка удаляет из standalone все файлы `.env*`, которые туда копирует Next.js. Не кладите `.env` в образ: репозиторий публичный, секреты в нём не хранятся (D-17).

### Стек

- Next.js 16.3.8 (App Router) · React 19 · Tailwind 4 · TypeScript · ESLint
- shadcn/ui · Forest Paper (light only)
- Prisma 7.10.0 + PostgreSQL
- Слои `apps/web`: `src/app` → `src/actions` → `src/domain` → `src/db`

## BMAD в репозитории

- Установка: BMAD Core + модуль **BMM** (v6.12.0), инструменты **Claude Code**, **Cursor**, **Codex** — каталог `_bmad/`, навыки в `.claude/skills/` (Claude Code) и `.agents/skills/` (Cursor, Codex).
- Артефакты планирования: `_bmad-output/planning-artifacts/`.
- Первый артефакт: [продуктовый бриф (RU)](_bmad-output/planning-artifacts/briefs/brief-gift-list-2026-09-29/brief.md).
- PRD: [Gift List PRD (RU)](_bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/prd.md) · [addendum](_bmad-output/planning-artifacts/prds/prd-gift-list-2026-09-30/addendum.md) — Раунд 1 без оплаты; платежи в Раунде 2.
- UX (Раунд 1): [DESIGN.md](_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md) · [EXPERIENCE.md](_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/EXPERIENCE.md).
- Architecture (Раунд 1): [ARCHITECTURE-SPINE.md](_bmad-output/planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md).

## Повторная установка / обновление BMAD

```bash
npx bmad-method@latest install \
  --directory . \
  --modules bmm \
  --tools claude-code,cursor,codex \
  --user-name "Sergey" \
  --communication-language Russian \
  --document-output-language Russian \
  --output-folder _bmad-output \
  --yes
```

Статус: `npx bmad-method@latest status`
