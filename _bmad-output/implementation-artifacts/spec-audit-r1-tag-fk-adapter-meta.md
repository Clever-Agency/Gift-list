---
title: 'R1/F4: P2003 вложенного create по реальной мете адаптера'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** на Prisma 7.10.0 + `@prisma/adapter-pg` вложенный `gift.create` с удалённым тегом каталога даёт P2003 с `meta.modelName: "Gift"`, а имя ограничения лежит только в `meta.driverAdapterError.cause.constraint.index = "GiftTag_tagId_fkey"`. Маппер читает `modelName`/`field_name`/`target`, видит `"Gift"` и пробрасывает ошибку, поэтому `POST /api/v1/me/gifts` отвечает сетевым сбоем вместо конверта AD-12 `VALIDATION` с `field: "tags"`.

**Approach:** собирать имена ограничений из реальных путей меты (включая `driverAdapterError.cause.constraint.index`/`fields` и `table`) и маппить только `GiftTag_tagId_fkey` (P2003 → `VALIDATION`/`tags`) и уникальные индексы `GiftTag` (P2002 → `CONFLICT`/`tags`). `Gift_listId_fkey` и прочие чужие ограничения по-прежнему пробрасываются. Атомарность вложенного create и транзакции update не меняется.

</frozen-after-approval>

## Implementation Notes

- `apps/web/src/actions/gifts.ts`: `constraintDetail()` заменён на сбор имён ограничений из `meta.modelName`, `meta.field_name`, `meta.target`, `meta.table`, `meta.driverAdapterError.cause.constraint.index`, `...constraint.fields`, `...cause.table`. P2003 маппится только при точном признаке `GiftTag_tagId_fkey` (или пустой мете в уже существующем пути записи тегов); P2002 — при признаке `GiftTag` в имени/таблице. Широкое `/tag/i` по всей ошибке не используется.
- `apps/web/src/actions/gifts.test.ts`, `apps/web/src/app/api/v1/me/gifts/tags.test.ts`: моки переведены на аутентичную мету адаптера; добавлен негативный кейс `Gift_listId_fkey`.
- `apps/web/src/db/disposable-pg/verify.pgtest.ts`: добавлена регрессия на реальной одноразовой PostgreSQL — форма меты, сквозной `createGift` с гонкой удаления тега → `VALIDATION`/`tags`, отсутствие остатка `Gift`/`GiftTag`, `Gift_listId_fkey` → проброс.
- Границы: схема, миграции, контракты AD-12, R2/F10 и R3/F6 не менялись. Задача без истории Linear — микрозадача устранения находки аудита F4.
- Проверки: focused vitest 91/91; `npm run typecheck` — 0; `npm run lint` — 0 (включая `check-boundaries`); `npm test` — mobile 590, web 518, contracts 164, ui 81, 5 границ; `npm run build` — успешно; `npm run verify:disposable-pg -w @gift-list/web` — 18/18 на одноразовой PostgreSQL 17.
- Реальная БД подтвердила: `meta.modelName = "Gift"`, `meta.driverAdapterError.cause.constraint.index = "GiftTag_tagId_fkey"`, `field_name`/`target` отсутствуют; `createGift` → `VALIDATION`/`tags` без остатка `Gift`/`GiftTag`; `Gift_listId_fkey` → проброс. Доказательство: `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-F5-evidence-2026-11-06T084454.md`.
- Ограничения: реальный P2002 проверен unit/route-моками с аутентичной метой; в одноразовом прогоне отдельный P2002-проб не добавлялся. Blind Hunter после гейтов не завершился (зависание CLI), повторные циклы ревью не запускались; замечания ревью учтены как ограничения в отчёте R1.
