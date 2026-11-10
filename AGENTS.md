<!-- bmad:context -->
<!-- Verified 2026-10-31 against 7ec8968. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Gift List

Сервис вишлистов: клиент Expo (Android, iOS, браузер) и сервер Next.js 16 с Prisma и PostgreSQL, монорепозиторий на npm workspaces (D-41, AD-26). Планирование — `_bmad-output/planning-artifacts/` (PRD, `ARCHITECTURE-SPINE.md`, UX, эпики), статус историй — `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Policy

- Не пушьте в `main` напрямую и не делайте в него force-push. Одна задача — одна ветка и один PR в `main`; несвязанные изменения не смешивайте в одном PR, а заводите под них отдельную ветку. Если у задачи есть ID в Linear (`CLE-N`), укажите его в названии PR.
- Коммитьте и открывайте PR только по просьбе человека; PR мержит человек.
- Документы в `_bmad-output/` пишите на русском.
- PRD, эпики и архитектуру меняйте только через `bmad-correct-course` или `bmad-architecture`, не правкой вручную.
- Истории продукта — в `epics.md` и `sprint-status.yaml`, Linear — трекер задач (команда CleverWebAgency, проект Gift List). Любую задачу, которая меняет код или конфигурацию, — из Linear или нет — реализуйте через `bmad-build`, чтобы вместе с файлами обновлялись история, `sprint-status.yaml` и документация; без него — только мелкие механические правки (опечатки, форматирование). Если задача соответствует истории, работайте по этой истории и её критериям приёмки; если история не указана, найдите её в `epics.md`. Задачи без истории (инфраструктура, CI) тоже ведите через `bmad-build`, но без BMAD-истории. Если задача меняет решения из PRD, эпиков или архитектуры, сначала пройдите `bmad-correct-course`.
- Создавая задачу в Linear, начинайте название с номера истории (`Story 1.3: …`) или пишите в описании «Без истории»; в описании укажите путь к истории в `epics.md`, связанные решения (`D-…`, `AD-…`), что сделать и когда готово. Не переписывайте критерии приёмки в задачу — источник правды `epics.md`.
- Заводя пакет задач в Linear, сначала сверьте, что уже сделано (`sprint-status.yaml`, статусы в Linear, `main`), и разложите следующие истории по волнам. Описание задачи — разделы «История», «Что сделать», «Порядок», «Готово, когда». В «Порядке» укажите волну, после каких задач начинать (ссылки на `CLE-N`), с чем можно делать параллельно, что задача блокирует, с чем её лучше взять одним заходом и с чем она конфликтует по файлам. Те же связи поставьте в Linear: блокеры — `blockedBy`, «одним заходом», «конфликтует по файлам» и «связана» — `relatedTo`. Истории, которые ждут открытого решения или задач без карточек, не заводите — назовите их и причину человеку.
- Беря задачу Linear в работу, одним вызовом `save_issue` переводите её в `In Progress` и ставьте `assignee: "me"` — это владелец подключения Linear MCP, то есть тот, кто запустил агента. Если задача уже назначена на другого человека, не переназначайте её, а спросите.
- Не меняйте номера историй и ключи в `sprint-status.yaml`.
- Репозиторий публичный до переезда с Vercel (D-17): не коммитьте секреты, `.env*` и реальные строки подключения; образец — `apps/web/.env.example`.
- Prisma, `.env*` и секреты — только в `apps/web`.
- Не используйте сервисы Vercel (Cron, Blob, KV, Edge Config) и API одной платформы (AD-16); задачи по расписанию — Route Handler в `app/api/cron/*` под секретом.
- `apps/mobile` импортирует только `@gift-list/contracts` и `@gift-list/ui`, импорт `apps/web` запрещён (AD-17). UI обоих приложений — только из `packages/ui` на Tamagui (AD-2): импорт по подпутям, не из `"tamagui"`; по API v3 сверяйтесь с `https://tamagui.dev/llms.txt` и `*.manifest.ts` компонентов.
- React в `apps/web` и `apps/mobile` — одна версия, по Expo SDK; все `@tamagui/*` — одна версия, `@tamagui/native` в корневом `package.json`. После обновления зависимостей проверка в CI ловит вложенные копии (AD-28).

## Where things are

- Перед правкой кода в `apps/web` прочтите [apps/web/AGENTS.md](apps/web/AGENTS.md): в Next.js 16 API отличаются от привычных.
- Перед любой работой с интерфейсом (`apps/**/*.tsx`, `apps/**/*.css`) прочтите `.cursor/rules/ux-design.mdc` (автоматически он грузится только в Cursor), нужные разделы `DESIGN.md` и `EXPERIENCE.md` в `_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/` и историю в `_bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md`. Спека главнее `mockups/app-key-screens.html`; `prototype/index.html` устарел — не используйте.
- Статус подарка и поля брони меняет только `GiftStatusService`, видимость желания решает только `VisibilityPolicy`: перед правкой брони, дружбы или чтения желаний прочтите AD-7…AD-10 в `ARCHITECTURE-SPINE.md`.
- Конфигурацию сервера читайте только через `getEnv()` из `apps/web/src/lib/env.ts`; новую переменную добавляйте в `envSchema`.

## Running and verifying

- Команды запускайте из корня; зависимость ставьте в свой workspace: `npm install <pkg> -w @gift-list/web`. Lock один — корневой `package-lock.json`, lock в workspace не создавайте.
- Node.js 24.22.1+ (линия 24.x, как на Vercel; `engines` в корневом `package.json`): в более ранних версиях не закрыты уязвимости из октябрьского выпуска безопасности Node.js 2026, а Node 20 больше не поддерживается.
- `prisma` и `@prisma/client` закреплены на 7.10.0: не ставьте `prisma@latest`, он может указать на Prisma 8 RC.
- `npm run migrate` — интерактивный `prisma migrate dev` для разработки; в CI и проде — `npm exec -w @gift-list/web -- prisma migrate deploy`.
- CI (`.github/workflows/ci.yml`) на PR и push в `main` гоняет `typecheck`, `lint`, `test`, `build` и запуск standalone-сервера; локально перед PR прогоните те же `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
- Сборка — `output: 'standalone'`: вне Vercel запускайте `node apps/web/.next/standalone/apps/web/server.js`, не `npm start` (`next start`).

