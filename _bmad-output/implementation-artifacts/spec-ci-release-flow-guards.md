---
title: 'CI: защита потока выкладки staging → main и обратное вливание хотфиксов'
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

**Problem:** Порядок выкладки (задачи → `staging` → `main`, хотфикс мимо `staging`) записан в `docs/deployment-environments.md`, но ничем не проверяется: PR в `main` можно открыть из любой ветки, а обратное вливание хотфикса в `staging` держится на памяти человека.

**Approach:** Без истории (инфраструктура/CI). Две проверки в GitHub Actions: (1) `guard-main` — PR в `main` проходит только из `staging` или `hotfix/*` этого же репозитория; человек делает её обязательной в правиле для `main`. (2) После push в `main` workflow открывает PR `main → staging`, если в `main` есть изменения содержимого, которых нет в `staging`, и такого PR ещё нет. Настройки GitHub (rulesets) человек делает сам, workflow их не меняет. Обновить `docs/deployment-environments.md`.

</frozen-after-approval>

## Implementation Notes

- `guard-main` — отдельный файл `.github/workflows/guard-main.yml`, события `pull_request` (`opened`, `reopened`, `synchronize`, `edited` — смена базы на `main`) по `branches: [main]`. Имя job `guard-main` = имя обязательной проверки. Проверяется ещё и `head.repo.full_name == github.repository`, чтобы ветка `staging` из форка не прошла.
- Обратное вливание — `.github/workflows/back-merge.yml` на `push` в `main`. Критерий «отстаёт»: `git diff --quiet origin/staging...origin/main` (изменения `main` после общего предка). После обычной выкладки `staging → main` merge-коммитом дерево `main` совпадает с влитым `staging`, дифф пуст, PR не открывается — иначе каждая выкладка рождала бы пустой синхронизирующий PR. Хотфикс даёт непустой дифф → PR `main → staging`.
- PR, созданный `GITHUB_TOKEN`, не запускает другие workflow, поэтому обязательная проверка `check` на нём не появится. Workflow берёт секрет `BACK_MERGE_TOKEN` (fine-grained PAT или токен GitHub App с правами Contents и Pull requests на запись), а без него — `github.token` и пишет предупреждение: CI тогда запускается закрытием и повторным открытием PR человеком. Для `github.token` в настройках Actions должно быть включено «Allow GitHub Actions to create and approve pull requests».
- PR `main → staging` мержится merge-коммитом, поэтому правило для `staging` должно разрешать и squash, и merge.
- Файлы: `.github/workflows/guard-main.yml`, `.github/workflows/back-merge.yml`, `docs/deployment-environments.md` (порядок выкладки, раздел «Хотфикс», «Настройки GitHub»), `AGENTS.md` (правило хотфикса: ветка `hotfix/*` от `main`, squash, обратное вливание merge-коммитом).
- По ревью `guard-main` дополнительно падает, если в `hotfix/*` есть коммиты из `staging`, которых нет в `main` (хотфикс, ответвлённый от `staging`).
- Проверено на тестовом репозитории: `git diff staging...main` пуст после выкладки, после опережения `staging` и после обратного вливания, непуст после хотфикса. Проверка утечки из `staging` ловит `hotfix/*` от `staging` и пропускает `hotfix/*` от `main`. YAML разбирается (`js-yaml`), actionlint локально не установлен.
- Ветка задачи `chore/ci-release-flow-guards` заведена от `origin/staging`.

## Review Triage Log

- medium — причина запрета «Require branches to be up to date» была неверной: `staging` отстаёт от `main` на merge-коммит после каждой выкладки, а не только после хотфикса. Исправлено в документе.
- low — не объяснено, зачем раньше были sync-PR (#102, #104): их вызывали выкладки squash-ом. Добавлена фраза.
- low — merge-коммит с разрешением конфликта меняет содержимое, и PR обратного вливания откроется. Это верное поведение; оговорка добавлена в документ и в комментарий workflow.
- medium — не было порядка действий при конфликте в PR `main → staging`: head защищён. Добавлен порядок через ветку `sync/*`.
- medium — `hotfix/*` от `staging` проходил `guard-main`. Добавлена проверка на коммиты из `staging` (patch).
- low — неверная мотивировка «иначе» про merge-коммит. Две причины разделены в документе и в `AGENTS.md`.
- low — `AGENTS.md` не говорил, что хотфикс ответвляется от `main` и мержится squash-ом. Исправлено.
- low — автоудаление head-веток опасно без запрета удаления. Добавлена оговорка.
- low — непонятная ошибка, если PR не удалось создать. Добавлен `::error::` с нужной настройкой.
- low — лишний `git fetch` после `checkout` с `fetch-depth: 0`. Удалён.
- false — неполный шаблон spec: маршрут `oneshot` по шагу 2 намеренно оставляет только Intent и Implementation Notes.
- low (отклонено) — scope spec: правка `AGENTS.md` внесена в заметки, абзац про default branch отвечает на исходный вопрос человека о настройке.
- low — порядок включения `guard-main` как обязательной проверки. В документ добавлен совет «сначала выкладка, потом ruleset».
- low (отклонено) — если хотфикс уже перенесён cherry-pick-ом, откроется PR, но его мерж безвреден. Случай редкий, усложнять критерий не стоит.
