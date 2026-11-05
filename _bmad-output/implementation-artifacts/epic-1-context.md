# Epic 1 Context: Фундамент двух клиентов и аккаунт

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Сервер и одно приложение на Android, iOS и в браузере, общий контракт и общий UI-пакет. Регистрация создаёт ровно один пустой вишлист; здесь же вход, выход, сброс пароля и часовой пояс. Story 1.9 (D-47, предложение `sprint-change-proposal-2026-11-04-tamagui-ui.md`) вернула эпик в `in-progress`: компоненты и тема приложения и Next-страниц переезжают в один пакет `packages/ui` на Tamagui, чтобы каждый экран и компонент писался один раз.

## Stories

- Story 1.1: Scaffold проекта из starter (Next.js + shadcn + Forest Paper)
- Story 1.2: Монорепозиторий: `apps/web`, `apps/mobile`, `packages/contracts`
- Story 1.3: Каркас Expo и токены Forest Paper
- Story 1.4: HTTP-адаптер `app/api/v1` и сессия приложения
- Story 1.5: Регистрация и один вишлист
- Story 1.6: Вход и выход
- Story 1.7: Сброс пароля по email
- Story 1.8: Часовой пояс пользователя
- Story 1.9: Общий UI-пакет `packages/ui` на Tamagui

## Requirements & Constraints

- В браузере нет только сверки контактов. Next.js — API и страницы ссылки, приглашения, отписки, админки и `.well-known`; их UI — тоже из `packages/ui`, с серверным рендером.
- Регистрация: email, пароль, имя, ник. Без телефона, дня рождения и пола. Подтверждение email не блокирует сессию. OAuth и SMS нет.
- Сессия и вишлист — одна транзакция. Токен ссылки непрозрачный, уникальный и неизменяемый. Второго списка нет; код двух списков переписывается, миграции нет.
- Ссылка вишлиста возвращает без дружбы; приглашение создаёт её в той же транзакции, если нет блока.
- Один домен: пути Next свои, `/wishlist` и прочее — SPA, ссылки `https`. Бинарник приложения на хост разработки не кладётся.
- Ник: 3–24, `a-z`, цифры и `_`, уникален без регистра. Занятый email или ник — ошибка поля; попытки с лимитом.
- Вход и запрос сброса не выдают, есть ли email. Выход гасит только эту сессию. Ссылка сброса одноразовая и открывает новый пароль в приложении или в браузере.
- Адрес возврата — относительный путь того же домена, иначе «Мой вишлист».
- Пояс IANA — при первом заходе (в браузере `Intl`), иначе `UTC`; сам потом не меняется. Язык устройства, запасной `ru`; профиль — из `Accept-Language`. Без литералов в UI, без оплаты и секретов в git.
- Перевод на `packages/ui` не меняет поведение: тесты экранов проходят, вид на телефоне и в браузере не хуже прежнего (сверка с DESIGN.md). Веб-сборка приложения тяжелеет не больше чем на 150 КБ gzip (замер в PR). Проверка на Android-эмуляторе и в браузере; iOS — при появлении macOS/EAS, иначе в `deferred-work.md`.

## Technical Decisions

