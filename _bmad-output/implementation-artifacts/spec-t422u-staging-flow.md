---
title: 't422u: код сначала в staging, потом в main'
type: 'chore'
created: '2026-11-16'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Все PR идут прямо в `main`, прод обновляется без промежуточной проверки, а ветка `staging` (ветка Vercel-домена `staging.wishmoon.clever-agency.dev`) не описана ни в политике, ни в CI, ни в документе окружений.

**Approach:** Записать порядок «фича → PR в `staging` (squash) → проверка на staging → PR `staging → main` (merge-коммит)» в Policy `AGENTS.md`, включить CI на `staging` и добавить в `docs/deployment-environments.md` раздел «Порядок выкладки» с правилами миграций и списком ручных настроек GitHub. Источник — решение человека: Евгений, t422u; блок `bmad:context` правится по правилам `bmad-project-context` (refresh, запись в ledger).

</frozen-after-approval>

## Implementation Notes

- `AGENTS.md` (внутри блока `bmad:context`): Policy переписан в четыре строки — запрет push/force-push в `staging` и `main`, один PR задачи в `staging` с squash-мержем, продвижение отдельным PR `staging → main` с merge-коммитом (с причиной: иначе истории веток расходятся), обратный мерж хотфикса из `main` в `staging`. Правило про `CLE-N` в названии PR и про несвязанные изменения сохранено. Строка про CI в «Running and verifying»: PR и push в `staging` и `main`. Строка `Verified` переставлена на 2026-11-16 / 4ec676a.
- Блок `bmad:context` правится по правилам `bmad-project-context` в намерении refresh: текст политики живёт только в самом блоке, генератора из CI/конфигов нет, поэтому источник один — этот блок, и splice идёт между маркерами. Источник записи — решение человека: Евгений, t422u. Вне маркеров ничего не менялось.
- `.github/workflows/ci.yml`: `on.pull_request.branches` и `on.push.branches` → `[main, staging]`; остальное не трогалось (job `check`, шаги, env-заглушки, concurrency — как были).
- `docs/deployment-environments.md`: новый раздел «Порядок выкладки» после сводной таблицы (прогон шагов, миграции, хотфикс, ручные настройки GitHub). Подраздел Staging: снята устаревшая оговорка «сначала создайте саму ветку» — ветка есть. Остальные разделы (таблица, Production, Preview, эксплуатация) новому порядку не противоречат.
- Проверено: в `README.md`, `CLAUDE.md` (импорт `@AGENTS.md`), `apps/web/AGENTS.md`, `apps/web/CLAUDE.md`, `.cursor/rules/*` нет утверждений про PR в `main`. `CONTRIBUTING` и `.github/pull_request_template.md` в репозитории отсутствуют.
- Продуктовые документы (`_bmad-output/planning-artifacts/`) не менялись: решения о ветках/деплое в PRD, эпиках и `ARCHITECTURE-SPINE.md` нет.
- Задача без BMAD-истории: карточки Linear у неё нет, идентификатор t422u — номер задачи в очереди `staging-flow` (C:\Users\Evgeniy\agent-tools\staging-flow\1-prompt.md); ветка `evivanchikov/staging-flow` от `origin/staging` = 4ec676a.
- Проверки: YAML `ci.yml` разобран `js-yaml` из `node_modules` — `on.pull_request.branches` и `on.push.branches` = `["main","staging"]`, job `check`, 12 шагов. `npm run lint` и `npm test` не запускались: изменены только `.md` и `.yml`. Не проверено: реальный триггер workflow на PR в `staging` (нужен push в GitHub) и защита ветки `staging` (настройка GitHub, её меняет человек).

## Review Triage Log

- `docs`: миграции описаны как автоматический шаг — **medium, patch**: в CI и `apps/web/vercel.json` шага миграций нет, раздела «Деплой вне Vercel» в README это не упоминает. Формулировка заменена на «запускаются вручную», добавлена ссылка на README; заодно в AGENTS.md строка про `migrate deploy` перестала говорить «в CI и проде».
- `docs`: fast-forward `staging` до `main` — прямой push в защищённую ветку, противоречит Policy — **medium, patch**: в шаге 4 назван исполнитель с правом обхода защиты, отмечено, что force-push не нужен.
- `docs`: «следующее продвижение откатит фикс» неверно при merge-коммите — **medium, patch**: причина исправлена на реальное следствие — `staging` разойдётся с продом, проверка пройдёт без фикса (и в AGENTS.md).
- `AGENTS.md`: «код попадает в `main` только через `staging`» без исключения хотфикса — **low, patch**: добавлено «кроме срочного фикса».
- `AGENTS.md`: не сказано, от какой ветки заводить ветку задачи — **medium, patch**: «ветку заводите от `staging`».
- `AGENTS.md`: проверка «что уже сделано» смотрит только `main` — **low, patch**: добавлен `staging`.
- `AGENTS.md`: Policy не ссылается на `docs/deployment-environments.md` — **low, patch**: ссылка добавлена в первый пункт.
- `docs`: ручные настройки GitHub без срока и конкретики — **low, patch**: «до первого PR в `staging`»; список правил оставлен как в задании (защита `staging` как у `main`), перечислять чужие настройки репозитория сверх задания не стал.
- `docs`: нет процедуры на случай сбоя — **defer**: записано в `deferred-work.md`; правила отката и корректирующих миграций — решение человека.
- `docs`: не определено, что значит «проверка на staging» — **defer**: записано в `deferred-work.md`; чек-лист и мобильный шаг — отдельное решение.
- `ci.yml`: полный прогон на push в `staging` дублирует проверку PR — **low, reject**: `on.push.branches = [main, staging]` задано условием задачи, а прогон после мержа подтверждает состояние самой ветки; менять триггеры сверх этого нельзя.
- `spec`/`README`: спека не отметила, что `README` не ссылается на поток веток — **low, reject**: `README` — документ сборки и деплоя артефакта, поток веток в нём не описан; ссылку на `docs/deployment-environments.md` теперь даёт Policy.
- `spec`: нет ссылки на трекер и ветку — **low, patch**: добавлено в заметки (задача без истории, карточки Linear нет).
