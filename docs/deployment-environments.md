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

## Production

- Домен `wishmoon.clever-agency.dev` привязан в Vercel к окружению Production
  и ветке `main`.
- `EMAIL_FROM`: `WishMoon <noreply@wishmoon.clever-agency.dev>`.
- Ключ Resend — продовый, только на отправку и только для продового домена.
- `BETTER_AUTH_URL=https://wishmoon.clever-agency.dev`.

## Staging

- Домен `staging.wishmoon.clever-agency.dev` привязан к ветке GitHub `staging`
  (сначала создайте саму ветку).
- Переменные `RESEND_API_KEY`, `EMAIL_FROM`
  (`WishMoon Staging <noreply@staging.wishmoon.clever-agency.dev>`),
  `BETTER_AUTH_URL=https://staging.wishmoon.clever-agency.dev`, `DATABASE_URL` и
  `DIRECT_URL` создаются в Vercel как Preview-переменные, **ограниченные веткой
  `staging`**, а не все Preview-деплои.
- Мобильная staging-сборка:
  `EXPO_PUBLIC_API_BASE_URL=https://staging.wishmoon.clever-agency.dev`.
- Ключ Resend — staging, только на отправку и только для staging-домена.

## Preview (`*.vercel.app`, остальные ветки)

- `BETTER_AUTH_URL` не задавать: значение подставляет `apps/web/src/lib/env.ts`
  как `https://${VERCEL_BRANCH_URL ?? VERCEL_URL}` (у хостов Vercel нет
  протокола). Явно заданный `BETTER_AUTH_URL` всегда важнее. В production
  запасного значения нет — без переменной валидация падает.
- Ключа Resend нет: письма сброса не отправляются, в лог пишется
  `Password reset email is not configured`, HTTP-ответ forgot-password при этом
  не меняется.

## Общие правила эксплуатации

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
