---
title: '5.6: Цикл истечения Срока брони (cron)'
type: 'feature'
created: '2026-11-20'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '28d24887d07928786a442c183da62abff84381d1'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Бронь ставится (Story 5.1), снимается (5.2), закрывается (5.3) и продлевается (5.5), но сам Срок брони ничего не делает: `reservationPhase` меняется только руками держателя. Если даритель пропал, желание навсегда остаётся `RESERVED`, владелец не получает вопроса «подарок уже у вас?», а «мёртвая» бронь не освобождается. Купленные подарки при этом нельзя открывать снова (FR-29, D-12, AD-5).

**Approach:** Один почасовой Route Handler `POST /api/cron/reservation-timers` под тем же секретом, что `/api/cron/wish-expiry` (AD-16, ARCH-A15). Он вызывает только `GiftStatusService.processReservationTimers(now)` — три шага CAS в порядке, заданном AD-9:

1. `ACTIVE → AWAITING_GIVER` при `reservationDueAt ≤ now`;
2. `AWAITING_GIVER → AWAITING_OWNER` при `reservationPhaseAt ≤ now − 72 ч`;
3. `AWAITING_OWNER → OPEN` при `reservationPhaseAt ≤ now − 168 ч AND reservationBought = false`; колонки брони очищаются тем же `RESERVATION_RELEASE_DATA`, что в 5.2.

Каждый шаг идёт батчами по 500 строк, строка переводится своим CAS и своей транзакцией, поэтому одна плохая строка не отменяет пачку, а повторный запуск ничего не дублирует: после успешного перехода строка уже не проходит предикат, проигранный CAS не пишет ни строки, ни события. Уведомлений пока нет — Epic 6: факт каждого перехода уходит в существующий шов `recordGiftEvent` (вариант A, как в 5.2/5.3) с новыми `kind`, ровно одна запись на переход и ни одной на проигранный CAS.

Владельцу нужен ответ на вопрос T6 «Не получал, оставить бронь»: `POST /api/v1/me/gifts/:id/reservation/keep` (строгое пустое тело `{}`) переводит `status=RESERVED AND phase=AWAITING_OWNER` обратно в `ACTIVE`, ставит `reservationDueAt` на конец дня «сегодня + 7» в сохранённом `reservationTimeZone` и не трогает `bought` и сам пояс-снимок. «Получил» — существующее закрытие 5.3, «Снять бронь» — существующее снятие 5.2.

В приложении у владельца появляется `OwnerActionLabel` по DESIGN для `ownerAction=EXPIRED_NO_REPLY`: «Срок брони истёк» + «Получил» / «Не получал, оставить бронь»; «Снять бронь» — третий пункт в ⋮ карточки. `CONFIRM_GIVEN` — Story 5.7 и в этой спеке только отложен.

Схема Prisma не меняется: все колонки брони и оба индекса для cron уже есть в применённой миграции `20261103074333_gift_reservations`. Миграции нет.

## Boundaries & Constraints

**Always:**
- Единственный писатель `status`, `reserved*`, `reservationPhase`, `reservationPhaseAt`, `reservationDueAt` и `reservationBought` — `GiftStatusService` (`apps/web/src/lib/gift-status-store.ts` + чистые правила в `apps/web/src/domain/gift-status.ts`); маршруты и клиент колонок не пишут (AD-1, AD-8, AD-9).
- Cron делает **только** три перехода из AD-9 и ровно с теми предикатами:
  - ACTIVE→AWAITING_GIVER: `WHERE id AND status="RESERVED" AND phase="ACTIVE" AND dueAt ≤ now`; `SET phase="AWAITING_GIVER", phaseAt=now`;
  - AWAITING_GIVER→AWAITING_OWNER: `WHERE id AND status="RESERVED" AND phase="AWAITING_GIVER" AND phaseAt ≤ now−72h`; `SET phase="AWAITING_OWNER", phaseAt=now`;
  - AWAITING_OWNER→OPEN: `WHERE id AND status="RESERVED" AND phase="AWAITING_OWNER" AND phaseAt ≤ now−168h AND bought=false`; `SET RESERVATION_RELEASE_DATA` (`status="OPEN"`, все колонки брони очищены).
  Предикат `bought=false` входит в CAS третьего шага, чтобы «Купил», поставленный между чтением и записью, не дал открыть подарок.
