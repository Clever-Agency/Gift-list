---
title: 'CLE-58: после сброса пароля прежние ссылки недействительны'
type: 'bugfix'
created: '2026-11-02'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/AGENTS.md'
story_key: '1-7-сброс-пароля-по-email'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Два запроса сброса (T1, T2) и успешная смена пароля по T2 оставляют T1 рабочей до часа. Better Auth 1.7.14 в `consumeVerificationValue` удаляет только строки с тем же `identifier` (`reset-password:<token>`); `value` — id пользователя. `resetPassword` в `apps/web/src/actions/password-reset.ts` остальные ссылки этого пользователя не гасит. FR-3 и AD-3 требуют, чтобы после успешного сброса прочие выданные ему ссылки были недействительны (`RESET_LINK_STALE`).

**Approach:** После успешного сброса удалять все записи `Verification` этого пользователя с префиксом `reset-password:`. Хук `onPasswordReset` покрывает и `auth.api.resetPassword` (его зовёт `POST /api/v1/password/reset`), и сырой `POST /api/auth/reset-password`. Сессии уже отзывает Better Auth: `revokeSessionsOnPasswordReset` внутри той же транзакции, что пароль и гашение использованного токена (`deleteUserSessions`) — отдельно сессии не трогать, флаг не менять. Чужие токены и записи не `reset-password:` не удалять. Неуспешный сброс (просрочка, короткий пароль, пустой токен) чужие ссылки не гасит. Тест: сброс по T2, затем T1 отвечает `RESET_LINK_STALE`.

</frozen-after-approval>

## Implementation Notes

- Гипотеза QA подтверждена по better-auth 1.7.14: `consumeVerificationValue` удаляет только строки с тем же `identifier` (`reset-password:<token>`), `value` — id пользователя. Хук `onPasswordReset` в типах пакета вызывается после сохранения пароля и после отзыва сессий.
- Сессии отдельно не трогал: `revokeSessionsOnPasswordReset: true` и `transaction: true` уже снимают все сессии пользователя в одной транзакции с паролем (`deleteUserSessions`).
- Очистка стоит в `onPasswordReset`, не в action: тот же хук срабатывает и для `auth.api.resetPassword` (`POST /api/v1/password/reset`), и для сырого `POST /api/auth/reset-password`, который CLE-57 не закрывал. `deleteMany` идёт после коммита. Если удаление упадёт, клиент получит 500: пароль уже сменён, использованный токен уже погашен.
- Тест подменяет только `auth.api.resetPassword` имитацией Better Auth (гасит один identifier) и вызывает настоящий `onPasswordReset`. Без хука T1 остался бы валидным.
- `sprint-status` ключа `1-7-сброс-пароля-по-email` уже `done`; синхронизация не откатывает его в `in-progress` или `review`.
- Typecheck: `auth.api.resetPassword` только для чтения в типах, в рантайме свойство записываемое. Тест пишет через приведение. Хук зовётся одним аргументом: выведенный тип колбэка — одна функция.

## Review Triage Log

- `low` reject — два одновременных сброса успевают закоммитить пароль до чужого `deleteMany`: окно на время одного запроса, оба токена гасятся своими транзакциями, после хуков чужих ссылок не остаётся. Увести очистку внутрь транзакции Better Auth этим хуком нельзя.
- `low` reject — сбой `deleteMany` после коммита даёт 500, пароль уже сменён, соседние ссылки живы до срока. Так записано в заметках; повтор и тест на отказ БД шире простой правки. В CI базы нет.
- `low` reject — тест не гоняет настоящий `auth.api.resetPassword`, а подменяет его и зовёт реальный `onPasswordReset`. Общий прогон без Postgres; адаптер в памяти не делит хранилище с Prisma.
- `low` reject — имитация просрочки удаляет только предъявленный ряд и сравнивает `<=`, а `findVerificationValue` ещё чистит все просроченные `Verification`. На хук это не влияет: просрочка до него не доходит, живой сосед остаётся.
- `low` reject — FR-3 и AD-3 дословно не говорят «погаси остальные ссылки»; это чтение CLE-58 и замороженного намерения. Блок намерения не переписывался.
- `defer` — `/change-password` не вызывает `onPasswordReset`, старая ссылка сброса после смены пароля вошедшим ещё действует. Не этот дефект. Запись в `deferred-work.md`.
- `false` — `user.id` в хуке обязательная строка, параметр хелпера `string`. Prisma отбросит `undefined` только если его передать; этот вызов так не делает.
