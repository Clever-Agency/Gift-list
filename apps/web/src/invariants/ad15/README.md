# Suite AD-15 — инварианты брони, видимости и анонимности

Одна точка входа к обязательным инвариантам AD-15, которые эпик 5 требует до merge. Здесь нет ни продуктового кода, ни второго дома для существующих тестов: канонические тесты остаются рядом с тем, что проверяют (`domain/`, `actions/`, `lib/`, `app/**/route.test.ts`), а эта папка хранит карту «инвариант → тест» и только те сценарные проверки, которых до сих пор не было.

Ни `apps/web`, ни `apps/mobile` этот каталог не импортируют: Next его не бандлит, прирост web-бандла — 0 байт.

## Как запускать

```bash
# только suite
npm run test -w @gift-list/web -- src/invariants/ad15

# весь набор веба (то же, что делает CI)
npm run test -w @gift-list/web
```

Файлы попадают в обычный прогон через существующий `apps/web/vitest.config.ts` (`include: ["src/**/*.test.{ts,tsx}"]`). Отдельного конфига, скрипта и раннера нет.

Настоящая гонка двух транзакций живёт в `db/disposable-pg/*.pgtest.ts`: это `*.pgtest.ts`, он требует одноразового PostgreSQL и в `npm test` (а значит, и в CI) не входит. Ручной прогон `npm run verify:reserve-concurrency` — шаг перед merge эпика 5, см. «Отложено» и «Открытый вопрос 1» спеки.

## Правило тега

Каждый тест этой папки называется `describe("AD-15 (n) — …")`, где `n` — номер пункта AD-15 из `ARCHITECTURE-SPINE.md` и Story 5.8. Номер в имени — единственная связь, которую видно и в выводе `vitest`, и поиском по `src`. Один тест — один инвариант; уже покрытое не копируется, а указывается здесь файлом и именем теста.

Тесты детерминированы: сеть и БД не трогаются (`vi.mock("server-only")`, моки `@/db/client`, `@/lib/auth`, `@/lib/relationships`), время передаётся явно. Фикстуры — вымышленные ники и названия.

## Карта инвариантов

Пути указаны от `apps/web/src/`. «CI» — входит ли проверка в `npm test`; `*.pgtest.ts` в CI не входит.

