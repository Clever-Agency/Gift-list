---
title: '5.5: «Мои брони»: продление, «Купил», видимость, reservation card'
type: 'feature'
created: '2026-11-20'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '84a34e8d89960502bbe897c7a4734f84a82cbd6f'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Бронь можно поставить (Story 5.1) и снять (Story 5.2), но управлять ею из одного места нельзя. У держателя нет ни списка своих броней, ни продления, ни отметки «Купил», ни смены переключателей видимости. После удаления из друзей или блока желание пропадает из вишлиста, и бронь становится неуправляемой, хотя A-14/FR-25 обещают reservation card. Фазы `AWAITING_GIVER`, `AWAITING_OWNER` и `GIVEN` уже возможны в данных, но экран не умеет показать их подписями и отличить доступные действия от ещё не сделанных (5.6, 5.7).

**Approach:** Один список reservation card держателя — `GET /api/v1/me/reservations` — читается по `reservedById`, **без** проверки видимости желания: после unfriend/Block карточка остаётся, других желаний владельца в ответе нет (A-14, AD-7). Одно действие за запрос — `PATCH /api/v1/me/reservations/:giftId`: `extend { dueOn }`, `bought { value }` или `visibility { holderVisibleToOwner, holderVisibleToOthers }`. Снятие остаётся существующим `DELETE /api/v1/gifts/:id/reserve` (5.2). Все записи идут только через `GiftStatusService` (CAS, AD-8/AD-9); схема Prisma не меняется. В приложении появляется экран `/reservations` с временным видимым входом из «Моего вишлиста» (вкладка «Брони» — Story 6.2); те же действия добавляются в деталь желания держателя. Уведомления владельцу/держателю — Epic 6 (вариант A, как в 5.2/5.3): 5.5 только меняет колонки брони, поэтому запрос владельцу «Даритель уже ответил» становится неактуальным вычислением `ownerAction` из фазы.

## Boundaries & Constraints

