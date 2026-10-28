# Gift List — монорепозиторий

npm workspaces (D-41, AD-26). Команды запускаются из корня.

| Каталог | Что внутри | Правила |
|---|---|---|
| `apps/web` | Next.js: сервер, `app/api/v1`, cron, серверные страницы (`/l`, `/i`, `/unsubscribe`, `/admin`), Prisma, env | Prisma, `.env*` и секреты — только здесь. Перед правкой кода прочтите [apps/web/AGENTS.md](apps/web/AGENTS.md). |
| `apps/mobile` | Приложение Expo (Android, iOS, браузер) | Пока пустой workspace (Story 1.3). Импортирует только `@gift-list/contracts`; импорт `apps/web` запрещён (AD-17). |
| `packages/contracts` | `@gift-list/contracts`: zod-схемы конверта AD-12, gift card, коды ошибок | Без React, Prisma и `process.env`. Сборки нет, пакет отдаёт исходники TS. |

- Зависимость ставится в свой workspace: `npm install <pkg> -w @gift-list/web`. Lock один — корневой `package-lock.json`.
- Общего UI-пакета нет: React у веба и Expo разных версий (AD-17).
- Планирование — `_bmad-output/planning-artifacts/`, статус историй — `_bmad-output/implementation-artifacts/sprint-status.yaml`. Язык документов — русский.
