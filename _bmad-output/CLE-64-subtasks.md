# CLE-64 — Именованные функции для всех компонентов + правило в инструкциях агентов

Linear: https://linear.app/cleverwebagency/issue/CLE-64 · ветка `chore/cle-64-named-functions` от main f0f9910 · исполнитель кода — opencode (`opencode-go/deepseek-v4.1-flash`), ревью и живые проверки — Grok Bot.

## Аудит (main f0f9910, TS AST по git ls-files, без generated)
- React-компоненты: **0 анонимных**. Все экраны `export default function XScreen`, все компоненты `export function`, оба `forwardRef` (ghost-button, gift-form) — с именованной функцией; `memo` не используется. ESLint с `react/function-component-definition` + `react/display-name` даёт **0 нарушений** в apps/mobile и apps/web → правило можно включать сразу.
- `ToastHost` (тост «Изменения сохранены.») объявлен `export function ToastHost` — `Anonymous` в DevTools, вероятно, был до рефакторинга или это внутренние компоненты react-native-web; проверяется в 07 и живой проверкой.
- Не-компонентные анонимные функции (прод-код): inline `on*={() =>}` — 29 (mobile: src/ui 14, app 15); inner `const f = () =>` — 4 (login/register `fieldError`, web env.ts ×2); колбэки эффектов/промисов — mobile app 52, src/session 13, src/ui 28, src/api 2; web src/lib 15, actions 2, domain/db 2; contracts ~9.
- Тесты: стрелочные константы-хелперы — 13; колбэки describe/it/vi — ~1900 (не трогаем).
- Инструкции агентов: `AGENTS.md` (bmad-блок управляемый + свой раздел), `CLAUDE.md` → `@AGENTS.md`, `apps/web/AGENTS.md` (next), `.cursor/rules/ux-design.mdc`; отдельного конфига opencode нет (opencode читает AGENTS.md). Правила про именование нет нигде.

## Подзадачи (порядок)
| # | Файл промпта | Суть | Spec |
|---|---|---|---|
| 01 | 01-agent-instructions-rule.md | Раздел в AGENTS.md (вне bmad-блока) + `.cursor/rules/named-functions.mdc` | S3 |
| 02 | 02-eslint-rules.md | `react/function-component-definition` + `react/display-name` в eslint mobile и web, проверка, что срабатывает | S2 |
| 03 | 03-mobile-ui-handlers.md | src/ui: 14 inline-обработчиков и колбэки эффектов → именованные | S1/конвенция |
| 04 | 04-mobile-screens-session.md | app/ экраны + src/session: fieldError, 15 inline-обработчиков, колбэки эффектов | S1/конвенция |
| 05 | 05-web-and-contracts.md | env.ts хелперы, колбэки lib/actions/domain/db, zod refine/transform | конвенция |
| 06 | 06-tests-helpers.md | 13 стрелочных хелперов в тестах → function | конвенция |
| 07 | 07-devtools-anonymous-check.md | Тест «у каждого компонента src/ui есть имя» + фиксы | Готово-критерий DevTools |

После каждой — ревью диффа, typecheck/test/lint, отчёт пользователю. В конце — общая проверка: живой обход React-дерева на :3000 (Playwright, имена fiber-ов наших компонентов), sync-spa, затем при необходимости новые подзадачи.