**Always:**
- Писатель `status`, колонок `reserved*`, `reservationPhase`, `reservationPhaseAt`, `reservationBought` и переключателей — только `apps/web/src/lib/gift-status-store.ts` через методы `GiftStatusService`; домен без Prisma, адаптеры — тонкие вызовы (AD-1, AD-8).
- Список «Мои брони» — это строки `Gift` с `status = RESERVED` и `reservedById = actor`. Видимость желания, дружба, подписка и Block на состав списка **не** влияют (A-14, FR-25): после unfriend/Block карточка остаётся. Запрос не читает другие желания владельца и не возвращает `listToken`.
- Карточка держателя (AD-7, AD-12) — закрытый набор: `giftId`, `titleSnapshot`, `status: "RESERVED"`, `ownerNick`, `dueAt` (календарный день `YYYY-MM-DD`), `phase`, `bought`, `holderVisibleToOwner`, `holderVisibleToOthers`, `canOpenGift`. Без цены, тегов, описания, ссылки, имени владельца и остальных желаний. `titleSnapshot` — снимок на момент брони (`titleSnapshotOnReserve`), поэтому правка названия владельцем карточку не переписывает; при пустом снимке (аномалия) — текущий `title`.
- `dueAt` — выбранный календарный день в `reservationTimeZone` снимка. В базе по-прежнему исключительная граница следующих суток (AD-9, ARCH-A14), поэтому mapper переводит `reservationDueAt` обратно в день: `calendarDayInZone(dueAt, zone) − 1 день`. Часовой пояс в ответ не попадает.
- `phase` — одна из `ACTIVE | AWAITING_GIVER | AWAITING_OWNER | GIVEN`; подписи — из `EXPERIENCE.md` → State Patterns → «Подписи брони» (единый источник для карточки, детали и «Моих броней»).
- Продление: CAS `where { id, status: "RESERVED", reservedById: actor, reservationPhase: { in: ["ACTIVE", "AWAITING_GIVER", "AWAITING_OWNER"] } }`; запись — `reservationDueAt` (конец выбранного дня), `reservationTimeZone` (новый снимок `User.timeZone` через `canonicalTimeZone(storedTimeZone(...))`, как в 5.1), `reservationPhase = ACTIVE`, `reservationPhaseAt = now`. `bought` не меняется. Диапазон `dueOn` — сегодня…сегодня+30 включительно в `User.timeZone` пользователя (fallback `UTC`), проверка и `max` — как в 5.1 (`isDueOnInRange`, `maxReserveDueOn`, `reservationDueAtFromDueOn`). Вне диапазона — `VALIDATION` + `DUE_OUT_OF_RANGE` + `params.max` в локали запроса.
- Продление из `AWAITING_OWNER` делает запрос владельцу неактуальным **без миграции**: `ownerAction` не хранится, а вычисляется из `reservationPhase` (`AWAITING_OWNER → EXPIRED_NO_REPLY`, `GIVEN → CONFIRM_GIVEN`, иначе `null`). После записи `phase = ACTIVE` следующее чтение владельца отдаёт `ownerAction = null`. Уведомление «Даритель уже ответил» — Epic 6 (см. «Отложено»), 5.5 его не отправляет.
- `bought`: CAS `where { id, status: "RESERVED", reservedById: actor }`; запись — только `reservationBought: value`. `reservationPhase`, `reservationPhaseAt`, `reservationDueAt`, `reservationTimeZone` и переключатели не меняются. В `AWAITING_OWNER` снятие «Купил» **не** сбрасывает `phaseAt`: запрос владельцу остаётся, а cron 5.6 снова сможет снять бронь по сроку.
- `visibility`: CAS `where { id, status: "RESERVED", reservedById: actor }`; запись — только два переключателя, оба приходят в теле. Фаза, `phaseAt`, `dueAt` и `bought` не меняются. Включение «видим владельцу» показывает подсказку «Владелец сразу увидит ваше имя; если потом выключить, он может уже знать» (EXPERIENCE, FR-31).
- `GIVEN` — терминальная фаза до Story 5.7: «Продлить до…» в ней не предлагается и сервер отвечает `CONFLICT` (продление вернуло бы `ACTIVE` и возобновило бы таймеры). «Купил», переключатели и «Снять бронь» в `GIVEN` остаются доступны: AD-9 не ограничивает их фазой. «Подарил» и переход в `GIVEN` — только Story 5.7.
- Ответ `PATCH` — обновлённая reservation card (200), а не `{ id }`: карточка нужна и списку, и детали, а после продления меняются сразу `dueAt`, фаза и `phaseAt`. Клиент заменяет карточку ответом; `CONFLICT`/`NOT_FOUND` — перечитывает список.
- Не держатель, неизвестный или чужой `giftId`, строка без `reservedById = actor` — один `NOT_FOUND` с одним телом (AD-7, AD-12): маршрут существует только для держателя, `FORBIDDEN` подсказал бы, что бронь была и кто её держит. Своя бронь, но `status ≠ RESERVED` (владелец закрыл желание, `reserved*` сохранены) — `CONFLICT` без `reason`; клиент перечитывает список.
- Гонка: `count ≠ 1` — переход проигран. Повторное чтение в своём наборе: строки с `reservedById = actor` больше нет — `NOT_FOUND`; строка есть, но не `RESERVED` или продление в `GIVEN` — `CONFLICT`. Ровно один успешный переход из двух (AD-15-7, SM-2).
- `canOpenGift` считает **только сервер** тем же `VisibilityPolicy.canSee` и теми же отношениями, что обычное чтение, **без** токена ссылки: `true`, если держатель ещё прошёл бы AD-7 в деталь; `false` после unfriend/Block, для доступа только по `/l/:token` и после сужения видимости. Значение не раскрывает видимость, отношения или причину. При `false` карточка не ссылается на деталь (DESIGN → ReservationCard).
- Маршруты: `GET /api/v1/me/reservations` (список), `PATCH /api/v1/me/reservations/:giftId` (одно действие), снятие — существующий `DELETE /api/v1/gifts/:id/reserve` (Story 5.2, не меняется). Прочие методы обоих новых маршрутов — `notFoundResponse`. Тело читается `parseJson` (лимит 32 КиБ уже есть).
- Тело `PATCH` — закрытый discriminated union по `action`: `{ action: "extend", dueOn }` | `{ action: "bought", value: boolean }` | `{ action: "visibility", holderVisibleToOwner: boolean, holderVisibleToOthers: boolean }`. Лишние ключи и два действия в одном запросе — `VALIDATION`; `firstIssueField` даёт поле.
- Экран `/reservations` — в группе `(app)`, с той же защитой сессии, что «Настройки»: аноним уходит на `/login?next=/reservations`. Вкладки «Брони» нет (Story 6.2); временный видимый вход — строка «Мои брони» в нижнем ряду «Моего вишлиста» рядом с «Поиск», «Друзья», «Настройки». В браузере путь уже отдаёт SPA fallback (`spa-paths.ts` не меняется; нужен только regression-тест).
- Тексты интерфейса — только из каталога `packages/contracts/src/i18n/ru/*.json`, дословно из epics/EXPERIENCE/DESIGN, где они есть. Сеть при действии — общая фраза формы «Нет соединения. Попробуйте ещё раз.» (`app.form.network`, DECISION 2026-11-18). Новые тексты, которых нет в источниках, перечислены в «Открытых вопросах» и в отчёте как «новые тексты, без утверждения в UX».
- Новой миграции нет: `reservationDueAt`, `reservationTimeZone`, `reservationPhase`, `reservationPhaseAt`, `reservationBought`, `holderVisibleToOwner`, `holderVisibleToOthers`, `titleSnapshotOnReserve` уже в `apps/web/src/db/schema.prisma` и в применённой миграции `20261103074333_gift_reservations`. Схема не меняется.
- NFR-6 audit — только смена `Gift.status` (ARCHITECTURE-SPINE → Consistency Conventions → Logging). 5.5 статус не меняет: продление, «Купил» и переключатели — атрибуты `RESERVED`. `recordGiftEvent` не расширяем и строк не пишем; снятие по-прежнему пишет свою audit-строку из 5.2. Факт продления для Epic 6 читается из `reservationPhaseAt`/`reservationPhase`.