## Storybook (visual catalog)

- Каталог компонентов — Storybook для web (react-native-web + Vite) в корневом `.storybook/`: `npm run storybook` → http://localhost:6007 (порт 6006 не используем), сборка — `npm run build-storybook`.
- Stories обязательны для новых и изменённых компонентов `packages/ui` (раздел `UI/…`) и `apps/mobile/src/ui` (раздел `App/…`): файл `<component>.stories.tsx` рядом с компонентом, все состояния из `DESIGN.md` и `EXPERIENCE.md` (normal, disabled, busy, error, empty, длинная кириллица) и проверка на 360 px через `globals.viewport`.
- Перед PR смотрите панель a11y (`@storybook/addon-a11y`, `parameters.a11y.test: "todo"`): нарушения видны в панели, но сборку пока не валят.
- Hover, focus и pressed не подделывайте стилями: показывайте настоящие состояния — сфокусируйте элемент в `play` или напишите «наведите / Tab» в описании story.
- Stories — dev-only: ни `src/index.ts`, ни приложения их не импортируют, в прод-бандлы они не попадают, `storybook-static/` в `.gitignore`. Провайдеры приложения в каталоге заменяются моками из `.storybook/mocks` (роутер, env, safe area, иконки), код компонентов из-за этого не меняется.
- `/ui-check` — не каталог, а dev-проверка серверного рендера Tamagui в Next (Story 1.10): его примеры не дублируют stories.

## Conventions that differ from defaults

