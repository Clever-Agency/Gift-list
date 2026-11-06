# F2 — сбой БД каталога тегов не маскируется под `NOT_FOUND`

Дата: 2026-11-06. Ветка: `evivanchikov/story-24-25-auth-fixups`, база — `c952a02` (отчёт F1). Код F2: `79dc3f6`. Статус: готово, на ревью.

## Что сделано

`GET /api/v1/tags` при настоящем сбое БД или внутреннем сбое чтения отвечает **bare HTTP 500** — пустое тело, без конверта AD-12 и без нового кода ошибки. Успешное чтение не изменилось: рабочая БД с пустой таблицей по-прежнему отдаёт `200 { ok: true, data: { tags: [] } }`, локаль и порядок по `slug` не тронуты.

- `apps/web/src/actions/tags.ts` — убран `try/catch`, превращавший любую ошибку в `{ ok: false, code: "NOT_FOUND" }`. `getTagCatalog` теперь пробрасывает исключение; удалён неиспользуемый `catalogUnavailableError`.
- `apps/web/src/app/api/v1/tags/route.ts` — единственная точка логирования и HTTP-маппинга: один `console.error("Tag catalog read failed", error)` на запрос, затем `infrastructureErrorResponse()`. `Vary: Accept-Language` ставится один раз для 200 и 500.
- `apps/web/src/lib/api-v1.ts` — helper `infrastructureErrorResponse()`: статус 500, пустое тело, `Cache-Control: private, no-store`, без `content-type`.
- Тесты: `apps/web/src/actions/tags.test.ts`, `apps/web/src/app/api/v1/tags/route.test.ts`, `apps/web/src/lib/api-v1.test.ts`.
- Спека: `_bmad-output/implementation-artifacts/spec-f2-catalog-db-error.md` (статус `done`).
- План: `opencode-microtasks/fixup-plan.md`, F2 переведён в «готово, на ревью».

## Решение и источники

- `deferred-work.md`, пункт 1.4: при сбое инфраструктуры `api/v1` допустим 500 без конверта AD-12; клиент трактует не-конверт как `network`.
- AD-12: набор кодов закрыт (`UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION | RATE_LIMITED`), внутреннего кода нет. Новый `INTERNAL` не вводился, `bmad-correct-course` и правки PRD/эпиков/архитектуры не выполнялись.
- Сбой контракта (строка не проходит zod-схему) идёт тем же путём 500: это внутренняя ошибка сервера, а не отсутствие каталога.
- Логирование перенесено в route, чтобы одна запись покрывала БД, согласование локали, контракт и сериализацию, и не было двойного лога.

## Поведение

| Сценарий | Ответ |
|---|---|
| Рабочая БД, непустой каталог | `200 { ok: true, data: { tags: [...] } }`, локализованные подписи, порядок по `slug` |
| Рабочая БД, пустая таблица | `200 { ok: true, data: { tags: [] } }` |
| Ошибка Prisma / БД недоступна | `500`, пустое тело, без конверта AD-12 |
| Невалидная строка каталога | `500`, пустое тело, без конверта AD-12 |
| Неизвестный язык / нет `Accept-Language` | `200`, fallback на `ru` |
| `POST`/`PUT`/`PATCH`/`DELETE`/`HEAD` | без изменений: `404` с конвертом `NOT_FOUND` |

## Проверки (фактические)

- Focused: `npm exec -w @gift-list/web -- vitest run src/actions/tags.test.ts src/app/api/v1/tags/route.test.ts src/lib/api-v1.test.ts` — 3 файла, **31 тест пройден**.
- `npm run typecheck` — успешно (mobile, web, contracts, ui).
- `npm run lint` — успешно, включая `node scripts/check-boundaries.mjs`.
- `npm test` — **1264 теста**: mobile 550 (40 файлов), web 480 (46 файлов), contracts 164 (6 файлов), ui 70 (13 файлов); плюс **5** проверок `check-boundaries`.
- `npm run build` — успешно, standalone-сборка, маршрут `/api/v1/tags` собран.

## Ограничения и безопасность

- Живая/общая БД не использовалась; `migrate`, `migrate deploy`, `db push`, `db seed` и deploy не запускались.
- Секреты и `.env*` не читались; настройки Vercel не менялись.
- Поведение на реальной PostgreSQL не проверялось — это по-прежнему предмет F5/Q-04.
- В коммит вошли только 8 файлов F2; грязный `apps/web/AGENTS.md`, `fixup-queue.md`, prompt/log/keyword-файлы не индексировались. `fixup-queue.md` обновлён, но оставлен unstaged.

## Ревью и новые находки

Blind-hunter ревью проведено; разбор — в `spec-f2-catalog-db-error.md`, раздел Review Triage Log. Исправлены: немой `catch` (лог перенесён в route), отсутствие HTTP-теста сбоя контракта, отсутствие прямого теста helper, дублирование `Vary`, избыточные утверждения.

Новые находки, **не исправлялись** (вне F2):

1. `HEAD /api/v1/tags` отдаёт `404 NOT_FOUND`; health-проба не отличает отсутствие маршрута от сбоя БД. Поведение было таким до F2; кандидат в отдельную задачу, если HEAD нужен для мониторинга.
2. Клиентский хук `useTagCatalog` сводит и старый конверт `NOT_FOUND`, и новый bare 500 в одно состояние `{ status: "error" }`. F2 исправляет HTTP-семантику (404 больше не врёт, мониторинг/прокси видят 5xx), но текст в пикере тегов может остаться прежним. Если нужен отдельный текст сетевой ошибки, это отдельная UX-задача.
3. `spec-2-5-4-tag-catalog.md` и `2.5.4-report.md` описывают старое поведение `NOT_FOUND` как исторические записи Story 2.5; задним числом не переписаны, актуальный статус — в плане, очереди и этом отчёте.

## Коммиты

- `79dc3f6` — `F2: answer tag catalog failures with a bare 500` (код, тесты, спека, план).
- Отчёт `fixup-F2-report.md` — отдельный коммит в этой же ветке.

## Оставшийся порядок

F2 готов к ревью, пакет не закрыт. Дальше по плану:

1. **F3** — полное доступное имя карточки желания (Q-03); следующий независимый пункт.
2. **F4** — гонки FK/unique каталога в конверт (Q-10), после F1/F2.
3. **F5** — проверка миграций/сида/транзакций на одноразовой PostgreSQL (Q-04); ждёт окружения, F1 и F2 на реальной БД не доказаны.
4. **F6** — адаптеры clipboard и посильные runtime-тесты (Q-30).
5. **F7** — доступность `ChoiceList` (Q-08).
6. **F8** — ошибка `tags.N`, привязанная к чипу (Q-09), после F4.
7. **F9** — `getMyGifts` без строки `List` (Q-13), сначала решение.
8. **F10** — `EXPO_PUBLIC_WEB_ORIGIN` в Expo-web (Q-14).

F3 в этом заходе не начат.