| № | Инвариант (AD-15 / Story 5.8) | Канонический тест | Уровень / CI | Статус |
|---|---|---|---|---|
| 1 | Две параллельные брони `SINGLE` → ровно одна успешна | `actions/gift-reserve.test.ts` — «answers CONFLICT with RESERVATION_TAKEN when CAS loses», «returns the holder card when the same person already holds the wish»; `lib/gift-status-store.test.ts` — «reserves an OPEN SINGLE row with CAS and answers lost when the row moved»; `db/disposable-pg/reserve.pgtest.ts` — «lets exactly one of two concurrent reserves win» | use-case (мок) + стор (мок) в CI; Prisma-гонка — отдельно, **вне CI** | Частично: нет двух одновременных `reserveGift` в CI; добавляет `reservation-race.test.ts` (S2). Prisma-путь — ручной прогон |
| 2 | Аноним по `/l/:token` получает только `PUBLIC` и не узнаёт число остальных | `app/api/v1/l/[...token]/route.test.ts` — «gives an anonymous link visitor only PUBLIC gifts and names the owner», «names the owner with an empty list when every wish is FRIENDS, SECRET or archived»; `app/l/[token]/link-page.test.ts` — «renders only PUBLIC wishes and the owner's public name and nick»; `domain/visibility.test.ts` — «keeps only PUBLIC for an anonymous visitor with the list link» | use-case + маршрут + домен, мок, CI | Покрыто; `link-anonymity.test.ts` (S1) сверяет страницу и `api/v1` между собой |
| 3 | `Block` + валидный токен → HTTP 404 `NOT_FOUND`, неотличимый от неизвестного | `app/api/v1/l/[...token]/route.test.ts` — «answers a block, an unknown token and a malformed token with one byte-identical 404» (статус, тело и все заголовки, кроме `date`) | use-case + маршрут, мок, CI | Покрыто полностью; нового теста нет |
| 4 | unfriend + активная бронь → карточка брони остаётся, остальные желания закрыты | `actions/my-reservations.test.ts` — «keeps the card after an unfriend and closes only the detail», «carries no list token, visibility or other wish data», «keeps the card on a block in either direction»; `actions/wishlist-friendship.test.ts` — «closes FRIENDS wishes in the profile and by the list link, leaving PUBLIC only» | use-case, мок, CI | Покрыто по частям, одним сценарием — `card-privacy.test.ts` (S3) |
| 5 | Владелец не получает держателя ни в gift card, ни в Notification, ни в письме — никогда, даже в старой строке с `holderVisibleToOwner=true`: имя дарителя владельцу не отдаётся никогда, а флаг в ответах всегда `false` (D-49, S9). `bought` и прочие признаки брони владельцу не отдаются | `actions/my-gifts.test.ts` — «hides the holder and the owner action in the %s phase», «hides the past holder of a closed wish with the toggle on»; `domain/owner-gift-card.test.ts` — «keeps the past holder of a closed wish hidden with the toggle on»; `lib/notification-store.test.ts` — «hides an owner's $kind row from every read path», «drops a legacy holderName from the owner e-mail even with the old true flag»; `invariants/ad15/owner-symmetry.test.ts` — «AD-15 (5) — владелец не отличает забронированное желание от открытого» | use-case + домен + проекция уведомлений, мок, CI | Покрыто: случаи `bought=true` и всех фаз — `card-privacy.test.ts` (S3) и `owner-symmetry.test.ts` (CLE-124 S3). Лента и письмо — CLE-124 S9 |
| 6 | cron снимает любую живую бронь (включая `bought=true` и `GIVEN`) не раньше чем через 168 ч после `reservationDueAt`, уведомляет только держателя, никогда не ставит `CLOSED`/«Получено» и не пишет владельцу | `domain/gift-status.test.ts` — «releases a GIVEN reservation once the deadline is 168 hours old», «refuses the %s phase»; `lib/gift-status-store.test.ts` — «reads live RESERVED candidates: steps 1–2 by phase, step 3 from AWAITING_OWNER or GIVEN», «releases AWAITING_OWNER or GIVEN when the deadline is 168 hours old, with the 5.2 clear and no `bought` in the CAS»; `app/api/cron/reservation-timers/route.test.ts` — счётчики прогона | домен + стор (мок) + маршрут, CI | Покрыто: сценарный прогон `processReservationTimers` на строках `bought=true` и `GIVEN` — `timer-races.test.ts` (S4, переписан в CLE-124 S9b-1); граница 168 ч от срока и порядок шагов — там же (CLE-124 S5) |
| 7 | Гонка cron-таймера и действия держателя/владельца → ровно один переход | `lib/gift-status-store.test.ts` — «reports the transition only after the transaction committed», «finds nothing and reports zeros when the run repeats with the same now», «counts a CAS that touched two rows as lost and keeps the log silent» | стор (мок), CI | Покрыто на фейке: «пользователь изменил строку до CAS cron» — `timer-races.test.ts` (S4). Владельческого действия «оставить бронь» больше нет (CLE-124/D-49). Настоящая гонка двух транзакций — только руками (pg-тест вне CI) |
| 8 | Отмена закрытия после `UNDO_WINDOW` → `CONFLICT` | `actions/gift-close.test.ts` — «answers UNDO_WINDOW_EXPIRED for a wish closed %s ago» (граница «exactly ten minutes ago» и «one millisecond after»); `domain/gift-status.test.ts` — `canUndoClose`, «refuses a wish closed one millisecond after the window»; `lib/gift-status-store.test.ts` — «answers lost and logs nothing when the undo CAS touches no row» | use-case + домен + стор, мок, CI | Покрыто полностью; нового теста нет |
| 9 | `UNLIMITED` → отказ брони | `actions/gift-reserve.test.ts` — «answers VALIDATION for UNLIMITED before CAS»; `lib/gift-status-store.test.ts` — CAS по `quantity: "SINGLE"`; `db/disposable-pg/reserve.pgtest.ts` — блок `UNLIMITED` (вне CI) | use-case + стор (мок), CI; Prisma — отдельно | Покрыто; нового теста нет |
| 10 | Подписчик не получает `FRIENDS` и даты | `domain/visibility.test.ts` — «AD-15-10 - a subscriber sees PUBLIC only»: «opens PUBLIC but never FRIENDS or SECRET», «keeps only PUBLIC in a whole list read and grants no friendship», «narrows the database filter to PUBLIC»; `domain/subscription.test.ts` — «is not a friendship: the subscriber fact opens PUBLIC and never FRIENDS (D-31)» | домен (политика), мок, CI | Покрыто; `subscriber.test.ts` (S1) проверяет тот же инвариант через `readWishlist`. Даты — Epic 7, см. «Отложено» |
| 11 | Регистрация по `/l/` не создаёт `Friendship`, по `/i/` создаёт | `actions/register.test.ts` — «creates no friendship and no subscription from a /l/ next path (AD-15-11)», «creates the friendship in the registration transaction when the invite token is live (AD-21)»; `actions/invite-link.test.ts` — «creates the edge once and answers FRIENDS» | use-case, мок, CI | Покрыто полностью; нового теста нет |
| 12 | Сопоставление телефонов не пишет сырые номера | — | — | Отложено: в `schema.prisma` нет `phoneE164`/`phoneHmac`, `ContactMatch` и экрана «Найти знакомых». Владелец — Story 8.1 |
| 14 | Страница владельца `/gifts/{id}` читает только `GET /api/v1/me/gifts/:id`, не получает `reservation`, `reservedBy`, `status=RESERVED`, срока и этапа; анонимная `/l/:token/:giftId` не отдаёт ничего сверх `/l/:token` (D-63) | `actions/gifts.test.ts` (карточка владельца); `owner-symmetry.test.ts` — «одинаково отвечает на список, одну карточку и свой профиль»; `invariants/ad15/link-anonymity.test.ts` — «AD-15 (14) — анонимная /l/:token/:giftId» | use-case + страница, мок, CI | Покрыто: страница владельца — `owner-page.test.ts` (CLE-129 T4.3); анонимная страница желания — `link-anonymity.test.ts` (CLE-129 T4.5) |

