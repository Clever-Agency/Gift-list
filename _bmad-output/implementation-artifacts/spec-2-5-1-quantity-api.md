---
title: 'Story 2.5.1: quantity в API желания'
type: 'feature'
created: '2026-11-05'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `Gift.quantity` (`SINGLE | UNLIMITED`) уже есть в Prisma и в контракте карточки, но создать желание с нужным типом или изменить его через API нельзя: `giftInputSchema` и `giftUpdateSchema` не принимают `quantity`. Story 2.5 требует сохранять тип при создании (по умолчанию `SINGLE`) и разрешать смену только у `OPEN`.

**Approach:** Добавить `quantity` в контракты create/update с дефолтом `SINGLE`, писать его в `createGift`, а в `updateGift` применять то же правило, что у видимости: неизменённое значение проходит, изменённое допустимо только при статусе `OPEN`, иначе `VALIDATION` с `field: "quantity"`. Видимость не трогать. UI формы — вне этой микротаски.

</frozen-after-approval>

## Implementation Notes

Решение planning: изменение небольшое и полностью определённое кодом и AC Story 2.5, поэтому route `oneshot` без Open Questions. Отдельного story-артефакта для Story 2.5 нет — источник правды `epics.md` и `sprint-status.yaml`; статус истории остаётся `in-progress`, так как это первый срез.

Решения реализации:
- `quantity` — optional в update-схеме; отсутствие ключа сохраняет значение, как у остальных полей.
- Повторная отправка сохранённого `quantity` не считается изменением и не требует `OPEN` (паттерн Story 2.3 для `visibility`).
- Реальная смена `quantity` пишется с `status: "OPEN"` в `where`, чтобы гонка с бронью не прошла.
- При `P2025` на guarded-записи поле ошибки выбирается детерминированно: `visibility`, если менялась и видимость, иначе `quantity` (сохранение поведения Story 2.3).

Файлы:
- `packages/contracts/src/gift.ts` — `quantity` в create (default `SINGLE`) и update (optional), `GiftUpdate`, JSDoc правила `OPEN`.
- `packages/contracts/src/gift.test.ts` — enum, default, невалидные значения в обеих схемах.
- `apps/web/src/actions/gifts.ts` — запись `quantity` при создании; в update чтение сохранённого значения, no-op при совпадении, `VALIDATION` вне `OPEN`, guarded `where` и обработка `P2025`.
- `apps/web/src/actions/gifts.test.ts` — create default/UNLIMITED/invalid, update OPEN/RESERVED/CLOSED, same-value, `P2025`, совместная смена с visibility.
- `apps/web/src/app/api/v1/me/gifts/quantity.test.ts` — API-уровень: POST default/UNLIMITED/invalid, PATCH OPEN/non-OPEN/same-value/visibility.
- `apps/mobile/app/(app)/gifts/new.tsx` — payload формы creation явно шлёт `SINGLE` до UI-среза 2.5.2.
- `apps/mobile/src/api/my-gifts.create.test.ts`, `apps/mobile/src/session/gift-flows.test.tsx`, `apps/mobile/src/session/new-gift-screen.test.tsx` — ожидания payload с `quantity: "SINGLE"`.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story 2.5 в `in-progress` (первый срез, не `review`).
- `_bmad-output/implementation-artifacts/epic-2-context.md` — контекст эпика для BMAD (сгенерирован).

Проверки (реальные): `npm run typecheck` — успешно; `npm run lint` — успешно; `npm test` — mobile 459, web 397, contracts 140, ui 55, check-boundaries 5/5; `npm run build` — успешно (Expo-web + Next standalone, 14 маршрутов).

## Review Triage Log

- Пустая update-запись при no-op `quantity` (`data: {}` → `updatedAt`) — `low`, defer: поведение совпадает с существующим no-op `visibility`; фикс требует отдельного чтения полной карточки и меняет общий путь. Предложен fixup-микротаской.
- Нет отдельного теста на quantity-only no-op — `low`, defer вместе с предыдущим: same-value покрыт тестом с другим изменяемым полем.
- Хардкод `SINGLE` в mobile payload — `low`: дефолт продублирован, но UI-контрол относится к 2.5.2; добавлен комментарий, смена типа клиента отложена.
- Нет маппинга `field: "quantity"` в форме — `low`, defer: это часть UI-среза 2.5.2.
- Отчёт 2.5.1 отсутствует — `false`: создаётся и коммитится в конце этой задачи.
- Спека не отражала файлы и проверки — `low`, patch: Implementation Notes дополнены.
- Остальные AC Story 2.5 (теги, запрет брони `UNLIMITED`) — `low`, вне среза: перечислены в отчёте и комментарии статуса.
- Совместная смена `quantity` и `visibility` вне `OPEN` не была закреплена тестом — `medium`, patch: добавлен тест на `field: "visibility"`.
- Нет API-теста гонки `P2025` и «мёртвый» mock класса — `low`, defer: гонка покрыта на уровне use-case, класс используется в `vi.mock`.
- Дублирование фикстур и двух маршрутов в `quantity.test.ts` — `low`, отклонено: организация теста не влияет на поведение, перенос добавит churn.
- Нет проверки паритета `QUANTITIES` и Prisma `GiftQuantity` — `low`, defer: межпакетная проверка вне среза.
- JSDoc контракта не описывал правило `OPEN` и отсутствие `null` — `low`, patch: дополнен.
- `apps/web/AGENTS.md` изменён — `false`: это существующая правка от `next dev`, в коммит не включается.
