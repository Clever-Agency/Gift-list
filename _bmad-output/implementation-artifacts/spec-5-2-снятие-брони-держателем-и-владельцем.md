---
title: '5.2: Снятие брони держателем и владельцем'
type: 'feature'
created: '2026-11-19'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '962dcfed83b3f55d6289b058cc55d7fa6344d2fe'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Бронь можно поставить (Story 5.1), но снять нельзя. `GiftStatusService` умеет только тихое снятие при сужении видимости; у держателя нет действия «Снять бронь», владелец не может освободить чужую бронь и не узнаёт, отметил ли даритель «Купил» или «Подарил». Пока бронь нельзя снять, ошибочная бронь держит желание занятым до cron (Story 5.6), которого ещё нет.

**Approach:** Два перехода `RESERVED → OPEN` через единственный писатель: держатель — по предикату `reservedById`, владелец — по владению списком, с preflight `warning` (`BOUGHT | GIVEN | null`) без остальных полей брони. Оба ответа — `{ id }`, клиент применяет переход сам. События другой стороне и письма — Epic 6; факт перехода остаётся только в audit-строке лога (NFR-6), потому что колонки брони при снятии очищаются.

## Boundaries & Constraints

**Always:**
- Писатель `status` и колонок `reserved*` — только `gift-status-store.ts`, новыми методами; домен без Prisma, адаптеры — тонкие вызовы (AD-1, AD-8).
- Снятие держателем: CAS `where: { id, status: "RESERVED", reservedById: actor }` с `RESERVATION_RELEASE_DATA`. Ограничения по фазе нет — «любая фаза» из AC (включая `GIVEN` и `bought=true`). `count ≠ 1` → `CONFLICT`.
- Видимость при снятии держателем не проверяется: после unfriend/block бронь и управление ею сохраняются (A-14, FR-25). Поэтому не-держатель — владелец на этом маршруте, другой зритель, неизвестный id, уже снятая бронь, `CLOSED` — получает один и тот же `NOT_FOUND` с одним телом: `FORBIDDEN` и разный статус подсказали бы, что бронь была и кто её держит (AD-7).
- Preflight владельца: `GET /api/v1/me/gifts/:id/reservation` → `{ warning }`: `GIVEN` при `reservationPhase = GIVEN`, иначе `BOUGHT` при `reservationBought = true`, иначе `null`; при `status ≠ RESERVED` — `null`. Ни имени держателя, ни срока, ни `bought`, ни фазы в ответе нет (AD-12, FR-31). Чужое или неизвестное id — `NOT_FOUND`. Preflight только читает.
- Снятие владельцем: CAS `where: { id, status: "RESERVED", list: { ownerId: actor } }` с тем же `RESERVATION_RELEASE_DATA`, в любой фазе. `count ≠ 1` → повторное чтение в своём списке: строки нет — `NOT_FOUND`, есть — `CONFLICT`.
- Оба снятия отвечают `{ id }`, не карточкой: после снятия держатель мог потерять доступ к желанию по AD-7, и карточка отдала бы поля, которых он больше не видит. Держатель применяет известный переход локально, владелец перечитывает список.
- `RESERVATION_RELEASE_DATA` не расширять и не менять: `closedAt` / `closedFromStatus` принадлежат Story 5.3, фазы и `titleSnapshotOnReserve` очищаются вместе с бронью (AD-9).
- NFR-6 (строка `Logging` в ARCHITECTURE-SPINE) — не таблица, а структурированная строка лога из стора на успешный переход: `gift-status: gift=<id> actor=<id> from=RESERVED to=OPEN at=<ISO>`. Ни названий, ни ников, ни email (FR-31). На проигранный CAS строка не пишется.
- Маршруты: `DELETE /api/v1/gifts/:id/reserve` (тот же путь, что `POST` из Story 5.1; `POST` не меняется), `GET` и `DELETE /api/v1/me/gifts/:id/reservation`. Тела у снятия нет. Прочие методы — `notFoundResponse`.
- Тексты интерфейса — только из каталога, дословно из epics/EXPERIENCE/DESIGN: «Снять бронь? Подарок снова станет открытым.», «Снять бронь», «Отмена», «Даритель отметил, что подарок уже куплен. Если снять бронь, его может купить кто-то ещё», «Даритель отметил, что уже вручил». Сеть на подтверждении — общая фраза формы «Нет соединения. Попробуйте ещё раз.» (DECISION 2026-11-18).
- Коралловый `destructive` — только снятие чужой брони (DESIGN → Colors → Destructive): кнопка и подтверждение у владельца. У держателя кнопка `secondary`, а в подтверждении ghost «Отмена» и обычная «Снять бронь».
- Подтверждение владельца — шаг в том же `DetailDialog`, а не второй слой (DESIGN → BottomSheet / Dialog): Esc, крестик и системная «Назад» возвращают шаг деталей.
- Новой миграции нет: `reserved*`, `reservationPhase`, `reservationBought`, `closedAt`, `closedFromStatus` уже в `apps/web/src/db/schema.prisma`. Схема не меняется.

