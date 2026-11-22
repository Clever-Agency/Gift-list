---
title: '5.8: Обязательные автотесты инвариантов (AD-15)'
type: 'feature'
created: '2026-11-22'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: 'e479f7e73f029799e1c1dff6ddd635133b460375'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-15 объявляет двенадцать обязательных инвариантов брони, видимости и анонимности, но они проверяются вразброс: часть — только на домене (`VisibilityPolicy`, `canReleaseByExpiry`), часть — только на сторе (`gift-status-store`), часть — только на маршруте (`/api/v1/l/:token`), а два инварианта (уведомления владельцу, сопоставление телефонов) опираются на ещё не сделанные истории. Нет одной точки, по которой видно покрытие; настоящая гонка двух транзакций живёт в `*.pgtest.ts`, который не входит в `npm test` и не гоняется в CI. Из-за этого «suite AD-15» существует только на словах, хотя эпик требует его до merge историй Epic 5.

**Approach:** Не переносить и не переписывать существующие тесты — они остаются каноническими там, где лежат. Рядом появляется одна явная точка `apps/web/src/invariants/ad15/`: README с таблицей «инвариант → канонический тест» и только те сценарные тесты, которых сейчас нет. Каждый тест suite помечен номером инварианта в `describe("AD-15 (n) — …")`, поэтому покрытие видно и из кода, и из README. Suite попадает в обычный `npm test` (`vitest.config.ts` уже включает `src/**/*.test.{ts,tsx}`), то есть в CI перед merge, без нового раннера, конфига и зависимостей. Тесты идут через use-case (`reserveGift`, `readWishlist`, `getMyReservations`, `getMyGifts`, `processReservationTimers`), а не только через домен, поэтому покрывают общий путь веба и приложения (AD-1). Настоящая гонка двух транзакций остаётся в `*.pgtest.ts` и в CI не входит: живой PostgreSQL в этой задаче недоступен (Docker запрещён), поэтому предложение по CI — «Открытый вопрос», а ручной прогон — шаг проверки перед merge Epic 5.

Найдено: (2), (3), (4), (8), (9), (11) закрыты существующими тестами; для (2) и (4) suite добавляет только недостающую кросс-проверку, а не дубль. (1) покрыт в CI на mock-уровне и на Prisma-уровне только стором, без use-case; (6), (7), (10) покрыты наполовину (домен/стор/политика без сценарного теста через use-case); (5) покрыт для gift card, но Notification и письма ещё не существуют; (12) невозможен до Story 8.1. Нарушений инвариантов в коде не найдено — есть только ограничения области проверки (см. «Design Notes» и «Найденные риски» в отчёте).

## Boundaries & Constraints

**Always:**
- Задача меняет только тесты, README suite и `deferred-work.md`. Продуктовый код `apps/**`, `packages/**`, `schema.prisma`, миграции, `.github/workflows/*`, `package.json` и lock не меняются.
- Suite живёт в `apps/web/src/invariants/ad15/` и попадает в `npm test` через существующий `apps/web/vitest.config.ts` (`include: ["src/**/*.test.{ts,tsx}"]`). Новый конфиг, скрипт или пакет не появляется. Файлы `*.pgtest.ts` в обычный прогон не добавляются.
- Каждый новый тест suite называется `describe("AD-15 (n) — …")`, где `n` — номер пункта AD-15 из `ARCHITECTURE-SPINE.md`/Story 5.8. Один тест — один инвариант; проверки, которые уже есть, не копируются, а указываются в README файлом и именем теста.
- Тесты (1)–(10) идут через use-case, а не только через домен: `reserveGift` (`actions/gift-reserve.ts`), `readWishlist` (`actions/wishlist-read.ts`), `readPublicWishlist`/`getWishlistByToken` (`actions/public-wishlist.ts`), `getMyReservations` (`actions/my-reservations.ts`), `getMyGifts` (`actions/my-gifts.ts`), `processReservationTimers` (`lib/gift-status-store.ts`), `undoGiftClose` (`actions/gift-close.ts`). Доменные тесты (`domain/**`) остаются опорой и не дублируются.
- Тесты детерминированы и не ходят в сеть/БД: `vi.mock("server-only")`, мок `@/db/client`, `@/lib/auth`, `@/lib/relationships`, как в соседних тестах. Время передаётся явно (`processReservationTimers(now, db)`) или фиксируется существующим способом (`vi.setSystemTime` в тестах с окном отмены); на «сегодня» проверки не завязаны.
- README suite — на русском, с таблицей всех 12 пунктов: канонический файл, имя теста, уровень (use-case/домен/стор/маршрут), отдельно «Отложено» с историей-владельцем. README пишется один раз в S1 сразу с полной таблицей, включая файлы S2–S4: это карта, а не исполняемая проверка.
- `deferred-work.md` дополняется одним разделом «Deferred from: Story 5.8 …» с пунктами: Notification/письмо для (5) — Story 6.1; даты для (10) — Epic 7; телефоны для (12) — Story 8.1; заметка про ручной pg-прогон и CI. Формат — как у соседних разделов (`source_spec` + `summary` + `evidence`).
- Закрытые тесты без секретов и реальных данных: фикстуры — вымышленные названия и ники; `.env*` не читаются.

