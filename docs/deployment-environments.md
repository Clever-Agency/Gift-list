# Окружения развёртывания

Три среды на Vercel: Production, Staging и Preview. Секретов в этом файле нет —
только имена переменных и правила, где их задавать. Значения `BETTER_AUTH_URL`
читаются через `getEnv()` из `apps/web/src/lib/env.ts`; образец переменных —
`apps/web/.env.example`.

## Сводная таблица

| | Production | Staging | Preview (`*.vercel.app`, остальные ветки) |
| --- | --- | --- | --- |
| Домен | `wishmoon.clever-agency.dev` | `staging.wishmoon.clever-agency.dev` | выдаётся Vercel на каждый деплой |
| Ветка в Vercel | Production, ветка `main` | Preview, ветка `staging` | все прочие ветки |
| `BETTER_AUTH_URL` | `https://wishmoon.clever-agency.dev` | `https://staging.wishmoon.clever-agency.dev` | не задавать — подставляется из `VERCEL_BRANCH_URL ?? VERCEL_URL` |
| `RESEND_API_KEY` | ключ Resend для прода | ключ Resend для staging | не задавать — письма сброса не отправляются |
| `EMAIL_FROM` | `WishMoon <noreply@wishmoon.clever-agency.dev>` | `WishMoon Staging <noreply@staging.wishmoon.clever-agency.dev>` | не задавать |
| `DATABASE_URL`, `DIRECT_URL` | переменные прода | Preview-переменные, ограниченные веткой `staging` | Preview-переменные без привязки к ветке |
| Мобильное приложение | боевая сборка | `EXPO_PUBLIC_API_BASE_URL=https://staging.wishmoon.clever-agency.dev` | — |

## Порядок выкладки

Прод обновляется только через `staging`:

1. feature-ветка (от `staging`) → PR в `staging`, мерж squash-ом;
2. проверка на `staging.wishmoon.clever-agency.dev` после деплоя Vercel и
   зелёного CI;