**Never:**
- `Notification`, Resend, `deliverAfter`, кнопки в письмах: «держатель снял бронь» владельцу и «владелец снял бронь» держателю (in-app + email по AC) — Epic 6. 5.2 не заводит ни строки `Notification`, ни outbox.
- Закрытие «Отметить полученным», окно отмены и «Хочу ещё такой» (5.3); удаление и правка забронированного (5.4); «Мои брони», продление, «Купил», «Подарил», reservation card (5.5, 5.7); cron (5.6); suite AD-15 (5.8).
- Менять `releaseReservation` и `visibilityChangeDropsReservation`: снятие по сужению видимости (CLE-82/S23.2–S23.3) остаётся как есть.
- Менять `VisibilityPolicy` и мапперы карточки (`reservedBy`, `reservationLabel`, `ownerAction`, `reservation`); показывать владельцу имя держателя без `holderVisibleToOwner` и отдавать владельцу `bought` или фазу.
- Применять миграции к живой БД, коммитить секреты, подключаться к staging/prod.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HOLDER_RELEASE | вошедший держатель, `RESERVED` в любой фазе | одна строка `OPEN`, `reserved*` очищены, одна audit-строка; ответ `{ id }` | — |
| HOLDER_ANY_PHASE | фаза `GIVEN` или `AWAITING_OWNER`, `bought=true` | снятие разрешено: ограничения по фазе нет | — |
| HOLDER_NO_ACCESS | держатель после unfriend/block, желание ему больше не видно | снятие проходит: видимость не проверяется (A-14) | — |
| HOLDER_RACE | владелец или сужение видимости сняли бронь между чтением и CAS | запись не делается | `CONFLICT`; клиент перечитывает желание |
| NOT_HOLDER | чужое или неизвестное id, не держатель, владелец на маршруте держателя, бронь уже снята или `CLOSED` | — | `NOT_FOUND`, одно тело |
| PREFLIGHT_BOUGHT | владелец, `RESERVED`, `reservationBought=true`, фаза ≠ `GIVEN` | `{ warning: "BOUGHT" }` | — |
| PREFLIGHT_GIVEN | `reservationPhase=GIVEN` | `{ warning: "GIVEN" }` (важнее `BOUGHT`) | — |
| PREFLIGHT_PLAIN | `bought=false`, фаза ≠ `GIVEN` | `{ warning: null }` | — |
| PREFLIGHT_STALE | желание уже `OPEN` или `CLOSED` | `{ warning: null }`: preflight ничего не пишет и не спорит | — |
| PREFLIGHT_FOREIGN | чужое или неизвестное id в `/me` | — | `NOT_FOUND` |
| OWNER_RELEASE | владелец снимает чужую бронь в любой фазе | `OPEN`, `reserved*` очищены, audit-строка; ответ `{ id }` | — |
| OWNER_RACE | держатель или сужение видимости успели раньше | запись не делается | `CONFLICT`; список перечитывается |
| ANON | нет сессии | — | `UNAUTHENTICATED` |
| UI_HOLDER | деталь `/gifts/{id}`, у зрителя есть блок `reservation` | `secondary` «Снять бронь» → confirm «Снять бронь? Подарок снова станет открытым.» → карточка локально `OPEN` без блока брони | сеть — «Нет соединения. Попробуйте ещё раз.»; `CONFLICT` / `NOT_FOUND` — перечитать желание |
| UI_OWNER | деталь-диалог владельца, `RESERVED` | `destructive` «Снять бронь» → preflight → шаг confirm в том же диалоге, предупреждение про «Купил» / «Подарил» → список перечитан | сеть — общая фраза формы; `CONFLICT` — перечитать список |
| UI_NO_ACTION | `OPEN`, `CLOSED`, чужой зритель, архив | действия снятия нет | — |

