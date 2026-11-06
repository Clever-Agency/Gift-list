---
title: 'next dev не переписывает apps/web/AGENTS.md'
type: 'bugfix'
created: '2026-11-05'
status: 'in-progress'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `next dev` (и `npm run dev` из корня) переписывает отслеживаемый `apps/web/AGENTS.md`: в блоке `<!-- BEGIN:nextjs-agent-rules -->` заголовок `# This is NOT the Next.js you know` не совпадает с тем, что пишет Next 16.4.3 (`##`). После любого запуска dev-сервера дерево грязное, и эту правку легко закоммитить в чужой PR.

**Approach:** Закоммитить управляемый блок ровно в том виде, который пишет установленный Next (`##`), не меняя смысл предупреждения для агентов. Повторный `next dev` не должен трогать файл. `agentRules: false` не использовать: при `false` Next удаляет блок, а его читают агенты.

</frozen-after-approval>

## Implementation Notes

- В `apps/web/AGENTS.md` заголовок блока заменён с `#` на `##`. Это единственное отличие от `buildAgentRulesBlock()` в Next 16.4.3 (`node_modules/next/dist/server/lib/generate-agent-files.js`).
- `agentRules: false` не ставили. В `start-server.js` флаг по умолчанию включён (`agentRules !== false`). При `false` `syncAgentRulesForDev` вызывает `removeAgentRulesFiles` и удаляет блок, который читают агенты.
- Файл остаётся в CRLF. `hasCurrentAgentRules('apps/web')` возвращает true, `writeAgentFiles` — `unchanged`.
- Два запуска `npm run dev -w @gift-list/web` (порты 3217 и 3218, Next 16.4.3, Ready). Хеш `apps/web/AGENTS.md` до и после — `af3b7c84114bafeee578bf1adff2ef74af2cc6a2`. `git diff` против `main` — только заголовок.
