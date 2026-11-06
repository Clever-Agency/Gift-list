---
title: 'F1: инициализация фиксированного каталога тегов в деплое'
type: 'bugfix'
created: '2026-11-06'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Поддерживаемый выкат выполняет `prisma migrate deploy`, а он не запускает `prisma db seed`. На чистой БД после деплоя таблица `Tag` пустая, `GET /api/v1/tags` отдаёт `{ tags: [] }`, и фиксированные теги нельзя выбрать. Это блокер полезности Story 2.5 в deployed-среде, а не дефект кода каталога.

**Approach:** Добавить отдельную аддитивную data-миграцию, которая идемпотентно вставляет стартовые фиксированные теги по `slug` в том же поддерживаемом шаге деплоя. Существующие строки и подписи ADMIN не перезаписывать и не удалять; `db seed` оставить для разработки и ремонта.

## Boundaries & Constraints

**Always:** Новая миграция идёт после `20261105120000_tags`; стартовый набор совпадает с `FIXED_TAGS`; конфликт по `slug` сохраняет существующие подписи и добавляет только недостающие языковые ключи; повторный деплой и повторный сид не создают дублей; проверка — офлайн-тестами без подключения к БД.

**Never:** Не редактировать уже существующую миграцию `20261105120000_tags`; не менять схему Prisma, API, контракты, PRD, эпики и архитектуру; не добавлять продуктовые лимиты или модерацию; не менять общее поведение CI/Vercel; не запускать `migrate`, `migrate deploy`, `db push`, `db seed` против живой или общей БД; не читать секреты и не трогать `main`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Чистая БД | `Tag` пустая, миграции применяются по порядку | Три строки `dream`, `need-now`, `someday` с русскими подписями | Ошибка SQL валит деплой, а не оставляет пустой каталог |
| Подпись изменена ADMIN | Строка `dream` уже есть с другой подписью | Существующая подпись сохранена, дубль не создан | — |
| Повторный деплой | Миграция уже в истории | SQL не выполняется повторно; данные не меняются | — |
| Повторный ручной сид | Строки уже созданы миграцией | Upsert по `slug` не создаёт дублей | — |
| Новый язык в `SUPPORTED_LOCALES` | У строки нет ключа locale | Ключ добавляется из стартового набора, существующие ключи не меняются | — |

</frozen-after-approval>

## Code Map

- `apps/web/src/db/migrations/20261105120000_tags/migration.sql` — создаёт `Tag`/`GiftTag`, unique `Tag_slug_key`, CHECK; не менять.
- `apps/web/src/db/migrations/20261106120000_fixed_tags_catalog/migration.sql` — новая data-миграция.
- `apps/web/src/db/seed.ts` — `FIXED_TAGS`, идемпотентный upsert `EXCLUDED.labels || Tag.labels`; остаётся источником стартового набора и ручным сидом.
- `apps/web/src/db/seed.test.ts` — существующие mock-тесты сида; не дублировать их.
- `README.md` — раздел «Миграции БД»/«Деплой вне Vercel»: поддерживаемый шаг и порядок выката.
- `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-plan.md` — порядок пакета.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/db/migrations/20261106120000_fixed_tags_catalog/migration.sql` — добавить `INSERT ... ON CONFLICT ("slug") DO UPDATE` с тремя тегами и слиянием подписей — инициализация в обычном деплое.
- [x] `apps/web/src/db/fixed-tags-migration.test.ts` — сверить SQL с `FIXED_TAGS`, проверить идемпотентность/неразрушительность и порядок миграции — офлайн-доказательство артефакта.
- [x] `apps/web/src/db/seed.ts` — обновить комментарий: миграция инициализирует каталог в деплое, сид остаётся ручным — убрать ложное впечатление, что деплой зависит от сида.
- [x] `README.md` — указать, что каталог инициализируется миграцией и отдельный сид в деплое не нужен — операционная ясность.

**Acceptance Criteria:**
- Given чистая БД и `prisma migrate deploy`, when миграции применяются, then в `Tag` ровно три стартовые строки с slug из `FIXED_TAGS`.
- Given существующая строка с подписью, изменённой ADMIN, when миграция применяется, then подпись не меняется и дубль не появляется.
- Given повторный вызов миграции или сида, when SQL выполняется снова, then число строк не растёт и существующие подписи сохраняются.
- Given SQL миграции, when запускается тест, then он не содержит `DELETE`/`TRUNCATE`/`DROP` для `Tag` и использует `ON CONFLICT ("slug")`.
- Given репозиторий без БД, when запускаются проверки, then они проходят офлайн и явно не выдают mock-проверку за применение к PostgreSQL.

## Implementation Notes

- Выбрана отдельная data-миграция, а не шаг сида в CI/Vercel: `prisma migrate deploy` уже поддерживаемый шаг, а изменение общего CI выходит за границы F1. Старая миграция `20261105120000_tags` не тронута, потому что могла быть применена удалённо.
- SQL повторяет семантику сида: `EXCLUDED.labels || Tag.labels`, то есть существующие ключи (включая правки ADMIN) выигрывают; `WHERE ... IS DISTINCT FROM` не трогает `updatedAt`, если менять нечего. Удаления и пересоздания строк нет.
- Стартовые `id` — три заранее сгенерированных CUID2; при конфликте по `slug` они не используются. Значения slug и `labels` сверяются с `FIXED_TAGS` тестом.
- Проверено офлайн: focused-тесты 10/10, `npm test` — 1262 теста (mobile 550, web 478, contracts 164, ui 70) и 5 проверок границ, `typecheck`, `lint`, `build` — успешно; `prisma validate` с фиктивным URL — schema valid.
- Не проверено: реальное применение SQL к PostgreSQL (нет одноразовой БД), поведение `migrate deploy` на удалённой истории. Это ограничение mock-тестов и предмет F5, а не доказанный успех.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run test -w @gift-list/web` — ожидается: все тесты зелёные, включая новый тест миграции.
- `npm run typecheck` — ожидается: без ошибок.
- `npm run lint` — ожидается: без ошибок.
- `npm test` — ожидается: все workspace-тесты и проверка границ зелёные.
- `npm run build` — ожидается: standalone-сборка успешна.

**Manual checks (if no CLI):**
- SQL миграции не содержит разрушительных операций и совпадает по значениям с `FIXED_TAGS`.
- Порядок выката: `prisma migrate deploy` до старта сервера; повторный деплой безопасен.
