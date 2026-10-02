# Gift List

Сервис персональных вишлистов подарков (web-first). Планирование ведётся по [BMAD Method](https://bmadcode.com/).

## Локальная разработка приложения

### Требования

- Node.js 20.19+ / 22.12+ (Prisma 7)
- PostgreSQL 16+ (локально или managed, например Neon)

### Установка

```bash
npm install
cp .env.example .env
# Отредактируйте DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL в .env
npx prisma generate
```

### Запуск dev-сервера

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) — должна открыться страница **Gift List** с темой Forest Paper.

### Миграции БД

Модели User, Session, Account, Verification и List уже в схеме (story 1.2), стартовая миграция — `src/db/migrations/20261002000000_init_auth_lists`. При изменении `src/db/schema.prisma`:

```bash
npm run migrate
```

Это алиас для `prisma migrate dev` (интерактивное создание/применение миграций в development). Для CI/production используйте `npx prisma migrate deploy`.

PIN: `prisma` и `@prisma/client` — **7.10.0** (не ставьте bare `prisma@latest` — он может указать на Prisma 8 RC).

### Стек (R1 scaffold)

- Next.js ^16.3.8 (App Router) · React 19 · Tailwind 4 · TypeScript · ESLint
- shadcn/ui · Forest Paper (light only)
- Prisma 7.10.0 + PostgreSQL
- Слои: `src/app` → `src/actions` → `src/domain` → `src/db`

## BMAD в репозитории

- Установка: BMAD Core + модуль **BMM** (v6.12.0), инструмент **Cursor** — каталог `_bmad/`, навыки в `.agents/skills/`.
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
  --tools cursor \
  --user-name "Sergey" \
  --communication-language Russian \
  --document-output-language Russian \
  --output-folder _bmad-output \
  --yes
```

Статус: `npx bmad-method@latest status`
