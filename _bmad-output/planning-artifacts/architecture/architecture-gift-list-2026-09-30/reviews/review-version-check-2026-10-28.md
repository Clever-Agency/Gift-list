---
review_type: version-reality-check
artifact: ARCHITECTURE-SPINE.md
sections:
  - Stack
  - AD-17
  - AD-3
date: 2026-10-28
reviewer: version-check
verdict: PASS
---

# Проверка версий — Architecture Spine, 2026-10-28

**Вердикт: PASS.** Пины Expo SDK 58, `expo@58.0.20`, React Native 0.88, React 19.3.0, `expo-contacts@58.0.9` и линия `@better-auth/expo` 1.7 (последний патч 1.7.14) совпадают с npm и с документацией на 2026-10-28. Веб-пины Next.js 16.3.8, React 19.2.8, Better Auth линии 1.7 и Prisma 7.10.0 существуют и совпадают с установленными в репозитории. Выдуманных версий в проверенных строках нет. AD-1, AD-3 и AD-17 связывают технологии, которые стыкуются с Next.js Route Handlers, cookie-сессиями Better Auth на вебе и отдельным клиентом Expo.

## Метод

Проверка 2026-10-28, реестр npm и опубликованные доки.

| Источник | Что сверено |
| --- | --- |
| `npm view expo@58.0.20`, dist-tag `latest`, `bundledNativeModules.json` из tarball `expo-58.0.20.tgz` | Пакет SDK, React, React Native, `expo-contacts` |
| https://docs.expo.dev/versions/v58.0.0/ | Матрица SDK 58 → React Native 0.88, React 19.3.0 |
| https://expo.dev/changelog/sdk-58 | SDK 58 собран на React Native 0.88 |
| `npm view expo-contacts@58.0.9` и список версий `58.*` | Пин контактов |
| `npm view better-auth` и `npm view @better-auth/expo` (версии линии 1.7 и dist-tags) | 1.7.6 и 1.7.14 |
| https://www.better-auth.com/docs/integrations/expo | Серверный плагин `expo()` и клиент `expoClient` |
| https://www.better-auth.com/docs/plugins/bearer | Плагин `bearer()` и заголовок `Authorization` |
| `package.json` и `package-lock.json` репозитория | Веб-пины как установленные, не как «последний npm» |
| `npm view next@16.3.8`, `react@19.2.8`, `react@19.3.0`, `prisma@7.10.0` и dist-tags | Существование версий; тег `latest` у Prisma |

Строка Stack «Проверено npm view / Next security release 2026-09-30» — пометка прошлой сверки веб-пинов. Этот отчёт её не отменяет и не считает дату 2026-09-30 утверждением, что патчей после неё не было.

## Expo SDK 58, React Native и React

Утверждения спайна:

- Stack: Expo SDK `58.0.20`, React Native «через SDK 58» `0.88`, `expo-contacts` `58.0.9`.
- AD-17: каталог `apps/mobile` — Expo SDK 58 (`expo` 58.0.20); «Проверено 2026-10-28: SDK 58 рассчитан на React Native 0.88 и React 19.3.0»; веб репозитория на React 19.2.8, версии не выравнивать общим UI-пакетом.
- AD-2: токены Forest Paper в мобильном клиенте — константы, не общий React-пакет, потому что версии React расходятся.

Факты npm и доков:

| Утверждение | Факт на 2026-10-28 | Статус |
| --- | --- | --- |
| `expo` 58.0.20 | Версия есть. Опубликована 2026-10-27. Dist-tag `latest` = `58.0.20`. Линия `58.0.x` доходит до 58.0.20 (58.0.18 в реестре нет, на пин это не влияет). | совпадает |
| SDK 58 | Пакет `58.0.20` — патч SDK 58. Матрица доков: строка SDK `58.0.0`. | совпадает |
| React Native 0.88 | Матрица доков: SDK 58.0.0 → React Native **0.88**. В `bundledNativeModules.json` пакета `expo@58.0.20` поле `react-native` = **`0.88.0`**. В реестре также есть `0.88.1`; спайн фиксирует линию SDK, не более новый патч вне бандла Expo. | совпадает |
| React 19.3.0 для SDK | Матрица доков: React **19.3.0**. В том же `bundledNativeModules.json`: `react` и `react-dom` = `19.3.0`, `react-server-dom-webpack` = `~19.3.0`. Пакет `react@19.3.0` в реестре есть. Dist-tag `latest` у `react` уже `19.3.1`; Expo 58.0.20 по-прежнему закрепляет ровно 19.3.0. | совпадает |
| `expo-contacts` 58.0.9 | Версия есть, опубликована 2026-10-23. Это верх стабильной линии `58.0.x` (58.0.0 … 58.0.9). В бандле `expo@58.0.20`: `expo-contacts` = `~58.0.9`. | совпадает |
| `expo-secure-store` (AD-3, не отдельная строка Stack) | В том же бандле: `expo-secure-store` = `~58.0.2`. Пакет линии SDK 58 существует; спайн не подменяет его чужой мажорной версией. | согласовано |