**Never:**
- Правка продуктового кода, «починка» найденных ограничений, рефакторинг существующих тестов, их перенос, переименование или ослабление. Если инвариант нарушен — только запись в отчёт; исправление — отдельная задача.
- Новые зависимости, `npm install`, `npm exec` с загрузкой, новый раннер, `vitest`-конфиг, npm-скрипт.
- `*.pgtest.ts` в `npm test`/CI, запуск живой БД, Docker, `migrate deploy/dev/reset`, `db push`, подключение к staging/prod.
- Правка `.github/workflows/*`, GitHub Environments, секретов; `sprint-status.yaml`; `_bmad-output/planning-artifacts/**`.
- `it.skip`/`describe.skip`/`it.todo` как способ «закрыть» отложенный инвариант: отложенное живёт в README и `deferred-work.md`, а не в зелёном прогоне.
- Дублирование уже покрытых инвариантов: (3), (8), (9), (11) получают только ссылку в README; (2) и (4) — только недостающую кросс-проверку, которой сейчас нет.
- Новые тексты интерфейса: suite ничего не показывает пользователю, i18n-каталог не меняется.

## I/O & Edge-Case Matrix

### Инвентаризация (1)–(12)

Легенда уровня: **UC** — через use-case; **домен** — чистые правила; **стор** — `gift-status-store`/CAS; **маршрут** — Route Handler/страница; **Prisma** — настоящая БД. «CI» — входит ли в `npm test` (CI гоняет только его).

