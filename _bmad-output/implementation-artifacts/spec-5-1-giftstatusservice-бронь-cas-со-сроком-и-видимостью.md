---
title: '5.1: GiftStatusService — бронь (CAS) со сроком и видимостью'
type: 'feature'
created: '2026-11-18'
status: 'done'
route: 'dispatch'
baseline_commit: 'abc864ccc1c6c9cd3f6246e2684faaad455b2f0e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Даритель не может забронировать единичное открытое желание: `GiftStatusService` умеет только снимать бронь при сужении видимости, кнопки «Куплю сам» в приложении нет, а гонка двух броней ничем не закрыта.

**Approach:** Один переход `OPEN → RESERVED` только через `GiftStatusService` (CAS), с датой «Подарю до» и двумя переключателями видимости имени. Клиент приложения показывает confirm и обновляет карточку; доставка уведомления владельцу остаётся Epic 6, факты события лежат в колонках брони.

## Boundaries & Constraints

**Always:**
- Писатель `status` и колонок `reserved*` — только `gift-status-store.ts`. Домен без Prisma.
- Бронь только у вошедшего не-владельца, которому желание видно (`VisibilityPolicy`, `access=gifts`), статус `OPEN`, `quantity=SINGLE`, `archivedAt` пуст.
- CAS: `updateMany` `where: { id, status: OPEN, quantity: SINGLE, archivedAt: null }`. `count ≠ 1` — неуспех. `UNLIMITED` отклоняется `VALIDATION` до записи.
- Владелец своего желания — `FORBIDDEN` (не `NOT_FOUND`). Чужое невидимое, архив для не-владельца, неизвестный id — тот же `NOT_FOUND`, что у чтения.
- Пояс дарителя: `User.timeZone`, если пуст — `UTC` (ARCH-A14). `reservationDueAt` — первый миг следующих календарных суток в этом поясе (выбранный день целиком входит в срок). Диапазон даты: сегодня…сегодня+30 включительно в том же поясе. Пояс пишется в `reservationTimeZone` и больше не читается из профиля.
- Вместе с бронью: `reservedById`, `reservedAt=now`, `titleSnapshotOnReserve=title`, `reservationPhase=ACTIVE`, `reservationPhaseAt=now`, `reservationBought=false`, переключатели из тела. Таблиц Reservation и Payment нет. Новой миграции нет: колонки уже в `schema.prisma`.
- Успех — `200` и viewer-`GiftCard`. Держателю (и только ему, пока `status=RESERVED`) добавляется `reservation`; владельцу и остальным ключ отсутствует. Правила `reservedBy` / `reservationLabel` / `ownerAction` не менять.
- Конфликт «уже забронировано» (статус стал `RESERVED` или CAS проиграл) — `CONFLICT` + `reason: RESERVATION_TAKEN`. `CLOSED` — `CONFLICT` без этого reason. Дата вне диапазона — `VALIDATION` + `DUE_OUT_OF_RANGE`.
- Тексты интерфейса только из каталога, дословно из EXPERIENCE/DESIGN. `errors.reason.DUE_OUT_OF_RANGE` — «Выберите дату не позже {max}.», `{max}` в виде `DD.MM.YYYY`. `RESERVATION_TAKEN` — «Кто-то только что забрал этот подарок.» Сеть на подтверждении брони — общая фраза формы «Нет соединения. Попробуйте ещё раз.» (DECISION 2026-11-18).
- Маршрут: `POST /api/v1/gifts/:id/reserve`. Тело: `{ dueOn: "YYYY-MM-DD", holderVisibleToOwner: boolean, holderVisibleToOthers: boolean }`. Прочие методы — `notFoundResponse`.