- Шаги выполняются в порядке 1→2→3 с одним `now` на весь прогон. Строка, переведённая в шаге 1 или 2, получает `phaseAt=now` и в этом же прогоне дальше не проходит следующий предикат: за один запуск строка двигается не более чем на один шаг, пропущенные запуски только откладывают переходы (ARCH-A15), а не ускоряют их.
- Выборка кандидатов — `findMany` с тем же предикатом, `orderBy: { id: "asc" }`, `take: 500`, пагинация по `id > lastId` (константа `RESERVATION_TIMERS_BATCH = 500`). Запись — отдельный `updateMany` на строку в своей транзакции `runGiftStatusTransaction`; `count === 1` — успех, иначе `lost` и ничего не пишется. Ошибка одной строки ловится, считается в `failed`, пишется в лог только `id` и имя/код ошибки (без названий) и не останавливает остальные строки. Цикл шага заканчивается на неполной пачке.
- Возврат `processReservationTimers(now, db)`: `{ expiredToGiver, askedOwner, released, failed }`; первые три — счётчики успешных переходов по шагам, `failed` — число упавших строк. `now` и `db` инъектируются для тестов; по умолчанию `new Date()` и `prisma`.
- Событие — тот же шов `recordGiftEvent(event)` с `GiftStatusEvent` из 5.2/5.3. Новые `kind`: `RESERVATION_GIVER_DEADLINE_PASSED` (шаг 1), `RESERVATION_OWNER_ASKED` (шаг 2), `RESERVATION_RELEASED_BY_EXPIRY` (шаг 3), `RESERVATION_KEPT_BY_OWNER` (keep). Для шагов 1 и 2 `from=to="RESERVED"`, для шага 3 `RESERVED→OPEN`, для keep `RESERVED→RESERVED`; `kind` различает фазовые переходы, у которых статус не меняется. `at` — один `now` прогона, у keep — момент действия.
- У системных переходов cron нет актора: `GiftStatusEvent.actorId` расширяется до `string | null`, cron пишет `actorId: null`. У keep актор — владелец. Событие пишется **после коммита** (`runGiftStatusTransaction`), ровно один раз на успешный CAS, и не пишется на `lost` и на упавшую строку. Персональных данных в событии нет (FR-31).
- Audit-строка `recordGiftEvent` (вариант A) дополняется полем `kind`: JSON `{ event: "gift.status", giftId, actorId, from, to, kind, at }`. Поля 5.2/5.3 остаются, формат расширяется аддитивно; существующие ожидания в `gift-status-store.test.ts` и `release.pgtest.ts` обновляются на `kind`.
- Keep (T6):
  - маршрут `POST /api/v1/me/gifts/:id/reservation/keep`, тело — строгая пустая схема `keepReservationBodySchema = z.strictObject({})`; лишний ключ или не-JSON тело — `VALIDATION` с `field`;
  - предикат: `status="RESERVED" AND reservationPhase="AWAITING_OWNER"` и владение списком (`list.ownerId = actor`); архив (`archivedAt != null`) — `VALIDATION` (AD-8: архивное желание только для просмотра); `OPEN`/`CLOSED` или другая фаза (`ACTIVE`, `AWAITING_GIVER`, `GIVEN`) — `CONFLICT`; чужой/неизвестный id — `NOT_FOUND` с одним телом (AD-7);
  - запись: `phase="ACTIVE"`, `phaseAt=now`, `reservationDueAt = конец дня «сегодня + 7»` в сохранённом `reservationTimeZone` (`addCalendarDays(calendarDayInZone(now, zone), 7)` → `reservationDueAtFromDueOn`), `reservationTimeZone` **не** пересчитывается и не меняется, `reservationBought` не меняется, `status` не меняется. Неизвестный/пустой пояс в аномальной строке — `canonicalTimeZone` даёт `UTC`;
  - ответ — owner gift card (`GiftCard`) после записи, а не `{ id }`: в ней уже есть `ownerAction`, и после keep он `null`; лишних полей брони (`dueAt`, `phase`, `bought`) владельцу не добавляется (AD-7);
  - проигранный CAS — `CONFLICT`; перед ответом строка перечитывается в своём списке: нет строки — `NOT_FOUND`, строка есть, но уже не `RESERVED`/`AWAITING_OWNER` — `CONFLICT`. Ни на один отказ событие не пишется.
- Cron-маршрут `POST /api/cron/reservation-timers`:
  - секрет — тот же `CRON_SECRET` и та же timing-safe проверка, что у `wish-expiry`; проверка выносится в `apps/web/src/lib/cron-auth.ts` и переиспользуется обоими маршрутами (поведение `wish-expiry` не меняется);
  - без/с неверным секретом — `UNAUTHENTICATED` (401) и сервис не вызывается; ошибка прогона или `failed > 0` — пустой 500 (как `wish-expiry`); успех — `{ ok: true, data: { expiredToGiver, askedOwner, released } }`; `failed` в тело не попадает; в ответе нет id, названий, ников и времени;
  - `GET/PUT/PATCH/DELETE` — `notFoundResponse`; тело не читается.
- Расписание — новый `.github/workflows/reservation-timers.yml`, раз в час (`20 * * * *`, чтобы не совпадать с `wish-expiry`), **только staging**: job в существующем окружении `cron-staging`, секреты `APP_URL`/`CRON_SECRET`, проверка `APP_URL` начинается с `https://staging.` и падение job при нарушении; `workflow_dispatch` без выбора окружения; `concurrency` на staging без отмены; `fail-fast` не нужен (один job). Прод не вызывается: маршрута там нет до выкладки в `main`.
- `docs/deployment-environments.md` дополняется разделом о таймерах брони: тот же секрет и окружение, staging-only, ручной запуск/`curl`, что пропуск запуска только откладывает переходы, и шаг включения прода при переносе в `main`.
- Клиент владельца:
  - `OwnerActionLabel` (DESIGN → OwnerActionLabel, EXPERIENCE → «Подписи брони»): полоса `$muted` с левой границей 3 px `$accent-foreground`, текст `label` и 1–2 secondary-кнопки `min-height 44`; кнопки не вложены в нажимаемую зону карточки;
  - в карточке владельца при `ownerAction=EXPIRED_NO_REPLY` строка брони заменяется полосой «Срок брони истёк» + «Получил» / «Не получал, оставить бронь»; «Снять бронь» — пункт ⋮ (коралловый, существующий preflight 5.2 + шаг подтверждения); при `CONFIRM_GIVEN` карточка остаётся как в 5.5 (полоса — Story 5.7);
  - в детали при `ownerAction=EXPIRED_NO_REPLY` полоса стоит над фактами, факт `ownerAction` не дублируется, «Получил» запускает существующий confirm закрытия 5.3, «Не получал, оставить бронь» вызывает keep, «Снять бронь» остаётся коралловой в действиях детали; общая кнопка «Отметить полученным» в этом состоянии не дублируется;
  - `keep` идёт без отдельного подтверждения (сам ответ и есть действие), с `busy` на кнопках полосы; успех заменяет карточку в списке ответом сервера (полоса исчезает, `ownerAction=null`), обрыв сети — общая фраза `app.form.network`, `CONFLICT`/`NOT_FOUND` — перечитать список, `UNAUTHENTICATED` — существующий выход из сессии;
  - тексты — только из каталога `packages/contracts/src/i18n/ru/*.json`: «Получил» и «Не получал, оставить бронь» дословно из epics/Story 5.6 и `DESIGN.md` → OwnerActionLabel; «Снять бронь», «Срок брони истёк» уже есть. Новых несогласованных текстов нет;
  - обязательны stories (соседний файл, раздел `App/…`) для нового/изменённых компонентов: normal, busy, длинная кириллица, 360 px; состояния `DESIGN`/`EXPERIENCE`; hover/focus не подделывать.
- Тесты: домен и стор (границы 72/168 ч включительно, `bought`, `GIVEN`, повторный запуск, гонки, батчи, ошибка строки, события), cron-маршрут (401/200/500, только счётчики), shared `cron-auth`, keep (успех/карта/фаза/срок/`bought`/пояс, 400/404/409, гонка, событие), клиент (API, полоса, карточка, деталь, экран), i18n. `npm run test -w @gift-list/contracts`, `-w @gift-list/web`, `-w @gift-list/mobile`, затем `npm run typecheck`, `npm run lint`. Тесты с настоящей БД в этой задаче не запускаются и не добавляются (`*.pgtest.ts` — 5.8).
- Общие с Story 5.4 файлы помечены в «Code Map»; правки в них — только свои участки, без переписывания чужих. `_bmad-output/implementation-artifacts/sprint-status.yaml` не трогается: ключ и статус ведёт владелец процесса.

