# Epic 1 Context: Фундамент двух клиентов и аккаунт

<!-- Compiled from planning artifacts 2026-10-28 (after D-40…D-42). Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Подготовить то, на чём стоит приложение на трёх платформах: монорепозиторий, каркас Expo (Android, iOS, браузер), HTTP-адаптер `app/api/v1` и сессию Better Auth. Затем пользователь регистрируется (на телефоне или в браузере), входит, сбрасывает пароль и получает **ровно один** пустой вишлист со стабильной ссылкой. Без оплаты и без CRUD желаний.

## Stories

- Story 1.1: Scaffold проекта из starter (Next.js + shadcn + Forest Paper) — done
- Story 1.2: Монорепозиторий: `apps/web`, `apps/mobile`, `packages/contracts`
- Story 1.3: Каркас Expo и токены Forest Paper (ждёт нативную UX-спеку)
- Story 1.4: HTTP-адаптер `app/api/v1` и сессия приложения
- Story 1.5: Регистрация и один вишлист (бывшая 1.2; код двух списков переписывается)
- Story 1.6: Вход и выход
- Story 1.7: Сброс пароля по email
- Story 1.8: Часовой пояс пользователя

## Requirements & Constraints

- D-40 (ред. 2): полный клиент — приложение Expo, Android, iOS и браузер одним кодом; в браузере нет только сверки контактов. Next.js — сервер и страницы `/l` (аноним, превью), `/i`, `/unsubscribe`, `/admin`. Выход iOS — шаг публикации, не меняет код.
- Регистрация: email, пароль, displayName, Ник. Телефон, ДР и пол не спрашиваются (D-21).
- При регистрации в одной транзакции создаётся **ровно один** `List` с immutable `publicToken` (CUID2, UNIQUE). Колонки типа списка нет, API второго списка нет (D-23). Боевых данных нет, миграция двух списков не нужна.
- Регистрация, начатая с `/l/:token` или `/i/:token`, возвращает к тому же вишлисту или приглашению; иначе — «Мой вишлист».
- Ник: 3–24 `[a-z0-9_]`, уникален без учёта регистра; дубликат email или nick → VALIDATION.
- Вход и сброс пароля не раскрывают существование email. Ссылка сброса открывает экран нового пароля в приложении или в браузере.
- Часовой пояс: `expo-localization` (в браузере — `Intl`); fallback `UTC`; заданный не перезаписывается.
- Без UI и кода оплаты, ЮKassa, COLLECTION, платёжных таблиц.
- Имя продукта — только из `BRAND_NAME` / `EXPO_PUBLIC_BRAND_NAME` (AD-24).

## Technical Decisions

- Монорепозиторий на npm workspaces (D-41, AD-26): `apps/web` (Next.js: сервер, `api/v1`, cron, серверные страницы, admin, Prisma, env; раздаёт веб-сборку приложения), `apps/mobile` (Expo SDK 58: Android, iOS, браузер), `packages/contracts` (zod-схемы AD-12 и gift card; без React, Prisma и env). Prisma и секреты — только в `apps/web`.
- Слои внутри `apps/web`: `src/app` → `src/actions` → `src/domain` → `src/db`. Адаптеры: `app/api/v1` (приложение на всех платформах), Server Actions (серверные страницы и админка), `app/api/cron` — все зовут один и тот же use-case (AD-1).
- `apps/mobile` импортирует только `packages/contracts`; импорт `apps/web` запрещён (AD-17). Общего UI-пакета нет: React веба 19.2.8, React Expo 19.3.0.
- Auth (AD-3): один Better Auth. Браузер (Next-страницы и веб-сборка приложения на том же домене) — httpOnly cookie database session, без CORS. Android/iOS — `@better-auth/expo` той же версии, что `better-auth`, плюс `bearer()`; токен в `expo-secure-store`; `trustedOrigins` со scheme приложения. OAuth и SMS нет.
- Ответ: `{ ok: true, data } | { ok: false, code, message }`, закрытый набор кодов; PK — CUID2.
- Один домен: Next.js обслуживает `/api`, `/l`, `/i`, `/unsubscribe`, `/admin`, `/.well-known`, остальное — SPA веб-сборки Expo (Story 1.3). Ссылки наружу — `https://{домен}/…`; App Links / Universal Links отдаёт `apps/web`.
- Хостинг: Vercel (Hobby) до публикации, Vercel собирает `apps/web` вместе с веб-сборкой приложения; `output: 'standalone'` должен работать (AD-16). Бинарник Expo — EAS Build или локальный prebuild. Секреты не в git (D-17).
- Версии: Next.js 16.3.8, React 19.2.8, Expo 58.0.20 (RN 0.88), Better Auth 1.7.6, Prisma 7.10.0, Zod 4.6.5.

## UX & Interaction Patterns

- Токены Forest Paper общие: primary `#2F5D3A`, accent `#D4A017`, background `#F4F1EA`; light only. Шрифты Lora + Manrope, не Fraunces/DM Sans.
- Приложение (все платформы): компоненты и навигация — по дизайн-спеке приложения (прогон `bmad-ux`, раздел App в DESIGN.md: телефон и широкий браузер). До неё Story 1.3 не начинается. Формы регистрации, входа и сброса с превью `@ник`.
- Серверные страницы и админка: shadcn + brand delta.
- Доступность: браузер — WCAG 2.2 AA на регистрации; Android/iOS — подписи для TalkBack/VoiceOver.

## Cross-Story Dependencies

- 1.1 done → 1.2 переносит код в `apps/web` без изменения поведения.
- 1.2 → 1.3 (нужен workspace `apps/mobile`) и 1.4 (нужен `packages/contracts`).
- 1.3 + 1.4 → 1.5–1.8 (экраны приложения и сессия на всех платформах).
- 1.5 переписывает код бывшей Story 1.2 (два списка) до приёмки; старая спека `spec-1-2-…` описывает устаревшее поведение.
- 1.8 нужна до Story 5.1 (Срок брони в `User.timeZone`).
- Epic 2 ожидает вошедшего владельца в приложении (телефон или браузер) с одним пустым вишлистом.
