# R1 / F4 — отчёт об устранении находки аудита

Дата: 2026-11-06
Ветка: `evivanchikov/story-24-25-auth-fixups`
База: `bc82a75` (`bc82a75718e86b391dc9c2aaac1782890fb1c142`)
Коммит R1: `ae01bc01f0da4ffce2993cc3bafd8f1d17fba342`
Статус: R1 — `done`; R2/F10 и R3/F6 — `planned-not-started`, код не менялся.
Задача без истории Linear: микрозадача устранения находки независимого аудита, критерии продукта не меняются.

## Что было сломано

На реальном Prisma 7.10.0 + `@prisma/adapter-pg` вложенный `prisma.gift.create({ tags: { create } })` с несуществующим `tagId` падал с `P2003`, но мета ошибки не совпадала с ожиданиями маппера:

- `meta.modelName` = `"Gift"` — корень операции, а не `GiftTag`;
- имя ограничения находилось только в `meta.driverAdapterError.cause.constraint.index` = `"GiftTag_tagId_fkey"`;
- `meta.field_name` и `meta.target` отсутствовали.

`constraintDetail()` собирал только `modelName`/`field_name`/`target`, получал строку `"Gift"`, не находил `/tag/i` и возвращал `null`. `createGift` пробрасывал исключение, `POST /api/v1/me/gifts` его не ловил, и клиент получал сетевую ошибку вместо конверта AD-12 `VALIDATION` с `field: "tags"`. Желание при этом не оставалось, то есть дефект был именно в отображении ошибки.

## Что исправлено

- `apps/web/src/actions/gifts.ts`:
  - `constraintDetail()` заменён на `constraintNames()`: имена собираются из `meta.modelName`, `meta.field_name`, `meta.target`, `meta.table`, `meta.driverAdapterError.cause.constraint.index`, `...constraint.fields`, `...cause.table`.
  - P2003 маппится в `VALIDATION`/`tags` только при точном признаке `GiftTag_tagId_fkey` (допускается префикс схемы) либо при полностью пустой мете — прежнее поведение для рантайма без метаданных.
  - `Gift_listId_fkey` и другие чужие ограничения пробрасываются, а не превращаются в `VALIDATION`/`tags`.
  - P2002 по `GiftTag` остаётся `CONFLICT`/`tags`; P2002 по другой таблице не маппится.
  - Широкое `/tag/i` по всей ошибке больше не используется.
- `apps/web/src/actions/gifts.test.ts` и `apps/web/src/app/api/v1/me/gifts/tags.test.ts`: моки переведены на аутентичную мету адаптера; добавлен негативный кейс `Gift_listId_fkey` на уровне action и HTTP-адаптера.
- `apps/web/src/db/disposable-pg/verify.pgtest.ts`: добавлены реальные регрессии на одноразовой PostgreSQL:
  1) форма меты вложенного create с отсутствующим тегом;
  2) сквозной `createGift` с детерминированной гонкой «тег удалён после проверки» → `VALIDATION`/`tags`, без остатка `Gift` и без осиротевших `GiftTag`;
  3) `Gift_listId_fkey` через `createGift` → проброс, не `VALIDATION`.
- `_bmad-output/implementation-artifacts/opencode-microtasks/audit-remediation-plan.md` — план всех трёх микрозадач, R1 отмечен `done`.
- `_bmad-output/implementation-artifacts/spec-audit-r1-tag-fk-adapter-meta.md` — BMAD-спека R1, `status: done`.

## Доказательство на одноразовой PostgreSQL

Запуск: `npm run verify:disposable-pg -w @gift-list/web` — **18/18**.
Одноразовый кластер: `postgres:17-alpine`, контейнер `gift-r1-audit-6278829227`, БД `gift_f5_c6f7c90bbd16`, loopback `127.0.0.1:62617`. Пароль и строки подключения не сохранялись в отчёте и не коммитились. Контейнер и том после проверки удалены.

Журнал: `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-F5-evidence-2026-11-06T084454.md` (не входит в коммит R1).

Ключевые строки журнала:

- `R1 real meta: P2003 modelName=Gift, cause.constraint.index=GiftTag_tagId_fkey, no gift left`
- `R1 createGift: real tag race -> VALIDATION/tags, no Gift and no orphan GiftTag`
- `R1 createGift: real Gift_listId_fkey rethrown (not a tags VALIDATION)`

## Гейты

| Команда | Результат |
|---|---|
| focused vitest (`gifts.test.ts`, `tags.test.ts`) | 2 файла / 91 тест, падений 0 |
| `npm run typecheck` | код 0 |
| `npm run lint` | код 0, включая `check-boundaries` |
| `npm test` | mobile 43 / 590, web 48 / 518, contracts 6 / 164, ui 14 / 81, 5 проверок границ; падений 0 |
| `npm run build` | код 0, standalone-сборка Next.js 16.4.3 |
| `npm run verify:disposable-pg -w @gift-list/web` | 18/18, PostgreSQL 17 |

## Ограничения

- Реальный P2002 проверен только unit/route-моками с аутентичной метой (`GiftTag_giftId_tagId_key`, `cause.table: "GiftTag"`). Отдельный реальный P2002-проб в одноразовый harness не добавлялся: существующие проверки unique уже покрывают БД, а маппер проверен на мете адаптера.
- Сквозной HTTP через поднятый Next-сервер не выполнялся; action и route покрыты тестами, `createGift` проверен на реальной БД.
- В `verify.pgtest.ts` auth замокан, чтобы вызвать action без Better Auth-сессии; это не проверка аутентификации.
- Заголовок и имя журнала F5 остались историческими: новые R1-пробы дописаны в тот же disposable-harness и журнал `fixup-F5-evidence-*`.
- Blind Hunter после успешных гейтов завис (CLI простаивал ~6+ минут, лог замер на 11:51:45); повторные циклы ревью не запускались. Замечания ревью учтены как ограничения, код после гейтов не менялся.
- `apps/web/AGENTS.md` остаётся грязным (`#` → `##`) и не входит ни в один коммит.

## Остаток

- **R2 / F10** — `planned-not-started`: сузить `normalizeWebOrigin`, отвергать userinfo/обратную косую черту, сохранить порядок «явный origin → API → origin страницы».
- **R3 / F6** — `planned-not-started`: гарантировать снятие временного `textarea` при броске `select()`/`appendChild`, сохранить результаты фолбэка.

Оба пункта описаны в `audit-remediation-plan.md` и в этот заход не реализовывались.