**Never:**
- `Notification`, Resend, письма, `deliverAfter`, outbox и кнопки в письмах для четырёх переходов и keep. Уведомления «держателю», «владельцу» и «Владелец продлил вашу бронь «Y» до DD.MM» — Epic 6; 5.6 не создаёт ни строки. Факт перехода остаётся только в audit-строке (вариант A).
- Story 5.7: «Подарил», переход в `GIVEN`, подтверждение получения владельцем, «Не получал» для `GIVEN`, полоса `CONFIRM_GIVEN` с действиями. В 5.6 `GIVEN` только не трогается cron-ом.
- Story 5.4: удаление и правка забронированного, их тексты и меню; Story 5.5 уже сделана и не переписывается.
- Изменение `schema.prisma`, новая миграция, `migrate deploy/dev/reset`, `db push`, подключение к staging/prod. Таблица `Reservation`/`Payment` не появляется.
- Сырые записи `Gift.status`, `reserved*`, `reservation*` вне `GiftStatusService`; правка `VISIBILITY`, дружбы и чтения желаний в обход `VisibilityPolicy`.
- Vercel Cron и любые платформенные сервисы Vercel; новые GitHub Environments, секреты, настройки репозитория; job для прода в новом workflow.
- Утечка в ответах и логах: названий желаний, ников, email, id строк в cron-ответе, `bought` владельцу, `dueAt`/`phase` владельцу, идентичности держателя без `holderVisibleToOwner`.
- Новые пакеты, `npm install`, dev-серверы, Storybook, `npm run build` в этой подзадаче (сборка — координатор).
- Новая вкладка/навигация, правка `apps/web/public/`, `packages/ui`-компонентов сверх слота полосы (если он понадобится) и текстов вне каталога.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| CRON_GIVER_DUE | `RESERVED`, `phase=ACTIVE`, `dueAt == now` | CAS 1 успешен: `phase=AWAITING_GIVER`, `phaseAt=now`; событие `RESERVATION_GIVER_DEADLINE_PASSED`, `actorId=null`; `expiredToGiver=1` | — |
| CRON_GIVER_NOT_DUE | `dueAt = now + 1 мс` | перехода нет, счётчик 0 | — |
| CRON_ASK_DUE | `AWAITING_GIVER`, `phaseAt == now−72 ч` | CAS 2 успешен: `AWAITING_OWNER`, `phaseAt=now`; событие `RESERVATION_OWNER_ASKED` | — |
| CRON_ASK_EARLY | `phaseAt = now−72 ч + 1 мс` | перехода нет | — |
| CRON_RELEASE_DUE | `AWAITING_OWNER`, `phaseAt == now−168 ч`, `bought=false` | CAS 3 успешен: `OPEN`, все колонки брони очищены (`RESERVATION_RELEASE_DATA`); событие `RESERVATION_RELEASED_BY_EXPIRY`; `released=1` | — |
| CRON_RELEASE_EARLY | `phaseAt = now−168 ч + 1 мс` | перехода нет | — |
| CRON_BOUGHT | `AWAITING_OWNER`, `bought=true`, срок вышел | ничего не меняется, события нет; владелец по-прежнему видит `ownerAction=EXPIRED_NO_REPLY` | — |
| CRON_GIVEN | `phase=GIVEN` в любом сроке | строка не кандидат, перехода нет | — |
| CRON_OPEN_CLOSED | `status=OPEN` или `CLOSED` | строка не кандидат | — |
| CRON_ARCHIVED | `archivedAt != null` | строка не кандидат (у `RESERVED` архив снимает бронь по AD-9 и такой строки быть не должно) | — |
| CRON_RERUN | второй прогон с тем же `now` после успешного | все счётчики 0, событий нет | — |
| CRON_BATCH | больше 500 кандидатов в шаге | пачки по 500 по возрастанию `id`, все обработаны; повторной выдачи нет | — |
| CRON_ROW_FAILS | одна строка падает в БД | остальные обработаны; `failed=1`; строка остаётся кандидатом на следующий прогон | лог без названия; маршрут — пустой 500 |
| CRON_EXTEND_RACE | продление 5.5 меняет `dueAt`/`phase` между чтением и CAS 1 | CAS 1 проигран (`dueAt ≤ now` уже неверно), события нет; если CAS 1 успел раньше, продление из `AWAITING_GIVER` законно вернёт `ACTIVE` | — |
| CRON_RELEASE_RACE | держатель/владелец снимает или владелец закрывает между чтением и CAS 3 | ровно один переход; проигравший CAS не пишет и не пишет события | — |
| CRON_KEEP_RACE | keep и CAS 3 одновременно | один успешен: keep → `ACTIVE`, release → `OPEN`; второй `lost`/`CONFLICT` | `CONFLICT` клиенту keep |
| CRON_BOUGHT_RACE | держатель ставит `bought=true` между чтением и CAS 3 | CAS 3 проигран (`bought=false` в предикате), подарок не открыт | — |
| CRON_SECRET_MISSING | нет `Authorization` | 401 `UNAUTHENTICATED`, сервис не вызван | один конверт AD-12 |
| CRON_SECRET_WRONG | неверный/короткий секрет | 401, сервис не вызван, секрет не логируется | — |
| CRON_DB_DOWN | `processReservationTimers` бросил | пустой 500, в теле ничего | лог только имя ошибки |
| CRON_OK_BODY | успешный прогон | 200 `{ ok: true, data: { expiredToGiver, askedOwner, released } }`; `failed` нет; id/названий/времени нет | — |
| CRON_OTHER_METHODS | `GET/PUT/PATCH/DELETE` | 404 AD-12 | — |
| KEEP_OK | владелец, `RESERVED`, `AWAITING_OWNER`, тело `{}` | 200 owner card: `ownerAction=null`, `status=RESERVED`; `phase=ACTIVE`, `phaseAt=now`, `dueAt` = конец «сегодня+7» в `reservationTimeZone`; `bought` и пояс не меняются; событие `RESERVATION_KEPT_BY_OWNER` | — |
| KEEP_BOUGHT | `AWAITING_OWNER`, `bought=true` | keep разрешён (предикат T6 не смотрит `bought`); `bought` остаётся `true`; автоснятие по сроку по-прежнему заблокировано | — |
| KEEP_WRONG_PHASE | `ACTIVE`, `AWAITING_GIVER` или `GIVEN` | записи нет | 409 `CONFLICT` |
| KEEP_NOT_RESERVED | `OPEN` или `CLOSED` у владельца | записи нет | 409 `CONFLICT` |
| KEEP_FOREIGN | чужой/неизвестный `id` | ничего не пишется | 404 `NOT_FOUND`, одно тело |
| KEEP_ARCHIVED | `archivedAt != null` | записи нет | 400 `VALIDATION` (архив только для просмотра) |
| KEEP_BODY | пустое тело, `content-type` не JSON, лишний ключ | записи нет | 400 `VALIDATION` с `field` |
| KEEP_ANON | нет сессии | записи нет | 401 `UNAUTHENTICATED` |
| KEEP_RACE_RELEASE | cron/владелец снял бронь между чтением и CAS | записи нет, строка перечитана | 409 `CONFLICT` |
| KEEP_RACE_EXTEND | держатель продлил, фаза уже `ACTIVE`/`AWAITING_*` | записи нет | 409 `CONFLICT` |
| KEEP_ZONE_UNKNOWN | `reservationTimeZone` пуст/невалиден | срок считается в `UTC`; ответ не раскрывает пояс | — |
| CARD_LABEL | владелец, `ownerAction=EXPIRED_NO_REPLY` | полоса «Срок брони истёк» + «Получил» / «Не получал, оставить бронь»; строка брони не дублируется; ⋮ — «Снять бронь» | — |
| CARD_NO_LABEL | `OPEN`, `ACTIVE`, `GIVEN` или `ownerAction=null` | полосы нет; карточка как в 5.5 | — |
| CARD_RECEIVED | нажато «Получил» | открывается существующий confirm закрытия 5.3; после успеха карточка закрыта | сеть — общий текст; `CONFLICT` — перечитать |
| CARD_KEEP | нажато «Не получал, оставить бронь» | keep, кнопки `busy`, ответ заменяет карточку, полоса исчезает | сеть — `app.form.network`; 409/404 — перечитать |
| CARD_RELEASE_MENU | ⋮ → «Снять бронь» | открывается деталь и тот же preflight 5.2; подтверждение — шаг 5.2, не второй диалог | как 5.2 |
| DETAIL_LABEL | деталь владельца, `ownerAction=EXPIRED_NO_REPLY` | полоса над фактами, факт `ownerAction` не дублируется, «Снять бронь» остаётся коралловой; «Отметить полученным» не дублируется | — |
| DETAIL_CONFIRM_GIVEN | `ownerAction=CONFIRM_GIVEN` | полосы 5.6 нет, поведение 5.5 сохраняется | — |
| W360 | 360 px, длинная кириллица | полоса и карточка не переполняются, кнопки доступны | — |