| № | Инвариант (AD-15 / Story 5.8) | Канонический тест сегодня | Уровень / CI | Чего не хватает |
|---|---|---|---|---|
| 1 | Две параллельные брони SINGLE → ровно одна success | `actions/gift-reserve.test.ts` — «answers CONFLICT with RESERVATION_TAKEN when CAS loses», «returns the holder card when the same person already holds the wish»; `lib/gift-status-store.test.ts` — «reserves an OPEN SINGLE row with CAS and answers lost when the row moved»; `db/disposable-pg/reserve.pgtest.ts` — «lets exactly one of two concurrent reserves win» | UC (mock) + стор (mock) в CI; Prisma — отдельно, **не в CI** | Нет двух одновременных вызовов `reserveGift` в CI; Prisma-путь проверен на сторе, не на use-case. S2 + «Открытый вопрос» 1 |
| 2 | Аноним по `/l/:token` получает только PUBLIC и не получает число остальных | `app/api/v1/l/[...token]/route.test.ts` — «gives an anonymous link visitor only PUBLIC gifts and names the owner», «names the owner with an empty list when every wish is FRIENDS, SECRET or archived»; `domain/visibility.test.ts` — «keeps only PUBLIC for an anonymous visitor with the list link», «exposes nothing but access, gifts, and role - no hidden counts or flags»; `app/l/[token]/link-page.test.ts` — «renders only PUBLIC wishes and the owner's public name and nick» | UC (маршрут → action → `readWishlist`) + домен, mock, CI | Покрыто. Нет одной проверки, что страница `/l` и `api/v1/l` отдают одинаковый видимый набор. S1 |
| 3 | Block + валидный token → HTTP 404 `NOT_FOUND`, статус/тело/заголовки как у неизвестного | `app/api/v1/l/[...token]/route.test.ts` — «answers a block, an unknown token and a malformed token with one byte-identical 404» (сравнивает статус, тело и все заголовки кроме `date`) | UC + маршрут, mock, CI | Покрыто полностью; нового теста нет, README ссылается |
| 4 | unfriend + активная бронь → reservation card без остальных желаний | `actions/my-reservations.test.ts` — «keeps the card after an unfriend and closes only the detail», «carries no list token, visibility or other wish data», «keeps the card on a block in either direction»; `actions/wishlist-friendship.test.ts` — «closes FRIENDS wishes in the profile and by the list link, leaving PUBLIC only» | UC, mock, CI | Две стороны проверены в разных файлах, нет одного сценария «вишлист закрыт, карточка жива». S3 |
| 5 | Владелец при `holderVisibleToOwner=false` не получает держателя в gift card, Notification и письме; `bought` владельцу не отдаётся | `actions/my-gifts.test.ts` — «keeps the holder hidden until they allow the owner to see them», «maps an owner card to the AD-12 contract» (точное равенство карточки); `domain/owner-gift-card.test.ts` — «shows the holder of a closed wish by the owner toggle» | UC + домен, mock, CI | Gift card покрыт; нет теста с `bought=true` и `phase=ACTIVE` на точный набор полей владельца. Notification и письма не существуют — Story 6.1. S3 |
| 6 | cron не переводит в OPEN брони с `bought=true` и в фазе GIVEN | `domain/gift-status.test.ts` — «never releases a gift the holder marked as bought»; `lib/gift-status-store.test.ts` — «reads only live RESERVED candidates of the three timer phases, never GIVEN or a closed wish», «releases AWAITING_OWNER after 168 hours with the 5.2 clear and `bought = false` in the CAS»; `app/api/cron/reservation-timers/route.test.ts` — только счётчики | домен + стор (mock) + маршрут, CI | Нет сценарного прогона `processReservationTimers` со строкой `bought=true` и строкой `GIVEN` на 168 ч с проверкой состояния, счётчиков и отсутствия audit-строки. S4 |
| 7 | Гонка cron-таймера и действия держателя/владельца → ровно один переход | `lib/gift-status-store.test.ts` — «writes and logs nothing when any of the four CAS writes touches 0/2 rows», «reports a transition only after the transaction committed», «finds nothing and reports zeros when the run repeats with the same now»; `actions/gift-reservation-keep.test.ts` — «answers CONFLICT and keeps the card when the CAS lost to the timer» | стор (mock) + UC (одно направление), CI | Нет сценария «пользователь изменил строку между выборкой кандидата и CAS cron» на уровне `processReservationTimers`; настоящая гонка двух транзакций — только руками. S4 + «Открытый вопрос» 1 |
| 8 | Отмена закрытия после `UNDO_WINDOW` → `CONFLICT` | `actions/gift-close.test.ts` — «answers UNDO_WINDOW_EXPIRED for a wish closed exactly ten minutes ago», «…one millisecond after»; `domain/gift-status.test.ts` — границы `canUndoClose`; `lib/gift-status-store.test.ts` — проигранный undo-CAS | UC + домен + стор, mock, CI | Покрыто полностью; нового теста нет |
| 9 | `UNLIMITED` → отказ брони | `actions/gift-reserve.test.ts` — «answers VALIDATION for UNLIMITED before CAS»; `lib/gift-status-store.test.ts` — CAS `quantity: "SINGLE"`; `db/disposable-pg/reserve.pgtest.ts` — блок `UNLIMITED` (отдельно, **не в CI**) | UC + стор (mock), CI; Prisma отдельно | Покрыто; нового теста нет |
| 10 | Подписчик не получает FRIENDS и даты | `domain/visibility.test.ts` — блок `AD-15-10 — a subscriber sees PUBLIC only`; `domain/subscription.test.ts` — «is not a friendship: the subscriber fact opens PUBLIC and never FRIENDS (D-31)» | домен (политика), mock, CI | Нет проверки через `readWishlist` (use-case). Даты (`UserDate`) не реализованы — Epic 7. S1 + «Отложено» |
| 11 | Регистрация по `/l/` не создаёт Friendship, по `/i/` создаёт | `actions/register.test.ts` — «creates no friendship and no subscription from a /l/ next path (AD-15-11)», «creates the friendship in the registration transaction when the invite token is live (AD-21)»; `actions/invite-link.test.ts` — «creates the edge once and answers FRIENDS» | UC, mock, CI | Покрыто полностью (тест живёт со Story 4.7); нового теста нет |
| 12 | Сопоставление телефонов не пишет сырые номера | — | — | Невозможно: в `schema.prisma` нет `phoneE164`/`phoneHmac`, `ContactMatch` и экрана «Найти знакомых»; Story 8.1 в backlog. «Отложено» |

### Новые тесты suite: сценарии и ожидания

