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
  (без него `getEnv()` не даёт стартовать серверу) и в GitHub Actions; значения
  хоста и секрета совпадают. В Vercel переменная Sensitive, её значение не
  прочитать: чтобы сменить секрет, сгенерируйте новый, запишите его в оба места
  и передеплойте окружение;
- миграция `20261110180000_gift_expiry_index` применяется `prisma migrate deploy`
  в общем порядке (после мержа в `staging` и до проверки на staging, на прод-базу —
  при продвижении в `main`); без неё выборка кандидатов идёт без индекса;
- `.github/workflows/wish-expiry.yml` раз в час вызывает оба окружения, каждое
  через свой GitHub Environment:

  | Environment | `APP_URL` | `CRON_SECRET` |
  | --- | --- | --- |
  | `cron-production` | секрет репозитория `APP_URL` = прод-домен | секрет репозитория = переменной Vercel Production |
  | `cron-staging` | секрет окружения `APP_URL` = `https://staging.wishmoon.clever-agency.dev` | секрет окружения = Preview-переменной Vercel, ограниченной веткой `staging` |

  У `cron-production` своих секретов нет: job берёт секреты репозитория, а
  секрет окружения с тем же именем их перекрывает. Если у `cron-staging`
  пропадёт секрет, job получит прод-значение, поэтому workflow падает, когда
  `APP_URL` у `cron-staging` не начинается с `https://staging.`. Deployment
  branches у обоих окружений — No restriction: секреты репозитория и так видны
  любому workflow этого репозитория, ограничение веткой их не закроет. Падение
  одного окружения не отменяет другое. Каждый запуск оставляет запись во
  вкладке Deployments: это шум, принятый сознательно. Ручной запуск
  (Actions → Wish expiry → Run workflow) позволяет выбрать `all`, `production`
  или `staging`. Если Actions недоступен, то же делает
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" <домен>/api/cron/wish-expiry`.
- Смена `CRON_SECRET`: сначала новое значение в Vercel и Redeploy окружения,
  потом тот же секрет в GitHub (`cron-staging` или секрет репозитория для
  прода). Между шагами запуски получают 401, и это безопасно: пропущенный
  запуск только откладывает архивирование (ARCH-A15).
- Расписание берёт файл из default-ветки, то есть из `staging`. Правка
  `wish-expiry.yml`, влитая в `staging`, сразу действует и на прод, ещё до
  выкладки в `main`. Код эндпоинта прода при этом остаётся из `main`.

### Таймеры брони (Story 5.6)

Таймеры брони двигают фазу брони по сроку (`ACTIVE → AWAITING_GIVER →
AWAITING_OWNER → OPEN`) через `POST /api/cron/reservation-timers`. Цикл простой
(D-49): когда наступает срок брони, напоминание получает только даритель; через
72 часа бронь переходит во внутреннюю фазу `AWAITING_OWNER`, и об этом не
сообщается никому; через 7 дней после срока (168 часов от `reservationDueAt`)
бронь снимается всегда — и с отметкой «Купил», и в фазе «Подарено» (CLE-124
S9b-1: отметка или обещание не должны держать желание занятым навсегда). Об этом
узнаёт только даритель. Владельцу
желания не приходит ни одного уведомления ни на одном шаге — для него подарок
остаётся сюрпризом. Уведомления дарителю — `RESERVATION_DUE` при наступлении
срока и `RESERVATION_AUTO_RELEASE` при авто-снятии, оба в приложении и письмом.
Устроены так же, как ночное архивирование, и новых секретов и окружений не
требуют:

- секрет и окружение — те же: `CRON_SECRET` (не короче 32 символов, совпадает
  со значением на хосте) и GitHub Environment `cron-staging`;
- `.github/workflows/reservation-timers.yml` раз в час (`20 * * * *`, чтобы не
  совпадать с `wish-expiry.yml`) вызывает **только staging**. Если у
  `cron-staging` пропадёт секрет, job получит прод-значение из секретов
  репозитория, поэтому workflow падает, когда `APP_URL` не начинается с
  `https://staging.`; пустые `APP_URL`/`CRON_SECRET` тоже валят job. Ручной
  запуск во время планового ждёт его окончания (`concurrency` без отмены);
- прода workflow не вызывает: job `cron-production` в нём нет, а сам маршрут
  появится на проде только после выкладки в `main`. До этого брони прода по
  сроку не двигаются — это осознанно (открытый вопрос спеки 5.6, п. 10);
- ручной запуск: Actions → Reservation timers → Run workflow (выбора окружения
  нет) или, если Actions недоступен,
  `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://staging.wishmoon.clever-agency.dev/api/cron/reservation-timers`.
  Успех — `{ "ok": true, "data": { "expiredToGiver", "toAwaitingOwner", "released" } }`;
  частичный сбой строки даёт пустой 500, счётчики наружу не отдаются;