### Новые тесты suite

| Файл | `describe` | Что проверяет | Подзадача |
|---|---|---|---|
| `invariants/ad15/owner-page.test.ts` | `AD-15 (14) — страница владельца /gifts/{id} без признаков брони` | чтение одной карточки владельца не спрашивает у БД колонки брони (`reservedBy`, `reservedById`, `reservation*`, `holderVisible*`) и отвечает на забронированное желание так же, как на открытое: точный набор полей карточки, ни держателя, ни `bought`, ни `dueAt` | CLE-129 T4.3 |
| `invariants/ad15/link-anonymity.test.ts` | `AD-15 (2) — аноним по /l/:token видит только PUBLIC`, `AD-15 (14) — анонимная /l/:token/:giftId` | страница `loadLinkPage` и `getWishlistByToken` отдают один и тот же PUBLIC-набор и одного владельца; скрытых названий, `publicToken`, `archived*` и счётчиков нет. Страница одного желания отдаёт ровно ту же карточку, а чужой, скрытый, архивный и неизвестный id и Block получают один `not_found` | S1, T4.5 |
| `invariants/ad15/subscriber.test.ts` | `AD-15 (10) — подписчик получает только PUBLIC` | `readWishlist` с `subscriber=true`, `friend=false`: PUBLIC виден, FRIENDS/SECRET/архив — нет; ключи ответа — `access` и `gifts` | S1 |
| `invariants/ad15/reservation-race.test.ts` | `AD-15 (1) — две одновременные брони SINGLE` | два `reserveGift` через общий атомарный фейковый CAS: ровно один успех, второй `CONFLICT`/`RESERVATION_TAKEN`, проигравший не пишет | S2 |
| `invariants/ad15/card-privacy.test.ts` | `AD-15 (4) — unfriend при активной брони`, `AD-15 (5) — владелец при holderVisibleToOwner=false` | карточка брони жива после unfriend и Block; в карточке владельца нет держателя, `bought`, `dueAt` и `reservation` | S3 |
| `invariants/ad15/owner-symmetry.test.ts` | `AD-15 (5) — владелец не отличает забронированное желание от открытого` | один и тот же ответ владельцу на открытое и забронированное (все фазы, `bought` да/нет): список, карточка, свой `/u/:nick`, PATCH (название, `quantity` в обе стороны, расширение и сужение видимости), preview, закрытие, отмена закрытия, возврат из архива, удаление; маршрутов брони у владельца нет — любой id даёт один 404 | CLE-124 S3 |
| `invariants/ad15/timer-races.test.ts` | `AD-15 (6) — cron снимает любую живую бронь через 168 ч`, `AD-15 (7) — гонка cron и пользователя` | `processReservationTimers` снимает `bought=true` и `GIVEN` через 168 ч с срока (держателю уведомление, владельцу ничего, статус `OPEN`, не `CLOSED`), не трогает их внутри окна, не шлёт `GIVEN` напоминаний и не переписывает строку, которую пользователь изменил до CAS; напоминание за 48 ч — только держателю, одно на срок и повторно после продления (CLE-124 S9b-2) | S4, переписан в CLE-124 S9b-1 и S9b-2 |
| `invariants/ad15/given-mail.test.ts` | `AD-15 (5) — письмо владельцу после «Подарил» без деталей` | общее письмо владельцу не содержит названия желания, дарителя, `giftId` и действия; уходит только почтой и не появляется в ленте | CLE-124 S9b-2 |