- `packages/contracts` и `packages/ui` не собираются: отдают исходники TS (`exports` → `src/index.ts`), веб транспилирует их через `transpilePackages`. Не добавляйте build-шаг и `dist/`.
- `packages/ui` — тема (`src/tokens.ts` и `src/config.ts`, значения из frontmatter `DESIGN.md`) и компоненты обоих клиентов. В пакете нет API, env, Prisma и строк интерфейса: тексты приходят пропсами, шрифты — из `expo-font` (приложение) и `next/font` (Next). Платформенные различия хранятся в парах `*.ts`/`*.native.ts`. Чего не хватает экрану, добавляйте в пакет, а не в `StyleSheet` приложения. `scripts/check-boundaries.mjs` (часть `npm run lint`) падает на второй копии `react`, `react-dom`, `tamagui` и `@tamagui/*` в lock и на импорте из `"tamagui"`.
- Тонкая обёртка над `SafeAreaView` / `useSafeAreaInsets` из `react-native-safe-area-context` в `packages/ui` — **утверждённое** исключение из «только Tamagui и React» (AD-2, уточнение 2026-11-10): обёртка без API, env, данных и текстов. Это `SafeArea` из `@gift-list/ui` (`src/safe-area.tsx` и нативный `safe-area.native.tsx`): экран ставит её один раз под `Screen` вместо `SafeAreaView style={{ flex: 1 }}`, вложенных обёрток не ставится, а `SafeAreaView` из библиотеки экраны не импортируют (правило в `scripts/check-boundaries.mjs`).
- `apps/web/public/` генерируется: `npm run build` пересоздаёт его из Expo-web экспорта `apps/mobile` (`scripts/sync-spa.mjs`). Не правьте его — меняйте исходники в `apps/mobile`.

<!-- /bmad:context -->

## Code style: named functions

- **Компоненты React — только именованные функции.** `export function WishCard() {}`, `export default function Screen() {}`. Анонимные компоненты запрещены: никаких `const X = () => <…/>`, `export default () => <…/>`, `memo(() => …)`, `forwardRef((props, ref) => …)` — передавайте именованную функцию: `forwardRef(function GhostButton(props, ref) {…})`.
- **`displayName` рядом с компонентом.** Сразу после компонента — `X.displayName = "X";`, строка равна имени функции (для generic — имени без параметров: `ChoiceGroup.displayName = "ChoiceGroup";`). Прод-сборка минифицирует terser и переименовывает `function WishCard` в `function a`, поэтому без строки React DevTools показывает `Anonymous`. Правило действует для экспортируемых компонентов `src/ui`, экранов `app/` и неэкспортируемых компонентов в этих файлах; хуки (`useAuth`, `useLayerClosed`) и обычные хелперы строка не трогает.
- **Фабрики и HOC.** Если компонент создаётся фабрикой или HOC, задайте ему `displayName`.
- **Прочие функции — тоже именованные.** Хелперы, обработчики событий и колбэки эффектов, где это разумно, объявляйте функциями: `function handlePress() {}`. Стрелки допустимы только для однострочных style-колбэков `Pressable` (`style={({ pressed }) => [...]}`), простых колбэков методов массивов (`.map(x => …)`, `.filter(…)`), однострочных апдейтеров состояния (`setCount((value) => value + 1)`) и однострочных заглушек в моках тестов (`vi.fn(() => true)`, `vi.mock(…)`).
- **Что проверяет линтер.** ESLint (`react/function-component-definition`, `react/display-name` в `apps/mobile` и `apps/web`) проверяет только компоненты; именование остальных функций — на ревью. Тест `apps/mobile/src/ui/component-names.test.tsx` падает, если у экспортированного компонента `src/ui` нет `displayName`, равного имени экспорта, или если у экрана `app/` `displayName` не совпадает с именем `default`-функции.
- **`KEEP_FNAMES` для локальной отладки.** `KEEP_FNAMES=1` заставляет terser сохранять имена всех функций и классов (включая библиотеки) в web-экспорте, чтобы в DevTools были имена из минифицированного бандла; это ~+10% JS, и на Vercel флаг никогда не ставится. Windows PowerShell: `$env:KEEP_FNAMES=1; node apps/web/scripts/sync-spa.mjs` (или `npm run build` в `apps/web`), затем `Remove-Item Env:KEEP_FNAMES`; bash: `KEEP_FNAMES=1 node apps/web/scripts/sync-spa.mjs`.

## Epic acceptance testing

- Когда все истории эпика в `sprint-status.yaml` переходят в `done`, проведите итоговое приёмочное тестирование эпика в отдельной сессии агента, до ретроспективы и до перевода эпика в `done`. Промпт — `_bmad-output/implementation-artifacts/epic-N-qa-prompt.md` по образцу `epic-1-qa-prompt.md`: критерии приёмки всех историй эпика из `epics.md`, проверки CI, сквозные сценарии и известные долги из `deferred-work.md`. Агент только проверяет, код не меняет; отчёт — `epic-N-qa-report.md` рядом с промптом. Дефекты из отчёта заводите задачами в Linear.