</frozen-after-approval>

## Open Questions

1. **`actorId` системного перехода — решено: `null`.** `GiftStatusEvent.actorId` становится `string | null`; cron пишет `null`, keep — владельца. Магическая строка `"system"` отклонена: она смешивает актора с идентификатором. Story 6.1 может ввести отдельное поле системы в `Notification`, не меняя CAS.
2. **`kind` в audit-строке — решено: добавить.** Без него фазовые переходы (`from=to=RESERVED`) неразличимы, а требование «новые kind» не наблюдается. Формат JSON расширяется аддитивно: `{ event, giftId, actorId, from, to, kind, at }`. Ожидания в `gift-status-store.test.ts` (шесть вызовов `expectOneAuditLine`) и `release.pgtest.ts` обновляются; замороженные спеки 5.2/5.3 не правятся, их формулировка о формате считается уточнённой здесь.
3. **Keep: тело `{}` или POST без тела — решено: строгое `{}`.** Задача требует zod-контракт; `keepReservationBodySchema = z.strictObject({})` в `packages/contracts`, маршрут читает тело через `parseJson` и отвергает лишние ключи. Альтернатива — POST без тела, как `DELETE .../reservation` 5.2; если команда предпочтёт её, уходят схема и `parseJson`, остальное не меняется.
4. **Ответ keep — owner card — решено.** Карточка уже содержит `ownerAction`; `{ id }` заставил бы экран перечитывать список. Владельцу не добавляются `dueAt`, `phase`, `bought` (AD-7), поэтому новый срок он не видит — это осознанно.
5. **Тост после keep — решено: без тоста.** Текста в источниках нет; полоса исчезает и строка брони меняется на «Забронирован»/«Берёт …». Если UX захочет подтверждение, это новая строка каталога и отдельное решение.
6. **Полоса в карточке — вне нажимаемой зоны — решено.** Вкладывать кнопки в кнопку карточки нельзя (вложенные интерактивные элементы). `apps/mobile/src/ui/gift-card.tsx` оборачивает карточку в `YStack` той же ширины и ставит полосу ниже `UiWishCard`; `packages/ui` не меняется. Визуально полоса остаётся частью ячейки карточки.
7. **Факт `ownerAction` в детали — решено: не дублировать.** Когда полоса показана, `wish-detail-dialog` отфильтровывает факт с `id="ownerAction"`; текст остаётся один раз. `detail-fields.ts` не меняется.
8. **Догон пропущенных запусков — решено: один шаг за прогон.** `phaseAt=now` на каждом переходе (AD-9) означает: после простоя строка пройдёт шаги в следующие часы, а не все сразу. Это соответствует «пропуск запуска только сдвигает переходы» (ARCH-A15); обратное (считать окна от `dueAt`) противоречило бы AD-9.
9. **`failed` не в теле — решено.** Как в `wish-expiry`: частичный сбой виден планировщику как 500, но счётчик наружу не отдаётся. Метрики/алерты — вне 5.6.
10. **Включение прода — открытый вопрос для переноса в `main`.** После выкладки маршрут появится на проде, но расписание его не вызывает: в `reservation-timers.yml` только `cron-staging`. При переносе нужно добавить job `cron-production` (существующее окружение/секреты) и проверить первый запуск; до этого брони прода по сроку не двигаются. Решает координатор/Сергей вместе с выкладкой.
11. **Общие файлы со Story 5.4.** `gift-status.ts`, `gift-status-store.ts`, `i18n/app.json` (+тест), `wish-detail-dialog.tsx` (+тест/story) названы в задаче; вероятны также `apps/mobile/app/(app)/index.tsx`, `gift-card.tsx`, `detail-dialog.tsx` — 5.4 трогает меню/деталь забронированного. Порядок волн и разрешение конфликтов — за координатором; правки 5.6 не переписывают чужие участки.