**Never:**
- `Notification`, Resend, `deliverAfter`, outbox и письма. Уведомление владельцу «Даритель уже ответил», уведомления об изменении переключателей и «Купил» — Epic 6 (вариант A, deferred-work). 5.5 не создаёт ни строки.
- Cron и таймеры (5.6), «Срок истёк» как действие, «Подарил» и подтверждение получения (5.7), удаление и правка забронированного (5.4), тесты AD-15 (5.8). Фазы `AWAITING_*`/`GIVEN` только отображаются.
- Таблицы `Reservation`, `Payment`, `Notification`; миграции; изменение `schema.prisma`.
- Изменение `VisibilityPolicy`, `readWishlist`, `getViewerGift`, `releaseReservation`, `reservationWarning`, мапперов `reservedBy` / `reservationLabel` / `ownerAction` и семантики `reservation` в gift card.
- Ссылка на деталь при `canOpenGift = false`; раскрытие `visibility`, отношений, `dueAt` как момента времени, `reservationTimeZone`, имени держателя владельцу и `bought` владельцу.
- Вкладка/раздел навигации «Брони» до Story 6.2; правка `apps/web/public/` (генерируется).
- Подключение к живой БД, применение миграций, секреты в репозитории.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| LIST | вошедший, есть `RESERVED` с `reservedById=actor` | 200 `{ reservations: [...] }`, по возрастанию `reservationDueAt`, затем `id`; поля reservation card; других желаний нет | — |
| LIST_SNAPSHOT | владелец переименовал желание после брони | `titleSnapshot` — прежнее название; `ownerNick` — текущий ник | — |
| EMPTY | вошедший, броней нет | 200 `{ reservations: [] }`; экран «Броней нет» + текст | — |
| ANON | нет сессии | — | `UNAUTHENTICATED` (401) |
| EXTEND_OK | `ACTIVE`/`AWAITING_GIVER`/`AWAITING_OWNER`, дата в диапазоне | одна запись: `dueAt`, новый снимок пояса, `phase=ACTIVE`, `phaseAt=now`; ответ — карточка | — |
| EXTEND_AWAITING_OWNER | `phase=AWAITING_OWNER` | `phase=ACTIVE`, `phaseAt=now`; следующее чтение владельца — `ownerAction=null`; `bought` не меняется | — |
| EXTEND_PAST | `dueOn` < сегодня в поясе пользователя | запись не делается | `VALIDATION` `DUE_OUT_OF_RANGE`, `params.max` |
| EXTEND_TOO_FAR | `dueOn` > сегодня+30 в поясе | запись не делается | `VALIDATION` `DUE_OUT_OF_RANGE`, `params.max` |
| EXTEND_GIVEN | `phase=GIVEN` | запись не делается; кнопки продления нет | `CONFLICT` без `reason`; список перечитывается |
| BOUGHT_ON | `ACTIVE`/`AWAITING_*`/`GIVEN`, `value=true` | `reservationBought=true`; фаза, `phaseAt`, `dueAt`, переключатели не меняются; ответ — карточка | — |
| BOUGHT_OFF | то же, `value=false` | `reservationBought=false`; `phaseAt` не сбрасывается | — |
| BOUGHT_OFF_AWAITING_OWNER | `AWAITING_OWNER`, `value=false` | `phase` остаётся `AWAITING_OWNER`, `phaseAt` прежний; владелец по-прежнему видит `ownerAction=EXPIRED_NO_REPLY` | — |
| VISIBILITY | любой `RESERVED`, оба boolean | записаны только два переключателя; ответ — карточка; при включении «владельцу» подсказка | — |
| RELEASE | любой `RESERVED`, держатель | существующий `DELETE /gifts/:id/reserve` 5.2: `{ id }`, карточка исчезает из списка | сеть — toast; `CONFLICT`/`NOT_FOUND` — перечитать |
| NOT_HOLDER | чужой/неизвестный id, не держатель | — | `NOT_FOUND`, одно тело |
| NOT_RESERVED | своя строка, но `status=CLOSED` | запись не делается | `CONFLICT` без `reason`; список перечитывается |
| RACE | владелец закрыл/снял бронь между чтением и CAS | ровно один переход; проигравший ничего не пишет | `CONFLICT` (закрыто) или `NOT_FOUND` (брони больше нет) |
| UNFRIEND_CARD | unfriend, бронь на FRIENDS | карточка в списке, `canOpenGift=false`, все действия работают; других желаний нет | — |
| BLOCK_CARD | Block в любую сторону | то же; профиль и `/l` недоступны, карточка живёт (A-14) | — |
| LINK_ONLY | бронь сделана по `/l/:token`, отношений нет | карточка есть, `canOpenGift=false` (токена в списке нет); действия работают | — |
| PHASE_AWAITING | `AWAITING_GIVER` / `AWAITING_OWNER` | подписи «Срок истёк» / «Срок истёк · ждём ответа владельца»; продление и остальные действия есть; «Подарил» нет | — |
| PHASE_GIVEN | `GIVEN` | подпись «Ждёт подтверждения»; продления нет; «Купил», переключатели, «Снять бронь» есть; «Подарил» нет | — |
| CARD_LINK | `canOpenGift=true` | основная зона карточки ведёт на `/gifts/{id}`; иначе не ссылка | — |
| NETWORK | обрыв сети на списке | скелет/текст, затем «Не получилось загрузить. Проверьте сеть.» + «Повторить» | — |
| NETWORK_ACTION | обрыв на продлении/«Купил»/переключателе/снятии | карточка не меняется | toast «Нет соединения. Попробуйте ещё раз.» |

