---
title: 'CLE-76: долги Story 2.6 из ревью переноса'
type: 'bugfix'
created: '2026-11-19'
status: 'done'
baseline_commit: '2803a72fb494c39219070e1e20e90d96649db2a3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-6-srok-zhizni-zhelaniya-i-arkhiv.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-cle-76-perenos-2-6-v-staging.md'
  - '{project-root}/apps/web/AGENTS.md'
  - '{project-root}/.cursor/rules/ux-design.mdc'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ревью переноса 2.6 в `staging` (три пункта CLE-76 в `deferred-work.md` от 2026-11-19) нашло долги в коде 2.6: гонки и неограниченные чтения в ночном архивировании, неполные ошибки восстановления, дубли хелперов, слишком широкое исключение `read-guard`, a11y `DateField`, нет stories и тестов, нет шагов выкладки.

**Approach:** Ветка `claude/cle-76-2-6-followups` поверх коммита переноса `2803a72`, отдельный PR после него. Чиним долги кода, пишем шаги выкладки в `docs/deployment-environments.md`, добавляем stories `DateField` и `WishCard` (меню, архив). Решения человека: объём — долги кода + docs + stories; диалог подробностей из «Архива» не делаем.

## Boundaries & Constraints

**Always:** статус и `archivedAt` пишет только `gift-status-store.ts` (AD-9); видимость не меняется (AD-7); строки — только из каталога `packages/contracts/src/i18n` (новые ключи — туда); компоненты и функции именованные, `displayName` по AGENTS.md.

**Never:** диалог подробностей CLE-84 для карточек архива; ленивая подгрузка архива; новые зависимости; правка PRD/эпиков/архитектуры; push/PR без просьбы.

## I/O & Edge-Case Matrix

| Сценарий | Вход / состояние | Ожидается |
|---|---|---|
| Гонка с правкой даты | между выборкой и CAS владелец перенёс `expiresOn` на будущее | желание не архивируется (CAS сверяет `expiresOn`) |
| Дальняя дата | `expiresOn` позже UTC-сегодня | в выборку кандидатов не попадает |
| Ошибка строки | `updateMany` одной строки бросает | остальные обработаны, ошибка в лог без названий, итог `archived` верный |
| Сбой всего прохода | `processWishExpiry` бросает | маршрут cron отвечает 500 без тела и деталей |
| Восстановить пропавшее | restore → `NOT_FOUND` | карточка убрана из архива, диалог закрыт, тост |
| Сессия истекла | restore или copy → `UNAUTHENTICATED` | `expireSession()`, как у правки |
| Большой архив | > 100 архивных | приходят 100 новейших, подпись секции — полный счёт |

</frozen-after-approval>

## Code Map

- `apps/web/src/lib/gift-status-store.ts` `processWishExpiry` -- `where` выборки + `expiresOn: { lt: <начало UTC-дня now> + 1 день }` (локальный день любой зоны ≤ UTC-сегодня + 1); CAS `where` + `expiresOn: row.expiresOn`; выборка пачками `take: 500` по `id` (курсор) до пустой; каждый `updateMany` в `try/catch` с `console.error` без названий.
- `apps/web/src/app/api/cron/wish-expiry/route.ts` -- `processWishExpiry` в `try/catch` → `console.error` без деталей строк и `new Response(null, { status: 500 })` (в `ERROR_CODES` нет серверного кода, контракт не расширяем).
- `apps/web/src/actions/wishlist-read.ts:155` -- архив: `take: 100`; рядом `prisma.gift.count` с тем же `where` → `archivedTotal`. Контракт списка (`packages/contracts`, схема с `archived`) — необязательное `archivedTotal: number` только у владельца.
- `apps/web/src/actions/restore-gift.ts` -- убрать свои `unauthenticated` / `validation` / разбор локали: экспортировать и переиспользовать из `apps/web/src/actions/gifts.ts:27,138,158`.
- `apps/web/src/domain/calendar-day.ts` `isCalendarDay` и inline `refine` в `packages/contracts/src/gift.ts` -- одна функция в contracts, веб её импортирует.
- `apps/web/src/actions/read-guard.test.ts:6-17` -- исключение `STATUS_SERVICE` сузить: в `gift-status-store.ts` разрешён ровно один `.gift.findMany`, и его `select` содержит только `id`, `expiresOn`, `list`; починить оборванный комментарий.
- `apps/mobile/app/(app)/index.tsx` -- `submitRestore`/`copyArchived` (≈611–665): `UNAUTHENTICATED` → `expireSession()`; restore `NOT_FOUND` → убрать карточку из `archived`, `archivedTotal - 1`, закрыть диалог, тост `common("errors.code.NOT_FOUND")`; кнопка «Вернуть в вишлист» (≈951) `disabled={archiveBusy}`; на шаге restore вторая кнопка «Назад» (`common("back")` или ключ экрана) → `setRestoreStep(false)`; подпись секции — `archivedTotal ?? archived.length`.
- `deviceToday()` в `index.tsx:1100` и `apps/mobile/src/ui/gift-form.tsx:1178` -- один хелпер в `apps/mobile/src/ui/` (например `device-today.ts`), с комментарием: `min` — день устройства, окончательную проверку по `User.timeZone` делает сервер.
- `packages/ui/src/date-field.tsx` -- убрать `aria-label` (есть `<label htmlFor>`) и `accessibilityHint` (есть `aria-describedby`); в типе пометить `placeholder`/`displayValue`/`doneLabel` как только для телефона.
- `packages/ui/src/date-field.native.tsx` -- `id` без связи убрать; ошибка доступна кнопке (в `accessibilityLabel`/`aria-describedby`-эквиваленте), текст ошибки с `role="alert"`.
- Stories: новый `packages/ui/src/date-field.stories.tsx` (`UI/DateField`: пусто, с датой, ошибка, с `min`, длинная кириллица, 360 px); `packages/ui/src/wish-card.stories.tsx` — состояния с `menu` и архивное `closed`.
- `docs/deployment-environments.md` (разделы «Порядок выкладки», «Staging», «Production») -- `CRON_SECRET` (≥ 32 символа) в env хоста и в секрет GitHub Actions; `migrate deploy` для `20261110180000_gift_expiry_index` до мержа; `wish-expiry.yml` по `schedule` идёт только с default-ветки и бьёт в `APP_URL`, на staging — `workflow_dispatch`/ручной `curl`.