## Code Map

**A. Домен, единственный писатель, события** *(⚠ общие с 5.4: `gift-status.ts`, `gift-status-store.ts` и их тесты)*
- `apps/web/src/domain/gift-status.ts` — константы `RESERVATION_GIVER_WINDOW_MS = 72 ч`, `RESERVATION_OWNER_WINDOW_MS = 168 ч`; чистые предикаты `canExpireToGiver`, `canAskOwner`, `canReleaseByExpiry`, `canKeepReservation` (границы включительно `≤`); `keptReservationDueAt(now, timeZone)`; типы `KeepReservationWrite`; новые `GiftStatusEventKind`; `GiftStatusEvent.actorId: string | null`; четыре метода в `GiftStatusTransaction`: `moveReservationToAwaitingGiver`, `moveReservationToAwaitingOwner`, `releaseReservationByExpiry`, `keepReservationByOwner`. Без Prisma.
- `apps/web/src/domain/gift-status.test.ts` — границы 72/168 ч (`==` проходит, `+1 мс` нет), `bought`, `GIVEN`, `status`, keep только `AWAITING_OWNER`, due «сегодня+7» в поясе и `UTC` fallback, DST-край.
- `apps/web/src/lib/gift-status-store.ts` — четыре `updateMany` с полными `where`/`data` (см. «Always»), `RESERVATION_RELEASE_DATA` для шага 3; `emit` с новыми `kind`; `actorId: null` у cron; `recordGiftEvent` пишет `kind`; `processReservationTimers(now, db)` рядом с `processWishExpiry`, батчи 500, пагинация по `id`, транзакция на строку, `try/catch` на строку, счётчики `expiredToGiver/askedOwner/released/failed`. `processWishExpiry`, `restoreFromArchive`, `reserveGift`, снятие/закрытие/продление не меняются.
- `apps/web/src/lib/gift-status-store.test.ts` — `where`/`data` каждого CAS, `count` 0/1, событие с `kind` и `actorId=null`, нет события на `lost`; `processReservationTimers`: три шага, порядок, повторный прогон, батч, ошибка строки, `bought`, `GIVEN`, `OPEN`/`CLOSED`.
- `apps/web/src/db/disposable-pg/release.pgtest.ts` — ожидание audit-строки дополняется `kind`; сам pg-тест в этой задаче не запускается (нужна одноразовая БД, см. правила).

**B. Cron-маршрут и keep** *(⚠ `gift-status-store.ts` — из A; `wish-expiry/route.ts` — только смена импорта)*
- `apps/web/src/lib/cron-auth.ts` (новый) — `cronAuthorized(request)`: `Authorization: Bearer ${getEnv().CRON_SECRET}`, SHA-256 обоих значений и `timingSafeEqual`; секрет не логируется.
- `apps/web/src/lib/cron-auth.test.ts` (новый) — нет заголовка, неверный, неверной длины, верный; отсутствие исключения.
- `apps/web/src/app/api/cron/reservation-timers/route.ts` (новый) — `POST`: проверка секрета → `processReservationTimers()`; `failed > 0` → пустой 500; успех → счётчики; прочие методы — `notFoundResponse`.
- `apps/web/src/app/api/cron/reservation-timers/route.test.ts` (новый) — 401 без/с неверным секретом и сервис не вызван; 200 только с тремя счётчиками; 500 пустой на исключении и на `failed>0`; лог без текста ошибки; `GET` 404.
- `apps/web/src/app/api/cron/wish-expiry/route.ts` — только импорт общей проверки вместо локальной копии; поведение и `route.test.ts` не меняются.
- `packages/contracts/src/gift.ts` — `keepReservationBodySchema = z.strictObject({})`, тип; `packages/contracts/src/index.ts` — экспорт; `packages/contracts/src/index.test.ts` — `{}` проходит, лишний ключ нет.
- `apps/web/src/actions/gift-reservation-keep.ts` (новый) — `keepReservation(headers, giftId, body)` и чистая `keepReservationResult(row, actorId)`; сессия, zod, `prisma.gift.findFirst` с `{ status, archivedAt, reservationPhase, reservationTimeZone, list.ownerId }`, `archivedValidation`/`notFound`/`conflict` из существующих хелперов (`actions/gifts.ts`), `now`, `keptReservationDueAt`, `runGiftStatusTransaction` → `keepReservationByOwner`, классификация `lost`, owner card через `ownerGiftSelect` + `toOwnerGiftCard` + `giftCardSchema.parse`.
- `apps/web/src/actions/gift-reservation-keep.test.ts` (новый) — 200 карточка с `ownerAction=null`; `phase`, `phaseAt`, `dueAt`, пояс и `bought`; 401/400/404/409; гонка; одно событие `RESERVATION_KEPT_BY_OWNER`, ноль на отказ.
- `apps/web/src/app/api/v1/me/gifts/[id]/reservation/keep/route.ts` (новый) — `POST` → `parseJson` → `keepReservation`; `GET/PUT/PATCH/DELETE` → `notFoundResponse`; Next 16: `params` — промис.
- `apps/web/src/app/api/v1/me/gifts/[id]/reservation/keep/route.test.ts` (новый) — тело `{}`, лишний ключ, не-JSON; 200/400/401/404/409; прочие методы 404.

**C. Workflow и документация** *(не пересекается с 5.4)*
- `.github/workflows/reservation-timers.yml` (новый) — см. «Always»; `permissions: contents: read`, `timeout-minutes: 10`, `curl --fail-with-body --max-time 120`, проверка staging-хоста в обе стороны (нет секрета — job падает, а не зовёт прод).
- `docs/deployment-environments.md` — подраздел «Таймеры брони (Story 5.6)»: тот же `CRON_SECRET`/`cron-staging`, staging-only, ручной запуск и `curl`, пропуск только откладывает переходы, шаг включения прода при переносе, миграции не нужны.