</frozen-after-approval>

## Open Questions

1. **`ownerAction` без миграции — решено.** Поле не хранится: `toOwnerGiftCard` вычисляет его из `reservationPhase` (`AWAITING_OWNER → EXPIRED_NO_REPLY`, `GIVEN → CONFIRM_GIVEN`). Продление ставит `phase=ACTIVE`, поэтому следующее чтение владельца отдаёт `null` — «запрос неактуален». Отдельная колонка не нужна; уведомление «Даритель уже ответил» остаётся Epic 6. Если Epic 6 захочет отличать «ответил» от «запрос ещё не создавался», ему хватит `reservationPhaseAt`; иное — отдельная миграция вне 5.5.
2. **Продление в `GIVEN` — решено: не делать.** Story 5.5 перечисляет продление без ограничения фазы, но 5.7 делает `GIVEN` ожиданием подтверждения и прекращает таймеры; продление вернуло бы `ACTIVE`. Кнопки нет, сервер — `CONFLICT`. Подтвердить вместе с 5.7; если 5.7 решит иначе, меняется только предикат CAS и видимость кнопки.
3. **Ответ `PATCH` — решено: reservation card.** `{ id }` заставил бы экран перечитывать список после каждого переключателя; карточка уже содержит все нужные поля. Ответ строгий (`strictObject`), лишние поля ломают контракт.
4. **`canOpenGift` — решено: серверное булево.** Клиент не должен сам решать доступ по отношениям (их у него нет) и не должен получать `listToken`. `false` — карточка без ссылки на деталь. Деталь после unfriend/Block остаётся `NOT_FOUND`; управление — только в «Моих бронях».
5. **Новые тексты, без утверждения в UX.** «Мои брони — {brand}», «Загружаем брони», «Открыть желание «{title}»». Остальные строки — дословно из epics/EXPERIENCE/DESIGN или уже есть в каталоге. См. «Design Notes → Тексты».
6. **Короткая дата на карточке.** DESIGN → ReservationCard требует «до DD.MM», а общий `formatDate` отдаёт `DD.MM.YYYY`. Решение: добавить в `formatDate` необязательный `year?: boolean` (по умолчанию `true`, старые вызовы не меняются) и на карточке передавать `{ year: false }`; в детали остаётся полная дата. Формат даты — одна функция контракта, не своя в экране.
7. **Состав списка — решено: только `status=RESERVED`.** Закрытые желания с сохранённым `reserved*` (AD-8, audit) в «Мои брони» не попадают: FR-25 говорит об активных бронях. Секция «Уже подарено» живёт в вишлисте (5.3).
8. **Место временного входа — решено: «Мой вишлист».** Там уже стоят временные «Поиск», «Друзья», «Настройки» до Story 6.2; отдельная вкладка не добавляется. После 6.2 строка убирается, экран становится вкладкой «Брони».
9. **`status` в reservation card — литерал `"RESERVED"`.** Так матрица AD-7 закрыта, а будущий `CLOSED` (если появится в списке) потребует явного расширения контракта, а не тихого протаскивания.
10. **Одинаковые подписи фазы.** Story 5.5 сокращает `AWAITING_*` до «Срок истёк», EXPERIENCE различает `AWAITING_GIVER` и `AWAITING_OWNER` и объявляет таблицу единым источником для Story 5.5. Берём таблицу EXPERIENCE: она содержит «Срок истёк» и добавляет контекст, не противореча эпику.

## Code Map

**Контракты**
- `packages/contracts/src/gift.ts` — `reservationCardSchema`, `reservationListSchema`, `reservationActionBodySchema` (discriminated union), типы `ReservationCard`, `ReservationList`, `ReservationActionBody`; рядом с `giftReserveBodySchema`. `CALENDAR_DAY` и `isCalendarDay` уже здесь.
- `packages/contracts/src/index.ts` — экспорт трёх схем и типов.
- `packages/contracts/src/i18n/format.ts` — `formatDate` получает `options.year?: boolean` (по умолчанию `true`); `i18n/i18n.test.ts` — короткая и полная дата.
- `packages/contracts/src/i18n/ru/app.json` — блок `app.reservations.*` (см. «Design Notes → Тексты»). `common.json` новых `errors.reason` не получает: используются `DUE_OUT_OF_RANGE`, `CONFLICT`, `NOT_FOUND`, `VALIDATION`.