## Tasks & Acceptance

**Execution:**
- [x] сервер: `gift-status-store.ts`, cron-route, `wishlist-read.ts` + контракт, `restore-gift.ts`, `calendar-day` -- по Code Map, с тестами на строки матрицы
- [x] `read-guard.test.ts` -- узкое исключение
- [x] клиент: `index.tsx`, `device-today`, `gift-form.tsx` -- по Code Map, тесты в `gift-flows.test.tsx` / `my-wishlist-screen.test.tsx`
- [x] `packages/ui`: `date-field*.tsx`, stories `DateField` и `WishCard`
- [x] `docs/deployment-environments.md`
- [x] `deferred-work.md` -- три пункта CLE-76 от 2026-11-19: отметить закрытое, оставить только «подробности из архива»

**Acceptance Criteria:**
- Given гейты, when `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, then exit 0 (кроме известного Windows-падения `generate-brand-icons.test.mjs` из-за CRLF) и `measure-web-size` в бюджете.
- Given `npm run build-storybook`, then сборка проходит, `UI/DateField` и новые состояния `UI/WishCard` есть.

## Implementation Notes

- Тесты клиента — в `my-wishlist-screen.test.tsx` (не `gift-flows.test.tsx`): там уже живут сценарии архива.
- `common` ключа `back` нет, поэтому для «Назад» добавлен `app.myWishlist.archiveBack`.
- Пагинация ночного прохода — `where.id.gt`, не Prisma `cursor`+`skip: 1`: строка-курсор, заархивированная в этом же проходе, иначе съедала бы следующего кандидата.
- Проход возвращает `{ archived, failed }`; маршрут cron отвечает 500 без тела при `failed > 0` или общем сбое, чтобы GitHub-воркфлоу краснел.
- Архив и счётчик читаются одной `prisma.$transaction`.
- Гейты после правок ревью (2026-11-19): `typecheck`, `lint`, `build`, `build-storybook` — 0; `measure-web-size` — прирост 198 745 при потолке 199 680 (запас 935); vitest — mobile 1410, web 1355, contracts 335, ui 313. `npm test` = 1 только из-за известного Windows-падения `generate-brand-icons.test.mjs` (CRLF).

## Spec Change Log

## Review Triage Log

| Находка | Вердикт | Маршрут |
|---|---|---|
| `cursor`+`skip: 1` пропускает кандидата на границе пачки и обрывается на удалённом курсоре (BH, ECH, VG) | high | patch — `id: { gt }` + тест с фильтрующим моком |
| Сбой строк глотается, cron отвечает 200; лог без id и с объектом ошибки (BH) | medium | patch — `failed`, 500, лог `id` + `name`/`code` |
| `isNarrowExpiryScan` не проверяет вложенный `select` (BH) | medium | patch — точная нормализованная форма |
| Секция «Архив» пропадает при `archivedTotal > 0` и пустой странице (BH, ECH) | medium | patch |
| restore `NOT_FOUND` не показывает желание, вернувшееся с другого устройства (ECH) | low | patch — перечитать список |
| `findMany`/`count` вне транзакции (ECH) | low | patch — `$transaction` |
| Ошибка `DateField` на телефоне звучит дважды (BH) | medium | patch — без `role="alert"` в native |
| Docs: противоречие о моменте миграции; ручной `workflow_dispatch` не работает (BH) | medium | patch |
| `ARCHIVE_PAGE` разорвал JSDoc `giftSelect` (BH, VG) | low | patch |
| Не хватает тестов: copy UNAUTH, «Архив (129)», «Назад», `aria-disabled`, a11y `DateField` (BH, VG) | medium | patch |
| Неотформатированный `toEqual` (BH) | low | patch |
| Дубль «Назад» (BH) | false | в `common` ключа `back` нет |
| Кап 100 не подсказан в интерфейсе (BH) | low | отклонено: подпись даёт полный счёт, подсказка — новый текст UX |
| Спека не заполнена (BH) | false | заполняется на этом шаге |
| Один экземпляр `ARCHIVE_PAGE` для клиента и сервера (BH) | low | отклонено: клиент числа не использует, только комментарий |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `node scripts/measure-web-size.mjs`, `npm run build-storybook` -- exit 0