| Тест | Given / When / Then | Что утверждается |
|---|---|---|
| S1 · AD-15 (2) | Даны PUBLIC, FRIENDS, SECRET и архивное желание; When аноним читает `/l/:token` одновременно через страницу `loadLinkPage` и action `getWishlistByToken`; Then оба ответа показывают одно и то же PUBLIC-желание и владельца | Одинаковый набор `id`/`title`; в обоих ответах нет FRIENDS/SECRET/архивных названий, нет `publicToken`, `archived`, `archivedTotal` и любого счётчика |
| S1 · AD-15 (10) | Ридер отношений отвечает `subscriber=true`, `friend=false`; When `readWishlist({ target: { ownerId } })`; Then список содержит только PUBLIC | FRIENDS/SECRET/архивные отсутствуют и в карточках, и в JSON; ключи ответа — `access` и `gifts` (без `owner` на чтении по `ownerId`, без `publicToken`/`archived*`); подписка не даёт `FRIENDS` |
| S2 · AD-15 (1) | Два вызова `reserveGift` на одну строку `OPEN`/`SINGLE` идут через `Promise.all`; общий фейковый стор реализует атомарный CAS (проверка и запись без `await` между ними); When оба доходят до записи; Then ровно один `{ ok: true }` | Второй — `CONFLICT` с `reason: RESERVATION_TAKEN`; в строке один `reservedById`; проигравший не пишет; карточка победителя проходит `giftCardSchema` |
| S3 · AD-15 (4) | Держатель забронировал желание; отношения с владельцем — не друг (unfriend) и, отдельным кейсом, Block; When держатель вызывает `readWishlist` по владельцу и `getMyReservations`; Then вишлист не показывает чужих желаний (пустой список при unfriend, закрытый гейт `null` при Block), карточка брони на месте | Ключи карточки — ровно `giftId, titleSnapshot, status, ownerNick, dueAt, phase, bought, holderVisibleToOwner, holderVisibleToOthers, canOpenGift`; в JSON нет остальных желаний, `visibility`, `publicToken`/`listToken` |
| S3 · AD-15 (5) | Строка владельца: `RESERVED`, `phase=ACTIVE`, `reservationBought=true`, `holderVisibleToOwner=false`, держатель есть; When `getMyGifts` (owner card) и `toOwnerGiftCard`; Then `reservedBy=null` | В карточке владельца нет `bought`, `dueAt`, `reservation`; `reservationLabel=null`; `ownerAction=null`; остальной набор полей совпадает с контрактом `GiftCard` |
| S4 · AD-15 (6) | Строка `RESERVED`/`AWAITING_OWNER`, `phaseAt=now−168 ч`, `bought=true`; отдельно строка `RESERVED`/`GIVEN`, `bought=false`; When `processReservationTimers(now)`; Then шаг 3 не срабатывает | `released=0`; `status` остаётся `RESERVED`; колонки брони не очищены; `console.info` не получил audit-строку |
| S4 · AD-15 (7) | Кандидат `AWAITING_OWNER` прочитан, но до CAS пользователь меняет строку (фейк: `updateMany` → `count=0`, состояние уже новое); When cron завершает прогон; Then перехода нет | `released=0`, audit-строки нет, состояние — пользовательское; повторный прогон с тем же `now` не даёт второго перехода |

</frozen-after-approval>

## Open Questions

1. **Живой PostgreSQL в CI.** Из тестов `ci.yml` гоняет только `npm test`; `verify:reserve-concurrency` (`reserve.pgtest.ts`, `release.pgtest.ts`), `verify:disposable-pg` и `verify:friendship-concurrency` запускаются вручную и требуют `DISPOSABLE_*`. Значит настоящая гонка двух транзакций перед merge Epic 5 не проверяется автоматически. Консервативное предложение: оставить `npm run verify:reserve-concurrency` обязательным ручным шагом перед merge Epic 5 (записать в чеклист эпика/PR) и не трогать workflow в 5.8; добавить сервис PostgreSQL в `ci.yml` — отдельным решением Евгения и Сергея (изменение workflow и секретов вне этой истории). Пока CI-гарантия для (1) — mock-тест use-case (S2) + CAS-тест стора.
2. **Инвариант (10) и даты.** Story 5.8 говорит «подписчик не получает FRIENDS и даты», но `UserDate` появится в Epic 7, а AD-23 разрешает `visibility=everyone` «любому зрителю профиля, включая подписчика». Ревью архитектуры (`review-adversarial-2026-10-28`, L4) предлагает сузить AD-15(10) до «при `visibility=friends` подписчик не получает даты» и проверить `everyone` отдельно. Сейчас suite проверяет только FRIENDS/PUBLIC; даты — «Отложено» до Epic 7. Решение о `everyone` — за Евгением и Сергеем; до него поведение не придумывается.
3. **Notification и письмо для (5).** До Story 6.1 нет ни модели `Notification`, ни транспорта, ни payload. Suite проверяет только gift card владельца; при появлении 6.1 тест на payload/письмо (нет держателя и `bought` при выключенном переключателе) должен быть добавлен в suite или в AC 6.1. Кто расширяет — решить при планировании Epic 6; запись в `deferred-work.md` делает S4.
4. **Телефоны для (12).** До Story 8.1 нет `phoneE164`/`phoneHmac`, `ContactMatch` и экрана «Найти знакомых». Инвариант невозможно проверить; тест «сырые номера не попадают в БД и лог» должен появиться вместе с 8.1. Запись в `deferred-work.md` — S4.
5. **Страница `/l` и «HTTP 404» из (3).** API отвечает байт-в-байт 404 (проверено). Страница для **вошедшего** посетителя сначала отдаёт 307 на SPA `/wishlist/:token` — одинаково для Block и неизвестного токена, а 404 показывает уже SPA. Для анонима страница отдаёт 404. Это сохраняет неразличимость, но буквальное «HTTP 404» относится к API/SPA, не к первому ответу страницы. Консервативно: считать инвариант выполненным (неразличимость важнее кода), зафиксировать в README. Если нужен именно 404 на странице для вошедшего — это изменение `link-page.ts` и отдельное решение.
6. **Граница (11) — `next`, а не источник ссылки.** `register.ts` решает, создавать ли дружбу, по возвратному пути: если `next` начинается с `/wishlist/`, `inviteToken` игнорируется (`register.ts`, строки 94–97). Сервер не знает, по какой ссылке реально пришёл человек. Клиент, который сам пришлёт `next: "/"` и валидный `inviteToken`, создаст дружбу; это не расширяет прав (токен и так даёт дружбу по `/i/`), но граница инварианта держится на клиенте. Консервативно: не менять; отметить в отчёте как ограничение, а не нарушение.