**Домен и единственный писатель**
- `apps/web/src/domain/reservation-card.ts` — новый mapper `toReservationCard(row)` и `canOpenGift(row, relations)`; без Prisma. Читает `titleSnapshotOnReserve`, `title`, `reservationDueAt`, `reservationTimeZone`, `reservationPhase`, `reservationBought`, переключатели, `reservedBy`, `list.owner.nick`, `list.ownerId`, `visibility`, `archivedAt`.
- `apps/web/src/domain/reservation-due.ts` — `reservationDueOn(dueAt, timeZone)` (обратный перевод конца суток в календарный день); переиспользуется в `viewer-gift-card.ts`, чтобы не заводить вторую формулу.
- `apps/web/src/domain/viewer-gift-card.ts` — заменить локальный расчёт `dayAfterDue − 1` на `reservationDueOn`; поведение не меняется.
- `apps/web/src/domain/gift-status.ts` — типы `ExtendReservationWrite`, `SetReservationBoughtWrite`, `SetReservationVisibilityWrite`; методы `extendReservation`, `setReservationBought`, `setReservationVisibility` в `GiftStatusTransaction`; чистые предикаты `canExtendReservation(row)` (только ACTIVE/AWAITING_GIVER/AWAITING_OWNER) и `canSetReservationAttributes(row)` (любая `RESERVED`). `RESERVATION_RELEASE_DATA`, `closeGift`, `undoClose` не трогать.
- `apps/web/src/lib/gift-status-store.ts` — три `updateMany` CAS с полным `where` и точным `data`:
  - extend: `reservationDueAt`, `reservationTimeZone`, `reservationPhase: "ACTIVE"`, `reservationPhaseAt`;
  - bought: только `reservationBought`;
  - visibility: только два переключателя.
  `count === 1` — успех, иначе `lost`. Audit-строк не добавлять (статус не меняется).
- `apps/web/src/lib/gift-status-store.test.ts`, `apps/web/src/domain/gift-status.test.ts`, `apps/web/src/domain/reservation-card.test.ts` — CAS-предикаты и `data`, `phaseAt` не меняется у bought/visibility, extend в GIVEN отклоняется, due-day, canOpenGift для друга/подписчика/Block/unfriend/link-only, snapshot названия.

**Сервер: чтение**
- `apps/web/src/actions/my-reservations.ts` — `getMyReservations(headers)`: сессия; `prisma.gift.findMany({ where: { status: "RESERVED", reservedById: actor, reservationDueAt: { not: null }, reservationPhase: { not: null } }, orderBy: [{ reservationDueAt: "asc" }, { id: "asc" }], select })`; один `relationshipReader.relationsBetween` на уникального владельца; `VisibilityPolicy.canSee` для `canOpenGift`; ответ `{ reservations }`. Не вызывает `readWishlist` и не проверяет видимость для состава. Строку без полной брони пропускает с `console.warn` только по `id` (без названий).
- `apps/web/src/app/api/v1/me/reservations/route.ts` — `GET` → `toResponse(await getMyReservations(request.headers))`; `POST/PUT/PATCH/DELETE` → `notFoundResponse`.
- `apps/web/src/actions/my-reservations.test.ts`, `apps/web/src/app/api/v1/me/reservations/route.test.ts` — список, порядок, пустой, аноним, unfriend/Block/link-only, отсутствие чужих желаний и токена.

**Сервер: запись**
- `apps/web/src/actions/reservation-update.ts` — `updateMyReservation(headers, giftId, body)` и чистая `reservationUpdateResult(...)`; разбор `reservationActionBodySchema`; предварительное чтение `{ id, status, reservedById, visibility, archivedAt, list.ownerId }`; `NOT_FOUND` для не-держателя; `CONFLICT` для `status ≠ RESERVED`; для extend — `User.timeZone`, `isDueOnInRange`, `reservationDueAtFromDueOn`, `maxReserveDueOn`, `formatDate`; вызов `runGiftStatusTransaction`; после успеха — перечитать строку и вернуть reservation card; на `lost` — повторное чтение и классификация `NOT_FOUND`/`CONFLICT`.
- `apps/web/src/app/api/v1/me/reservations/[giftId]/route.ts` — `PATCH` → `parseJson` → `updateMyReservation`; `GET/POST/PUT/DELETE` → `notFoundResponse`.
- `apps/web/src/actions/reservation-update.test.ts`, `apps/web/src/app/api/v1/me/reservations/[giftId]/route.test.ts` — три действия, `DUE_OUT_OF_RANGE` с `params.max`, `GIVEN` extend, bought off в AWAITING_OWNER, visibility, `NOT_FOUND`/`CONFLICT`, аноним, лишние ключи и два действия в теле.
- Снятие не дублировать: `apps/mobile` вызывает существующий `releaseMyReservation` (`apps/mobile/src/api/viewer-gift.ts`), сервер — `DELETE /gifts/:id/reserve` из 5.2.

