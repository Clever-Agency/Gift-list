---
title: 'CI: архивирование желаний по расписанию для прода и staging'
type: 'chore'
created: '2026-11-19'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/docs/deployment-environments.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `.github/workflows/wish-expiry.yml` по расписанию вызывает `/api/cron/wish-expiry` только у прода (единственный секрет `APP_URL`), поэтому на staging желания архивируются лишь ручным `curl`. Story 2.6 / AD-16 на staging по расписанию не проверяется.

**Approach:** Без истории (инфраструктура/CI). Workflow вызывает оба окружения через GitHub Environments: `cron-production` берёт секреты репозитория `APP_URL` и `CRON_SECRET`, `cron-staging` — свои секреты окружения с тем же именем. Окружения и секреты человек уже создал, staging-эндпоинт ответил 200. Падение одного окружения не отменяет другое. Ручной запуск позволяет выбрать окружение. Обновить `docs/deployment-environments.md`.

</frozen-after-approval>

## Implementation Notes

- Файлы: `.github/workflows/wish-expiry.yml`, `docs/deployment-environments.md`. Ветка `chore/wish-expiry-environments` от `origin/staging`; задачи в Linear нет.
- Matrix по окружениям `cron-production` и `cron-staging`, `fail-fast: false`; `workflow_dispatch` с выбором `all`/`production`/`staging` через `fromJSON(format(...))`. `concurrency` на окружение — ручной запуск ждёт scheduled-запуск, а не вызывает эндпоинт параллельно.
- По ревью: job `cron-staging` падает, если `APP_URL` не `https://staging.…` (при пропавшем секрете окружения подставился бы секрет репозитория, то есть прод), а прод-job падает, если `APP_URL` указывает на staging. Варианты проверены локально.
- В документе: таблица секретов, ротация `CRON_SECRET` (Vercel → Redeploy → GitHub), аварийный `curl`, расписание из `staging` действует и на прод. Правка о ruleset `main` (`refs/heads/main`) связана с этой задачей: основную ветку сменили на `staging` ради неё и агентов.
- Проверено до кода: окружения `cron-production` (без секретов) и `cron-staging` (`APP_URL`, `CRON_SECRET`) существуют, staging-эндпоинт ответил 200, основная ветка — `staging` (`gh api`). Готово, когда после мержа в `staging` scheduled-запуск даёт два зелёных job.

## Review Triage Log

- medium — при пропавшем секрете `cron-staging` job молча вызвал бы прод. Исправлено (patch): проверка хоста в обе стороны.
- low (defer, без записи) — ограничить `cron-production` веткой: секреты репозитория видны любому workflow, поэтому ограничение окружения не защищает. Объяснение добавлено в документ.
- low — нет `concurrency`. Добавлено.
- low — шум во вкладке Deployments. Принят сознательно и записан в документ; `deployment: false` не используется, поддержка ключа не проверена.
- false — «основная ветка не проверена»: `gh api repos/... --jq .default_branch` = `staging`, локальный `origin/HEAD` просто устарел.
- false — «спека не доведена»: ревью шло до финализации, этот шаг её доводит.
- low — удалён аварийный `curl`. Вернул одной строкой.
- low — порядок ротации секрета не описан. Добавлен.
- low — неточный комментарий в workflow и формулировка ячеек таблицы. Исправлены.
- low (отклонено) — смешение задач: правка про ruleset `main` описывает смену основной ветки, из-за которой и меняется cron.