Расхождение React веба (19.2.8) и React натива (19.3.0) — реальное свойство SDK 58, а не опечатка. Запрет общего React-пакета в AD-2 и AD-17 этому соответствует.

## Better Auth: линия 1.7, 1.7.14, Expo и bearer

Утверждения спайна:

- Stack, Better Auth: `1.7.6`.
- Stack, `@better-auth/expo`: та же версия, что `better-auth` (линия 1.7; 1.7.14 на 2026-10-28).
- AD-3: серверный плагин `@better-auth/expo` той же версии, что пакет `better-auth`, плюс `bearer()`; клиент Expo хранит токен в `expo-secure-store` и шлёт `Authorization`; `trustedOrigins` включает scheme приложения. Веб — cookie httpOnly. Одна таблица пользователей и database sessions.

Факты:

| Утверждение | Факт на 2026-10-28 | Статус |
| --- | --- | --- |
| Линия 1.7 у `better-auth` и `@better-auth/expo` | У обоих пакетов стабильные патчи `1.7.0` … `1.7.14`. Dist-tag `latest` у обоих = `1.7.14`. Выше по номеру только беты `1.8.0-beta.*` (тег `beta`, не `latest`). | совпадает |
| «1.7.14 на 2026-10-28» | Это текущий `latest` линии 1.7, не выдуманный патч. | совпадает |
| Better Auth `1.7.6` | Версия есть в реестре. В репозитории: `package.json` `"better-auth": "^1.7.6"`, lock разрешает ровно `1.7.6`. Для веб-пина это установленная версия линии 1.7, а не заявление, что 1.7.6 всё ещё `latest`. | не вымысел |
| Одинаковая версия пакетов | AD-3 требует ставить `@better-auth/expo` в ту же версию, что `better-auth`. Оба номера в таблице (1.7.6 и 1.7.14) опубликованы, так что правило выполнимо. Строка Stack не подменяет линию 1.7 чужой мажорной версией. | совпадает |

Документация текущей линии (сайт better-auth.com, пакеты с тегом `latest` = 1.7.14):

- Интеграция Expo: https://www.better-auth.com/docs/integrations/expo — серверный `expo()` из `@better-auth/expo`, клиентский `expoClient` из `@better-auth/expo/client`, хранение в `expo-secure-store`, `trustedOrigins` со scheme приложения (`myapp://`, для разработки `exp://`). Это ровно те поверхности, на которые опирается AD-3.
- Плагин bearer: https://www.better-auth.com/docs/plugins/bearer — `bearer()` из `better-auth/plugins`. После входа токен приходит в заголовке `set-auth-token`. Клиент шлёт `Authorization: Bearer …`. Сервер читает сессию через `auth.api.getSession`, если в запросе есть этот заголовок. Плагин описан как замена cookie для API, которым cookie неудобны.

Оба документа существуют. Связка «cookie на вебе + bearer на нативе + плагин Expo» в доках разложена по двум страницам, и обе страницы на линии 1.7 живые.

Пиры `better-auth@1.7.14`: `prisma` и `@prisma/client` допускают `^5 || ^6 || ^7`. Пин Prisma 7.10.0 в этот диапазон входит. Prisma 8 в пиры 1.7 не входит — оговорка Stack «не `latest` → 8 RC» для CLI с этим согласована.

## Веб-пины репозитория

Критерий этой проверки: Next.js 16.3.8, React 19.2.8, Better Auth линии 1.7 и Prisma 7.10.0 — установленные пины репозитория. Расхождение с сегодняшним `latest` само по себе не ошибка. Ошибка была бы, если бы спайн назвал версию, которой нет.

| Пин спайна | Репозиторий | Реестр npm на 2026-10-28 | Статус |
| --- | --- | --- | --- |
| Next.js 16.3.8 | `package.json` и lock: `next@16.3.8` | `next@16.3.8` есть. Dist-tag `latest` сейчас `16.4.3`. | версия реальная, пин репозитория |
| React (веб) 19.2.8 | `react` и `react-dom` `19.2.8` в `package.json` и lock | `react@19.2.8` есть. Dist-tag `latest` сейчас `19.3.1`. | версия реальная, пин репозитория |
| Better Auth 1.7.6, линия 1.7 | `^1.7.6`, lock `1.7.6` | `1.7.6` и вся линия до `1.7.14` есть. | версия реальная |
| Prisma и `@prisma/client` 7.10.0 | оба пакета и `@prisma/adapter-pg` зафиксированы на `7.10.0` | `prisma@7.10.0` есть. | версия реальная |

