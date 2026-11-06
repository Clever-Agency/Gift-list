---
title: 'Story 4.1.3 — живая кнопка дружбы на /u/[nick]'
type: 'feature'
created: '2026-11-06'
status: 'in-review'
route: 'dispatch'
baseline_commit: 'add226f0589bd8edc398b3e3766a1df1e809923f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** профиль `/u/[nick]` до сих пор показывает только карточку и желания. Зритель не может отправить приглашение, а экран не различает «нет связи», pending в обе стороны и дружбу, хотя ответ 4.1.2 уже отдаёт закрытое `relationship`.

**Approach:** добавить на экран действия ровно по отношению из ответа сервера. «Добавить в друзья» и «Принять приглашение» вызывают один и тот же `POST /api/v1/u/:nick/invite`; успех меняет chip по закрытому исходу, входящий pending получает auto-accept, после дружбы профиль перечитывается. Видимость желаний по-прежнему решает сервер, экран её не фильтрует.

## Boundaries & Constraints

**Always:** строки только из `packages/contracts/src/i18n/ru/app.json` и EXPERIENCE; кнопка называется так же, как её accessible name; зона касания ≥44; optimistic с откатом и тостом «Нет сети. Попробуйте ещё раз.»; 401 уходит на вход с прежним безопасным `next`; смена ника в маршруте не оставляет состояние и кнопку предыдущего человека; повторные нажатия и устаревшие ответы игнорируются; смена/принятие дружбы — только существующий API 4.1.2 и протокол R1 с advisory lock.

**Never:** «Подписаться», «Отписаться», «Заблокировать», «Отменить приглашение», «Отклонить», меню ⋯, даты; отдельный endpoint принятия/отклонения Story 4.2; `InviteCooldown`; клиентская фильтрация видимости; выдуманные строки; Story 4.3/4.5/4.6, поиск, уведомления; полный приёмочный прогон 4.1.4; push, PR, `main`, deploy, общая/боевая PostgreSQL, `.env`, секреты.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| NONE | `relationship:"NONE"`, не свой профиль | кнопка «Добавить в друзья»; после `INVITED`/`PENDING` — toast «Приглашение отправлено», chip «Ожидает ответа», кнопки нет | сеть — откат и тост «Нет сети. Попробуйте ещё раз.» |
| OUTGOING_PENDING | исходящий pending | только chip «Ожидает ответа», без повторной отправки и отмены | — |
| INCOMING_PENDING | входящий pending | chip «Зовёт в друзья», кнопка «Принять приглашение» через тот же invite API; после `FRIENDS_CREATED` — toast «{имя} теперь в друзьях», chip «Друзья», перечитывание профиля | сеть — откат и сетевой тост |
| FRIENDS | есть ребро | только chip «Друзья», действий нет | — |
| SELF | ник совпадает с ником сессии | chip «Это вы», действий нет | — |
| NOT_FOUND | `access:"not_found"` | «Пользователь не найден.», без кнопки | — |
| RACE | повторное нажатие или ответ старого ника | второй запрос не уходит; устаревший ответ не меняет новый экран | — |

</frozen-after-approval>

## Code Map