**Never:**
- Снятие брони, закрытие, «Купил», «Подарил», продление, cron, «Мои брони», reservation card после unfriend (5.2–5.8).
- Строка `Notification`, письмо, outbox. Доставка «Кто-то забронировал «Y»» — Epic 6; 5.1 только пишет снимок названия и переключатели.
- Менять навигацию карточки владельца (она ведёт в правку). Не менять `releaseReservation` и `visibilityChangeDropsReservation`.
- Не применять миграции к живой БД. Не коммитить секреты.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| RESERVE | вошедший не-владелец, OPEN SINGLE, дата в диапазоне, желание видно | одна строка RESERVED, поля AD-9, фаза ACTIVE; ответ — карточка держателя с `reservation` | — |
| DEFAULTS | confirm без правок | дата сегодня+7; «владельцу» выкл.; «другим» вкл.; подсказка про «Купил» | — |
| DATE | дата &lt; сегодня или &gt; сегодня+30 в поясе | запись не делается | `VALIDATION` `DUE_OUT_OF_RANGE` |
| UNLIMITED | OPEN UNLIMITED | до CAS | `VALIDATION` без нового reason; кнопки нет, строка «Можно дарить без брони» |
| SELF | владелец | — | `FORBIDDEN` |
| HIDDEN | нет доступа, архив не-владельцу, нет id | — | `NOT_FOUND`, одно тело |
| RACE | две параллельные брони одного id | ровно одна success | вторая `CONFLICT` `RESERVATION_TAKEN` |
| CLOSED | видимый CLOSED | — | `CONFLICT` без `RESERVATION_TAKEN` |
| ANON | нет сессии | — | `UNAUTHENTICATED` |
| CARD_OWNER | владелец читает, «владельцу» выкл. | `status=RESERVED`, `reservedBy=null`, нет `reservation` | — |
| CARD_OTHER | другой зритель, «другим» выкл. | `reservedBy=null` | — |
| CARD_HOLDER | держатель | `reservedBy` — он сам, есть `reservation` | — |
| OPTIMISTIC | confirm → сеть или CONFLICT | карточка откатилась | toast сети или «Кто-то только что забрал этот подарок.»; при занятости во время входа confirm не открывается |
| NO_BUTTON | UNLIMITED, RESERVED, CLOSED | кнопки «Куплю сам» нет | строки «Можно дарить без брони» / «Уже забронирован» / «Уже подарено» |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/gift-status.ts` — расширить `GiftStatusTransaction` методом брони; правила даты и предикат без Prisma. Не трогать `RESERVATION_RELEASE_DATA`.
- `apps/web/src/lib/gift-status-store.ts` — единственный `updateMany` CAS `OPEN → RESERVED`.
- `apps/web/src/domain/visibility.ts` — `VisibilityPolicy` как есть: перед бронью тот же доступ, что у чтения.
- `apps/web/src/domain/viewer-gift-card.ts` — `toViewerGiftCard`: держателю добавить `reservation`. Комментарий уже обещает это в Epic 5.
- `apps/web/src/domain/owner-gift-card.ts` — не отдавать `reservation` и не показывать имя без `holderVisibleToOwner`.
- `apps/web/src/actions/gifts.ts` — образец сессии, конверта и `NOT_FOUND`. Новое действие брони рядом, не внутри `updateGift`.
- `apps/web/src/lib/api-v1.ts` — `toResponse`: CONFLICT 409, FORBIDDEN 403, VALIDATION 400.
- `apps/web/src/lib/time-zone.ts` — `canonicalTimeZone` для пустого пояса.
- `packages/contracts/src/index.ts` — `giftCardSchema.reservation` optional; `ERROR_REASONS` += `RESERVATION_TAKEN`.
- `packages/contracts/src/i18n/ru/common.json` — тексты `DUE_OUT_OF_RANGE` и `RESERVATION_TAKEN`.
- `packages/contracts/src/i18n/ru/app.json` — confirm, подписи даты, строки вместо кнопки, фраза входа. `app.gift.giftNotFound` уже есть.
- `apps/mobile/src/api/my-gifts.ts` — образец клиента; новая функция reserve.
- `apps/mobile/app/wishlist/[token].tsx` — гость смотрит список без сессии; `?reserve=` открывает confirm только вошедшему и только если карточка ещё SINGLE+OPEN.
- `apps/mobile/app/(auth)/login.tsx` и `register.tsx` — если `next` несёт бронь, фраза «Чтобы забронировать «{название}», войдите или зарегистрируйтесь.» `safeNextPath` уже сохраняет query.
- `apps/web/src/app/l/[token]/public-wishlist-view.tsx` — ссылка «Куплю сам» ведёт на `/wishlist/{token}?reserve={id}` (название — отдельным query для фразы входа, на запись не влияет).
- `apps/mobile/src/ui/public-gift-card.tsx` — основная зона карточки зрителя ведёт на `/gifts/{id}`. Карточку владельца не переназначать.
- `apps/mobile/app/(app)/gifts/[id]/edit.tsx` — сосед; деталь — `index.tsx` того же сегмента.
- `packages/ui/src/button.tsx` — `variant="reserve"` уже есть. `bottom-sheet.tsx` / `dialog.tsx` / `switch.tsx` — confirm: шторка на compact, диалог на medium+.
- `apps/web/src/db/disposable-pg/` — образец гонки на одноразовом PostgreSQL (`friendship.pgtest.ts`). В обычный `npm test` не входит.
- `apps/web/src/db/schema.prisma` — колонки брони уже есть (`20261103074333_gift_reservations`). Не менять схему.

## Tasks & Acceptance

**Execution:**
- [x] `packages/contracts` — тело брони, optional `reservation` у карточки, reason `RESERVATION_TAKEN`, каталог ru.
- [x] `apps/web/src/domain/gift-status.ts` + store — reserve CAS и расчёт `dueAt`; юнит-тесты диапазона, UNLIMITED до записи, count 0/1.
- [x] `apps/web/src/actions` + `app/api/v1/gifts/[id]/reserve/route.ts` — сессия, видимость, self-FORBIDDEN, конверт; тест маршрута.
- [x] `viewer-gift-card.ts` — блок `reservation` только держателю; тесты матрицы CARD_*.
- [x] `apps/web/src/db/disposable-pg/` — две параллельные брони одного желания, ровно один успех. Прогон локально, не в CI.
- [x] `apps/mobile` — клиент, деталь `/gifts/[id]`, confirm, optimistic и тосты, ссылка с карточки зрителя, `?reserve=` и фраза входа, правка href на `/l`.
- [x] Stories нового UI (`App/…` и `UI/…`, если появится компонент пакета): normal, disabled, busy, error, пустое, длинная кириллица, кадр 360. `displayName` у компонентов.
- [x] Не добавлять миграцию. `sprint-status.yaml`: ключ `5-1-giftstatusservice-бронь-cas-со-сроком-и-видимостью`.

**Acceptance Criteria:**
- Given даритель не владелец и желание OPEN SINGLE видно ему, when он подтверждает «Куплю сам» с датой и переключателями, then ровно одна CAS-запись RESERVED с полями AD-9 и карточка держателя содержит `reservation`.
- Given две такие попытки одновременно, when обе доходят до записи, then успешна одна, вторая `CONFLICT` с тостом «Кто-то только что забрал этот подарок.»
- Given UNLIMITED, владелец, невидимое желание или дата вне пояса, when приходит запрос, then VALIDATION / FORBIDDEN / NOT_FOUND / DUE_OUT_OF_RANGE как в матрице, и строка желания не меняется.
- Given бронь с выключенным «показать владельцу», when владелец читает список, then статус RESERVED и `reservedBy=null`.

## Implementation Notes

- Доступ по ссылке: `GET/POST /api/v1/gifts/:id` принимают query `listToken`. Совпадение с `List.publicToken` ставит `viaListToken`, иначе чужое PUBLIC для не-друга — `NOT_FOUND`. Тело запроса не расширялось.
- `reservation.dueAt` на проводе — календарный день выбранной даты, не сам timestamptz. В базе по-прежнему исключительная граница следующих суток.
- Toast брони при обрыве сети — `app.form.network`, «Нет соединения. Попробуйте ещё раз.» (DECISION 2026-11-18). Отдельный ключ `app.gift.network` убран.
- Подсказка «имя могло стать известно» в confirm не ставится: в EXPERIENCE она у действий держателя, не у первого confirm.
- Успешная бронь не показывает отдельный toast: карточка просто становится RESERVED.
- Гонка прогнана на локальном PostgreSQL 16, порт 54321, база `gift_f5_reserve01`: один success и один lost. В CI тест не входит (`verify:reserve-concurrency`).
- Потолок gzip SPA: 191 488 при замере 186 706 (запас 4 782 байта). `datetimepicker` в веб-бандл не попал.

## Spec Change Log

- 2026-11-18, решение владельца: toast брони при обрыве сети — «Нет соединения. Попробуйте ещё раз.», не «Нет сети…». Граница даты — «Выберите дату не позже {DD.MM.YYYY}», год обязателен. Потолок gzip поднят с запасом, без отдельного PR.

## Review Triage Log

- `medium` — confirm всегда был `Dialog`, потому что `useMedia().maxMd` в теме нет. Исправлено: `!useMedia().medium`.
- `medium` — toast сети. Сначала вынесен в «Нет сети», затем владелец продукта вернул общую фразу формы «Нет соединения. Попробуйте ещё раз.» (DECISION 2026-11-18).
- `medium` — повторное нажатие могло откатить свою же бронь. Исправлено `useRef` на время запроса.
- `medium` — нативный выбор даты через `toISOString()` сдвигал день. Исправлено локальными `getFullYear/getMonth/getDate`.
- `medium` — `2026-06-31` проходил диапазон. Исправлено: день должен совпасть сам с собой после сдвига.
- `medium` — держатель при повторе получал «кто-то забрал». Исправлено: повтор того же держателя возвращает карточку.
- `medium` — пропавшая строка после CAS была `CONFLICT`. Исправлено: `NOT_FOUND`.
- `low` — владелец по публичной карточке попадал на `FORBIDDEN`. Исправлено: переход в правку.
- `low` — фраза входа про бронь показывалась и при простом открытии. Исправлено: `title` в `next` только вместе с `openReserve`.
- `low` — у безлимитного пояснение было ссылкой. Исправлено: обычный текст; у RESERVED/CLOSED — свои подписи.
- `patch` — тесты не проверяли полный payload CAS, `params.max`, `getViewerGift`, query `listToken` и московский `dueAt`. Добавлены.
- `false` — пустая story и совпадение Disabled с Busy не ломают приёмку: busy уже запрещает кнопки, пустого состояния у confirm нет.
- `defer` — описание и ссылка желания на детали показаны только если есть; полный экран детали со всеми действиями 5.2+ не в этой истории.

## Design Notes

`dueAt` хранится как исключительная граница следующих суток, чтобы весь выбранный календарный день входил в срок и почасовой cron (5.6) сравнивал `reservationDueAt <= now` без «дырки» в 23:59:59.999. Пояс фиксируется в строке, даже если профиль потом сменит `User.timeZone` (колонка профиля сегодня не перезаписывается, но снимок всё равно обязателен AD-9).

Confirm — один компонент: `BottomSheet` при ширине compact (&lt; 600) и `Dialog` иначе. Дата: браузер — `input type="date"` с min/max; телефон — системный выбор (`@react-native-community/datetimepicker` версии Expo SDK 58, ставить в `@gift-list/mobile`). Подпись кнопки даты «Подарю до, {дата}», hint «Выбрать дату», caption «Не позже {DD.MM.YYYY}». Ошибка диапазона — «Выберите дату не позже {DD.MM.YYYY}». Подтвердить — `variant="reserve"`, отмена — ghost.

На `/l` название в query нужно только фразе экрана входа. Бронь всегда читает название из строки `Gift`.

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без ошибок
- `npm test` -- expected: юнит и маршрутные тесты зелёные, включая CAS count и матрицу карточки
- одноразовый PostgreSQL и pg-тест гонки -- expected: из двух параллельных броней одна success
- `npm run build` -- expected: сборка проходит; замер веса веб-сборки тем же шагом, что CI

**Manual checks (if no CLI):**
- В браузере: вишлист друга → деталь → «Куплю сам» → confirm с +7 и переключателями по умолчанию → карточка RESERVED. UNLIMITED без кнопки. Повторная бронь — toast и откат.