**D. Клиент владельца** *(⚠ общие с 5.4: `i18n/app.json` + тест, `wish-detail-dialog.tsx` + тест/story, вероятно `index.tsx`, `gift-card.tsx`, `detail-dialog.tsx`)*
- `packages/contracts/src/i18n/ru/app.json` — `app.gift.ownerRequest.received` «Получил», `app.gift.ownerRequest.keep` «Не получал, оставить бронь»; `packages/contracts/src/i18n/i18n.test.ts` — дословно и непусто.
- `packages/ui/src/detail-dialog.tsx` — необязательный слот `banner?: ReactNode`, рисуется в теле над фактами; без `notice`/фактов поведение прежнее. `detail-dialog.test.tsx`/`stories.tsx` — слот и компоновка.
- `apps/mobile/src/api/my-gifts.ts` — `keepReservation(id)`: `POST /me/gifts/:id/reservation/keep`, `content-type: application/json`, тело `{}`, разбор `giftCardSchema`; исходы `ok | network | invalid | code`, как у `fetchGift`. `apps/mobile/src/api/my-gifts.keep.test.ts` (новый) — тело, успех, сеть, `CONFLICT`, `NOT_FOUND`, `VALIDATION`.
- `apps/mobile/src/ui/owner-action-label.tsx` (новый) — `OwnerActionLabel` для `ownerAction="EXPIRED_NO_REPLY"`: текст `app.gift.ownerAction.EXPIRED_NO_REPLY`, кнопки «Получил»/«Не получал, оставить бронь», `busy`, `onReceived`, `onKeep`; `displayName`. `owner-action-label.test.tsx` (норма, busy, только нужные кнопки) и `.stories.tsx` (`App/OwnerActionLabel`: normal, busy, длинная кириллица, 360; `globals.viewport.value = "w360"`).
- `apps/mobile/src/ui/gift-card.tsx` — при `ownerAction=EXPIRED_NO_REPLY` не рисовать строку брони, обернуть `UiWishCard` в `YStack` той же ширины и положить полосу ниже; `pressLabel` включает текст полосы; новые пропсы `onOwnerReceived`, `onOwnerKeep`, `ownerBusy`. `gift-card.test.tsx`/`.stories.tsx` — полоса вместо строки, busy, отсутствие для `CONFIRM_GIVEN`, 360.
- `apps/mobile/src/ui/wish-detail-dialog.tsx` — новые пропсы `onKeep`, `ownerBusy`; при `ownerAction=EXPIRED_NO_REPLY` баннер `OwnerActionLabel` через `DetailDialog.banner`, факт `ownerAction` отфильтрован, «Отметить полученным» в футере скрыт, «Снять бронь» остаётся. `wish-detail-dialog.test.tsx`/`.stories.tsx` — действия полосы, busy, фильтр факта, 360.
- `apps/mobile/app/(app)/index.tsx` — `requestRelease` принимает карточку/id (не только `detail`), `cardMenuActionsFor` для `EXPIRED_NO_REPLY` даёт «Снять бронь» (destructive; деталь + preflight), обработчик keep с одним запросом на карточку, `replaceGift` ответом, тосты/перечитывание, `WishCard`/`WishDetailDialog` получают новые колбэки. `apps/mobile/src/session/my-wishlist-screen.test.tsx` — label→keep→полоса исчезла; ⋮→release; сеть/409; 360.
- `apps/mobile/src/ui/component-names.test.tsx` — проверка `displayName` новых компонентов (правок не требует, если имя задано).

**Документация**
- `_bmad-output/implementation-artifacts/deferred-work.md` — пункты из «Отложено» (секция Story 5.6).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **не трогать**.
- `_bmad-output/planning-artifacts/**` — **не трогать**.

## Tasks & Acceptance

Порядок волн: **A → B → (C ∥ D)**. C не зависит от кода и может идти сразу после согласования маршрута. D зависит от A (поля состояний) и B (keep), а по файлам пересекается с 5.4 — начинать после того, как 5.4 зафиксирует правки детали/меню, либо делить участки с координатором. A и B идут после/вместе с 5.4, потому что делят `gift-status.ts` и `gift-status-store.ts`.

### A — домен, единственный писатель, события
- [ ] `apps/web/src/domain/gift-status.ts` + `.test.ts` — окна 72/168 ч, четыре предиката с включительной границей, `keptReservationDueAt`, новые `kind`, nullable `actorId`, четыре метода транзакции; `bought`/`GIVEN`/`OPEN`/`CLOSED` не проходят.
- [ ] `apps/web/src/lib/gift-status-store.ts` + `.test.ts` — четыре CAS с полными `where`/`data`, `RESERVATION_RELEASE_DATA` на шаге 3, `count` 0/1, событие только на успех, `kind` в строке, `actorId=null` у cron.
- [ ] `processReservationTimers(now, db)` — порядок 1→2→3, один `now`, батчи 500 по `id`, транзакция на строку, `failed` без остановки, счётчики; повторный прогон — нули.
- [ ] `apps/web/src/db/disposable-pg/release.pgtest.ts` — ожидание audit-строки с `kind` (не запускать без одноразовой БД).

### B — cron-маршрут и keep
- [ ] `apps/web/src/lib/cron-auth.ts` + тест — та же проверка, что в `wish-expiry`; `wish-expiry/route.ts` переходит на неё без изменения поведения.
- [ ] `apps/web/src/app/api/cron/reservation-timers/route.ts` + тест — 401/200/500, только счётчики, прочие методы 404, лог без текста ошибки.
- [ ] `packages/contracts/src/gift.ts`, `index.ts`, `index.test.ts` — `keepReservationBodySchema` (`strictObject({})`) и экспорт.
- [ ] `apps/web/src/actions/gift-reservation-keep.ts` + тест — сессия, zod, `VALIDATION`/`NOT_FOUND`/`CONFLICT`, `AWAITING_OWNER` только, `dueAt` «сегодня+7» в сохранённом поясе, `bought`/пояс без изменений, owner card, событие один раз.
- [ ] `apps/web/src/app/api/v1/me/gifts/[id]/reservation/keep/route.ts` + тест — `POST` + `parseJson`, прочие методы 404.
- [ ] Убедиться, что `DELETE .../reservation` (5.2) и `PATCH /me/reservations/:giftId` (5.5) не менялись и их тесты зелёные.

