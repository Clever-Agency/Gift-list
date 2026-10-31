<!-- bmad:context -->
<!-- Verified 2026-10-30 against d3a3846. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## Gift List

Сервис вишлистов: клиент Expo (Android, iOS, браузер) и сервер Next.js 16 с Prisma и PostgreSQL, монорепозиторий на npm workspaces (D-41, AD-26). Планирование — `_bmad-output/planning-artifacts/` (PRD, `ARCHITECTURE-SPINE.md`, UX, эпики), статус историй — `_bmad-output/implementation-artifacts/sprint-status.yaml`.

## Policy

- Не пушьте в `main` напрямую и не делайте в него force-push. Одна задача — одна ветка и один PR в `main`; несвязанные изменения не смешивайте в одном PR, а заводите под них отдельную ветку. Если у задачи есть ID в Linear (`CLE-N`), укажите его в названии PR.
- Коммитьте и открывайте PR только по просьбе человека; PR мержит человек.
- Документы в `_bmad-output/` пишите на русском.
- PRD, эпики и архитектуру меняйте только через `bmad-correct-course` или `bmad-architecture`, не правкой вручную.
- Истории продукта — в `epics.md` и `sprint-status.yaml`, Linear — трекер задач (команда CleverWebAgency, проект Gift List). Задачу из Linear, которая соответствует истории, реализуйте через `bmad-build` по этой истории и её критериям приёмки; если история не указана, найдите её в `epics.md`. Задачи без истории (инфраструктура, CI) делайте без BMAD-историй.
- Создавая задачу в Linear, начинайте название с номера истории (`Story 1.3: …`) или пишите в описании «Без истории»; в описании укажите путь к истории в `epics.md`, связанные решения (`D-…`, `AD-…`), что сделать и когда готово. Не переписывайте критерии приёмки в задачу — источник правды `epics.md`.
- Беря задачу Linear в работу, одним вызовом `save_issue` переводите её в `In Progress` и ставьте `assignee: "me"` — это владелец подключения Linear MCP, то есть тот, кто запустил агента. Если задача уже назначена на другого человека, не переназначайте её, а спросите.
- Не меняйте номера историй и ключи в `sprint-status.yaml`.
- Репозиторий публичный до переезда с Vercel (D-17): не коммитьте секреты, `.env*` и реальные строки подключения; образец — `apps/web/.env.example`.
- Prisma, `.env*` и секреты — только в `apps/web`.
- Не используйте сервисы Vercel (Cron, Blob, KV, Edge Config) и API одной платформы (AD-16); задачи по расписанию — Route Handler в `app/api/cron/*` под секретом.
- `apps/mobile` импортирует только `@gift-list/contracts`, импорт `apps/web` запрещён; общий UI-пакет не создавайте — React у веба и Expo разных версий (AD-17).
- В `packages/contracts` — без React, Prisma и `process.env`.

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
- `npm run lint` проверяет только `apps/web`. CI (`.github/workflows/ci.yml`) на каждый PR в `main` гоняет `typecheck`, `lint`, `test`, `build` и запуск standalone-сервера; локально перед PR прогоните `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`.
- Сборка — `output: 'standalone'`: вне Vercel запускайте `node apps/web/.next/standalone/apps/web/server.js`, не `npm start` (`next start`).

## Conventions that differ from defaults

- `packages/contracts` не собирается: отдаёт исходники TS (`exports` → `src/index.ts`), веб транспилирует их через `transpilePackages`. Не добавляйте build-шаг и `dist/`.

<!-- /bmad:context -->