- **Монорепозиторий (AD-26, D-41):** `apps/web` — use-case, `api/v1`, cron, Prisma и env; `apps/mobile` — Expo SDK 58; `packages/contracts` — zod, коды и каталоги, без React, Prisma и env; `packages/ui` — Tamagui-компоненты и тема. Prisma и секреты — только в `apps/web`. Веб-сборка Expo раздаётся `apps/web` на том же домене.
- **Граница клиентов (AD-17):** приложение вызывает только `app/api/v1` и импортирует только `@gift-list/contracts` и `@gift-list/ui`; импорт `apps/web` запрещён. Адаптеры зовут одни use-case.
- **UI-стек (AD-2, D-47):** один пакет `packages/ui` на Tamagui 3.1.10 для приложения и Next-страниц (включая `/admin`). Отдаёт исходники TS без сборки, Next транспилирует через `transpilePackages`. Тема Tamagui со значениями из frontmatter DESIGN.md — единственный источник токенов в коде. В пакете нет API, Prisma, env и строк интерфейса — тексты пропсами; шрифты передают приложение (expo-font) и Next (`next/font`). На Next CSS Tamagui попадает в HTML первого ответа (`useServerInsertedHTML`). Импорт только по подпутям (`@tamagui/core`, `@tamagui/stacks`, `tamagui/dialog` …), не из `"tamagui"` целиком. shadcn, Tailwind, `@base-ui/react`, `class-variance-authority` не используются. По API v3 — `tamagui.dev/llms.txt` и `*.manifest.ts` компонентов.
- **Гигиена зависимостей (AD-28):** React и `react-dom` 19.3.0 в обоих приложениях (версия Expo SDK, поднимать парой), `overrides` в корне. Все `tamagui`/`@tamagui/*` — одна точная версия; `@tamagui/native` в корневом `package.json`, иначе npm кладёт вложенные копии и на Android рвутся React-контексты. CI падает при второй копии `react`, `react-dom`, `tamagui`, любого `@tamagui/*` и при импорте из `"tamagui"`. Metro без `resolveRequest` и `disableHierarchicalLookup`. Пакеты с версией, закреплённой в одном месте и не закреплённой в другом, закрепляются явно.
- **Конверт:** успех `{ ok: true, data }`; отказ `{ ok: false, code, message, reason?, field?, params? }`. Коды: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`, `RATE_LIMITED`. Текст по `reason`, иначе по коду; `message` не показывать. В запросе — `Accept-Language`.
- **Auth:** один Better Auth, database sessions. Браузер — httpOnly cookie того же домена. Телефон — bearer в SecureStore, `@better-auth/expo` той же версии, scheme в `trustedOrigins`. Письма — Resend.
- `use-intl`/`next-intl` одной версии; полифил плюралов не входит в веб-сборку. Имя, URL API и конфигурация сервера — из env. Ключи CUID2. Prisma 7.10.0. Сборка `standalone`, без сервисов одной платформы.

## UX & Interaction Patterns

- Forest Paper, только светлая: `#2F5D3A`, фон `#F4F1EA`, `#D4A017` не для входа. Один Lora на экран, остальное Manrope с кириллицей.
- Компоненты `packages/ui`: Button (`primary`, `secondary`, `ghost`, `destructive`; в браузере настоящий `<button>`), TextField (label, подсказка, ошибка, связи для диктора по DESIGN.md → «Форма»), WishCard, StatusPill, BottomSheet, Dialog. Роль и подпись у каждого интерактивного элемента, зона касания без `hitSlop`, кольцо фокуса.
- BottomSheet и Dialog закрываются кнопкой «Закрыть»/«Отмена», Esc в браузере и системной «Назад» на Android; фокус возвращается на открывший элемент.
- Вход, регистрация и сброс без вкладок. Email и адрес возврата переносятся между ними; у ника превью `@ник`.
- «Неверный email или пароль.»; «Этот email уже зарегистрирован.» и «Войти»; «Этот ник уже занят.»; «3–24 символа: латиница, цифры, _»; «Ссылка устарела. Запросите новую.»

## Cross-Story Dependencies

- Каркас сервера переезжает в `apps/web`; затем приложение, контракты и сессия `api/v1`; экраны аккаунта — после них.
- 1.5–1.8 требуют 1.2–1.4. Пояс (1.8) нужен до брони (5.1); правка — в 7.2. Страницы ссылок позже, возврат и дружба фиксируются в регистрации.
- Story 1.9 заменяет результат 1.1 (shadcn, Tailwind в `apps/web`) и 1.3 (`apps/mobile/src/theme/tokens.ts`, удаляется). Она переводит уже сделанные на `StyleSheet` экраны и `src/ui/*` (ConfirmDialog, Toast, GiftForm, VisibilityPicker, VisibilityChip) из Epic 1, Stories 2.1–2.3 и 3.1. Код спайка (`apps/mobile/app/spike.tsx`, `apps/web/src/app/l/[token]`) удаляется или заменяется.
- 1.9 (CLE-66) блокирует Story 3.3 и 2.4–2.7; новые экраны на `StyleSheet` до неё не начинать. Позже `packages/ui` используют 3.3, 4.7, 6.4, 6.5, 7.2 (отписка) и Epic 10.
- `AGENTS.md` по итогам 1.9 описывает `packages/ui`, AD-28 и ссылку на `tamagui.dev/llms.txt`; `.cursor/rules/ux-design.mdc` правится, если ссылается на shadcn.
