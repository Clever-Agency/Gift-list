---
title: 'Story 4.2.4 — приёмка гейтов Story 4.2'
type: 'verification'
created: '2026-11-07'
status: 'in-review'
route: 'oneshot'
baseline_commit: '0e8298204038461c9849abe289fd9f6f68ca68b5'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 4.2 собрана из микрозадач 4.2.1–4.2.3, но полный корневой прогон и живая приёмка на одноразовой PostgreSQL с реальным HTTP ещё не выполнялись. Нужно доказать, что принятие и отклонение приглашения работают на уровне гейтов, домена и провода, либо честно назвать непроверенное.

**Approach:** прогнать корневые `typecheck`, `lint`, `test`, `build`; поднять отдельный собранный standalone-сервер на своей loopback-порте и собственную одноразовую PostgreSQL; пройти accept/reject, cooldown, истечение фикстурой, Block-фикстуру, анонимный 401, recipient-only и гонки пары реальными HTTP-запросами. Поведение не расширять; Story 4.2 перевести максимум в `review`, CLE-71 не закрывать.

## Boundaries & Constraints

**Always:** одноразовая синтетическая PostgreSQL на loopback; отдельный HTTP-процесс и порт; реальные коды выхода гейтов; русская матрица AC; разделение «реальный HTTP / реальная PostgreSQL / unit»; `sprint-status.yaml` для `4-2` — `review`.

**Never:** push, PR, `main`, merge, deploy; общая/боевая PostgreSQL, Supabase, `.env`, существующие секреты; `done` для Story 4.2; создание Block через UI (Story 4.5); `Notification` и письма (Epic 6); браузерная/нативная проверка без санкционированного инструмента; shared serve и другие worktrees.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Принятие | pending A→B, B вызывает accept | 200 `FRIENDS_CREATED`, одно ребро, 0 инвайтов, оба видят FRIENDS | повтор — `ALREADY_FRIENDS` |
| Отклонение | pending A→B, B вызывает reject | 200 `REJECTED`, инвайта нет, одна строка cooldown на 24 ч | повтор — `NOT_FOUND`, cooldown не переписывается |
| Повтор приглашения | живой cooldown | 429 `RATE_LIMITED` + `INVITE_COOLDOWN` + `hours` | строки инвайта нет, `until` не продлевается |
| Истечение | `until` в прошлом фикстурой | успешная отправка создаёт инвайт и удаляет cooldown | без cron |
| Block | строка `Block` фикстурой | профиль `not_found`, accept/reject/send — `FORBIDDEN`, cooldown не пишется | Block не создаётся UI |
| Без сессии | accept/reject без cookie | 401 `UNAUTHENTICATED` | — |
| Не получатель | отправитель вызывает accept/reject | 404 `NOT_FOUND`, состояние не меняется | — |
| Гонка | два accept или accept/reject одной пары | одно ребро либо один cooldown; второй запрос — `ALREADY_FRIENDS`/`NOT_FOUND` | advisory lock пары |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/friendship.ts` — протокол AD-10: accept/reject, cooldown, общий accept-primitive.
- `apps/web/src/lib/friendship-store.ts` — Prisma-адаптер, `pg_advisory_xact_lock` пары, `READ COMMITTED`.
- `apps/web/src/actions/friend-invite.ts` — HTTP-исходы accept/reject/send и `INVITE_COOLDOWN`.
- `apps/web/src/actions/profile.ts`, `apps/web/src/lib/relationships.ts` — `relationship` и `inviteCooldown` только профиля.
- `apps/web/src/app/api/v1/u/[nick]/invite/{accept,reject}/route.ts` — два тонких POST.
- `apps/web/src/app/api/v1/u/[[...nick]]/route.ts`, `apps/web/src/app/api/v1/l/[[...token]]/route.ts`, `apps/web/src/app/api/v1/me/route.ts` — чтения.
- `apps/web/scripts/verify-friendship-42-http.mjs` — новый bounded harness живой приёмки.
- `apps/web/src/db/disposable-pg/guard.ts` — гейт одноразовой цели.
- `_bmad-output/implementation-artifacts/opencode-microtasks/4.2.4-live-evidence-*.md` — сырое evidence.

## Tasks & Acceptance

**Execution:**
- [x] Корневые `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` с кодами выхода.
- [x] Одноразовая PostgreSQL 17.11 в Docker на loopback; `prisma migrate deploy`; миграция `InviteCooldown` применена.
- [x] Отдельный standalone-сервер на своём loopback-порту; 12 синтетических аккаунтов.
- [x] Живые сценарии accept/reject/cooldown/expiry/Block/401/recipient-only/гонки; 146/146 PASS.
- [x] Матрица AC и ограничения в `4.2.4-report.md`; `sprint-status.yaml` — `review`.

**Acceptance Criteria:**
- Given HEAD `0e82982`, when запустить четыре корневые команды, then каждая завершается exit 0 с зафиксированными числами.
- Given pending A→B, when B принимает, then одно ребро, 0 инвайтов, FRIENDS в обе стороны, FRIENDS-желания видны, SECRET и чужой `publicToken` — нет.
- Given pending A→B, when B отклоняет, then инвайт удалён, cooldown 24 ч, A видит `rejected: true`, B — `false`; повтор 429 без строки.
- Given `until` в прошлом, when A снова приглашает, then инвайт создаётся, cooldown удаляется.
- Given Block фикстурой, then профиль `not_found`, accept/reject/send `FORBIDDEN`, cooldown не появляется.
- Given нет сессии или запрос от отправителя, then 401 или 404 соответственно, состояние не меняется.
- Given гонка пары, then остаётся одно ребро либо один cooldown, без дублей и взаимных pending.
- Given отчёт, then явно перечислены непроверенные браузер/натив/скринридер и будущие истории.

## Implementation Notes

- Новых миграций и изменений продуктового поведения не потребовалось: все сценарии прошли на коде 4.2.1–4.2.3.
- Harness не управляет Docker: контейнер создаёт и удаляет оператор; harness проверяет цель через `resolveDisposableTarget()`, отказывает непустой базе и сам поднимает только HTTP-процесс.
- Секреты, `.env*`, существующие переменные окружения с БД и удалённый Supabase не читались; дочерним процессам передаются только синтетические loopback-значения.
- Block и истечение cooldown вставляются/меняются SQL-фикстурой; это не экран 4.5 и не cron.
- Живая проверка — реальный HTTP к standalone-серверу и реальная PostgreSQL; unit/happyDOM 4.2.1–4.2.3 остаются отдельным доказательством.

## Verification

**Commands:** см. `4.2.4-report.md`; evidence — `4.2.4-live-evidence-2026-11-06T223419.md`.

**Limitations:** ручной браузер, Android/iOS и скринридер не проверялись; санкционированного браузерного инструмента в окружении нет. Story 4.3–4.7, уведомления и письма вне границ.
