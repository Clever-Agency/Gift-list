---
title: '5.3: Закрытие желания владельцем, отмена и «Хочу ещё такой»'
type: 'feature'
created: '2026-11-19'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '962dcfed83b3f55d6289b058cc55d7fa6344d2fe'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Желание нельзя закрыть. Перехода `OPEN | RESERVED → CLOSED` в `GiftStatusService` нет: колонки `closedAt` и `closedFromStatus` в `schema.prisma` есть, но их никто не пишет (`apps/web/src/lib/gift-status-store.ts`), поэтому закрытых желаний не бывает вовсе. Клиент не умеет ни «Отметить полученным», ни отменить промах, ни разложить закрытые карточки по секциям, ни создать такой же подарок снова, а `DELETE /api/v1/me/gifts/:id` закрытое желание отклоняет `CONFLICT`. Владелец не может отметить подарок полученным, если его вручили не через сервис (FR-32, ARCH-A5).

**Approach:** Один владельческий переход `OPEN | RESERVED → CLOSED` через `GiftStatusService` (CAS): `reserved*` сохраняются, пишутся `closedAt` и `closedFromStatus`, в карточку владельца попадает `undoUntil`. Отмена — обратный CAS `CLOSED → closedFromStatus` только внутри `UNDO_WINDOW` = 10 мин (D-43, ARCH-A5). Закрытые карточки клиент показывает в свёрнутой секции «Получено (N)» у владельца и «Уже подарено» у зрителей, «Хочу ещё такой» — обычное создание `OPEN`-копии без `expiresOn`, удаление закрытого — существующий `DELETE` с confirm. Уведомление держателю после окна и его отложенная доставка остаются Epic 6; 5.3 оставляет только факт перехода в колонках `Gift` и строку аудита NFR-6. Событие пишется одной функцией-шов `recordGiftEvent(...)` в `GiftStatusService` (по умолчанию вариант A: строки `Notification` нет, `deliverAfter = closedAt + UNDO_WINDOW` Epic 6 вычислит из `closedAt` и сохранённого снимка брони; см. «Открытые вопросы → Запись события: вариант A или B»). (уточнено по CLE-114/CLE-115, 2026-11-19)

## Boundaries & Constraints

