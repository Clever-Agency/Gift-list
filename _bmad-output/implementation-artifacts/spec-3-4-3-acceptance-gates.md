---
title: 'Story 3.4.3: приёмка гейтов Story 3.4'
type: 'chore'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 3.4.1 (серверное чтение `GET /api/v1/u/:nick`) и 3.4.2 (экран `/u/[nick]`) уже в ветке, но полные корневые гейты (`npm test`, `npm run build`) не запускались, матрица приёмки Story 3.4 не собрана, а статус истории всё ещё `backlog`.

**Approach:** прогнать полные корневые `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` с явными кодами выхода, честно собрать русскую матрицу критериев приёмки Story 3.4 против фактических доказательств (unit/mock против живой БД), записать отчёт `3.4.3-report.md` и перевести историю в `review` (не `done`). Дефекты править только если гейт упал и только в границах Story 3.4.

</frozen-after-approval>

## Implementation Notes

- Правки кода — только при падении гейта и только в границах Story 3.4; иначе коммитов кода нет.
- Приёмка 3.4.3 не включает запуск устройства, браузера или скринридера: живые проверки друга, подписчика, `ContactMatch` и Block невозможны без таблиц Epic 4, поэтому в матрице они отмечены как mock-only.
- 2026-11-06: полные корневые гейты пройдены на `b18650c` — `typecheck`, `lint`, `test` (125 файлов, 1496 тестов + 5 проверок границ) и `build` дали exit `0`. Правок кода не потребовалось: коммиты 3.4.1 (`c6b528d`) и 3.4.2 (`094c300`) не менялись.
- Точечные прогоны для матрицы: 12 тестов маршрута `/api/v1/u` и 47 тестов мобильного профиля, exit `0`.
- `sprint-status.yaml`: `3-4-профиль-u-nick` переведена в `review` (не `done`). Push, PR, `main`, Linear, живые БД, `.env` и миграции не трогались.
