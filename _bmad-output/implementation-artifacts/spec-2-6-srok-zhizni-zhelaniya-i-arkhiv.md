---
title: 'Story 2.6: срок жизни желания и архив'
type: 'feature'
created: '2026-11-10'
status: 'review'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/sprint-status.yaml'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Владелец не может задать дату, после которой желание уходит из списка, и не видит архив. `expiresOn` есть в базе и на карточке, но не принимается формой и API, `GiftStatusService` — пустая заглушка, cron нет.

**Approach:** Необязательная дата в форме и в create/update; первая версия сервиса архивирует только `OPEN` по локальной дате владельца и возвращает желание из архива; почасовой вызов снаружи — GitHub Actions, не Vercel Cron; у владельца в конце списка свёрнутая секция «Архив (N)» с возвратом и копированием.

## Boundaries & Constraints

**Always:** Срок прошёл, когда локальная дата владельца позже `expiresOn` (нет `User.timeZone` или зона не IANA — UTC). «Сегодня» допустимо. Прошлую дату проверять только если она новая. `archivedAt` пишет только `GiftStatusService`, CAS `count ≠ 1` не считается успехом. Зритель архив не получает. «Скопировать» создаёт новое `OPEN` без `expiresOn`, архивная строка остаётся. Секрет cron — `CRON_SECRET` в `envSchema`, сравнение без утечки длины.

**Never:** Ручной архив, ветки `RESERVED`/`CLOSED`, уведомления `WISH_EXPIRY*`, фото, Vercel Cron, меню ⋯ на активных карточках.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Новая дата сегодня | create/update с `expiresOn` = локальный сегодня | Дата сохраняется | N/A |
| Новая дата вчера | та же, день раньше локального сегодня | Запись не меняется | `VALIDATION`, `field: expiresOn` |
| Правка без смены даты | та же `expiresOn`, даже если она уже в прошлом | Дата не проверяется заново | N/A |
| Снять дату | `expiresOn: null` | Колонка `null` | N/A |
| Cron, срок прошёл, `OPEN` | локальная дата позже `expiresOn`, не в архиве | `archivedAt` поставлен | N/A |
| Cron повторно | уже в архиве | Ничего не меняется | N/A |
| Cron, `RESERVED`/`CLOSED` | срок прошёл | Строка не кандидат | N/A |
| Возврат | владелец, архив, новая дата или пусто | `OPEN`, `archivedAt` снят, дата заменена | прошлая дата — `VALIDATION`; чужое/не архив — `NOT_FOUND` |
| Копирование | ⋯ → «Скопировать» | Новое `OPEN` без даты, архив на месте | N/A |
| Секция | у владельца есть архив | Свёрнутая «Архив (N)»; пустой секции нет | N/A |
| Зритель | чужой список | Поля `archived` нет, архивные не в `gifts` | N/A |
| Cron без секрета | нет или неверный `Authorization: Bearer` | 401, сервис не вызывается | N/A |

</frozen-after-approval>

## Code Map

- `packages/contracts/src/gift.ts` — вход create/update и тело возврата. Не ослаблять strict.
- `apps/web/src/domain/calendar-day.ts` — день колонки и локальное «сегодня».
- `apps/web/src/actions/gifts.ts` — запись `expiresOn`; `archivedAt` не трогать. `updateGift` по-прежнему не видит архив.
- `apps/web/src/domain/gift-status.ts` — `processWishExpiry`, `restoreFromArchive`. Не добавлять бронь.
- `apps/web/src/actions/wishlist-read.ts` — `archived` только владельцу; активный список как был.
- `apps/web/src/lib/env.ts` — `CRON_SECRET`, минимум 32.
- `apps/mobile/src/ui/gift-form.tsx` — поле после тегов. Строки только из каталога.
- `packages/ui` — `DateField`: web `input type=date`, native системный выбор. Без строк интерфейса.
- `apps/mobile/app/(app)/index.tsx` — секция и действия. Активные карточки без ⋯.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/gift.ts` — `expiresOn` и схема возврата
- [ ] `apps/web/src/actions/gifts.ts` — сохранение и проверка новой даты
- [ ] `apps/web/src/domain/gift-status.ts` — архив и возврат с CAS
- [ ] `apps/web/src/app/api/cron/wish-expiry/route.ts` — POST под секретом
- [ ] `.github/workflows/wish-expiry.yml` — раз в час
- [ ] `apps/web/src/actions/wishlist-read.ts` — архив владельца
- [ ] `apps/mobile` — поле, секция, вернуть, скопировать
- [ ] Тесты матрицы выше

**Acceptance Criteria:**
- Given критерии Story 2.6 в `epics.md`, when реализация готова, then каждый сценарий матрицы покрыт тестом.

## Implementation Notes

План чата утверждён; реализация в той же сессии. Планировщик — GitHub Actions (`APP_URL`, `CRON_SECRET`). Ошибки прошлой даты нет в EXPERIENCE: текст поля фиксируется в каталоге с пометкой для UX.

Секреты `APP_URL` и `CRON_SECRET` в GitHub и `CRON_SECRET` на хосте ставит человек. Локально без `CRON_SECRET` в окружении `getEnv()` не поднимется.

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck` — web и mobile, exit 0
- затронутые тесты web и mobile через `scripts/run-suite.mjs` — exit 0
- `npm run lint` — exit 0

Браузер (Expo web `:8081`, API `:3000`): форма показывает «Убрать в архив после», желание с сегодняшней датой создаётся и остаётся в списке; после сдвига даты на вчера cron архивирует его (`archived: 1`); секция «Архив (1)» свёрнута, пока её не открыть; копирование оставляет архивную строку и добавляет копию в список; возврат с прошлой датой показывает «Выберите сегодняшнюю дату или более позднюю.»; возврат без даты убирает секцию и возвращает желание в список.