**Клиент: список и карточка**
- `apps/mobile/src/api/reservations.ts` — `fetchReservations()` (parse `reservationListSchema`) и `updateReservation(giftId, body)` (parse `reservationCardSchema`); исходы `ok | invalid | network | code`, как в `my-gifts.ts`.
- `apps/mobile/src/ui/reservation-card.tsx` — карточка: снимок названия, `у @{nick}`, срок/фаза, чип «Куплено», переключатель «Купил», свёрнутый блок «Кто видит, что это я» с двумя `Switch`, «Продлить до…», ⋮ «Снять бронь»; основная зона — ссылка только при `canOpenGift`; `displayName` обязателен.
- `apps/mobile/src/ui/reservation-extend-dialog.tsx` — `BottomSheet` на compact, `Dialog` на medium+; `DateField` с `min=сегодня`, `caption` «Не позже {max}», ошибка `DUE_OUT_OF_RANGE`, кнопки «Подтвердить»/«Отмена», `busy`; `displayName`.
- `apps/mobile/src/ui/reservation-visibility.tsx` — свёрнутый блок с двумя переключателями и подсказкой владельцу; либо внутри `reservation-card.tsx`, если так проще без второго компонента. `displayName` при отдельном компоненте.
- `apps/mobile/app/(app)/reservations.tsx` — экран: защита сессии (`next=/reservations`), загрузка, ошибка/повтор, пустое состояние, список карточек, `useFocusEffect` для тихого обновления после детали, состояния busy по `giftId`, тосты, confirm снятия (`ReservationReleaseConfirm`), замена карточки ответом, удаление после снятия, перечитывание на `CONFLICT`/`NOT_FOUND`.
- `apps/mobile/app/(app)/index.tsx` — временная строка «Мои брони» в нижнем ряду рядом с «Настройки»; `router.push("/reservations")`; комментарий «временный вход до Story 6.2».
- `apps/web/src/lib/spa-paths.test.ts` — regression: `/reservations` не `Next`-owned и попадает в SPA fallback; сам `spa-paths.ts` не меняется.
- Stories: `apps/mobile/src/ui/reservation-card.stories.tsx` (`App/ReservationCard`: ACTIVE, AWAITING_GIVER, AWAITING_OWNER, GIVEN, bought, раскрытые переключатели, без ссылки, длинная кириллица, 360), `reservation-extend-dialog.stories.tsx` (normal, busy, error, 360, medium), `apps/mobile/src/session/reservations-screen.test.tsx` и story экрана с `parameters: { layout: "fullscreen", screenFrame: true }`.

**Клиент: деталь желания**
- `apps/mobile/app/(app)/gifts/[id]/index.tsx` — у держателя (`current.reservation`) те же действия: подпись фазы, «Продлить до…», «Купил», блок видимости; снятие уже есть (5.2). Переиспользовать компоненты/колбэки из B5, не копировать правила. `GIVEN` — без продления. `displayName` экрана сохраняется.
- `apps/mobile/src/session/gift-detail-screen.test.tsx` — действия держателя, busy, сеть, `CONFLICT`, `GIVEN`.

**Документация**
- `_bmad-output/implementation-artifacts/deferred-work.md` — пункты из «Отложено».
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **не трогать**: ключ и статус обновляет владелец процесса.

## Tasks & Acceptance

Порядок волн: **B2 → (B3 ∥ B4) → B5 → B6**. B3 и B4 не конфликтуют по файлам, но оба ждут контракты и стор из B2. B5 и B6 делят компоненты карточки: B6 идёт после B5 и только переиспользует их.

### B2 — контракты, домен, единственный писатель
- [ ] `packages/contracts/src/gift.ts` — три схемы и типы; strict, discriminated union, `dueOn` как реальный календарный день; тесты: валидные три действия, лишний ключ, два действия, `2026-02-31`, пустой `action`.
- [ ] `packages/contracts/src/index.ts` — экспорт; `packages/contracts/src/index.test.ts` — схемы доступны из пакета.
- [ ] `packages/contracts/src/i18n/format.ts` — `year?: boolean`; тест `formatDate("2026-11-20", "ru", { year: false })` без года, старый вызов с годом.
- [ ] `packages/contracts/src/i18n/ru/app.json` — `app.reservations.*`; `i18n.test.ts` — строки дословные и непустые.
- [ ] `apps/web/src/domain/reservation-card.ts` + `.test.ts` — mapper, `canOpenGift`, snapshot, текущий ник, due-day, отсутствие лишних полей.
- [ ] `apps/web/src/domain/reservation-due.ts` (+ тест) и `viewer-gift-card.ts` — общий `reservationDueOn`; тест 5.1 не меняется по смыслу.
- [ ] `apps/web/src/domain/gift-status.ts` + `.test.ts` — типы, методы, предикаты; extend в GIVEN запрещён; bought/visibility не трогают фазу.
- [ ] `apps/web/src/lib/gift-status-store.ts` + `.test.ts` — три CAS, полный `where`, точный `data`, `count` 0/1, отсутствие audit-строки.

### B3 — чтение «Мои брони»
- [ ] `apps/web/src/actions/my-reservations.ts` + `.test.ts` — сессия, выборка по держателю, порядок, A-14 после unfriend/Block, link-only `canOpenGift=false`, пустой список, неполная строка.
- [ ] `apps/web/src/app/api/v1/me/reservations/route.ts` + `.test.ts` — `GET` 200, аноним 401, прочие методы 404.
- [ ] Проверить, что ответ не содержит `listToken`, других желаний, `visibility`, `reservationTimeZone`, имени владельца.

### B4 — запись одного действия
- [ ] `apps/web/src/actions/reservation-update.ts` + `.test.ts` — три действия, `NOT_FOUND`/`CONFLICT`, `GIVEN`, `DUE_OUT_OF_RANGE`, `ownerAction=null` после продления из `AWAITING_OWNER`, `phaseAt` не меняется у bought off.
- [ ] `apps/web/src/app/api/v1/me/reservations/[giftId]/route.ts` + `.test.ts` — `PATCH`, `parseJson`, прочие методы 404.
- [ ] Убедиться, что `DELETE /gifts/:id/reserve` не изменён и работает после unfriend/Block (тест 5.2 остаётся зелёным).