**Always:**
- Писатель `status` и колонок закрытия — только `gift-status-store.ts` через `GiftStatusService`. Домен без Prisma.
- Закрыть может только владелец, только `OPEN` или `RESERVED` (любая фаза), только не архивное. Чужое и несуществующее — тот же `NOT_FOUND`, что у чтения; своё архивное — `VALIDATION` + `GIFT_ARCHIVED`; уже `CLOSED` — `CONFLICT`; нет сессии — `UNAUTHENTICATED`.
- CAS закрытия: `where: { id, status: ожидаемый, archivedAt: null, list: { ownerId: actor } }`. `count ≠ 1` — `CONFLICT`. Ожидаемый статус берётся из строки, прочитанной в том же use-case перед записью.
- Запись закрытия: `status: CLOSED`, `closedAt: now`, `closedFromStatus: OPEN | RESERVED`. Ни `reserved*`, ни `quantity`, ни `visibility`, ни `titleSnapshotOnReserve` не меняются; `undoUntil` — не колонка, а вычисляемое поле ответа.
- `UNDO_WINDOW` = 10 минут — одна серверная константа в домене (`D-43`, `ARCH-A5`). В карточке владельца `undoUntil` — ISO-момент `closedAt + UNDO_WINDOW` для `CLOSED` (в том числе в прошлом, когда окно уже вышло) и `null` для остальных статусов. Десяти минут клиент не знает: он сравнивает `undoUntil` с текущим временем и отсчитывает остаток; кнопка живёт только пока момент в будущем.
- Отмена: CAS `status = CLOSED AND closedAt = прочитанный AND closedFromStatus = прочитанный AND list.ownerId = actor`; запись `status = closedFromStatus, closedAt = null, closedFromStatus = null`. `reserved*` не трогаются, поэтому бронь, её фаза, «Купил» и срок возвращаются сами. Событий и уведомлений нет. В варианте A отменять нечего — строки `Notification` не было, а после очистки `closedAt` будущий `deliverAfter` перестаёт вычисляться сам; в варианте B отмена удаляет недоставленную запись (см. «Открытые вопросы»). (уточнено по CLE-114/CLE-115, 2026-11-19)
- Отмена после окна — `CONFLICT` + `reason: UNDO_WINDOW_EXPIRED`; потеря CAS по другой причине (уже не `CLOSED`, `closedAt` переписан, `closedFromStatus` пуст) — `CONFLICT` без `reason`. Успешная отмена отдельного тоста не показывает: карточка просто возвращается в активный список.
- NFR-6 — это Logging, а не таблица: после успешного закрытия и отмены `GiftStatusService` зовёт одну функцию-шов `recordGiftEvent({ giftId, actorId, from, to, at })` (та же, что в 5.2), и она пишет одну структурированную строку `console.info` с JSON `{ event: "gift.status", giftId, actorId, from, to, at }`. Формат задаёт только шов — 5.2 и 5.3 пишут одинаково; тест проверяет вызов и поля. Ни названий, ни имён, ни email, ни новых таблиц. (уточнено по CLE-114/CLE-115, 2026-11-19)
- Карточка: `undoUntil` получает только владелец; у зрителя ключа нет. `reservedBy` закрытого желания по-прежнему решается переключателем `holderVisibleToOwner` (владелец) и `holderVisibleToOthers` (остальные), `reservationLabel` и `ownerAction` у `CLOSED` — `null`. Правила мапперов не меняются.
- Списки: закрытыми считаются карточки из `gifts` с `status=CLOSED` (они не архивные: архив читается отдельным ключом `archived`). Разбиение на активные и закрытые делает клиент, форму `listDataSchema` не расширяем. Архив главнее: желание с `archivedAt` в секцию «Получено» не попадает.
- Секции: «Получено (N)» у владельца, «Уже подарено» у зрителей; свёрнуты по умолчанию; порядок — активная сетка, затем «Получено (N)», затем «Архив (N)» (`DESIGN.md` → Archive section). Закрытые карточки без действий у зрителей; у владельца в ⋯ — «Вернуть в открытые» (только в окне), «Хочу ещё такой», «Удалить».
- «Вернуть в открытые · ещё N мин» — на закрытой карточке владельца и в диалоге подробностей, пока окно открыто; в ⋯ — «Вернуть в открытые». В диалоге подробностей закрытого желания действия «Изменить желание» нет: `CLOSED` только для просмотра.
- «Хочу ещё такой» — без диалога: `POST /api/v1/me/gifts` с `title`, `description`, `priceAmount`, `priceCurrency`, `linkUrl`, `visibility`, `quantity`, `tags` и без `expiresOn`; тост «Добавлено в вишлист». Список один (AD-6), поэтому выбора списка нет.
- Удаление закрытого — существующий `DELETE /api/v1/me/gifts/:id` с confirm из каталога («Удалить «{title}»?», «Желание исчезнет из вишлиста. Это нельзя отменить.»).
- Тост закрытия: сообщение «Отмечено полученным», действие «Отменить», 10 с с паузой при наведении и фокусе, без автоскрытия при включённом дикторе (поведение `ToastHost` уже есть). После закрытия фокус уходит на «Отменить» в тосте (`DESIGN.md` → Доступность: «Куда уходит фокус», пункт «а»). Поздняя отмена — тост «Время на отмену вышло». Сеть — общая фраза формы «Нет соединения. Попробуйте ещё раз.».
- Тексты интерфейса — только из каталога, дословно из epics/EXPERIENCE/DESIGN. Новой миграции нет: `closedAt`, `closedFromStatus` и enum `GiftClosedFromStatus` уже в `schema.prisma` и в применённой миграции `20261103074333_gift_reservations`.