### C — workflow и документация
- [ ] `.github/workflows/reservation-timers.yml` — hourly `20 * * * *`, `cron-staging`, проверка `https://staging.`, `workflow_dispatch`, `concurrency`, `curl` под секретом, без прода и без новых секретов.
- [ ] `docs/deployment-environments.md` — таймеры брони: секрет/окружение, staging-only, ручной запуск, включение прода при переносе, миграций нет.
- [ ] Проверить YAML глазами (нет `actionlint` в зависимостях и ставить его нельзя): `on`, `permissions`, `environment`, `secrets`, `curl`, отсутствие `cron-production`.

### D — клиент владельца
- [ ] `packages/contracts/src/i18n/ru/app.json` + `i18n.test.ts` — две строки дословно.
- [ ] `packages/ui/src/detail-dialog.tsx` + тест/story — слот `banner`.
- [ ] `apps/mobile/src/api/my-gifts.ts` + `.keep.test.ts` — keep-клиент и исходы.
- [ ] `apps/mobile/src/ui/owner-action-label.tsx` + тест/story — полоса, две кнопки, busy, 360, длинная кириллица, `displayName`.
- [ ] `apps/mobile/src/ui/gift-card.tsx` + тест/story — полоса вместо строки, обёртка ширины, `pressLabel`, menu release, отсутствие для `CONFIRM_GIVEN`.
- [ ] `apps/mobile/src/ui/wish-detail-dialog.tsx` + тест/story — баннер, фильтр факта, keep/received/release, busy.
- [ ] `apps/mobile/app/(app)/index.tsx` + `my-wishlist-screen.test.tsx` — keep, ⋮→release+preflight, busy, сеть/409, полоса исчезает; 360.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` — «Отложено».

**Acceptance Criteria:**
- Given `RESERVED/ACTIVE` и `dueAt ≤ now`, when cron, then ровно один CAS в `AWAITING_GIVER` с `phaseAt=now`, одно событие `RESERVATION_GIVER_DEADLINE_PASSED` и `expiredToGiver=1`.
- Given `AWAITING_GIVER` и `phaseAt` ровно `now−72 ч` (или старше), when cron, then `AWAITING_OWNER`, `phaseAt=now`, событие `RESERVATION_OWNER_ASKED`; на `+1 мс` раньше — ничего.
- Given `AWAITING_OWNER`, `phaseAt` ровно `now−168 ч` и `bought=false`, when cron, then `OPEN` с очищенными колонками брони, событие `RESERVATION_RELEASED_BY_EXPIRY`, `released=1`; при `bought=true`, `GIVEN`, `OPEN`, `CLOSED` или архиве — ничего.
- Given успешный прогон, when он повторяется с тем же `now`, then счётчики 0 и новых событий нет; при гонке с продлением/снятием/закрытием/keep ровно один переход.
- Given одна упавшая строка, when cron, then остальные обработаны, `failed=1`, ответ — пустой 500; в логе и ответе нет названий и id.
- Given `/api/cron/reservation-timers` без/с неверным секретом, when запрос, then 401 `UNAUTHENTICATED` и сервис не вызван; при успехе тело — только три счётчика.
- Given владелец и `RESERVED/AWAITING_OWNER`, when keep, then 200 owner card, `phase=ACTIVE`, `phaseAt=now`, `dueAt` — конец «сегодня+7» в сохранённом поясе, `bought` и пояс не изменены, `ownerAction=null`, одно событие `RESERVATION_KEPT_BY_OWNER`.
- Given чужой id, другая фаза, `OPEN`/`CLOSED`, архив, пустое/лишнее тело или аноним, when keep, then 404/409/409/400/400/401 соответственно, без записи и без события.
- Given `ownerAction=EXPIRED_NO_REPLY`, when владелец открывает карточку/деталь, then полоса «Срок брони истёк» с «Получил»/«Не получал, оставить бронь», «Снять бронь» в ⋮ карточки и коралловой в детали; `CONFIRM_GIVEN` ведёт себя как в 5.5.
- Given нажато «Получил», when подтверждение 5.3, then желание закрывается как раньше; given «Не получал, оставить бронь», then карточка заменяется ответом и полоса исчезает.
- Given 360 px и длинная кириллица, when каталог, then полоса и кнопки не переполняются; `displayName` задан.
- Given схема Prisma и миграции, when проверка, then изменений нет; `npm run typecheck`, `npm run lint` и тесты трёх пакетов зелёные.

## Implementation Notes

— (заполняется при реализации)

## Spec Change Log

- 2026-11-20 (CLE-121, рамки координатора): cron-цикл из трёх CAS + keep T6; уведомления не делаются (вариант A, `recordGiftEvent`, новые `kind`, ровно одно событие на переход); `processReservationTimers` батчами, идемпотентно; `bought=true` не открывается, `GIVEN` не трогается; keep — новый владельческий эндпоинт с zod; workflow только staging; миграции нет; общие с 5.4 файлы помечены.

## Review Triage Log

— (заполняется при ревью)

## Design Notes

**Почему cron пишет события, хотя статус не меняется.** До 5.6 `recordGiftEvent` фиксировал только смену `Gift.status` (5.5 это подчёркивала). Но у таймеров брони три из четырёх переходов не меняют статус, и без записи они не оставляют следа: повторный запуск защищён CAS, однако факт «владельцу задан вопрос» или «срок истёк» нигде не виден. Поэтому шов расширяется до жизненного цикла брони: `kind` называет переход, `actorId=null` — систему будит cron. Это по-прежнему не `Notification` и не письмо; вариант B (строка `Notification` в той же транзакции) заменит только тело `recordGiftEvent`.

**Почему транзакция на строку, а не на пачку.** Одна плохая строка не должна откатывать 499 хороших; событие пишется после коммита своей строки, поэтому откат не оставляет ложной audit-строки. Цена — до 500 коротких транзакций за шаг; это почасовой фон, не пользовательский запрос. Батч ограничивает память и время ответа.

**Почему `phaseAt=now`, а не расчёт от `dueAt`.** AD-9 прямо задаёт окна от `reservationPhaseAt`. Если считать 72/168 ч от `dueAt`, пропущенный запуск мог бы «перескочить» сразу в `OPEN`, не дав владельцу шанса ответить. Один шаг за прогон гарантирует, что вопрос владельцу существует не меньше суток, даже после простоя.

**Почему keep не трогает `reservationTimeZone` и `bought`.** Пояс — снимок зоны держателя на момент брони (ARCH-A14); владелец не должен переписывать его своей зоной. `bought` — отметка держателя, а не ответ владельца; её снимает только держатель. Новый `dueAt` — конец дня «сегодня+7» в этом же поясе, поэтому следующий тик cron снова увидит будущую дату.

**Почему keep возвращает карточку.** Владелец не получает `dueAt`/`phase`/`bought` (AD-7), но получает `ownerAction`; после keep он должен стать `null`. Ответ карточкой избавляет экран от лишнего чтения и не добавляет владельцу полей брони.

**Почему полоса вне нажимаемой зоны карточки.** В карточке основная зона — кнопка. Кнопки «Получил»/«Не получал…» внутри неё были бы вложенными интерактивными элементами (недоступно с клавиатуры и для скринридера). Обёртка той же ширины ставит полосу сразу под карточкой; визуально это часть ячейки, а Tab идёт: карточка → полоса → ⋮.

**Почему факт `ownerAction` скрывается в детали.** Полоса уже говорит «Срок брони истёк»; второй такой же строки в фактах не нужно. Фильтр — в `wish-detail-dialog`, контракт фактов не меняется.

**Тексты.** «Срок брони истёк» (`app.gift.ownerAction.EXPIRED_NO_REPLY`) — уже в каталоге; «Получил» и «Не получал, оставить бронь» — дословно из `epics.md` Story 5.6/5.7 и `DESIGN.md` → OwnerActionLabel; «Снять бронь» — существующие `app.gift.release.confirm`/`app.reservations.release`. Новых несогласованных текстов нет. Тексты уведомлений («Срок брони «Y» истёк, даритель пока не ответил. Подарок уже у вас?», «Владелец продлил вашу бронь «Y» до DD.MM», «Бронь «Y» снята: срок истёк, ответа не было») остаются Epic 6 и в каталог 5.6 не добавляются.

**Сеть и состояния.** Keep — одно действие без диалога; `busy` блокирует обе кнопки полосы и повторное нажатие. Сеть — `app.form.network`; `CONFLICT`/`NOT_FOUND` — тихое перечитывание списка и общий текст ошибки, как в 5.5; `UNAUTHENTICATED` — существующий выход. «Получил» и «Снять бронь» не переписываются: это шаги 5.3 и 5.2.

## Отложено

- Уведомления и письма по всем четырём переходам и keep (держателю «Срок брони «Y» истёк» с действиями; владельцу «Срок брони «Y» истёк, даритель пока не ответил. Подарок уже у вас?»; обоим «Бронь «Y» снята: срок истёк, ответа не было»; держателю «Владелец продлил вашу бронь «Y» до DD.MM») — Epic 6, `Notification`/Resend, без `deliverAfter` (события немедленные). 5.6 пишет только audit-строку.
- `CONFIRM_GIVEN` и полоса для `GIVEN` с действиями «Получил»/«Не получал» — Story 5.7.
- «Подарил», переход в `GIVEN`, остановка таймеров в `GIVEN` — Story 5.7; 5.6 только не трогает `GIVEN`.
- Полный suite AD-15 (пункты 6 и 7 — cron/bought/GIVEN и гонки) и pg-тесты на настоящей одноразовой БД — Story 5.8; 5.6 даёт доменные/CAS-тесты, на которые suite опирается.
- Job `cron-production` и первый запуск на проде — при переносе `staging → main` (см. «Открытые вопросы» п. 10).
- Тост после keep и любой новый текст подтверждения — вопрос UX, вне 5.6.
- Метрики/алерты по `failed` и разбору упавших строк — вне 5.6; сейчас частичный сбой виден только как 500 в Actions.
- Догон «сразу в OPEN» после долгого простоя не делается: каждый переход ждёт своего окна от `phaseAt` (ARCH-A15).
- Окно между коммитом и записью audit-строки: падение процесса в этот момент теряет строку (CAS уже прошёл). В варианте B Epic 6 запись уйдёт в ту же транзакцию.
- Backfill не нужен: существующие просроченные брони обработаются первыми прогонами по одному шагу в час.

## Verification

**Commands:**
- `npm run test -w @gift-list/contracts` — `keepReservationBodySchema`, строгий `{}`, i18n-строки.
- `npm run test -w @gift-list/web` — домен, стор, `processReservationTimers`, `cron-auth`, cron-маршрут, keep-действие и маршрут; границы, `bought`, `GIVEN`, повтор, гонки, батчи, 401/400/404/409.
- `npm run test -w @gift-list/mobile` — API keep, полоса, карточка, деталь, экран; `displayName`, 360.
- `npm run typecheck` — без ошибок.
- `npm run lint` — без ошибок, `check-boundaries` чист.
- `npm test` — все пакеты зелёные.
- `npm run build` и `npm run build-storybook` — выполняет координатор в конце, не подзадача; dev-серверы в этой задаче не запускаются.
- Миграции не запускаются: `prisma migrate deploy/dev/reset` и `db push` запрещены; к staging/prod не подключаться.

**Manual checks (после мержа, только staging):**
- Actions → Reservation timers → Run workflow: 200 с тремя счётчиками; неверный секрет даёт 401 и сервис не трогает строки.
- Локально/на staging с тестовой бронью: `dueAt` в прошлом → первый прогон даёт «Срок истёк»; `phaseAt` старше 72 ч → у владельца «Срок брони истёк» с кнопками; старше 168 ч и `bought=false` → бронь снята; с `bought=true` — висит с меткой; `GIVEN` не меняется.
- Владелец: «Не получал, оставить бронь» → фаза `ACTIVE`, у держателя в «Моих бронях» новый срок; «Получил» → закрытие 5.3; ⋮ → «Снять бронь» → шаг 5.2.
- Повторный запуск workflow сразу после первого: счётчики 0, новых переходов нет.
- Прод не вызывается: в workflow нет `cron-production`, `APP_URL` в job — staging.