Уточнение про «не `latest` → 8 RC», без смены вердикта. На 2026-10-28 dist-tag `latest` пакета `prisma` (CLI) = `8.0.0-rc.28`, тег `prev` = `7.10.1`. Dist-tag `latest` пакета `@prisma/client` = `7.10.1`, не 8 RC. Формулировка строки Stack точна для CLI `prisma`, из-за которого голый `npm install prisma` уезжает на ORM 8 RC. Для `@prisma/client` «latest → 8 RC» на эту дату уже неверно: клиент на `latest` остаётся на линии 7, патч 7.10.1. Сам пин `7.10.0` при этом не вымышлен и совпадает с lock. Пиры Better Auth 1.7 по-прежнему не принимают Prisma 8, так что удержание пары на 7.10.0 остаётся осмысленным.

## Граница клиентов: Route Handlers, cookie, отдельный Expo

Проверялось, не привязывает ли спайн технологию, которая не стыкуется с схемой «Next.js Route Handlers + cookie-сессии Better Auth + отдельный клиент Expo». Образец негодной привязки: Server Actions как единственный API, который натив якобы может вызывать.

Что написано в спайне:

- AD-1. Мутации продукта для веба — Server Actions. Нативный клиент вызывает Route Handlers `app/api/v1/*`. Cron и webhooks — свои Route Handlers. Все три адаптера вызывают одни и те же методы domain/application.
- AD-17, Prevents: «Expo вызывает Server Actions». Rule: `apps/mobile` ходит только в `app/api/v1` JSON с конвертом AD-12. Страницы `/l/:token` и `/admin` остаются в Next.js. Импорт `src/domain` из Expo запрещён. Общий код — только контракт без React, если его вынесут.
- AD-3. Веб: cookie httpOnly. Натив: `@better-auth/expo` + `bearer()`, токен в `expo-secure-store`, заголовок `Authorization`, scheme в `trustedOrigins`.
- AD-5 / структурное семя. Бинарники Expo на Vercel не деплоятся (EAS или `expo prebuild`). Каталог `apps/mobile` отдельно от `src/app`.

Это та схема, которую доки Better Auth и модель Next.js допускают:

- Cookie httpOnly — обычный режим сессии Better Auth для браузера.
- Route Handler умеет отдать `auth.api.getSession` и прочитать `Authorization`, если включён `bearer()`. Отдельному Expo-клиенту не нужна cookie-банка браузера и не нужны Server Actions.
- Плагин Expo закрывает scheme, `trustedOrigins` и хранение в SecureStore. Плагин bearer закрывает токен в `Authorization`. Оба существуют на линии 1.7.
- Server Actions в AD-1 ограничены вебом. AD-17 прямо запрещает вызов Server Actions из Expo. Спайн не объявляет их единственным API.

Замечание для реализации, не дефект пина. Гайд Expo Integration показывает для своих API другой приём: `authClient.getCookie()` и заголовок `Cookie` (cookies лежат в SecureStore). AD-3 выбирает bearer и `Authorization`. Оба приёма описаны; bearer как раз для клиента, которому cookie не подходят. Рядом с httpOnly-сессией веба bearer не ломает модель «одна база пользователей, database sessions». Гайд Expo на сайте по-прежнему помечен как написанный для Expo SDK 55 (React Native 0.83, React 19.2). Это отставание текста гайда, а не пин спайна. В том же гайде package exports в Metro включены с SDK 53+, так что SDK 58 из AD-17 в эту оговорку входит. Спайн SDK 55 не утверждает.

## Замечания, которые не меняют PASS

1. В одной таблице Stack рядом стоят Better Auth `1.7.6` (пин репозитория, lock ровно 1.7.6) и пометка «1.7.14 на 2026-10-28» у `@better-auth/expo`. Оба номера существуют. AD-3 требует одну и ту же версию у `better-auth` и `@better-auth/expo`. При установке натива их нужно пиновать парой, а не смешивать 1.7.6 сервера с 1.7.14 плагина. Это чтение таблицы, не ложная версия.
2. `@prisma/client@latest` на эту дату — `7.10.1`, тогда как `prisma@latest` — `8.0.0-rc.28`. Скобка «не `latest` → 8 RC» верна для CLI и неверна, если читать её как dist-tag клиента. Пин `7.10.0` вымыслом не является.
3. `next@latest` сейчас `16.4.3`, `react@latest` — `19.3.1`. Спайн для веба называет установленные 16.3.8 и 19.2.8. Для натива React остаётся 19.3.0, как в бандле Expo 58.0.20, даже при наличии патча 19.3.1 в реестре.
4. Текст гайда Better Auth Expo всё ещё говорит «SDK 55». На существование плагинов `expo` и `bearer` на линии 1.7 это не влияет.

## Итог

Выдуманных версий в проверенных пинах нет. SDK 58 на дату проверки — это `expo@58.0.20` с React Native 0.88.0 и React 19.3.0 в бандле и в матрице доков; `expo-contacts@58.0.9` — верх линии 58 и диапазон бандла. `@better-auth/expo` живёт на линии 1.7, последний патч 1.7.14, интеграция Expo и плагин bearer в доках есть. Веб-пины совпадают с lock. Нативный клиент привязан к Route Handlers и bearer, а не к Server Actions.