**Never:**
- `Notification`, письма, outbox, `deliverAfter`. Тексты держателю «Владелец отметил «Y» полученным. Если вы его ещё не вручали — подарок пришёл от кого-то другого» и «Владелец подтвердил получение «Y»» — Epic 6; 5.3 хранит только факт перехода (в фразе confirm текст про уведомление остаётся дословным, как в 5.1 с «Кто-то забронировал»). Строка `Notification` появляется только в варианте B, решение не принято (см. «Открытые вопросы»); в варианте A шов пишет только audit-строку, а `deliverAfter` Epic 6 вычисляет из `closedAt`.
- Cron и таймеры (5.6), «Подарил» / подтверждение получения (5.7), «Мои брони» (5.5), удаление и правка `RESERVED` (5.4), бронь (5.1) и снятие брони (5.2).
- Повторное открытие `CLOSED` после окна и любой другой переход из `CLOSED`, кроме отмены.
- Смена `quantity`, `visibility`, `reserved*`, тегов при закрытии и отмене. Изменение `RESERVATION_RELEASE_DATA`, `VisibilityPolicy`, правил AD-7 и мапперов `reservedBy` / `reservationLabel` / `ownerAction`.
- Новые таблицы и миграции; применение миграций к живой БД; секреты в репозитории.
- Правка серверной страницы `/l` до решения открытого вопроса 1.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CLOSE_OPEN | владелец, `OPEN`, не архив | `CLOSED`, `closedAt=now`, `closedFromStatus=OPEN`, `reserved*` пусты; карточка владельца с `undoUntil`; toast «Отмечено полученным · Отменить» | — |
| CLOSE_RESERVED | владелец, `RESERVED` в любой фазе | `CLOSED`, `reserved*` сохранены, `closedFromStatus=RESERVED`; confirm с телом «Бронь будет закрыта, бронировавший получит уведомление» | — |
| ALREADY_CLOSED | `CLOSED` | строка не меняется | `CONFLICT` без `reason` |
| ARCHIVED | своё желание с `archivedAt` | — | `VALIDATION` `GIFT_ARCHIVED` |
| FOREIGN | чужое или нет id | — | `NOT_FOUND`, одно тело |
| ANON | нет сессии | — | `UNAUTHENTICATED` |
| RACE | статус сменился между чтением и CAS | строка не меняется | `CONFLICT` |
| UNDO | `CLOSED`, окно открыто | `status=closedFromStatus`, `closedAt` и `closedFromStatus` пусты, `reserved*` как были; карточка вернулась в активный список; без тоста | — |
| UNDO_LATE | `closedAt + 10 мин ≤ now` | — | `CONFLICT` `UNDO_WINDOW_EXPIRED`; toast «Время на отмену вышло» |
| UNDO_RACE | уже не `CLOSED` или `closedAt` переписан | — | `CONFLICT` без `reason`; список перечитывается |
| UNDO_NO_ORIGIN | `CLOSED` без `closedFromStatus` | — | `CONFLICT` без `reason`, кнопки отмены нет |
| CARD_OWNER_CLOSED | владелец читает список/одно желание | `status=CLOSED`, `undoUntil` — ISO `closedAt + 10 мин` (и в прошлом, если окно вышло); отмена только пока момент в будущем; «Изменить желание» нет | — |
| CARD_VIEWER_CLOSED | друг, подписчик, ссылка | `status=CLOSED`, ключа `undoUntil` нет, имени держателя нет без переключателя | — |
| SECTION_OWNER | в `gifts` есть `CLOSED` | сетка активных; свёрнутая «Получено (N)»; ниже «Архив (N)»; пустое состояние — только когда активных нет | — |
| SECTION_VIEWER | то же у зрителя | свёрнутая «Уже подарено», без ⋯, без отмены | — |
| ARCHIVE_PRECEDENCE | `CLOSED` и `archivedAt` | карточка только в «Архив (N)» | — |
| COPY | «Хочу ещё такой» | новая `OPEN`-карточка сверху, `expiresOn=null`, те же поля; toast «Добавлено в вишлист» | `network` — общая фраза формы |
| DELETE_CLOSED | владелец, `CLOSED`, не архив | confirm, затем строка удалена; карточка ушла из списка | `CONFLICT` для `RESERVED`, `NOT_FOUND` для чужого и архивного |
| TOAST_TIMER | тост закрытия | 10 с, пауза при hover/фокусе, при дикторе не скрывается сам; после закрытия фокус на «Отменить» | — |
| NET | обрыв сети на закрытии, отмене, копии или удалении | действие не применено, карточка как была | toast «Нет соединения. Попробуйте ещё раз.» |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/gift-status.ts` — `UNDO_WINDOW_MS`, `canCloseGift`, `canUndoClose`, данные записи закрытия и отмены, метод `closeGift` / `undoClose` в `GiftStatusTransaction`, тип шва `recordGiftEvent` (объявлен в 5.2, здесь используется). `RESERVATION_RELEASE_DATA` не трогать.
- `apps/web/src/lib/gift-status-store.ts` — единственные CAS `OPEN | RESERVED → CLOSED` и `CLOSED → closedFromStatus`; там же реализация шва `recordGiftEvent` — строка аудита NFR-6 (в варианте A других записей нет).
- `apps/web/src/actions/gift-close.ts` — use-cases `closeGift` и `undoGiftClose`: сессия, владение, архив, окно, конверт, карточка владельца.
- `apps/web/src/app/api/v1/me/gifts/[id]/close/route.ts` — `POST`, остальные методы `notFoundResponse`. Тела нет.
- `apps/web/src/app/api/v1/me/gifts/[id]/undo-close/route.ts` — `POST`, остальные методы `notFoundResponse`. Тела нет.
- `apps/web/src/actions/gifts.ts` — `deleteGift`: к существующему предикату добавляется `CLOSED` (архив по-прежнему исключён); `RESERVED` остаётся `CONFLICT` (5.4). Здесь же селекты карточки владельца — добавить `closedAt`.
- `apps/web/src/domain/owner-gift-card.ts` — `OwnerGiftRow.closedAt` (обязательное поле) и `undoUntil` в карточке владельца.
- `apps/web/src/domain/viewer-gift-card.ts` — ключ `undoUntil` не выставлять. Остальное как есть.
- `apps/web/src/actions/wishlist-read.ts` — `giftSelect.closedAt`: один список для владельца и зрителя.
- `apps/web/src/actions/my-gifts.ts`, `apps/web/src/actions/restore-gift.ts`, `apps/web/src/actions/gifts.ts` — селекты, которые кормят `toOwnerGiftCard`, получают `closedAt`.
- `apps/web/src/actions/gift-reserve.ts` — сосед по конверту и сессии; не менять.
- `packages/contracts/src/index.ts` — `giftCardSchema.undoUntil` (`z.string().nullable().optional()`), `ERROR_REASONS` += `UNDO_WINDOW_EXPIRED`. `listDataSchema` не меняется.
- `packages/contracts/src/i18n/ru/app.json` — `app.gift.close.*`, `app.gift.closed.*` (включая `menuLabel`), `app.gift.toast.closed`, `app.gift.toast.undo`.
- `packages/contracts/src/i18n/ru/common.json` — `errors.reason.UNDO_WINDOW_EXPIRED`.
- `apps/mobile/src/api/my-gifts.ts` — `closeGift(id)` и `undoGiftClose(id)`, оба возвращают `GiftResult` и проверяют тело `giftCardSchema`.
- `packages/ui/src/toast.tsx` — необязательный `actionRef` (`FocusTarget`), чтобы экран переводил фокус на «Отменить» после закрытия.
- `apps/mobile/src/ui/toast.tsx` — необязательный `durationMs` (по умолчанию `toastDurationMs`) для 10-секундного undo-тоста.
- `apps/mobile/src/ui/closed-section.tsx` — свёрнутая секция с заголовком-кнопкой (`aria-expanded`) и сеткой карточек; заголовок и содержимое приходят пропсами.
- `apps/mobile/src/ui/closed-gift-menu.tsx` — ⋯ закрытого желания: «Вернуть в открытые», «Хочу ещё такой», «Удалить».
- `apps/mobile/src/ui/close-gift-confirm.tsx` — confirm закрытия поверх `ConfirmDialog`: заголовок, тело при брони, «Подтвердить» / «Отмена»; кнопка обычная `primary`, не `destructive` (`DESIGN.md` → Colors: destructive не для `закрыт`).
- `apps/mobile/src/ui/confirm-dialog.tsx` — `confirmTone?: "primary" | "destructive"` (по умолчанию `destructive`, поведение остальных вызовов не меняется).
- `apps/mobile/src/ui/use-undo-window.ts` — остаток окна от серверного `undoUntil` (обновление раз в 30 с, 0 — кнопки нет), без собственных 10 минут.
- `apps/mobile/src/ui/wish-detail-dialog.tsx` — у владельца закрытого желания нет «Изменить желание», есть отмена в окне; новые пропсы `onUndoClose`, `undoUntil`.
- `apps/mobile/app/(app)/index.tsx` — разбиение `gifts` на активные и закрытые, секция, закрытие из карточки и детали, undo-тост, ⋯, удаление закрытого, копия; `canShare` и пустое состояние считаются по активным и закрытым вместе.
- `apps/mobile/app/wishlist/[token].tsx` — секция «Уже подарено» у зрителя, без действий.
- `apps/mobile/app/u/[nick].tsx` — та же секция; подпись и действия по роли карточки (свой профиль — владелец).
- `apps/mobile/src/ui/public-gift-card.tsx` — сосед зрительской карточки; правок не требует, сверить closed-вид.
- `apps/mobile/src/ui/gift-card.tsx` — `menu` и `closed` уже есть; правок не ждёт.
- `.storybook/` и `apps/mobile/src/ui/*.stories.tsx` — истории новых компонентов и новые состояния существующих.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts` — `giftCardSchema.undoUntil`, `ERROR_REASONS` += `UNDO_WINDOW_EXPIRED`; тест схемы: ключ есть/нет, `null`, reason проходит `errorReasonSchema`. Файлы: `packages/contracts/src/index.ts`, `packages/contracts/src/index.test.ts`.
- [ ] `apps/web/src/domain/gift-status.ts` — `UNDO_WINDOW_MS`, `canCloseGift`, `canUndoClose`, `closeGiftData`, `undoUntil`; методы `closeGift` / `undoClose` в интерфейсе; тип шва `recordGiftEvent` — общий с 5.2 (если 5.2 ещё не смержена, тип заводится здесь, а 5.2 его переиспользует; второй копии быть не должно). Тесты матрицы статусов, границы окна (`closedAt = now - 10 мин` — уже нельзя; `now - 10 мин + 1 мс` — можно), состав записи закрытия (никаких `reserved*`), `RESERVATION_RELEASE_DATA` не изменился. Файлы: `apps/web/src/domain/gift-status.ts`, `apps/web/src/domain/gift-status.test.ts`.
- [ ] `apps/web/src/lib/gift-status-store.ts` — два CAS и шов `recordGiftEvent` (вариант A, до решения). Тесты: предикат и `data` закрытия (`status`, `closedAt`, `closedFromStatus`, `archivedAt: null`, `list.ownerId`), отмена восстанавливает `closedFromStatus` и очищает колонки закрытия, `count = 0` → потеря, `closedFromStatus = null` → отказ, шов вызван ровно один раз на успех (закрытие и отмена) и не вызван на проигранный CAS, формат и поля JSON-строки (`giftId`, `actorId`, `from`, `to`, `at`). Файлы: `apps/web/src/lib/gift-status-store.ts`, `apps/web/src/lib/gift-status-store.test.ts`.
- [ ] `apps/web/src/actions/gift-close.ts` + маршруты — сессия, `NOT_FOUND` на чужое, `GIFT_ARCHIVED`, `CONFLICT` на уже закрытое и на позднюю отмену (`UNDO_WINDOW_EXPIRED`), успех отдаёт карточку владельца с `undoUntil`. Тесты действий и маршрутов: `UNAUTHENTICATED`, `FORBIDDEN` нет (чужое — `NOT_FOUND`), `GET/PUT/PATCH/DELETE` → 404. Файлы: `apps/web/src/actions/gift-close.ts`, `apps/web/src/actions/gift-close.test.ts`, `apps/web/src/app/api/v1/me/gifts/[id]/close/route.ts`, `apps/web/src/app/api/v1/me/gifts/[id]/close/route.test.ts`, `apps/web/src/app/api/v1/me/gifts/[id]/undo-close/route.ts`, `apps/web/src/app/api/v1/me/gifts/[id]/undo-close/route.test.ts`.
- [ ] `deleteGift` — закрытое удаляется, архивное и чужое `NOT_FOUND`, `RESERVED` `CONFLICT`; тесты на все четыре ветки. Файлы: `apps/web/src/actions/gifts.ts`, `apps/web/src/actions/gifts.test.ts`.
- [ ] Карточки и чтение — `OwnerGiftRow.closedAt`, `undoUntil` только у владельца, все селекты владельца обновлены; тесты: `undoUntil` = `closedAt + 10 мин` внутри окна и после него, `null` у `OPEN`/`RESERVED`, отсутствие ключа у зрителя, `reservedBy` закрытого по переключателям. Файлы: `apps/web/src/domain/owner-gift-card.ts`, `apps/web/src/domain/viewer-gift-card.ts`, `apps/web/src/domain/viewer-gift-card.test.ts`, `apps/web/src/actions/wishlist-read.ts`, `apps/web/src/actions/wishlist-read.test.ts`, `apps/web/src/actions/my-gifts.ts`, `apps/web/src/actions/restore-gift.ts`, `apps/web/src/actions/gifts.ts`.
- [ ] `apps/mobile` API-клиент — `closeGift`, `undoGiftClose`, проверка тела; тесты успеха, `network`, `invalid` и `UNDO_WINDOW_EXPIRED`. Файлы: `apps/mobile/src/api/my-gifts.ts`, `apps/mobile/src/api/my-gifts.close.test.ts`.
- [ ] `apps/mobile` UI закрытия — confirm (без `destructive`), ⋯ закрытого, секция, хук остатка окна; тесты компонентов, включая `displayName` и 360 px в историях. Файлы: `apps/mobile/src/ui/close-gift-confirm.tsx`, `apps/mobile/src/ui/close-gift-confirm.test.tsx`, `apps/mobile/src/ui/close-gift-confirm.stories.tsx`, `apps/mobile/src/ui/closed-gift-menu.tsx`, `apps/mobile/src/ui/closed-gift-menu.test.tsx`, `apps/mobile/src/ui/closed-gift-menu.stories.tsx`, `apps/mobile/src/ui/closed-section.tsx`, `apps/mobile/src/ui/closed-section.test.tsx`, `apps/mobile/src/ui/closed-section.stories.tsx`, `apps/mobile/src/ui/use-undo-window.ts`, `apps/mobile/src/ui/use-undo-window.test.ts`, `apps/mobile/src/ui/confirm-dialog.tsx`, `apps/mobile/src/ui/confirm-dialog.test.tsx`, `apps/mobile/src/ui/confirm-dialog.stories.tsx`.
- [ ] Тосты — `durationMs` в хосте и `actionRef` в `@gift-list/ui`; тесты 10 с, паузы, диктора и фокуса; истории undo-тоста. Файлы: `apps/mobile/src/ui/toast.tsx`, `apps/mobile/src/ui/toast.test.tsx`, `apps/mobile/src/ui/toast.stories.tsx`, `packages/ui/src/toast.tsx`, `packages/ui/src/toast.test.tsx`, `packages/ui/src/toast.stories.tsx`.
- [ ] Экраны — закрытие из карточки и из диалога подробностей, секции и ⋯ у владельца, «Уже подарено» у зрителей, undo-тост, копия, удаление; `canShare` и пустое состояние не ломаются. Тесты экранов: `apps/mobile/src/session/my-wishlist-screen.test.tsx`, `apps/mobile/src/session/public-wishlist-screen.test.tsx`, `apps/mobile/src/session/profile-screen.test.tsx`, `apps/mobile/src/ui/wish-detail-dialog.test.tsx`, `apps/mobile/src/ui/wish-detail-dialog.stories.tsx`, `apps/mobile/src/ui/gift-card.stories.tsx`; файлы экранов — `apps/mobile/app/(app)/index.tsx`, `apps/mobile/app/wishlist/[token].tsx`, `apps/mobile/app/u/[nick].tsx`, `apps/mobile/src/ui/wish-detail-dialog.tsx`.
- [ ] i18n — тексты дословно: `app.gift.close.menuAction` «Отметить полученным», `app.gift.close.title` «Подарок «{title}» получен?», `app.gift.close.reservedBody` «Бронь будет закрыта, бронировавший получит уведомление», `app.gift.close.confirm` «Подтвердить», `app.gift.close.cancel` «Отмена», `app.gift.closed.undo` «Вернуть в открытые», `app.gift.closed.undoWithTime` «Вернуть в открытые · ещё {minutes} мин», `app.gift.closed.copy` «Хочу ещё такой», `app.gift.closed.delete` «Удалить», `app.gift.closed.sectionOwner` «Получено ({count})», `app.gift.closed.sectionViewer` «Уже подарено», `app.gift.closed.menuLabel` «Меню», `app.gift.toast.closed` «Отмечено полученным», `app.gift.toast.undo` «Отменить», `common.errors.reason.UNDO_WINDOW_EXPIRED` «Время на отмену вышло». Файлы: `packages/contracts/src/i18n/ru/app.json`, `packages/contracts/src/i18n/ru/common.json`.
- [ ] `deferred-work.md` — пункты: (1) Notification и письмо держателю после окна; в варианте A `deliverAfter = closedAt + UNDO_WINDOW` Epic 6 вычисляет сам, в B — это колонка `Notification`, а отмена удаляет недоставленную запись; варианты текста для `GIVEN` — Epic 6; (2) аудит NFR-6 остальных переходов статуса (бронь, снятие, архив) — одной задачей после 5.3; (3) секция закрытых на серверной странице `/l`, если открытый вопрос 1 решится положительно. Файл: `_bmad-output/implementation-artifacts/deferred-work.md`.
- [ ] Миграции не добавлять; `sprint-status.yaml` в этой работе не менять — ключ `5-3-закрытие-желания-владельцем-отмена-и-хочу-ещё-такой` владелец процесса обновит отдельно.

**Acceptance Criteria:**
- Given владелец и желание `OPEN` или `RESERVED` в любой фазе, when он подтверждает «Отметить полученным», then ровно одна CAS-запись `CLOSED` с `closedAt` и `closedFromStatus`, `reserved*` сохранены, карточка владельца несёт `undoUntil`, и показан тост «Отмечено полученным · Отменить».
- Given окно 10 минут открыто, when владелец жмёт «Отменить» в тосте или «Вернуть в открытые · ещё N мин» на карточке, then статус возвращается в `closedFromStatus`, `closedAt` и `closedFromStatus` очищаются, бронь, фаза, «Купил» и срок на месте, уведомлений нет.
- Given окно прошло, when приходит отмена, then `CONFLICT` с `UNDO_WINDOW_EXPIRED`, тост «Время на отмену вышло», карточка остаётся закрытой.
- Given закрытое желание, when владелец открывает ⋯, then «Вернуть в открытые» только в окне, «Хочу ещё такой» создаёт `OPEN`-копию без `expiresOn`, «Удалить» спрашивает confirm и удаляет.
- Given закрытые желания в списке, when его читает владелец или зритель, then они лежат в свёрнутой секции «Получено (N)» / «Уже подарено» без действий у зрителя, а имя держателя владельцу видно только по переключателю.
- Given чужое, архивное или уже закрытое желание, when приходит закрытие или отмена, then `NOT_FOUND` / `GIFT_ARCHIVED` / `CONFLICT` как в матрице, и строка не меняется.

## Implementation Notes

—

## Spec Change Log

- 2026-11-19 (уточнено по CLE-114/CLE-115): событие держателю пишется одной функцией-шов `recordGiftEvent` в `GiftStatusService`, по умолчанию — вариант A (строки `Notification` нет, `deliverAfter` Epic 6 вычисляет из `closedAt`; открытый вопрос A/B ниже). Отмена в варианте A ничего не удаляет, в варианте B удаляет недоставленную запись. Audit NFR-6 — та же функция, формат JSON `{ event: "gift.status", … }`, один на 5.2 и 5.3.

## Review Triage Log

—

## Design Notes

`undoUntil` едет в карточке владельца, а не отдельным полем ответа: карточку отдаёт и список, и одиночное чтение, и мутация, поэтому после перезагрузки списка кнопка «Вернуть в открытые · ещё N мин» не пропадает. Срок считает сервер (`ARCH-A5`: «клиент берёт срок из ответа (`undoUntil`), а не из своего таймера»), клиент лишь отсчитывает остаток от ISO-момента; расхождение часов устройства не открывает обход правила, потому что запись всё равно отвечает `CONFLICT` после окна. Момент отдаётся и после окна — иначе закрытую карточку нечем упорядочить: `closedAt` на проводе нет, а `createdAt` желания о времени закрытия ничего не говорит.

Разбиение закрытых карточек делает клиент, а не сервер: списки в R1 не пагинируются, желаний немного, а новый ключ в `listDataSchema` пришлось бы поддерживать в трёх чтениях (`/me`, `/u/:nick`, `/l/:token`) и в SPA. Архив остаётся серверным ключом (`archived`), потому что он capped и считается отдельным запросом; закрытые же всегда лежат в `gifts`, и `archivedAt` уже отсечён условием чтения, так что «архив главнее» получается само.

Порядок секций — сетка, «Получено (N)», «Архив (N)»: так записано в `DESIGN.md` → Archive section («У владельца, после «Получено (N)»»). Порядок внутри секции — по `undoUntil` по убыванию, то есть по времени закрытия: недавно закрытое выше, а карточки с живым окном — первыми.

Подтверждение закрытия не красное: `DESIGN.md` → Colors прямо исключает `закрыт` из `destructive`, поэтому `ConfirmDialog` получает `confirmTone`, а не новый вариант слоя. Тост и окно — разные вещи: 10 секунд тоста задаёт `DESIGN.md` (undo toast), 10 минут окна — серверная константа `D-43`; клиент не выводит одно из другого.

`FR-32` упоминает выбор списка для «Хочу ещё такой»; в R1 список один (`AD-6`, `List.ownerId` UNIQUE), поэтому диалога нет — как в `EXPERIENCE.md` («Без диалога: копия `открыт` в том же вишлисте»).

Аудит NFR-6 — строка лога из сервиса, а не таблица: в `ARCHITECTURE-SPINE` → Consistency Conventions это Logging, а структура `Notification` относится к Epic 6. Пишутся только идентификаторы и переход, без названий и имён, чтобы строка не стала каналом утечки. Пишет её та же функция-шов `recordGiftEvent`, что и в 5.2, поэтому обе истории не могут разойтись форматом, а переход к варианту B (строка `Notification`) меняет только тело шва.

## Открытые вопросы

1. **Секция закрытых на серверной странице `/l` (аноним).** Story 5.3 говорит «Клиент: приложение», но `apps/web/src/app/l/[token]/public-wishlist-view.tsx` сам рисует карточки и сейчас показывает закрытые в общей сетке (`closed={gift.status === "CLOSED"}`). Нужно решение: оставить страницу как есть в 5.3 или перенести туда же секцию «Уже подарено» отдельной правкой. До решения страница не меняется (см. Never).
2. **Объём аудита NFR-6.** `NFR-6` и `ARCHITECTURE-SPINE` читаются как аудит любой смены `Gift.status`, а 5.3 даёт строку только для закрытия и отмены. Если нужен аудит брони, снятия и архива в этом же объёме, это расширяет 5.3 на `reserveGift` / `releaseReservation` / `archivedAt`; иначе остальные переходы уходят в отдельную задачу (см. `deferred-work`).
3. **Запись события: вариант A или B** (уточнено по CLE-114/CLE-115, 2026-11-19). Таблицы `Notification` в `schema.prisma` нет; epics («Сущности по мере нужды», около строки 1331) относит её к Epic 6, а Story 6.1 (около строки 1018) создаёт `Notification` и соблюдает `deliverAfter`. AC 5.3 и 5.2 обещают событие другой стороне, поэтому:
   - **A (по умолчанию, до решения).** Как в 5.1: строки нет; факт перехода лежит в колонках `Gift` (`closedAt`, `closedFromStatus`, сохранённый снимок брони `reservedById` + `titleSnapshotOnReserve`), отмена очищает `closedAt`, поэтому `deliverAfter = closedAt + UNDO_WINDOW` перестаёт вычисляться сам. Плюсы: без миграции и без пересечения со Story 6.1, которая идёт параллельно и владеет таблицей и `deliverAfter`. Минус: Epic 6 собирает событие сам из строки `Gift` и не имеет готовой записи с `kind`.
   - **B.** Завести модель `Notification` по AD-14 (kind из закрытого набора, `deliverAfter`, payload) и миграцию сейчас; шов пишет `GIFT_CLOSED` с `deliverAfter = closedAt + UNDO_WINDOW`, отмена удаляет недоставленную запись. Плюсы: «закрытие не видно до конца окна» уже обеспечено строкой, 6.1 остаётся доставка. Минусы: миграция и таблица внутри 5.3, пересечение со Story 6.1 по `schema.prisma` и риск двойной записи одного события.
   - Решение — за Сергеем/Евгением. Переход A→B меняет только тело `recordGiftEvent`; CAS, use-case, карточка, маршруты и клиент не меняются. В тексте спеки принят **A**, помеченный «до решения».

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без ошибок, включая `scripts/check-boundaries.mjs`
- `npm test` -- expected: юнит и маршрутные тесты зелёные, включая CAS закрытия и отмены, границу окна, `undoUntil` в карточке и матрицу `CONFLICT` / `NOT_FOUND` / `GIFT_ARCHIVED`
- `npm run build` -- expected: сборка проходит; замер веса веб-сборки тем же шагом, что CI
- `npm run build-storybook` -- expected: каталог собирается, новые истории видны в `UI/…` и `App/…`

**Manual checks (if no CLI):**
- В браузере и на телефоне: вишлист → «Отметить полученным» на открытом желании → карточка ушла в «Получено (1)», тост с «Отменить» держится 10 с и не скрывается при наведении и фокусе; «Отменить» возвращает карточку в сетку.
- Закрытие забронированного желания: confirm с телом про бронь, у зрителя карточка в «Уже подарено», имя держателя у владельца — только по переключателю.
- Через 10 минут «Вернуть в открытые» на карточке исчезает, а поздняя попытка из уже открытого экрана даёт тост «Время на отмену вышло».
- «Хочу ещё такой» добавляет копию сверху без «Убрать в архив после»; «Удалить» спрашивает confirm; на 360 px секция, ⋯ и тост не переполняются.