## Отложено

| Инвариант | Что не проверено | Где появится |
|---|---|---|
| (5) | Лента и письмо владельцу без имени держателя и `bought`, даже при старой строке с `holderVisibleToOwner=true` | Покрыто в CLE-124 S9: `lib/notification-store.test.ts` (лента и письмо) |
| (10) | Даты (`UserDate`) подписчику; поведение `visibility=everyone` (AD-23) требует решения | Epic 7; «Открытый вопрос» 2 |
| (12) | Сырые телефоны не попадают в БД и лог | Story 8.1 (`phoneE164`/`phoneHmac`, `ContactMatch`) |
| (1), (7), (9) | Настоящая гонка двух транзакций на живом PostgreSQL | `db/disposable-pg/*.pgtest.ts`, вне CI; ручной `npm run verify:reserve-concurrency` перед merge эпика 5, «Открытый вопрос» 1 |

Отложенное живёт здесь и в `_bmad-output/implementation-artifacts/deferred-work.md`, а не в зелёном прогоне: `it.skip`/`describe.skip`/`it.todo` для этих пунктов не используются.

## Ограничения, а не нарушения

- **Страница `/l` и «HTTP 404» из (3).** Вход с действующей сессией проверяет список и Block той же `VisibilityPolicy`, что и API. Неизвестный токен и Block дают HTTP 404 на самой странице. Перенаправление в SPA `/wishlist/:token` выполняется только для доступного списка.
- **Граница (11) — `next`, а не источник ссылки.** `register.ts` решает по возвратному пути: при `next`, начинающемся с `/wishlist/`, `inviteToken` игнорируется. Сервер не знает, по какой ссылке реально пришёл человек; граница держится на клиенте.
- **Строка `GIVEN` в (6)** создаётся фикстурой: полный цикл «Подарил» — Story 5.7 (CLE-124 S9b-2/S9b-3). С CLE-124 S9b-1 такая строка снимается таймером через 168 ч после `reservationDueAt`; строка `GIVEN` без `reservationDueAt` не снимается (условие по сроку её не выбирает).
