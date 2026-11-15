---
title: 'Ссылка сброса пароля сохраняет http на loopback'
type: 'bugfix'
created: '2026-11-15'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/apps/web/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `passwordResetLink(betterAuthUrl, token)` всегда собирает `https://${base.host}`. Локально `BETTER_AUTH_URL` равен `http://localhost:3000`, письмо уходит на `https://localhost:3000/reset?token=…` и браузер падает с `ERR_SSL_PROTOCOL_ERROR`.

**Approach:** Для настоящих хостов (прод, staging, preview) схема по-прежнему принудительно `https`, чтобы случайный `http` в `BETTER_AUTH_URL` не попал в письмо. Если хост — loopback локальной разработки (`localhost`, `127.0.0.1`, `[::1]`, а также `*.localhost`), исходная схема `http:` сохраняется. Уже заданный `https:` на loopback не понижается. Порт остаётся как сейчас (`base.host`). Путь и query не меняются: `/reset?token=`. `passwordResetRedirectTo` и прочие файлы, кроме теста этой функции, не трогать. `127.0.0.2` и прочие адреса из `127.0.0.0/8`, кроме точного `127.0.0.1`, остаются «настоящими» хостами и уходят на `https`.

</frozen-after-approval>

## Implementation Notes

- `passwordResetLink` оставляет `http:` только если `URL.hostname` — локальный хост (`localhost`, суффикс `.localhost`, точный `127.0.0.1`, `[::1]` или `::1`) и схема исходного URL именно `http:`. Иначе схема принудительно `https:`. Порт берётся из `base.host`, как раньше. Уже заданный `https:` на loopback не понижается.
- `passwordResetRedirectTo` не менялся.
- Тесты в `password-reset-mail.test.ts`: `http://localhost:3000`, `http://127.0.0.1:3000`, `http://[::1]:3000`, `http://app.localhost:3000` остаются `http`; `https://localhost:3000` остаётся `https`; `http://example.com/api/auth` становится `https://example.com/reset?token=` без `/api/auth`. Ожидания письма на `127.0.0.1` в этом файле и в `auth.test.ts` переведены на `http`, иначе suite продолжал бы требовать сломанный `https` на loopback.
- Проверено на Node 24.22.3: `npm run typecheck -w @gift-list/web`, `npm run lint -w @gift-list/web`, `npm test -w @gift-list/web` (84 файла, 983 теста) — зелёные.
- После ревью в тот же тест добавлены границы: `127.0.0.2` и `localhost.example.com` уходят на `https`, нестандартный порт `example.com:8443` сохраняется. В комментарии `passwordResetLink` явно назван `*.localhost`.

## Review Triage Log

- `low` → patch — тесты не фиксировали края нового списка хостов. Добавлены `http://127.0.0.2:3000` → `https`, `http://localhost.example.com` → `https` (иначе прошёл бы `endsWith("localhost")` без точки) и `http://example.com:8443/api/auth` → `https://example.com:8443/reset?token=tok`.
- `false` — сброс порта `:443` у `http://example.com:443` до `https://example.com/…` делает `new URL` для схемы `https`. Прежний код собирал ссылку тем же конструктором от `https://${base.host}`, так что это не регрессия этой правки.
- `false` — проверка Resend только по `html` не открывает дыру: `buildPasswordResetMessage` уже требует, чтобы `text` содержал тот же `href`. Один `it` на форму ссылки — стиль файла, не дефект.
- `false` — на Node 24.22.3 `new URL("http://[::1]:3000").hostname` равен `[::1]`, и тест ждёт `http://[::1]:3000/reset?token=tok`. Сравнение с `::1` не даёт неверной ссылки; это вторая запись того же адреса, если рантайм вернёт hostname без скобок.
- `low` reject — `localhost.` и `app.localhost.` (корневая точка DNS) не входят в список хостов и уходят на `https`. В `BETTER_AUTH_URL` так почти не пишут; отдельная нормализация шире простой правки.
- `false` — `0.0.0.0` не назван ни запросом, ни спекой. Для хоста вне списка принудительный `https` — как раз правило.
- `low` → patch — комментарий экспортируемой функции говорил только «loopback», хотя `*.localhost` тоже сохраняет `http:`. В комментарий добавлен `*.localhost`.
- `low` defer — `docs/deployment-environments.md` и замороженный блок Story 1.7 всё ещё говорят, что ссылка сброса всегда `https`. Для прод/staging/preview это верно; расхождение только у loopback. Запись в `deferred-work.md`. Эти файлы вне разрешённого diff, замороженный блок Story 1.7 не редактируется.
- `false` — ожидание в `auth.test.ts` переведено с `https://127.0.0.1` на `http://127.0.0.1`. Это тест, не прод-код: фикстура `BETTER_AUTH_URL` уже `http://127.0.0.1:3000`, и без правки suite падает. Запрос разрешает править тесты и требует зелёный прогон `apps/web`.