### B5 — экран «Мои брони» и вход
- [ ] `apps/mobile/src/api/reservations.ts` + тесты — список, обновление, `network`, `invalid`, `DUE_OUT_OF_RANGE`, `CONFLICT`.
- [ ] `reservation-card`, `reservation-extend-dialog`, `reservation-visibility` + тесты и stories; `displayName`; 360 px.
- [ ] `apps/mobile/app/(app)/reservations.tsx` + тест/story — сессия, загрузка, ошибка/повтор, пусто, действия, busy, тост, confirm снятия, `canOpenGift`.
- [ ] `apps/mobile/app/(app)/index.tsx` — временный вход «Мои брони»; тест навигации.
- [ ] `apps/web/src/lib/spa-paths.test.ts` — `/reservations` в SPA fallback.

### B6 — те же действия в детали
- [ ] `apps/mobile/app/(app)/gifts/[id]/index.tsx` — фаза, продление, «Купил», переключатели; `GIVEN` без продления; снятие 5.2 не дублировать.
- [ ] Тест детали и story; на 360 px действия не переполняются.
- [ ] `deferred-work.md` — «Отложено» ниже.

**Acceptance Criteria:**
- Given вошедший держатель с активными бронями, when открывает `/reservations`, then видит по каждой снимок названия, `@ник` владельца, срок, фазу, «Купил» и переключатели; чужих желаний и токена списка нет.
- Given unfriend или Block при активной брони, when держатель открывает `/reservations`, then карточка на месте, `canOpenGift=false`, все действия работают, других желаний владельца нет.
- Given `ACTIVE`/`AWAITING_GIVER`/`AWAITING_OWNER` и дата в диапазоне, when держатель продлевает, then ровно одна CAS-запись с новым `dueAt`, снимком пояса, `phase=ACTIVE` и `phaseAt=now`; из `AWAITING_OWNER` владелец далее видит `ownerAction=null`.
- Given `AWAITING_OWNER` и снятие «Купил», when запрос проходит, then `phase`, `phaseAt` и `dueAt` не меняются.
- Given `GIVEN`, when экран показывает карточку, then подпись «Ждёт подтверждения», продления нет, «Подарил» нет, «Купил»/переключатели/снятие доступны.
- Given чужой id, не держатель или своя закрытая бронь, when приходит `PATCH`, then `NOT_FOUND` или `CONFLICT` как в матрице, строка не меняется.
- Given две одновременные попытки изменить одну бронь, when обе доходят до записи, then успешна одна, вторая получает `CONFLICT`/`NOT_FOUND` и список перечитывается.
- Given `DUE_OUT_OF_RANGE`, when клиент получает ошибку, then показывает «Выберите дату не позже {max}.» с `max` из `params`.
- Given обрыв сети, when действие не прошло, then карточка не меняется и показан тост «Нет соединения. Попробуйте ещё раз.».

## Implementation Notes

— (заполняется при реализации)

## Spec Change Log

- 2026-11-20 (CLE-119, рамки координатора): схема Prisma не меняется; `ownerAction` вычисляется из фазы, продление из `AWAITING_OWNER` делает запрос неактуальным без миграции; уведомления — Epic 6 (вариант A); 5.6/5.7 не делаются, их фазы только отображаются; экран `/reservations` + временный вход; API `GET /me/reservations` и `PATCH /me/reservations/:giftId`; снятие — 5.2; все переходы — CAS `GiftStatusService`.

## Review Triage Log

— (заполняется при ревью)

## Design Notes

**Почему `ownerAction` не хранится.** `ownerAction` — не действие, а производная от фазы: владелец может ответить только в `AWAITING_OWNER` (`EXPIRED_NO_REPLY`) или `GIVEN` (`CONFIRM_GIVEN`). Продление переводит бронь в `ACTIVE`, значит вопрос владельцу снимается самим состоянием, и отдельная колонка `ownerAction` была бы вторым источником правды. Это же снимает миграцию. Уведомление «Даритель уже ответил» (Epic 6) должно читать `reservationPhase`/`reservationPhaseAt` в момент доставки, а не полагаться на сохранённый флаг.

**Почему список не проходит `readWishlist`.** A-14 — исключение из AD-7, а не второй read-owner: `readWishlist` отдаёт желания владельца и после unfriend/Block возвращает `null`. «Мои брони» — это отдельный запрос по `reservedById`, который не читает чужие желания и не отдаёт токен. Так исключение остаётся точечным и не открывает ни одного лишнего желания.

**Почему `canOpenGift` на сервере.** Клиент не знает отношений и не должен получать `listToken`; сервер уже умеет `VisibilityPolicy.canSee`. Булево не раскрывает причину: после unfriend, Block, сужения видимости или доступа только по ссылке оно просто `false`. Деталь при `false` не открывается, потому что её собственный `getViewerGift` не знает A-14; управление остаётся в карточке.

**Почему `PATCH` отдаёт карточку.** Продление меняет три поля сразу (`dueAt`, `phase`, `phaseAt`), «Купил» и переключатели — по одному. Карточка — тот же закрытый набор, что список; клиент не собирает состояние из ответа `{ id }` и не делает лишний запрос. `CONFLICT` и `NOT_FOUND` — единственные исходы, где нужен перечитать.