</frozen-after-approval>

## Open Questions

- CHOICE — текст подтверждения. epics: «Снять бронь? Подарок снова станет открытым.»; EXPERIENCE → Interaction Primitives: «Снять бронь? Желание снова станет открытым.». В спеке принят вариант epics (AC — источник приёмки). Если Сергей выберет EXPERIENCE, меняется одна строка каталога и один тест; на код и API это не влияет.
- CHOICE — заголовок подтверждения владельца. Дословно в источниках не задан (epics 5.2 и EXPERIENCE дают только предупреждения). В спеке заголовок — та же фраза, что у держателя, а предупреждение `BOUGHT`/`GIVEN` уходит в описание шага. Нужен отдельный заголовок — правка epics/EXPERIENCE и одна строка каталога.
- CHOICE — охват NFR-6. Audit-строка покрывает только переходы этой истории. `reserveGift` (5.1) и `releaseReservation` (сужение видимости, S23.2) тоже меняют `status`, но `releaseReservation` не получает актора, а 5.1 запрещает менять его подпись. Выбрано (A): оставить как есть и закрыть отдельной задачей; (B) добавить необязательный параметр актора и писать строку и там — правка кода 5.1 без изменения поведения.
- CHOICE — источник события для Epic 6. После снятия `reserved*` очищаются, поэтому уведомлению «бронь снята» не из чего собрать payload, кроме audit-строки. На 5.2 это не влияет (уведомлений нет), но Epic 6 должен решить, откуда берётся событие — запись в момент перехода или outbox. Решение вне этой истории.

## Code Map

