# Fixup F9 (Q-13) — отчёт

Дата: 2026-11-06. Ветка: `evivanchikov/story-24-25-auth-fixups`. Исходный HEAD: `d8ccbdb`. Коммит с кодом, тестами, спекой и планом: `6847c8f`.

## Краткие ответы

**1. Когда создаётся `List` — при регистрации или только при первом желании?**

При регистрации. `registerUser` одним вложенным write создаёт `User`, credential `Account` и ровно один `List` с `publicToken: createId()` (`apps/web/src/actions/register.ts:60-79`). Это прямо требуют AD-6 (`ARCHITECTURE-SPINE.md:139`: «Создаётся при регистрации; API создания/удаления списков в MVP нет») и Story 1.5 (`epics.md:327`). Сырой `POST /api/auth/sign-up/email` закрыт (`apps/web/src/lib/auth.ts:27-31`, `disableSignUp: true`), другого пути создания пользователя в приложении нет. `createGift` список не создаёт: он только ищет существующий `List` и при отсутствии отвечает явным `NOT_FOUND` (`apps/web/src/actions/gifts.ts:216-222`). Удаление желания удаляет только `Gift`; удаления `List` в коде нет. Историческая миграция `20261101143000_one_list_locale_timezone` только схлопнула старые два списка в один по `ownerId`.

Поэтому гипотеза «`List` появляется только при первом желании, и нулевой вишлист — это норма без строки» **кодом и документами не подтверждается**. Нормальный нулевой вишлист — это существующая строка `List` с токеном и нулём `Gift`. Отсутствие строки `List` — настоящая аномалия (нарушение AD-6), а не нормальное пустое состояние.

**2. Фактическая причина отсутствия ссылки?**

`readWishlist` при отсутствии `List` возвращает `not_found` (`apps/web/src/actions/wishlist-read.ts:77-84`). Старый `getMyGifts` превращал это в `{ access: "gifts", gifts: [] }` без `publicToken` (`apps/web/src/actions/my-gifts.ts` до правки, строки 29-31). В результате владелец видел обычный пустой список, но не мог получить и скопировать `/l/{publicToken}`. То есть дефект был не в нормальном пустом вишлисте, а в том, что аномалия маскировалась под нормальный пустой ответ.

**3. Что исправлено?**

Добавлен `ensureOwnerList` (`apps/web/src/lib/owner-list.ts`). Если owner-чтение получило `not_found`, `getMyGifts`:

1. вызывает восстановление отсутствующей строки;
2. пишет предупреждение в лог (`console.warn` с внутренним `ownerId`);
3. повторяет `readWishlist`;
4. возвращает обычный owner-ответ с `publicToken`.

Восстановление вставляет ровно одну строку с новым CUID2-токеном. Существующая строка не обновляется, поэтому существующий `publicToken` никогда не перегенерируется. Гонку решает UNIQUE `List.ownerId`: проигравший вставку получает P2002, проверяет, что строка уже есть, и оставляет токен победителя. Если строки всё равно нет, `getMyGifts` возвращает явный `NOT_FOUND`, а не пустой список без ссылки. Доступ только по `session.user.id`, входных `ownerId`/`listId` нет.

**4. Что осталось после F9?**

Все плановые fixup-пункты F1–F10 закрыты или готовы к ревью. Остались ручные и продуктовые вопросы очереди: Q-05 (визуальная проверка чипов), Q-06 (экранный диктор), Q-07 (no-op PATCH и `updatedAt`), Q-11 (подсказка при правке `RESERVED`), Q-12 (перечитывание желания при серверном `VALIDATION`), Q-15/Q-16/Q-17/Q-18/Q-19/Q-20 (продуктовые/UX-решения по тегам), Q-21…Q-29 (P3-улучшения), Q-30 (owner-схема с обязательным `publicToken`), Q-31…Q-34 (хвосты CLE-62 и доступного имени карточки). Подробности — в `fixup-queue.md`, который оставлен unstaged.

## Что проверено и на что опирается вывод

- AD-6, правило 1: ровно один `List`, создаётся при регистрации, API создания/удаления списков в MVP нет, `publicToken` immutable (`_bmad-output/planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md:134-142`).
- Story 1.5: «в одной транзакции создаётся ровно один `List` с immutable `publicToken`» (`_bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md:327`).
- Story 2.4: владелец в «Мой вишлист» нажимает «Скопировать ссылку» и получает `https://{домен}/l/{publicToken}`; никакого условия «сначала добавь желание» нет (`epics.md:476-491`).
- `registerUser`: вложенный `lists: { create: { publicToken: createId() } }` (`apps/web/src/actions/register.ts:60-79`).
- `auth.ts`: `disableSignUp: true`, комментарий «Sign-up goes through `registerUser` so the user and the single list are created in one transaction (AD-6); the raw endpoint stays closed» (`apps/web/src/lib/auth.ts:27-31`).
- `createGift`: поиск `List` и явный `NOT_FOUND`, создания списка нет (`apps/web/src/actions/gifts.ts:209-222`).
- `readWishlist`: `findUnique` по `ownerId`/`publicToken`, при `null` — `not_found` (`apps/web/src/actions/wishlist-read.ts:77-84`).
- Историческая миграция: `DELETE` лишних дублей, `DROP INDEX "List_ownerId_type_key"`, `CREATE UNIQUE INDEX "List_ownerId_key"` (`apps/web/src/db/migrations/20261101143000_one_list_locale_timezone/migration.sql`).