**Почему bought/visibility не трогают `phaseAt`.** `phaseAt` — время входа в фазу для cron 5.6. Снятие «Купил» в `AWAITING_OWNER` не является ответом держателя и не должно продлевать 72/168-часовые окна. Поэтому запись касается только `reservationBought`; то же для переключателей.

**Почему продление в `GIVEN` запрещено.** `GIVEN` — «подарил, ждём подтверждения», таймеры срока остановлены (5.7). Продление вернуло бы `ACTIVE` и снова включило бы уведомления об истечении, что противоречит смыслу фазы. Если 5.7 решит иначе, предикат и кнопка — единственные места правки.

**Подписи и даты.** «Подписи брони» из EXPERIENCE — единый источник; `ACTIVE` уже содержит «до DD.MM», поэтому на карточке для `ACTIVE` отдельная строка срока не дублируется. Для остальных фаз строка «до DD.MM» стоит отдельно, ниже — подпись фазы. `formatDate(..., { year: false })` даёт короткую дату без своей формулы в экране; в детали остаётся полная.

**Тексты.** Дословно из источников: «Мои брони» (таблица экранов), «Броней нет» / «Нажмите «Куплю сам» у желания друга — бронь появится здесь.» (Empty states), «у @{ник}», «до DD.MM», «Купил», «Куплено», «Кто видит, что это я», «Продлить до…», «Снять бронь» (epics/EXPERIENCE/DESIGN), «Показать владельцу, что это я», «Показать другим, кто берёт» (Reserve confirm), «Владелец сразу увидит ваше имя; если потом выключить, он может уже знать» (Reservation actions), «Не позже {max}», «Выберите дату не позже {max}.», «Нет соединения. Попробуйте ещё раз.». Новые, без утверждения в UX: `app.reservations.pageTitle` «Мои брони — {brand}», `loading` «Загружаем брони», `openGift` «Открыть желание «{title}»». Их список продублирован в отчёте B1.

**Сеть и состояния.** Загрузка — скелет/`LoadingCards` по State Patterns; ошибка — существующие «Не получилось загрузить. Проверьте сеть.» и «Повторить». Действие — `busy` на конкретной карточке, повторное нажатие блокируется; при ошибке карточка остаётся прежней, при `CONFLICT`/`NOT_FOUND` список перечитывается. Один тост за раз, `ToastHost` уже есть.

## Отложено

- Уведомление владельцу «Даритель уже ответил», когда продление из `AWAITING_OWNER` сняло запрос: Epic 6, `Notification`/письмо, `deliverAfter` не нужен. Источник — `reservationPhase=ACTIVE` и `reservationPhaseAt`; отдельной строки 5.5 не создаёт.
- Уведомления об изменении «Купил» и переключателей видимости: FR-26 их не перечисляет; если продукт захочет, это Epic 6 и отдельное решение, не 5.5.
- «Подарил», `GIVEN`, подтверждение получения и ответы владельца — Story 5.7.
- Cron `reservation-timers`, `AWAITING_GIVER`/`AWAITING_OWNER`/снятие по сроку — Story 5.6. 5.5 только показывает фазы.
- Вкладка «Брони» и полная навигация — Story 6.2; до неё временная строка в «Моём вишлисте».
- Деталь желания после unfriend/Block по A-14 (если продукт захочет открывать reservation card отдельным экраном) — вне 5.5; сейчас карточка самодостаточна.
- Audit NFR-6 для фаз и атрибутов брони (не `status`): если Epic 6 или аудит потребует, отдельная задача; 5.5 не расширяет `recordGiftEvent`, потому что смены статуса здесь нет.

## Verification

**Commands:**
- `npm run test -w @gift-list/contracts` -- expected: схемы, strict-тела, `formatDate` с годом и без.
- `npm run test -w @gift-list/web` -- expected: домен, стор, действия и маршруты; CAS, `DUE_OUT_OF_RANGE`, `GIVEN`, `ownerAction=null`.
- `npm run test -w @gift-list/mobile` -- expected: API-клиент, карточка, диалог, экран, деталь; `displayName`, 360.
- `npm run typecheck` -- expected: без ошибок.
- `npm run lint` -- expected: без ошибок, `check-boundaries` чист.
- `npm test` -- expected: все пакеты зелёные.
- `npm run build` -- expected: сборка проходит (выполняет координатор в конце, не подзадача).
- `npm run build-storybook` -- expected: новые истории `App/…` видны, 360 px не переполняются.

**Manual checks (if no CLI):**
- Телефон и браузер: «Мой вишлист» → «Мои брони»; бронь видна с названием-снимком, `@ником`, сроком, фазой. Продлить на +10 дней — срок и фаза обновились; «Купил» включается и выключается; переключатели меняются; «Снять бронь» убирает карточку.
- Второй аккаунт: удалить из друзей / заблокировать держателя. У держателя карточка остаётся, деталь не открывается, действия работают; других желаний владельца нет.
- Фазы вручную в БД (только локально): `AWAITING_GIVER`, `AWAITING_OWNER`, `GIVEN` показывают подписи; в `GIVEN` нет продления; «Подарил» нигде нет.
- Отключить сеть на продлении/«Купил»/переключателе: карточка не меняется, тост общий; на списке — ошибка и «Повторить».
- 360 px: карточка, ⋮, диалог продления и переключатели не переполняются; фокус и клавиатура в браузере работают.