## Code Map

**Существующие тесты — канонические, не переносятся и не переписываются**

- Бронь и CAS: `apps/web/src/actions/gift-reserve.ts` + `.test.ts`; `apps/web/src/domain/gift-status.ts` + `.test.ts`; `apps/web/src/lib/gift-status-store.ts` + `.test.ts`.
- Prisma-гонка: `apps/web/src/db/disposable-pg/reserve.pgtest.ts`, `release.pgtest.ts`, `guard.ts`; конфиги `apps/web/vitest.pg.config.ts`, `vitest.pg-reserve.config.ts`; префлайт `apps/web/scripts/require-disposable-pg.mjs`.
- Видимость и ссылка: `apps/web/src/domain/visibility.ts` + `.test.ts`; `apps/web/src/actions/wishlist-read.ts` + `.test.ts`; `apps/web/src/actions/public-wishlist.ts`; `apps/web/src/app/api/v1/l/[...token]/route.test.ts`; `apps/web/src/app/l/[token]/link-page.ts` + `.test.ts`.
- Карточки: `apps/web/src/domain/owner-gift-card.ts` + `.test.ts`; `apps/web/src/domain/viewer-gift-card.ts` + `.test.ts`; `apps/web/src/domain/reservation-card.ts` + `.test.ts`; `apps/web/src/actions/my-gifts.ts` + `.test.ts`; `apps/web/src/actions/my-reservations.ts` + `.test.ts`.
- Закрытие и отмена: `apps/web/src/actions/gift-close.ts` + `.test.ts`.
- Cron: `apps/web/src/app/api/cron/reservation-timers/route.ts` + `.test.ts`; `processReservationTimers` в `lib/gift-status-store.ts`.
- Регистрация и дружба: `apps/web/src/actions/register.ts` + `.test.ts`; `apps/web/src/actions/invite-link.ts` + `.test.ts`; `apps/web/src/lib/friendship-store.ts`.
- CI: `.github/workflows/ci.yml` (шаг `Test` → `npm test`; сервиса PostgreSQL нет).
- Схема (для отложенных): `apps/web/src/db/schema.prisma` — нет `Notification`, `UserDate`, `phoneE164`/`phoneHmac`, `ContactMatch`.

**Новые файлы suite**

- `apps/web/src/invariants/ad15/README.md` — одна точка входа: как гонять, таблица 12 инвариантов → файл/имя теста, уровень и CI, «Отложено» с историей-владельцем. Пишется в S1 сразу целиком.
- `apps/web/src/invariants/ad15/link-anonymity.test.ts` — AD-15 (2): cross-adapter «страница `/l` и API согласны» (S1).
- `apps/web/src/invariants/ad15/subscriber.test.ts` — AD-15 (10): `readWishlist` для подписчика (S1).
- `apps/web/src/invariants/ad15/reservation-race.test.ts` — AD-15 (1): два параллельных `reserveGift` на общем фейковом CAS (S2).
- `apps/web/src/invariants/ad15/card-privacy.test.ts` — AD-15 (4) и (5): unfriend/Block + reservation card; owner card при выключенном переключателе и `bought=true` (S3).
- `apps/web/src/invariants/ad15/timer-races.test.ts` — AD-15 (6) и (7): `processReservationTimers` с `bought=true`, `GIVEN` и проигранным CAS (S4).

**Документация**

- `_bmad-output/implementation-artifacts/deferred-work.md` — раздел «Deferred from: Story 5.8 …» (S4).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — **не трогать**: ключ и статус ведёт владелец процесса.

## Tasks & Acceptance

Порядок волн: **S1 → S2 → S3 → S4**. Файлы подзадач не пересекаются; S1 пишет README сразу с полной таблицей, поэтому S2–S4 README не правят.

### S1 — каркас suite, README, (2) и (10)

