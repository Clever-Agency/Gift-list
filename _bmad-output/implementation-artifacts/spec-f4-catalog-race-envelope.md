---
title: 'F4: гонки FK/unique каталога в конверте AD-12'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** удаление тега каталога между проверкой id и записью `GiftTag` даёт необработанный P2003, а уникальная гонка при замене набора тегов — P2002. Оба уходят из use-case наружу вместо конверта AD-12, поэтому клиент получает инфраструктурный сбой там, где причина — гонка данных. Подтверждено в `fixup-queue.md` (Q-10, F-2.5.5-5).

**Approach:** отобразить обе гонки в уже существующие коды AD-12 без нового кода: P2003 по внешнему ключу `GiftTag.tagId` → `VALIDATION` (`field: "tags"`, тот же ответ, что у неизвестного id), P2002 по уникальному индексу `GiftTag` → `CONFLICT` (`field: "tags"`). Атомарность и правила статуса/eligible не меняются: create остаётся одним вложенным write, update — одной транзакцией с откатом. Маппинг включается только для запросов, которые пишут строки тегов, и только когда ограничение называет отношение тегов; чужая FK (например, `Gift.listId`) по-прежнему пробрасывается. Закрытие каталога от удаления при связях — Story 10.2, не здесь.

</frozen-after-approval>

## Implementation Notes

- `apps/web/src/actions/gifts.ts`:
  - `constraintDetail()` собирает `modelName`/`field_name`/`target` из `meta` ошибки Prisma в одну строку; отсутствие `meta` даёт пустую строку.
  - `tagWriteFailure()` срабатывает только на `Prisma.PrismaClientKnownRequestError` с кодом P2003/P2002, когда `meta` пуст или называет тег. P2003 → `validation("tags")` (тот же конверт, что у отсутствующего `catalogId`); P2002 → `CONFLICT` с диагностическим `message` и `field: "tags"`. Другие коды и чужие ограничения возвращают `null`.
  - `createGift`: вложенный `prisma.gift.create` обёрнут в `try/catch`; маппинг применяется только при непустом наборе тегов. Вложенный write — один statement, поэтому при ошибке подарок не создаётся.
  - `updateGift`: в существующем `catch` маппинг стоит после `MissingCatalogTagError` и до разбора P2025; применяется только при `tags !== undefined`. Транзакция `$transaction` откатывает и обновление полей, и замену тегов.
  - JSDoc `fixedTagsExist` уточнён: P2003 на create теперь отображается, а не уходит наружу.
- Новых кодов, `reason`, лимитов тегов, ограничений `CLOSED`, изменений PRD/эпиков/архитектуры нет. `INTERNAL` не вводился. Q-34 не трогался.
- Тесты `apps/web/src/actions/gifts.test.ts`: P2003 на create и update → `VALIDATION`; P2002 на create и update → `CONFLICT`; P2003 с `meta` про `Gift_listId_fkey` пробрасывается; мок `PrismaClientKnownRequestError` расширен необязательным `meta`.
- Тесты `apps/web/src/app/api/v1/me/gifts/tags.test.ts`: те же четыре сценария на уровне HTTP — 400 с конвертом для P2003 и 409 с конвертом для P2002, вместо необработанного 500.
- Существующие проверки не менялись: happy path create/update, пустой набор тегов, отказ без сессии, P2025 → `NOT_FOUND`/`VALIDATION`, P2002 без тегов по-прежнему пробрасывается.

## Review Triage Log

- Ревью не проводилось: заход ограничен fixup-пунктом F4 и его focused-тестами.

## Verification

**Commands:**
- `npm exec -w @gift-list/web -- vitest run src/actions/gifts.test.ts src/app/api/v1/me/gifts/tags.test.ts` — 2 файла, 90 тестов пройдено.
- `npm run typecheck` — успешно.
- `npm run lint` — успешно, включая `check-boundaries`.
- `npm test` — 1281 тест (mobile 557, web 489, contracts 164, ui 71) и 5 проверок границ.
- `npm run build` — standalone-сборка успешна.

**Manual checks (if no CLI):**
- Реальная PostgreSQL не использовалась; поведение P2003/P2002 проверено на моках Prisma. Живая проверка гонок остаётся за F5/Q-04.
