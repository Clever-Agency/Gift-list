---
title: 'F2: сбой БД каталога тегов не маскируется под NOT_FOUND'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `GET /api/v1/tags` при недоступной БД отвечает конвертом AD-12 с кодом `NOT_FOUND`, поэтому клиент показывает «Не найдено» вместо сетевой ошибки. Проблема подтверждена в `deferred-work.md` (пункт 1.4): для сбоя инфраструктуры уже разрешён ответ 500 без конверта, а клиент трактует не-конверт как `network`.

**Approach:** Настоящий сбой БД или иной внутренний сбой чтения каталога отдаёт bare HTTP 500 без конверта AD-12 и без нового кода ошибки. Успешное чтение, в том числе пустая таблица, остаётся `200 { ok: true, data: { tags: [] } }`; язык, порядок по `slug` и формат успешного ответа не меняются.

</frozen-after-approval>

## Implementation Notes

- `getTagCatalog` больше не ловит исключения и не возвращает `NOT_FOUND`: ошибка БД, согласования локали или zod-схемы пробрасывается, а вызывающий route обязан её поймать.
- `GET /api/v1/tags` — единственная точка логирования и HTTP-маппинга: `console.error("Tag catalog read failed", error)` один раз на запрос, затем пустое тело со статусом 500 и заголовками `Cache-Control: private, no-store`, `Vary: Accept-Language`. Конверта AD-12 и кода `INTERNAL` нет.
- `infrastructureErrorResponse()` в `apps/web/src/lib/api-v1.ts` фиксирует санкционированную конвенцию bare 500; helper покрыт отдельным тестом.
- Удалён неиспользуемый helper `catalogUnavailableError`; успешный путь не тронут.
- Обновлены focused-тесты action, route и `api-v1`: пустая БД — успех, исключение Prisma — 500 без конверта, сбой контракта — тот же 500, happy path и локаль/порядок без изменений.
- Проверено: focused 31/31; `npm run typecheck` — успешно; `npm run lint` — успешно, включая `check-boundaries`; `npm test` — 1264 теста (mobile 550, web 480, contracts 164, ui 70) и 5 проверок границ; `npm run build` — standalone-сборка успешна.

## Review Triage Log

- **Ложный симптом у клиента** — `false`: `apiRequest` действительно трактует не-конверт как `network`; хук пикера и раньше сводил оба отказа в `error`, это не вызвано F2. Комментарий уточнён до «API client treats as network».
- **Немой `catch` в route** — `medium`, исправлено: логирование перенесено в route и покрывает локаль, БД, контракт и сериализацию; на запрос ровно одна запись.
- **Нет HTTP-теста сбоя контракта** — `medium`, исправлено: добавлен route-тест «невалидная строка → 500 без конверта».
- **Нет прямого теста `infrastructureErrorResponse`** — `medium`, исправлено: добавлен тест 500/пустое тело/без `content-type`.
- **Хрупкая проверка `content-type`** — `low`, отклонено: отсутствие `content-type` — часть контракта bare-ответа, проверка оставлена осознанно.
- **Избыточные утверждения в route-тесте** — `low`, исправлено: убран `not.toBe(404)`, добавлен `toHaveBeenCalledTimes(1)`.
- **Устаревший отчёт 2.5.4** — `false`: это историческая запись приёмки Story 2.5; актуальный статус ведут `fixup-plan.md`, `fixup-queue.md` и `fixup-F2-report.md`.
- **`deferred-work.md` не упоминает каталог** — `false`: там зафиксирована общая конвенция; применение к каталогу отражено в плане, очереди и отчёте.
- **Нет `fixup-F2-report.md`** — `false`: отчёт создаётся отдельным коммитом после кода.
- **Спека не финализирована** — `medium`, исправлено: статус `done`, добавлены результаты проверок и этот журнал.
- **Нет блока Always/Never** — `false`: маршрут `oneshot` по шаблону не содержит этот раздел; ограничения записаны в Intent и Implementation Notes.
- **Сигнатура бросает без предупреждения** — `low`, исправлено: JSDoc явно требует ловить исключение на вызывающей стороне.
- **Дублирование `Vary`** — `low`, исправлено: заголовок ставится один раз после try/catch.
- **`HEAD` отдаёт 404** — `false`: поведение было таким до F2 и не относится к сбою БД; кандидат в отдельную задачу.
- **Нет клиентского теста bare 500** — `false`: не-конверт → `network` уже покрыт `client.test.ts`; focused-границы F2 — серверные.
- **Посторонние файлы в коммите** — `false`: коммит собирается явным списком файлов, грязные логи и `apps/web/AGENTS.md` не индексируются.

## Verification

**Commands:**
- `npm exec -w @gift-list/web -- vitest run src/actions/tags.test.ts src/app/api/v1/tags/route.test.ts src/lib/api-v1.test.ts` — 3 файла, 31 тест пройден.
- `npm run typecheck` — успешно (mobile, web, contracts, ui).
- `npm run lint` — успешно, `check-boundaries` пройден.
- `npm test` — 1264 теста: mobile 550, web 480, contracts 164, ui 70; плюс 5 проверок границ.
- `npm run build` — успешно, маршрут `/api/v1/tags` собран.

**Manual checks (if no CLI):**
- Живая/общая БД, миграции, сиды и deploy не запускались; поведение на реальной PostgreSQL не проверялось.