- [ ] `apps/web/src/invariants/ad15/README.md` — зачем папка, как запускать (`npm run test -w @gift-list/web`, фильтр `src/invariants/ad15`), таблица всех 12 пунктов с каноническими файлами и именами тестов, отметки «покрыто / частично / отложено», отдельный список отложенного (6.1, Epic 7, 8.1) и правило тега `AD-15 (n)`.
- [ ] `apps/web/src/invariants/ad15/link-anonymity.test.ts` — `describe("AD-15 (2) — аноним по /l/:token видит только PUBLIC")`: мок `@/db/client`, `@/lib/auth` (сессия `null`), `@/lib/relationships`; фикстура PUBLIC/FRIENDS/SECRET/архив; вызвать `loadLinkPage` и `getWishlistByToken`; сравнить видимые `id`/`title` и проверить отсутствие скрытых названий, `publicToken`, `archived*` и счётчиков.
- [ ] `apps/web/src/invariants/ad15/subscriber.test.ts` — `describe("AD-15 (10) — подписчик получает только PUBLIC")`: `readWishlist({ viewer, target: { ownerId } }, { reader })` с `subscriber: true`, `friend: false`; PUBLIC виден, FRIENDS/SECRET/архив — нет; ключи ответа — `access` и `gifts`; комментарий, что даты — Epic 7 и в тесте их нет.
- [ ] README ссылается на (3), (8), (9), (11) без новых тестов: `route.test.ts` (3), `gift-close.test.ts` + `gift-status.test.ts` (8), `gift-reserve.test.ts` (9), `register.test.ts` + `invite-link.test.ts` (11).

### S2 — (1) гонка брони

- [ ] `apps/web/src/invariants/ad15/reservation-race.test.ts` — `describe("AD-15 (1) — две одновременные брони SINGLE")`: моки `@/lib/auth`, `@/db/client`, `@/lib/relationships`, `@/lib/gift-status-store` (фейковый `giftStatusTransaction` с атомарным CAS над общей строкой); два `reserveGift` через `Promise.all`; ровно один успех, второй `CONFLICT`/`RESERVATION_TAKEN`; один держатель; проигравший не писал; карточка победителя проходит `giftCardSchema`.
- [ ] В комментарии теста указать, что настоящая гонка двух транзакций — `db/disposable-pg/reserve.pgtest.ts`, вне CI, и что тест проверяет use-case и контракт CAS, а не блокировки PostgreSQL.

### S3 — (4) и (5): карточка после unfriend и приватность владельца

- [ ] `apps/web/src/invariants/ad15/card-privacy.test.ts` — `describe("AD-15 (4) — unfriend при активной брони")`: один и тот же держатель, отношения «не друг» и отдельно `blocked`; `readWishlist` по владельцу отдаёт пустой список (unfriend) или `null` (Block), `getMyReservations` отдаёт карточку; точный набор ключей карточки; в JSON нет других желаний, `visibility`, `publicToken`/`listToken`.
- [ ] `describe("AD-15 (5) — владелец при holderVisibleToOwner=false")`: `getMyGifts` на строке `RESERVED`/`ACTIVE`/`bought=true`/`holderVisibleToOwner=false` (и тот же mapper `toOwnerGiftCard` для точного набора полей); `reservedBy=null`; нет `bought`, `dueAt`, `reservation`; `reservationLabel=null`; `ownerAction=null`; в комментарии — что Notification и письмо появятся в 6.1 и проверяются там.

### S4 — (6), (7), отложенное

