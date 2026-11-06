---
title: 'Story 4.1.4 — приёмка гейтов Story 4.1'
type: 'verification'
created: '2026-11-06'
status: 'in-review'
route: 'dispatch'
baseline_commit: 'bce13029dd4f712c25b270796c07d23ba8d3321f'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 4.1 собрана из микрозадач 4.1.1–4.1.3, но полный корневой прогон и приёмка AC ещё не выполнялись. Нужно доказать, что отправка приглашения работает на уровне гейтов, реального протокола записи и HTTP, либо честно назвать непроверенное.

**Approach:** прогнать `typecheck`, `lint`, `test`, `build` из корня; повторить harness встречных приглашений и ограничения миграции на новой одноразовой PostgreSQL; поднять собранный standalone-сервер на той же одноразовой базе и пройти invite/profile end-to-end по HTTP. Код менять только при дефекте в границах Story 4.1. Story 4.1 перевести максимум в `review`.

## Boundaries & Constraints

**Always:** одноразовая синтетическая PostgreSQL на loopback; реальные коды выхода гейтов; русская матрица AC; пометка «мок / реальный HTTP / нативно не проверено»; тот же advisory lock пары и `READ COMMITTED` в R1; `sprint-status.yaml` для `4-1` — `review`.

**Never:** push, PR, `main`, merge, deploy; общая/боевая PostgreSQL, `.env`, секреты; `done` для Story 4.1; расширение на 4.2/4.3/4.5/4.6/4.7, поиск, уведомления; выдуманная ручная/нативная/скринридер-проверка; запуск чужого shared serve PID 3720.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Гейты | чистое дерево, HEAD `bce1302` | четыре команды завершаются exit 0 | при падении — дефект в границах 4.1 или честный FAIL |
| Встречные отправки | A→B и B→A одновременно | 1 ребро, 0 инвайтов | при 2 pending — дефект R1, чинить в границах 4.1 |
| HTTP: приглашение | 2 синтетических аккаунта | `INVITED`, повтор `PENDING`, встречный `FRIENDS_CREATED` | `FORBIDDEN`/`NOT_FOUND` по AD-12 |
| HTTP: видимость | FRIENDS-желание | скрыто до ребра, видно после; `/l` без `relationship` | `not_found` при Block |

</frozen-after-approval>

## Code Map

- `apps/web/src/domain/friendship.ts` — протокол AD-10/ARCH-A12: lock пары, Block, повтор, auto-accept; менять только при доказанном дефекте.
- `apps/web/src/lib/friendship-store.ts` — Prisma-адаптер: `pg_advisory_xact_lock(hashtextextended('<low>:<high>',0))` первой инструкцией, `ReadCommitted`.
- `apps/web/src/db/disposable-pg/friendship.pgtest.ts` — harness R1: гонка старого протокола, lock-wait, 10 раундов, ограничения миграции; пишет evidence в `opencode-microtasks/`.
- `apps/web/src/app/api/v1/u/[nick]/invite/route.ts` — `POST /api/v1/u/:nick/invite`, тело не читается.
- `apps/web/src/app/api/v1/u/[[...nick]]/route.ts` и `apps/web/src/actions/profile.ts` — профиль и закрытое `relationship`.
- `apps/web/src/lib/relationships.ts` — `friend` по ребру, `blocked` в любую сторону, pending только для профиля.
- `apps/web/src/domain/visibility.ts` — AD-7: FRIENDS только по ребру; PUBLIC по дружбе/подписке/контакту/токену.
- `packages/contracts/src/friendship.ts` — закрытые исходы и `PROFILE_RELATIONSHIPS`.
- `apps/mobile/app/u/[nick].tsx` — экран 4.1.3; в этой микрозадаче только читается как контекст, вживую не проверялся.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — ключ `4-1-отправка-приглашения-в-друзья`.

## Tasks & Acceptance

**Execution:**
- [x] Корневые `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` с кодами выхода.
- [x] Новая одноразовая PostgreSQL 17.11 в Docker на loopback, `verify:friendship-concurrency`; свежий evidence.
- [x] Standalone-сервер на одноразовой базе: 2 аккаунта, invite/повтор/auto-accept/FRIENDS, self/unknown/401/Block, `/me` и `/l`.
- [x] Матрица AC Story 4.1 в `4.1.4-report.md` с разделением доказанного и непроверенного.
- [x] `sprint-status.yaml`: `4-1` → `review`, не `done`.

**Acceptance Criteria:**
- Given HEAD `bce1302`, when запустить четыре корневые команды, then каждая завершается exit 0 с зафиксированными числами.
- Given одноразовая PostgreSQL, when прогнать harness, then гонка воспроизводится на старом протоколе, а R1 даёт 1 ребро и 0 инвайтов; ограничения миграции срабатывают.
- Given standalone HTTP, when A приглашает B, then `INVITED`; повтор — `PENDING`; встречная — `FRIENDS_CREATED`; FRIENDS-желание появляется только после ребра.
- Given Block, self или неизвестный ник, then `FORBIDDEN`/`FORBIDDEN`/`NOT_FOUND`, профиль при Block — `not_found`.
- Given `/me` и `/l/:token`, then поля `relationship` нет; аноним по ссылке видит только `PUBLIC`.
- Given отчёт, then в нём явно перечислены непроверенные экраны и будущие истории.

## Implementation Notes

- Новых миграций и изменений поведения не потребовалось: все гейты и HTTP-сценарии прошли на существующем коде.
- Одноразовая база: контейнер `postgres:17-alpine`, PostgreSQL 17.11, порт 58421, имя `gift_f5_*`; после прогона контейнер удалён, пароль не сохранён в репозитории.
- HTTP E2E — реальные запросы к `node apps/web/.next/standalone/apps/web/server.js` на `127.0.0.1:45871`; shared serve не трогался.
- Block в HTTP-сценарии вставлен строкой напрямую: создание Block — Story 4.5.
- Один FAIL первого прогона E2E был ошибкой ожидания теста: по AD-7 `PUBLIC` не открывается постороннему по нику. Продукт вёл себя канонически; assertion исправлен, повторный прогон 31/31.
- Экран `/u/[nick]` проверен только автотестами 4.1.3, не вручную и не на устройстве.

## Verification

**Commands:** см. `4.1.4-report.md`; evidence — `4.1.4-pg-evidence-2026-11-06T215546.md`.

**Limitations:** нативная/браузерная ручная проверка, скринридер и живая общая PostgreSQL не выполнялись; Story 4.2/4.3/4.5/4.6/4.7, поиск и уведомления вне границ.