- `apps/mobile/app/u/[nick].tsx` — экран профиля; сюда добавляются chip и кнопка, optimistic-состояние и перечитывание.
- `apps/mobile/src/api/profile.ts` — `fetchProfile`; добавляет `relationship` из ответа 4.1.2 в `ProfileResult`.
- `apps/mobile/src/api/friend-invite.ts` (новый) — `POST /api/v1/u/:nick/invite` через `apiRequest`, проверка `friendInviteDataSchema`.
- `packages/contracts/src/i18n/ru/app.json` — канонические строки `app.profile.relationship.*`; `notFound` получает точку из EXPERIENCE.
- `packages/ui/src/relationship-chip.tsx` (новый) — статический chip отношения по DESIGN (muted/primary, как StatusPill).
- Тесты: `apps/mobile/src/session/profile-screen.test.tsx`, `apps/mobile/src/api/profile.test.ts`, `apps/mobile/src/api/friend-invite.test.ts`, `packages/ui/src/relationship-chip.test.tsx`.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/contracts/src/i18n/ru/app.json` — строки отношения, тостов и сети; точка в `notFound`.
- [ ] `packages/ui/src/relationship-chip.tsx` и `index.ts` — chip отношения с `displayName`; экспорт из пакета.
- [ ] `apps/mobile/src/api/profile.ts` — `relationship` в успешном `ProfileResult` (при отсутствии — `NONE`).
- [ ] `apps/mobile/src/api/friend-invite.ts` — вызов invite API и разбор закрытого исхода.
- [ ] `apps/mobile/app/u/[nick].tsx` — действия по отношению, optimistic/откат, тосты, защита от гонок, перечитывание после дружбы.
- [ ] Тесты веток отношения, чужих кнопок, тостов, отката сети, отсутствия преждевременных «Друзей» и смены ника.
- [ ] `spec-4-1-3-profile-friend-cta.md` и `4.1.3-report.md` — русские документы с хешами, гейтами и ограничениями.

**Acceptance Criteria:**
- Given связи нет, when нажать «Добавить в друзья», then уходит один запрос, появляется «Ожидает ответа», после успеха — тост «Приглашение отправлено» и кнопки больше нет.
- Given исходящий pending, then на экране только «Ожидает ответа»; второго запроса и «Отменить» нет.
- Given входящий pending, when нажать «Принять приглашение», then вызывается тот же invite API, после `FRIENDS_CREATED` — тост «{имя} теперь в друзьях», chip «Друзья» и перечитанные FRIENDS-желания.
- Given дружба, свой профиль или `not_found`, then экран показывает соответственно «Друзья», «Это вы» или «Пользователь не найден.» без чужих действий.
- Given сеть недоступна или 401, then optimistic-состояние откатывается и появляется сетевой тост, либо происходит прежний безопасный переход на вход.
- Given смена ника или повторное нажатие, then состояние и ответ предыдущего запроса не попадают на новый экран.

## Implementation Notes

- `fetchProfile` добавляет `relationship` в успешный ответ и берёт `NONE`, если поля нет: клиент не выводит дружбу из карточек и не усиливает отношение.
- `sendFriendInvite` — один путь для первой заявки и принятия входящей. Ник нормализуется `profileRoute`, тело не отправляется, ответ проверяется `friendInviteDataSchema`; отдельного accept-эндпоинта Story 4.2 нет.
- Экран хранит optimistic-состояние в самом `ScreenState.relationship`. При ошибке возвращается прежнее отношение; при `FRIENDS_CREATED`/`ALREADY_FRIENDS` выставляется `FRIENDS` и увеличивается `attempt`, поэтому профиль и FRIENDS-желания перечитываются с сервера.
- `pendingNick` и `toast.nick` привязаны к нику: после смены маршрута старый chip и тост не совпадают с новым ником. `requestSeq`/`nickRef` отбрасывают ответ старого запроса; `inviteInFlight` не даёт отправить второй запрос по тому же нику.
- Свой профиль определяется сравнением ника владельца с ником сессии без регистра; серверное отношение для себя не усиливается.
- `RelationshipChip` добавлен в `packages/ui`: статический chip на токенах `muted`/`primary`, без роли кнопки. Кнопки — общий `Button` с `minHeight: $control-height` (48), подпись совпадает с `aria-label`.

## Verification

**Commands:**
- `npm exec -w @gift-list/mobile -- vitest run src/session/profile-screen.test.tsx src/api/profile.test.ts src/api/friend-invite.test.ts src/profile/profile-route.test.ts` — 4 файла, 64 теста, exit 0.
- `npm test -w @gift-list/mobile` — 50 файлов, 696 тестов, exit 0.
- `npm test -w @gift-list/contracts` — 7 файлов, 177 тестов, exit 0.
- `npm test -w @gift-list/ui` — 15 файлов, 83 теста, exit 0.
- `npm exec -w @gift-list/web -- vitest run src/actions/friend-invite.test.ts src/lib/relationships.test.ts "src/app/api/v1/u/[[...nick]]/route.test.ts" "src/app/api/v1/u/[nick]/invite/route.test.ts" "src/app/api/v1/u/[nick]/invite/route.action.test.ts"` — 5 файлов, 52 теста, exit 0.
- `npm run typecheck` — mobile, web (`prisma generate`, `next typegen`, `tsc`), contracts, ui; exit 0.
- `npm run lint` — все workspace и `check-boundaries.mjs`; exit 0.

**Limitations:** живая PostgreSQL, полный корневой `npm test`/`npm run build` и приёмка 4.1.4 не запускались по условию микрозадачи. Story 4.1 остаётся не `done`; Story 4.2/4.3/4.5/4.6, поиск, уведомления и `/i` не входили.