- [ ] `apps/web/src/invariants/ad15/timer-races.test.ts` — `describe("AD-15 (6) — cron не открывает bought и GIVEN")`: фейковая БД состояния, `findMany` отдаёт кандидата только по предикату, `updateMany` реализует CAS; строки `AWAITING_OWNER`/`bought=true` и `GIVEN`/168 ч; `released=0`, `status=RESERVED`, колонки целы, `console.info` пуст.
- [ ] `describe("AD-15 (7) — гонка cron и пользователя")`: кандидат прочитан, до CAS состояние меняется (фейк `updateMany` → `count=0`); `released=0`, audit пуст, пользовательское состояние сохранено; повторный прогон с тем же `now` не даёт второго перехода; комментарий со ссылкой на `gift-reservation-keep.test.ts` (обратное направление) и на отсутствие pg-гонки в CI.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` — раздел «Deferred from: Story 5.8 — обязательные автотесты инвариантов (CLE-122, 2026-11-22)»: (5) Notification/письмо → Story 6.1; (10) даты → Epic 7 и вопрос `everyone`/AD-23; (12) телефоны → Story 8.1; ручной pg-прогон и CI без PostgreSQL → «Открытый вопрос» 1.

**Acceptance Criteria:**
- Given `npm run test -w @gift-list/web`, when suite на месте, then все тесты `src/invariants/ad15/**` находятся существующим `vitest.config.ts` без правки конфига и проходят вместе с остальными.
- Given README suite, when его читает человек перед merge Epic 5, then по каждому из 12 пунктов видно: где канонический тест, через use-case ли он, входит ли в CI или отложен с историей-владельцем.
- Given любой новый тест suite, when открыт его файл, then в `describe` стоит `AD-15 (n)`, а инвариант проверяется через use-case, а не только через домен.
- Given два одновременных `reserveGift`, when оба доходят до CAS, then ровно один успешен, второй получает `CONFLICT`/`RESERVATION_TAKEN`, и проигравший не пишет.
- Given строка `bought=true` или `GIVEN` старше 168 ч, when идёт `processReservationTimers`, then шаг 3 её не трогает, счётчик `released` равен 0, audit-строки нет.
- Given подписчик, when читает `readWishlist`, then видит только PUBLIC и не видит FRIENDS/SECRET/архив.
- Given владелец при `holderVisibleToOwner=false` и `bought=true`, when получает owner card, then в ней нет держателя, `bought`, `dueAt` и `reservation`, а `reservationLabel=null`.
- Given diff подзадачи, when он готов, then в нём только файлы из «Твои файлы» этой подзадачи: продуктовый код, схема, миграции, workflow, `package.json`, `sprint-status.yaml` и planning artifacts не изменены.
- Given отложенные пункты, when прогон зелёный, then в нём нет `it.skip`/`it.todo`, а (5) Notification, (10) даты и (12) телефоны записаны в README и `deferred-work.md`.

## Implementation Notes

— (заполняется при реализации)

## Spec Change Log

- 2026-11-22 (CLE-122, рамки координатора): suite не переносит существующие тесты, а ссылается на них; одна точка `apps/web/src/invariants/ad15/` + тег `AD-15 (n)`; новых тестов семь сценариев в пяти файлах; (3), (8), (9), (11) закрыты существующими тестами; (5) Notification/письмо, (10) даты, (12) телефоны — «Отложено»; живой PostgreSQL в CI не добавляется, ручной прогон — шаг перед merge Epic 5; продуктовый код, схема, миграции, workflow и `package.json` не меняются.

## Review Triage Log

— (заполняется при ревью)

## Design Notes

**Почему suite — папка со ссылками, а не перенос тестов.** Канонические тесты уже стоят рядом с тем, что проверяют: домен — в `domain/`, CAS — в `lib/gift-status-store.test.ts`, HTTP-ответы — в `route.test.ts`. Перенос в `invariants/ad15/` дал бы большой diff без новой проверки и риск потерять историю/ревью. Поэтому suite — это README-карта плюс только те сценарии, которых нет. Так «одна точка» остаётся точкой входа, а не вторым домом для всех тестов.

**Почему тег в `describe`.** Номер инварианта в имени — единственная связь, которую нельзя забыть обновить: её видно в выводе `vitest` и в поиске по `src`. README повторяет ту же нумерацию, поэтому покрытие читается и человеком, и грепом. Формат `AD-15 (n) — …` перекликается с уже существующими тегами `AD-15-10`/`AD-15-11`, только с пробелом и скобками для читаемости.

**Что именно добавлено и почему не больше.** (1): существующий mock-тест проверяет один проигранный CAS, но не два одновременных вызова use-case; pg-тест — стор, не use-case. (2): страница и API проверены порознь, но не сравнены. (4): unfriend и «Мои брони» проверены в разных файлах, нет одного сценария. (5): нет случая `bought=true` на точный набор полей владельца. (6): сценарный прогон `processReservationTimers` с `bought`/`GIVEN` отсутствует. (7): есть механизм «CAS проигран», но нет сценария «пользователь успел первым» на уровне cron. (10): политика проверена, `readWishlist` — нет. Остальные пункты не дублируются.

**Mock, Prisma и «оба адаптера».** «Оба адаптера» в AD-1 — это веб (Server Actions) и приложение (`api/v1`), которые вызывают один use-case; тест через action покрывает оба, отдельные маршруты не нужны. Prisma-путь в CI не проверяется ни для одного инварианта: `vitest.config.ts` берёт только `*.test.ts`, а `*.pgtest.ts` требует одноразовый PostgreSQL. Это осознанное ограничение, а не скрытая дыра: pg-тесты существуют для (1)/(9) и запускаются вручную; в CI роль Prisma-гарантии для (1) выполняет контракт CAS на фейке (S2). Расширение CI — «Открытый вопрос» 1.

**Почему (5) закрыт не полностью.** `Notification` и транспорт писем появляются в Story 6.1; сейчас в `schema.prisma` нет модели, а `recordGiftEvent` — audit-строка без получателя. Проверять «владелец не получает держателя в Notification/письме» нечего. Gift card закрыт: `toOwnerGiftCard` берёт держателя только при `holderVisibleToOwner` и вообще не читает `reservationBought`/`reservationDueAt`. При 6.1 тест на payload и письмо должен появиться вместе с реализацией — иначе инвариант останется наполовину бумажным.

**Почему (10) без дат.** `UserDate` нет; AD-23 описывает `friends`/`everyone`, а ревью архитектуры (L4) прямо просит сузить AD-15(10). Придумывать поведение `everyone` в тесте нельзя. Suite проверяет то, что уже существует: подписчик видит только PUBLIC и не получает FRIENDS. Даты — Epic 7 и «Открытый вопрос» 2.

**Почему (12) отложен.** В схеме нет `phoneE164`/`phoneHmac`, `ContactMatch` и `relationships.ts` честно возвращает `contactMatch: false` до Story 8.1. Тест «сырые номера не пишутся» без кода проверял бы пустоту. Запись в `deferred-work.md` — S4.

**Почему страница `/l` не ломает (3).** Для вошедшего страница отдаёт 307 на SPA до проверки Block — и для Block, и для неизвестного токена одинаково. Настоящий 404 приходит из API/SPA. Инвариант требует неразличимости; она сохранена. Буквальное «HTTP 404 на первом ответе страницы» потребовало бы менять `link-page.ts` и поведение ссылки для вошедших — это вне 5.8 (см. «Открытые вопросы» 5).

**Бандл и границы.** Файлы `apps/web/src/invariants/**` — только тесты; ни `apps/web`, ни `apps/mobile` их не импортируют, Next их не бандлит. Прирост web-бандла — 0 байт, потолок не трогается. Новых пакетов и конфигов нет, `check-boundaries` не затрагивается.

**Данные фикстур.** Ники, названия и id вымышленные; реальные email, телефоны и строки подключения не используются. Тесты не читают `.env*`.

## Отложено

- **AD-15 (5), Notification и письмо владельцу** — Story 6.1: payload `NotificationPayload`, текст письма и отсутствие держателя/`bought` при `holderVisibleToOwner=false`. Сейчас проверяется только gift card. `deferred-work.md`, раздел 5.8.
- **AD-15 (10), даты** — Epic 7 (`UserDate`, AD-23): подписчик не получает даты; поведение `everyone` требует решения (ревью архитектуры L4). До этого suite проверяет только FRIENDS/PUBLIC.
- **AD-15 (12), телефоны** — Story 8.1: `phoneE164`/`phoneHmac`, `ContactMatch`, «Найти знакомых»; тест «сырые номера не пишутся ни в БД, ни в лог» появляется вместе с кодом.
- **Настоящая гонка двух транзакций в CI** — сервис PostgreSQL в `ci.yml` не добавляется в 5.8; до решения ручной `npm run verify:reserve-concurrency` — шаг перед merge Epic 5. «Открытый вопрос» 1.
- **Pg-тест (7)** — сценарий «cron и пользователь одновременно на одной строке» на реальной БД не пишется: требует того же одноразового PostgreSQL; механизм покрыт CAS-тестами, сценарий — `timer-races.test.ts` на фейке. Добавить вместе с pg-CI, если решение будет положительным.
- **Story 5.7** — `GIVEN` пока нельзя получить через API; suite создаёт строку `GIVEN` фикстурой (это допустимо, колонка в схеме есть). Полный цикл «Подарил» → подтверждение проверит 5.7.
- **Story 6.2** — навигация и «Уведомления» к AD-15 не относятся; suite их не трогает.

## Verification

**Commands:**
- `npm run test -w @gift-list/web -- src/invariants/ad15` — expected: все новые файлы suite найдены, тесты `AD-15 (1)`, `(2)`, `(4)`, `(5)`, `(6)`, `(7)`, `(10)` зелёные.
- `npm run test -w @gift-list/web` — expected: suite и существующие тесты зелёные; число тестов выросло только на новые сценарии.
- `npm test` — expected: все пакеты и `scripts/*.test.mjs` зелёные; `npm test` — это и есть CI-шаг `Test`.
- `npm run typecheck` — expected: без ошибок.
- `npm run lint` — expected: без ошибок, `check-boundaries` чист.
- `npm run build` и `npm run build-storybook` — **не запускаются** в подзадачах: их выполняет координатор; suite в бандл не входит.
- `npm run verify:reserve-concurrency`, `npm run verify:disposable-pg`, `npm run verify:friendship-concurrency` — **не запускаются** здесь: нужен живой одноразовый PostgreSQL, Docker запрещён. Ручной прогон `verify:reserve-concurrency` — шаг перед merge Epic 5 (см. «Открытый вопрос» 1).
- Миграции не запускаются: `prisma migrate deploy/dev/reset` и `db push` запрещены; к staging/prod не подключаться.

**Manual checks (если CLI недоступен):**
- Открыть README suite и сверить: у каждого из 12 пунктов есть либо файл+имя теста, либо отметка «отложено» с историей-владельцем; ни один пункт не помечен «покрыто» без теста.
- `git diff --stat` подзадачи: только файлы из её списка; продуктовый код, `schema.prisma`, `.github/workflows`, `package.json`, `sprint-status.yaml` и planning artifacts не изменены.
- В выводе `vitest` найти `AD-15 (n)` для новых тестов; убедиться, что нет `skipped`/`todo`.