3. PR `staging → main`, мерж merge-коммитом (не squash-ом), чтобы истории веток
   не расходились. Merge-коммит в `main` изменений не добавляет (если при
   выкладке не разрешали конфликт), поэтому синхронизировать `staging` после
   выкладки не нужно. Прежние PR «Синхронизация main → staging» (#102, #104)
   понадобились, потому что выкладки мержились squash-ом.

PR в `main` принимается только из `staging` или `hotfix/*` этого репозитория,
причём в `hotfix/*` не должно быть коммитов из `staging`, которых нет в `main`.
Это проверяет `guard-main` (`.github/workflows/guard-main.yml`).

Миграции Prisma запускаются вручную — автоматического шага в деплое нет (команда —
README, «Деплой вне Vercel»): `prisma migrate deploy` с `DATABASE_URL` и
`DIRECT_URL` staging-базы после мержа в `staging` и до проверки на staging,
на прод-базу — только при продвижении в `main`.

Ночное архивирование желаний (Story 2.6) требует ручных шагов:

- `CRON_SECRET` (не короче 32 символов) задаётся в env хоста каждого окружения
  (без него `getEnv()` не даёт стартовать серверу) и в секрете GitHub Actions
  `CRON_SECRET`; значения хоста и секрета совпадают;
- миграция `20261110180000_gift_expiry_index` применяется `prisma migrate deploy`
  в общем порядке (после мержа в `staging` и до проверки на staging, на прод-базу —
  при продвижении в `main`); без неё выборка кандидатов идёт без индекса;
- `.github/workflows/wish-expiry.yml` по `schedule` запускается только с
  default-ветки, а `workflow_dispatch` читает тот же единственный секрет
  `APP_URL`, поэтому для staging он не подходит. Архивирование на staging
  запускается вручную:

  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
    https://staging.wishmoon.clever-agency.dev/api/cron/wish-expiry
  ```

### Хотфикс

Срочный фикс идёт мимо `staging`, чтобы не выкатить недоделанное из неё:

1. ветка `hotfix/<кратко>` от `main` → PR в `main`, мерж squash-ом;
2. после мержа `.github/workflows/back-merge.yml` сам открывает PR
   `main → staging` «Синхронизация main → staging (хотфикс)», если в `main` есть
   изменения, которых нет в `staging`, и такой PR ещё не открыт;
3. этот PR мержится merge-коммитом, не squash-ом: squash разведёт истории, и
   следующая выкладка `staging → main` принесёт конфликты. Без обратного
   вливания `staging` разойдётся с продом, и следующая проверка пройдёт без
   фикса.

Если в PR `main → staging` конфликт, редактор конфликтов GitHub не поможет: он
коммитит в `main`, а её защищает ruleset. Порядок такой: ветка `sync/<кратко>`
от `main`, в неё `git merge origin/staging` с разрешением конфликта, PR в
`staging` merge-коммитом. Автоматический PR после этого закройте.

PR, открытый от `GITHUB_TOKEN`, не запускает CI. Поэтому workflow берёт секрет
Actions `BACK_MERGE_TOKEN` (fine-grained PAT или токен GitHub App с правами
Contents и Pull requests на запись только для этого репозитория). Без секрета PR
открывается от `GITHUB_TOKEN` с предупреждением в логе, и проверку `check`
запускают, закрыв и снова открыв PR. Workflow можно запустить и вручную
(`workflow_dispatch`).

### Настройки GitHub

Их человек меняет вручную, workflow их не трогают.

- Repository → General → Pull Requests: включены Allow merge commits и Allow
  squash merging. Automatically delete head branches — по желанию и только
  вместе с запретом удаления в обоих rulesets: у PR выкладки head — `staging`,
  у обратного вливания — `main`.
- Ruleset для `staging`: обязательный PR, мерж squash-ом (задачи) и
  merge-коммитом (обратное вливание хотфикса), обязательная проверка `check`,
  запрет force-push и удаления.
- Ruleset для `main`: обязательный PR, мерж merge-коммитом (выкладка) и squash-ом
  (хотфикс), обязательные проверки `check` и `guard-main`, запрет force-push и
  удаления. Require branches to be up to date не включать: merge-коммита
  выкладки в `staging` нет, поэтому с этой галочкой каждый следующий PR
  `staging → main` требовал бы синхронизации.
- `guard-main` можно выбрать обязательной проверкой только после того, как
  workflow попал в `main` и хотя бы раз отработал. Поэтому сначала выкладка с
  этим workflow, потом правка ruleset для `main`.
- Actions → General → Workflow permissions: включено Allow GitHub Actions to
  create and approve pull requests — если `BACK_MERGE_TOKEN` не задан.
- Если основной веткой (default branch) сделать `staging`, PR по умолчанию пойдут
  в неё. `wish-expiry.yml` по расписанию тогда запускается из `staging`, но бьёт
  по-прежнему в `APP_URL`, то есть в прод.

## Production

- Домен `wishmoon.clever-agency.dev` привязан в Vercel к окружению Production
  и ветке `main`.
- `EMAIL_FROM`: `WishMoon <noreply@wishmoon.clever-agency.dev>`.
- Ключ Resend — продовый, только на отправку и только для продового домена.
- `BETTER_AUTH_URL=https://wishmoon.clever-agency.dev`.
- `CRON_SECRET` (≥ 32 символа) — тот же, что в секрете GitHub Actions; `APP_URL`
  в секретах Actions указывает на этот домен: по расписанию работает только он.

## Staging

- Домен `staging.wishmoon.clever-agency.dev` привязан к ветке GitHub `staging`
  (в неё приходят PR задач — см. «Порядок выкладки»).
- Переменные `RESEND_API_KEY`, `EMAIL_FROM`
  (`WishMoon Staging <noreply@staging.wishmoon.clever-agency.dev>`),
  `BETTER_AUTH_URL=https://staging.wishmoon.clever-agency.dev`, `DATABASE_URL` и
  `DIRECT_URL` создаются в Vercel как Preview-переменные, **ограниченные веткой
  `staging`**, а не все Preview-деплои.
- Мобильная staging-сборка:
  `EXPO_PUBLIC_API_BASE_URL=https://staging.wishmoon.clever-agency.dev`.
- Ключ Resend — staging, только на отправку и только для staging-домена.
- `CRON_SECRET` (≥ 32 символа) — Preview-переменная, ограниченная веткой
  `staging`. Расписание сюда не стучится (`APP_URL` один): архивирование на
  staging — вручную, см. «Порядок выкладки».

## Preview (`*.vercel.app`, остальные ветки)

- `BETTER_AUTH_URL` не задавать: значение подставляет `apps/web/src/lib/env.ts`
  как `https://${VERCEL_BRANCH_URL ?? VERCEL_URL}` (у хостов Vercel нет
  протокола). Явно заданный `BETTER_AUTH_URL` всегда важнее. В production
  запасного значения нет — без переменной валидация падает.
- Ключа Resend нет: письма сброса не отправляются, в лог пишется
  `Password reset email is not configured`, HTTP-ответ forgot-password при этом
  не меняется.

## Общие правила эксплуатации

- Почтовые ящики продукта: `support@wishmoon.clever-agency.dev` — техподдержка,
  на него ведёт «Написать автору» (`AUTHOR_EMAIL`);
  `privacy@wishmoon.clever-agency.dev` — запросы на удаление аккаунта и о
  персональных данных (политика, форма Google Play). Письма сервиса уходят с
  `noreply@` (`EMAIL_FROM`), ответы на него не читаются (D-35, D-48).
- Resend: регион `eu-west-1`.
- DNS в Cloudflare — **DNS only** (серая тучка), без прокси. Значения CNAME
  берутся из Vercel. Оранжевая тучка (прокси) блокирует выпуск сертификата.
- У корневого домена уже есть DMARC `p=reject; sp=reject; adkim=s; aspf=s`. На
  старте продукта добавить:
  - `_dmarc.wishmoon` TXT: `v=DMARC1; p=none; rua=mailto:clever.web.agency@gmail.com`
  - `_dmarc.staging.wishmoon` TXT с тем же значением
  Позже, когда отчёты станут чистыми: `quarantine`, затем `reject`.
- Ссылка сброса всегда имеет вид
  `https://<хост из BETTER_AUTH_URL>/reset?token=…`, поэтому она должна вести на
  тот же бэкенд, который выдал токен.