- пропущенный запуск только откладывает переходы: за прогон строка делает не
  больше одного шага, а следующие шаги ждут своих окон (72 ч и 168 ч от
  `reservationDueAt`; бронь, переведённую в `AWAITING_OWNER` этим же прогоном,
  снимают не раньше следующего). Догона «сразу в `OPEN`» нет (ARCH-A15);
- миграций нет: колонки брони и индексы для выборки уже есть в применённой
  `20261103074333_gift_reservations`; схема Prisma не меняется;
- смена `CRON_SECRET` — в том же порядке, что у `wish-expiry.yml`: сначала
  новое значение на хосте Vercel и Redeploy, затем тот же секрет в GitHub
  (`cron-staging`). Между шагами запуски получают 401, и это безопасно:
  пропуск только откладывает переходы.
- включение прода — отдельный шаг при переносе `staging → main`: после
  выкладки добавить в `reservation-timers.yml` job `cron-production` (без своих
  секретов, на существующих секретах репозитория `APP_URL` и `CRON_SECRET`, как
  у `wish-expiry.yml`) и проверить первый запуск. Пока job не добавлен,
  расписание трогает только staging.
- после выката этой версии на прод почасовой запуск на проде можно включать —
  это отдельная задача CLE-126.

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
- Основная ветка (default branch) — `staging`: в неё по умолчанию идут PR, от
  неё стартуют агенты. Поэтому ruleset для `main` нацелен на `refs/heads/main`,
  а не на Default branch: иначе при смене основной ветки защита переехала бы
  на неё.
- Environments `cron-production` и `cron-staging` для `wish-expiry.yml` (см.
  «Порядок выкладки»). `reservation-timers.yml` использует тот же `cron-staging`
  и новых окружений и секретов не требует; `cron-production` добавится только
  при включении таймеров брони на проде. `Production` и `Preview` создаёт Vercel
  под свои деплои, их не трогать.

## Обновление мобильного приложения (CLE-86)

Политика обновления — константы `APP_VERSION_POLICY` в
`packages/contracts/src/app-version.ts`; их отдаёт публичный
`GET /api/v1/app-version` без сессии и без базы. Поднять `latestVersion` или
`minSupportedVersion` — значит поменять константы и задеплоить сервер обычным
порядком (см. «Порядок выкладки»); пересобирать приложение не нужно, старые
сборки получат новую политику с сервера.

- `latestVersion` — версия, которую предлагаем установить: ниже неё приложение
  один раз показывает закрываемое «Доступно обновление».
- `minSupportedVersion` — версия, ниже которой приложение блокируется
  полноэкранным «Обновите приложение» без возможности закрыть.
- `storeUrl` — ссылка на магазин (`https`) или `null`; выдумывать адреса нельзя.
- **Без магазина `min` не поднимать.** Пока `storeUrl = null`, блокирующий экран
  не показывает кнопку, и обновиться пользователю негде. Пока магазины не
  опубликованы, значения по умолчанию (`latest = min = 0.1.0`, `storeUrl = null`)
  не меняются — при них никому ничего не показывается.

## Production

- Домен `wishmoon.clever-agency.dev` привязан в Vercel к окружению Production
  и ветке `main`.
- `EMAIL_FROM`: `WishMoon <noreply@wishmoon.clever-agency.dev>`.
- Ключ Resend — продовый, только на отправку и только для продового домена.
- `BETTER_AUTH_URL=https://wishmoon.clever-agency.dev`.
- `CRON_SECRET` (≥ 32 символа) — тот же, что в секрете репозитория GitHub
  Actions; секрет репозитория `APP_URL` указывает на этот домен (Environment
  `cron-production`).

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
  `staging`; то же значение — секрет `CRON_SECRET` в Environment `cron-staging`.
  Расписание вызывает staging так же раз в час.

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

### Доставка писем уведомлений

`.github/workflows/notification-email.yml` каждые 10 минут вызывает
`POST /api/cron/notification-email` на staging с `Authorization: Bearer <CRON_SECRET>`.
Используется существующий GitHub Environment `cron-staging` с секретами `APP_URL`
и `CRON_SECRET`. До ручного запуска примените миграцию к staging. Проверка хоста
отклоняет любой адрес без префикса `https://staging.`. Для ручного запуска доступен
`workflow_dispatch`. Запуски по расписанию идут из ветки по умолчанию (`staging`).
GitHub может задерживать запуски при высокой нагрузке. См. [документацию расписаний GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

После продвижения в `main` и миграции production подключите отдельный job к
`cron-production` по примеру таймеров брони. Укажите production `APP_URL`
и `CRON_SECRET` и ограничьте job production-хостом. Отправитель использует
`RESEND_API_KEY` и `EMAIL_FROM`, ссылки — HTTPS-адрес из `BETTER_AUTH_URL`.

Обработчик захватывает запись на пять минут, затем отправляет письмо с постоянным
ключом Resend вне транзакции. Повторы прекращаются через 23 часа от первой попытки
при 24-часовом окне Resend. Записи с истёкшим окном закрываются и один раз попадают
в операционный лог и счётчик `expired`. Ответ 500 сообщает планировщику о сбое попытки.