## Изменения

- `apps/web/src/lib/owner-list.ts` — новый `ensureOwnerList`: вставка отсутствующей строки, обработка P2002 как проигранной гонки, проброс остальных ошибок.
- `apps/web/src/lib/owner-list.test.ts` — создание строки, стабильность токена победителя при гонке, P2002 без строки, проброс несвязанной ошибки, формат токена.
- `apps/web/src/actions/my-gifts.ts` — восстановление при `not_found`, повторное чтение, лог, явный `NOT_FOUND`; обновлён docstring.
- `apps/web/src/actions/my-gifts.test.ts` — нормальный пустой список с токеном, восстановление, явная ошибка, отсутствие восстановления без сессии и для чужой строки.
- `apps/web/src/app/api/v1/me/gifts/route.test.ts` — HTTP-тест восстановления: 200, `Cache-Control: private, no-store`, вызов `create`, токен в теле; уточнён заголовок теста нормального пустого списка.
- `apps/web/src/actions/gifts.ts` — обновлён устаревший комментарий: чтение восстанавливает строку, запись по-прежнему явно отказывает.
- `apps/mobile/src/api/my-gifts.ts` — обновлён комментарий: токен присутствует и для нулевого вишлиста, `null` остаётся защитным fallback.
- `_bmad-output/implementation-artifacts/spec-f9-empty-wishlist-list-repair.md` — спека BMAD oneshot с evidence, границами и review triage.
- `_bmad-output/implementation-artifacts/opencode-microtasks/fixup-plan.md` — F9 переведён в «готово, на ревью», записано решение.

`fixup-queue.md` обновлён, но оставлен unstaged. `apps/web/AGENTS.md`, логи, промпты и keyword-файлы не трогались.

## Проверки

Focused-прогон после всех правок:

```text
npm test -w @gift-list/web -- src/actions/my-gifts.test.ts src/lib/owner-list.test.ts src/app/api/v1/me/gifts/route.test.ts
Test Files  3 passed (3)
Tests       32 passed (32)
```

Полные проверки:

- `npm run typecheck` — успешно (mobile, web, contracts, ui).
- `npm run lint` — успешно, включая `scripts/check-boundaries.mjs`.
- `npm test` — **111 файлов / 1352 теста, 0 падений**:
  - mobile — 43 файла / 590 тестов;
  - web — 48 файлов / 517 тестов;
  - contracts — 6 файлов / 164 теста;
  - ui — 14 файлов / 81 тест;
  - плюс 5/5 boundaries.
- `npm run build` — успешно (`sync-spa`, `prisma generate`, `next build`, standalone assets).

## Ограничения и ручные проверки

- Реальная PostgreSQL-гонка не запускалась: в этой задаче было достаточно unit/integration-моков, а одноразовый PostgreSQL-харнесс был опциональным. Мок моделирует атомарный UNIQUE-индекс: победитель сохраняет токен, проигравший делает один re-read. Если нужна проверка именно на живой PostgreSQL, её можно повторить через существующий F5-харнесс с одноразовой БД.
- `createGift` при отсутствии `List` по-прежнему возвращает явный `NOT_FOUND`. Это осознанная граница F9: чинится owner-чтение, потому что именно оно обязано вернуть ссылку; запись не создаёт список скрыто. После открытия «Моего вишлиста» строка уже восстановлена.
- Owner-схема с обязательным `publicToken` (Q-30) не входила в Q-13. Общий `listDataSchema` остаётся общим для владельца и зрителя; мобильный `publicToken: string | null` сохранён как защитный fallback. Это записано в P3.
- Если строка `List` исчезла, вместе с ней исчез и её прежний токен. Восстановление выдаёт единственный доступный новый токен; у существующей строки токен не меняется, поэтому ранее скопированная ссылка продолжает работать.
- Реальное копирование ссылки в браузере/Android/iOS не проверялось — это остаётся за F6/F10/Q-05/Q-06.
- Blind Hunter oneshot завершён в этой сессии; все существенные находки разобраны в `## Review Triage Log` спеки. Предыдущая попытка Blind Hunter зависла до результата, повторный запуск не потребовался.

## Коммиты и границы

- `6847c8f` — F9: код, тесты, спека, `fixup-plan.md`. `fixup-queue.md` не включён.
- Отчёт `fixup-F9-report.md` — отдельный коммит после кодового, как требовалось.
- В `main` не пушилось, PR не открывался, merge/deploy не выполнялись, живые и общие БД не затрагивались.
