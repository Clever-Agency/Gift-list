---
title: 'Смена имени через /api/auth/update-user'
type: 'bugfix'
created: '2026-11-18'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `POST /api/auth/update-user` пишет отображаемое имя (`User.name`) в обход экрана настроек и серверного action. Длина из `DISPLAY_NAME_MAX` не проверяется, колонка поиска `nameNormalized` не обновляется, и поиск друзей остаётся на старом имени. Ник этим путём не пишется. Регистрация задаёт имя своим путём и не должна сломаться.

**Approach:** Закрыть HTTP-путь `/update-user` так же, как уже закрыты сырые пути входа, регистрации и сброса: 404 до обработчика Better Auth. Внутренний `auth.api` не трогать. Имя по-прежнему задаётся только в `registerUser` вместе с `nameNormalized`. Смена ника и регистрация не меняются.

</frozen-after-approval>

## Implementation Notes

- `input: false` не закрывает `name`: Better Auth снимает `name` и `image` с тела до `parseUserInput`. Путь добавлен в массив `disabledPaths` (`"/update-user"`), как сырые пути входа (CLE-57). Ответ HTTP — 404 до обработчика.
- Экран настроек меняет только ник (`updateNick`). Отображаемое имя пишет только `registerUser` (`name` и `nameNormalized` вместе). Поиск (`searchUsers`) и круг читают `nameNormalized`.
- `auth.api.updateUser` в приложении не вызывается. OAuth и `updateUserInfoOnLink` не включены. Регистрация и смена ника не трогались.
- Тест: `POST /api/auth/update-user` с обычным именем, с именем длиннее `DISPLAY_NAME_MAX` и с cookie сессии отвечает 404 `NOT_FOUND`, без `set-cookie`. `parseUserInput` по-прежнему не отвергает `name` — это фиксирует, почему закрыт именно HTTP-путь.

## Review Triage Log

- `low` → patch — комментарий CLE-94 всё ещё описывал `/api/auth/update-user` как живой разбор тела. Комментарий уточнён: `parseUserInput` не видит `name`, HTTP-путь закрыт. В тест добавлено `parseUserInput(..., { name })` → `{}`.
- `false` — `auth.api.updateUser` и OAuth `updateUserInfoOnLink` пишут `name` без `nameNormalized`. В приложении нет вызова `auth.api.updateUser`, нет `socialProviders`, флаг `updateUserInfoOnLink` не включён (в библиотеке срабатывает только при `=== true`). Достижимый обход — только HTTP, он закрыт.
- `low` → patch — заголовок теста обещал проверку колонок, а смотрел только 404. Заголовок сужен до отказа до обработчика. Длина берётся из `DISPLAY_NAME_MAX`. Отдельный стенд с Postgres не добавлялся: `disabledPaths` отвечает в `onRequest` до адаптера, тот же приём, что у CLE-57.
- `low` → patch — комментарий у `disabledPaths` смешивал счётчики входа и `nameNormalized` и не упоминал `image`. Причины разведены, `image` назван.
- `low` reject — список из трёх путей в закрытом пункте `deferred-work.md` (CLE-57) не переписывался: это свидетельство того закрытия, актуальный набор — `auth.ts` и тест.