- `packages/contracts/src/gift.ts` — новая схема `giftReservationWarningSchema` (`{ warning: BOUGHT | GIVEN | null }`) на `RESERVATION_LABELS`; рядом с `giftReserveBodySchema`. Тело снятия в контракте не появляется.
- `packages/contracts/src/index.ts` — экспорт схемы и типа.
- `packages/contracts/src/i18n/ru/app.json` — блок `app.gift.release.*`: заголовок подтверждения, «Снять бронь», «Отмена», два предупреждения. Новых `errors.reason` нет.
- `apps/web/src/domain/gift-status.ts` — два метода в `GiftStatusTransaction` (`releaseReservationByHolder`, `releaseReservationByOwner`) и чистая `reservationWarning(row)`; домен без Prisma.
- `apps/web/src/lib/gift-status-store.ts` — единственные `updateMany` новых переходов через `RESERVATION_RELEASE_DATA` + audit-строка. `releaseReservation`, `reserveGift`, `processWishExpiry`, `restoreFromArchive` не меняются.
- `apps/web/src/actions/gift-release.ts` — новые use-case: снятие держателем, preflight владельца, снятие владельцем; сессия, `NOT_FOUND` / `CONFLICT`, конверт AD-12. Образцы — `gift-reserve.ts` и `previewGiftVisibility` в `gifts.ts`.
- `apps/web/src/app/api/v1/gifts/[id]/reserve/route.ts` — `DELETE` вместо `notFoundResponse`; `POST` и чтение `listToken` не меняются.
- `apps/web/src/app/api/v1/me/gifts/[id]/reservation/route.ts` — новый маршрут: `GET` preflight, `DELETE` снятие, остальные методы `notFoundResponse`. Владельческое чтение маскирует чужое как `NOT_FOUND`, как `/me/gifts/[id]/visibility`.
- `apps/web/src/actions/gifts.ts` — образец владельческого чтения (`storedGiftSelect`, `notFound`, маскировка архивного/закрытого); правил снятия здесь не добавлять.
- `apps/web/src/lib/api-v1.ts` — `toResponse`: `CONFLICT` 409, `NOT_FOUND` 404, `VALIDATION` 400. Кодов не менять.
- `apps/mobile/src/api/viewer-gift.ts` — `releaseMyReservation(id)` → `DELETE …/reserve`, ответ `{ id }` сверяется с запрошенным id.
- `apps/mobile/src/api/my-gifts.ts` — `fetchReservationWarning(id)` и `releaseReservation(id)` для `/me/gifts/:id/reservation`, по образцу `previewGiftVisibility`.
- `apps/mobile/src/ui/reservation-release-confirm.tsx` — новый confirm держателя: `BottomSheet` на compact, `Dialog` на medium+, ghost «Отмена» и обычная «Снять бронь», `busy`; по образцу `reserve-confirm.tsx`, `displayName` обязателен.
- `apps/mobile/app/(app)/gifts/[id]/index.tsx` — у держателя (есть `current.reservation`) кнопка «Снять бронь» вместо подсказки «Уже забронирован», confirm, локальный переход карточки в `OPEN`.
- `apps/mobile/src/ui/wish-detail-dialog.tsx` — у владельца destructive «Снять бронь» при `status=RESERVED` и шаг confirm внутри того же `DetailDialog` (строки предупреждения из каталога, busy, возврат шага).
- `apps/mobile/app/(app)/index.tsx` — владельческий экран: preflight по нажатию, состояние подтверждения, `DELETE`, перечитывание списка, тост ошибки.
- `packages/ui/src/button.tsx` — `secondary` и `destructive` уже есть; новых вариантов и правок пакета не нужно.
- `packages/ui/src/detail-dialog.tsx` — `actions` уже принимает произвольный узел; шаг подтверждения собирается в `wish-detail-dialog.tsx` без правки пакета.
- `apps/web/src/db/schema.prisma` — колонки уже есть; не менять, миграций не создавать.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/gift.ts` — схема `giftReservationWarningSchema` + тип; тест: `BOUGHT`, `GIVEN`, `null` проходят, лишний ключ и неизвестное значение — нет. `packages/contracts/src/index.ts` — экспорт.
- [ ] `packages/contracts/src/i18n/ru/app.json` — `app.gift.release.*` дословно; `i18n.test.ts` — строки равны дословным и не пусты.
- [ ] `apps/web/src/domain/gift-status.ts` + `gift-status.test.ts` — `reservationWarning` (матрица `GIVEN` > `BOUGHT` > `null`, `status ≠ RESERVED` → `null`), два метода в интерфейсе транзакции.
- [ ] `apps/web/src/lib/gift-status-store.ts` + `gift-status-store.test.ts` — оба CAS с полным `where` и `RESERVATION_RELEASE_DATA`, `count` 0/1, audit-строка только на успех, `releaseReservation` не тронут.
- [ ] `apps/web/src/actions/gift-release.ts` + `gift-release.test.ts` — сессия, предикаты, `NOT_FOUND` для не-держателя и чужого, `CONFLICT` на проигранном CAS, `{ id }` на успехе, preflight без полей брони.
- [ ] `apps/web/src/app/api/v1/gifts/[id]/reserve/route.ts` + `route.test.ts` — `DELETE` вызывает снятие держателем; `POST` по-прежнему разбирает тело и `listToken`.
- [ ] `apps/web/src/app/api/v1/me/gifts/[id]/reservation/route.ts` + `route.test.ts` — `GET` preflight, `DELETE` снятие, прочие методы `notFoundResponse`.
- [ ] `apps/mobile/src/api/viewer-gift.ts` + тест, `apps/mobile/src/api/my-gifts.ts` + тест — клиенты двух маршрутов, проверка `{ id }` и `{ warning }`.
- [ ] `apps/mobile/src/ui/reservation-release-confirm.tsx` + `.test.tsx` + `.stories.tsx` (`App/…`: normal, busy, 360 compact, medium) — confirm держателя, `displayName`.
- [ ] `apps/mobile/app/(app)/gifts/[id]/index.tsx` — действие держателя, confirm, локальный `OPEN`, обработка сети / `CONFLICT` / `NOT_FOUND`.
- [ ] `apps/mobile/src/ui/wish-detail-dialog.tsx` + `.test.tsx` + обновить `.stories.tsx` (шаг: `warning` null / `BOUGHT` / `GIVEN`, busy, 360) — действие владельца и шаг подтверждения в том же слое.
- [ ] `apps/mobile/app/(app)/index.tsx` — preflight, подтверждение, `DELETE`, перечитывание списка, тост ошибки, возврат фокуса на карточку.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` — два долга: событие владельцу (держатель снял бронь) и держателю in-app + email (владелец снял), Notification/Resend — Epic 6; после снятия на строке остаётся только audit-строка.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` — ключ `5-2-снятие-брони-держателем-и-владельцем` не переименовывать, по готовности `review`.
- [ ] Миграции не создавать; `schema.prisma` не менять.

**Acceptance Criteria:**
- Given держатель и `RESERVED` в любой фазе, when он подтверждает «Снять бронь», then ровно одна CAS-запись `OPEN` с очищенными `reserved*` и ответ `{ id }`.
- Given две одновременные попытки снять одну бронь (держатель и владелец, или держатель и сужение видимости), when обе доходят до записи, then успешна одна, вторая `CONFLICT`.
- Given держатель потерял доступ к вишлисту (unfriend/block), when он снимает бронь, then снятие проходит (A-14).
- Given владелец и `bought=true`, when он открывает подтверждение, then preflight отдаёт `warning: "BOUGHT"` без имени, срока и `bought`, а шаг показывает «Даритель отметил, что подарок уже куплен. Если снять бронь, его может купить кто-то ещё».
- Given чужое или неизвестное id, не держатель, уже снятая бронь или `CLOSED`, when приходит запрос на снятие, then `NOT_FOUND` с одним телом, строка желания не меняется.
- Given владелец снял чужую бронь, when переход прошёл, then желание `OPEN`, а в логе ровно одна строка `gift-status` с актором, `from=RESERVED`, `to=OPEN`; строк `Notification` и писем нет.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

Снятие отвечает `{ id }`, а не карточкой, по двум причинам: у держателя после unfriend/block карточка отдала бы поля, которых он по AD-7 больше не видит, а владельцу после снятия не нужны новые данные — он перечитывает список. Держатель применяет известный переход (`status: OPEN`, `reservedBy: null`, без `reservation`) локально, как 5.1 применял optimistic-бронь.

`NOT_FOUND` для всех не-держателей выбран вместо `FORBIDDEN`, чтобы маршрут не требовал `relationshipReader` и не отличался для `SECRET`-желаний и уже снятой брони. В 5.1 владелец получал `FORBIDDEN` на бронь своего желания — там это безопасно, потому что владелец своё желание видит всегда; здесь маршрут существует только для держателя.

Подтверждение держателя — отдельный компонент, а не `ConfirmDialog`: в проекте `ConfirmDialog` всегда рисует подтверждение коралловым (`destructive`), а DESIGN → Colors → Destructive перечисляет только удаление, блок, «снятие чужой брони», «Выйти» и удаление аккаунта. Своё снятие — обычное действие: `secondary` в детали, ghost «Отмена» и обычная «Снять бронь» в шторке/диалоге, как у `ReserveConfirm`.

Подтверждение владельца — шаг в том же `DetailDialog` (DESIGN → BottomSheet / Dialog: «confirm внутри диалога — шаг в том же слое», «не больше одного слоя»). Отдельный `ConfirmDialog` поверх детали был бы вторым слоем. Story 5.3 добавит в тот же файл свой шаг закрытия — порядок мержа этих двух историй согласовать, конфликт по `wish-detail-dialog.tsx` ожидаем. Если 5.3 смержится раньше, шаг снятия встраивается в уже готовый механизм шагов тем же способом, без второй реализации.

Audit-строка живёт в сторе, потому что только он знает `from → to` и актора, и только он пишет. Формат строки намеренно плоский (`key=value`), как `wish-expiry:` в том же файле: логгер-абстракции в проекте нет, появление отдельного модуля — вне этой истории.

Preflight не отвечает `CONFLICT` на устаревшее состояние: он только читает и возвращает `warning: null`, а решение принимает `DELETE`. Так подтверждение владельца не ломается, если держатель снял бронь, пока владелец читал карточку.

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок
- `npm run lint` -- expected: без ошибок, `check-boundaries` чист
- `npm test` -- expected: зелёные тесты контракта, домена, стора, use-case и маршрутов, обоих клиентов и обоих экранов
- `npm run build` -- expected: сборка проходит
- `node scripts/measure-web-size.mjs` -- expected: в бюджете CI (новых зависимостей нет)

**Manual checks (if no CLI):**
- Телефон и браузер: деталь забронированного желания у держателя → «Снять бронь» → confirm → желание снова «Открыт», у других снова «Куплю сам». У владельца: карточка → деталь → «Снять бронь» → предупреждение про «Купил» (если отметка стоит) → подтверждение → карточка «Открыт», брони в списке нет.
- Отключить сеть на подтверждении: общая фраза формы, карточка не меняется. Снять бронь в двух окнах: второе получает `CONFLICT` и перечитывает.
