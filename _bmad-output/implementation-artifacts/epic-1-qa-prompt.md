# Промпт: приёмочное тестирование Epic 1

Скопируйте всё, что ниже линии, в новую сессию агента, открытую в корне репозитория `Gift-list`.

---

Ты — QA-инженер. Твоя задача — независимо проверить, что Epic 1 «Фундамент двух клиентов и аккаунт» проекта Gift List действительно работает так, как записано в критериях приёмки, и выдать отчёт. Ты **не чинишь** код: только проверяешь, воспроизводишь и описываешь дефекты.

## Контекст

- Монорепозиторий на npm workspaces: `apps/web` (Next.js 16, Prisma 7.10.0, PostgreSQL, Better Auth, HTTP-адаптер `app/api/v1`), `apps/mobile` (Expo SDK 58: Android, iOS, браузер), `packages/contracts` (zod-схемы, коды ошибок, i18n-каталог `ru`), `packages/ui` (тема и компоненты обоих клиентов на Tamagui 3.1.x, Story 1.9, D-47, AD-2, AD-28).
- Веб-версия приложения — Expo web export, который `npm run build` кладёт в `apps/web/public/` (`scripts/sync-spa.mjs`); Next отдаёт её на том же домене. Пути Next: `/api`, `/l`, `/i`, `/unsubscribe`, `/admin`, `/.well-known`; всё остальное — SPA.
- Источник правды по критериям: `_bmad-output/planning-artifacts/epics/epics-gift-list-2026-09-30/epics.md`, раздел «Epic 1» (Stories 1.1–1.9). Story 1.9 заменила shadcn и Tailwind в `apps/web` и константы темы `apps/mobile/src/theme/tokens.ts` на `packages/ui`; оговорки об этом есть в тексте Stories 1.1 и 1.3. Сводка решений — `_bmad-output/implementation-artifacts/epic-1-context.md`. Спеки реализации и известные долги — `_bmad-output/implementation-artifacts/spec-*.md` и `deferred-work.md`.
- Прочитай перед началом: корневой `AGENTS.md`, `apps/web/AGENTS.md`, `README.md`, раздел Epic 1 в `epics.md`, `deferred-work.md`, AD-2 и AD-28 в `_bmad-output/planning-artifacts/ARCHITECTURE-SPINE.md`, спеку `spec-1-9-общий-ui-пакет-packages-ui-на-tamagui.md`.

## Ограничения

- Не коммить, не пушь, не открывай PR, не меняй код, конфиги, миграции и документы в `_bmad-output/` (кроме своего отчёта, см. ниже). Если для проверки нужна временная правка — не делай её, опиши в отчёте.
- Не трогай прод и Vercel. Только локальная БД и `localhost`.
- Секреты: локальный `apps/web/.env` создай по `apps/web/.env.example` со своими локальными значениями; не печатай секреты в отчёт, не коммить `.env`. Тестовые аккаунты — только выдуманные адреса вида `qa+N@example.test`.
- Node.js 24.22.1+ (`node -v`). Если версия ниже — отметь и продолжай, где возможно.

## Шаг 0. Подготовка

1. `npm ci` из корня.
2. PostgreSQL 16+ локально (например `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`), база `gift_list`. Если Docker и PostgreSQL не установлены, подними временный кластер пакетом `embedded-postgres` в отдельной папке вне репозитория. Не подключайся к базе из чужого `.env` (Supabase, Neon): это не локальная БД.
3. `apps/web/.env` по образцу; `BETTER_AUTH_URL=http://localhost:3000`; для Expo web раскомментируй `AUTH_DEV_TRUSTED_ORIGINS` с `http://localhost:8081`. `RESEND_API_KEY` не задавай (письмо не уходит) — ссылку сброса бери из логов сервера или из таблицы `verification` в БД.
4. `npm exec -w @gift-list/web -- prisma migrate deploy`.

## Шаг 1. Автоматические проверки (как в CI)

Из корня, по очереди, фиксируя результат и время:

```
npm run typecheck
npm run lint
npm test
npm run build
node apps/web/.next/standalone/apps/web/server.js   # проверить ответ на /, /register и /api/v1/me
```

Повтори шаги CI, которых нет в npm-скриптах (`.github/workflows/ci.yml`): перед `build` положи в `apps/web/.env` канарейку и проверь, что в `apps/web/.next/standalone` нет файлов `.env*` вне `node_modules`; `GET /` и `GET /register` у standalone → 200. Проверь, что последний прогон CI на `main` зелёный (`gh run list --branch main --limit 3`).

`scripts/check-boundaries.mjs` (часть `npm run lint`) — проверь, что он действительно ловит нарушения, а не только проходит на чистом дереве. Репозиторий не трогай: копию lock-файла правь во временной папке и подсунь через `GIFT_LIST_LOCKFILE`.
- Вторая копия `react`, `react-dom`, `tamagui` или любого `@tamagui/*` (вложенный `node_modules/<pkg>/node_modules/react` в lock) → падение с `duplicate copies`.
- Два разных номера версии у `@tamagui/*` → падение `must share one version`.
- Импорт из `"tamagui"` целиком в `apps/mobile`, `apps/web/src`, `packages/ui/src` (в том числе `require("tamagui")` и `vi.mock("tamagui")`) — прочитай регулярное выражение и проверь его на образцах; подпути `tamagui/dialog`, `@tamagui/core` должны проходить.
- `packages/ui/src` не импортирует Prisma, `@gift-list/web`, `@gift-list/contracts`, `next`, `expo*`, `better-auth` и не читает `process.env`.
- Дополнительно: `npm ls react react-dom tamagui --all` и поиск `@tamagui/` в lock — одна версия на пакет.

Отдельно: `npm test` прогони дважды — известен флейк таймаута `apps/web/src/lib/auth.test.ts` на холодном импорте под Windows (`deferred-work.md`). Флейк отметь отдельно от реальных падений.

## Шаг 2. Проверка по историям

Для каждого пункта: что сделал, ожидание, факт, вердикт (PASS / FAIL / NOT TESTED + причина). API проверяй `curl` (или `fetch` из Node) на `http://localhost:3000` с заголовком `Accept-Language: ru`; UI — в браузере на SPA, собранной `npm run build` и поднятой `npm run dev` (или standalone).

Формат ответа API (AD-12): успех `{ ok: true, data }`, ошибка `{ ok: false, code, message, reason?, field?, params? }`, `code` ∈ `UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | VALIDATION | RATE_LIMITED`. Клиент показывает текст по `reason`, иначе по `code`, и никогда не показывает `message`.

### 1.1–1.2. Каркас и монорепозиторий
- Структура `apps/web`, `apps/mobile`, `packages/contracts`, `packages/ui`; один `package-lock.json` в корне, в workspace lock-файлов нет.
- `packages/contracts` — исходники TS без build-шага и `dist/`, без React, Prisma и `process.env`.
- Prisma, `.env*` и секреты — только в `apps/web`; в git нет `.env` и реальных строк подключения (`git ls-files | grep -i env`, поиск `postgresql://` в tracked-файлах).
- В коде нет оплаты, ЮKassa, COLLECTION.
- `apps/mobile` не импортирует `apps/web` (проверка `scripts/check-boundaries.mjs` — попробуй мысленно/по коду, что она реально ловит такой импорт).

### 1.3. Каркас Expo и токены
- SPA открывается с корня; пути Next (`/api/...`, `/.well-known/assetlinks.json`, `/.well-known/apple-app-site-association`) обслуживает Next, а не SPA.
- Цвета Forest Paper (`#2F5D3A`, фон `#F4F1EA`), шрифты Lora + Manrope с кириллицей, только светлая тема. После Story 1.9 значения живут в `packages/ui/src/tokens.ts`, а не в `apps/mobile/src/theme`.
- Нет литералов интерфейса в компонентах (поиск кириллицы в `apps/mobile/app` и `apps/mobile/src`, кроме тестов и каталогов); строки — из `packages/contracts/src/i18n/ru`.
- Плюралы `ru` («1 желание · 3 желания · 5 желаний · 21 желание»), цена BYN/RUB, дата `ru` — проверь smoke-тест и вывод.
- Имя продукта из `EXPO_PUBLIC_BRAND_NAME` / `BRAND_NAME`, URL API — из env, литерала адреса нет.
- Полифил плюралов не попадает в веб-бандл (поиск `intl-pluralrules` в `apps/web/public`).
- Если доступны Android-эмулятор или iOS-симулятор — запусти `npm run mobile:start`; если нет — NOT TESTED с причиной.

### 1.4. `api/v1` и сессия
- `GET /api/v1/me` без сессии → `UNAUTHENTICATED`.
- В браузере сессия — httpOnly cookie (DevTools → Application; `document.cookie` её не видит), в запросах к `/api/v1/me` нет `Authorization`, есть `Accept-Language`.
- Нативный путь: запрос с `expo-origin: giftlist://` при входе отдаёт токен (`set-auth-token`), с `Authorization: Bearer <token>` `/api/v1/me` → 200.
- Невалидное тело на любой POST → `VALIDATION` с `field`, а не 500; неизвестный JSON / не JSON → корректная ошибка.
- Перезагрузка SPA восстанавливает сессию через `/api/v1/me`.

### 1.5. Регистрация и один вишлист — `POST /api/v1/register` `{ email, password, displayName, nick, next? }`
- Успех → сессия создана, пользователь аутентифицирован; в БД ровно один `List` с непустым `publicToken`; второго списка и колонок типа DISCOVERABLE/FRIENDS_ONLY нет (проверь схему Prisma и БД).
- Повтор email → `VALIDATION`, `reason: EMAIL_TAKEN`, `field: email`; в UI «Этот email уже зарегистрирован.» и ссылка «Войти», email переносится в форму входа.
- Повтор ника, в т.ч. в другом регистре (`QaUser` vs `qauser`) → `reason: NICK_TAKEN`, `field: nick`.
- Ник: 2 символа, 25 символов, кириллица, дефис, пробел — отклоняются; в UI «3–24 символа: латиница, цифры, _»; превью `@ник`.
- Поля телефона, ДР, пола в форме нет.
- `User.locale` = `negotiateLocale(Accept-Language)`, без заголовка — `ru`.
- `next`: `/l/<token>` → `/wishlist/<token>`, `/i/<token>` → путь приглашения в приложении; `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:…`, `%2F%2Fevil` → «Мой вишлист» (`/`).
- Подтверждение email не блокирует сессию.
- Лимит попыток: серия регистраций подряд → `RATE_LIMITED` (отметь порог). Отметь известный долг: IP берётся из первого `X-Forwarded-For` — проверь, обходится ли лимит подменой заголовка.
- Гонка: две параллельные регистрации с одним email/ником → одна успешна, вторая — ошибка поля, не 500, без «сироты» `List`.

### 1.6. Вход и выход — `POST /api/v1/session`, `DELETE /api/v1/session`
- Верные данные → сессия; переход на `next` или «Мой вишлист».
- Неверный пароль и несуществующий email → одинаковый ответ (код, тело, по возможности время ответа); в UI «Неверный email или пароль.»
- Выход гасит только текущую сессию: войди с двух «клиентов» (cookie и bearer), выйди из одного — второй остаётся валиден. В браузере cookie сбрасывается; в нативном клиенте токен удаляется из SecureStore (проверь по коду и тестам `apps/mobile/src/session`).
- Повторный `DELETE` без сессии не падает 500.

### 1.7. Сброс пароля — `POST /api/v1/password/forgot` `{ email }`, `POST /api/v1/password/reset` `{ token, password }`
- Ответ forgot одинаков для существующего и несуществующего email.
- Ссылка ведёт на экран нового пароля (`/reset?token=…` в SPA); новый пароль работает, старый — нет.
- Повторное использование ссылки, выдуманный токен, пустой токен, просроченная ссылка (подвинь срок в БД или дождись) → `reason: RESET_LINK_STALE`, в UI «Ссылка устарела. Запросите новую.»
- Короткий пароль при валидном токене → ошибка поля, при этом токен не сгорает.
- Лимит на forgot → `RATE_LIMITED`.
- Email переносится между экранами входа, регистрации и сброса; вкладок нет.

### 1.8. Часовой пояс — `PUT /api/v1/me/time-zone` `{ timeZone? }`
- Первый заход после входа с пустым `User.timeZone` → клиент отправляет пояс (в браузере `Intl`), сервер сохраняет.
- `Europe/Minsk` → сохраняется; `Mars/Olympus`, `""`, отсутствие поля, `UTC+3` → сохраняется `UTC`.
- Уже заданный пояс не перезаписывается повторным запросом/перезапуском.
- Без сессии → `UNAUTHENTICATED`.

### 1.9. Общий UI-пакет `packages/ui` на Tamagui (D-47, AD-2, AD-28)
- Тема: все значения frontmatter `DESIGN.md` (`_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md`) — цвета, радиусы, отступы, размеры, типографика — есть в `packages/ui/src/tokens.ts` / `config.ts`; сверь построчно хотя бы цвета и радиусы. Токенов больше нигде нет: `apps/mobile/src/theme/tokens.ts` удалён, поиск hex-цветов (`#[0-9A-Fa-f]{6}`) в `apps/mobile/app`, `apps/mobile/src`, `apps/web/src` вне тестов пустой или объяснимый.
- Пакет отдаёт исходники TS (`exports` → `src/index.ts`), без `dist/` и build-шага; нет запросов к API, Prisma, env и строк интерфейса (поиск кириллицы в `packages/ui/src` вне тестов); шрифты передаются из `expo-font` и `next/font`.
- Компоненты есть и экспортируются: Button (`primary`, `secondary`, `ghost`, `destructive`; в браузере — настоящий `<button>`, проверь в DOM), TextField (label, подсказка, ошибка; `aria-describedby`/`aria-invalid` по DESIGN.md → «Форма»), WishCard, StatusPill, BottomSheet, Dialog.
- Dialog и BottomSheet закрываются кнопкой «Закрыть»/«Отмена», Esc в браузере и «Назад» на Android; фокус возвращается на открывший элемент. В браузере проверь на ConfirmDialog удаления желания и VisibilityPicker (нужен вход и одно желание); Android — по unit-тестам `layer.native`/`BackHandler`, если эмулятора нет.
- Экраны и `src/ui/*` в `apps/mobile` (ConfirmDialog, Toast, GiftForm, VisibilityPicker, VisibilityChip) используют только `packages/ui`: поиск `StyleSheet.create`, UI-примитивов `react-native` с собственными стилями, импортов `src/theme`. Тесты экранов проходят.
- В `apps/web` нет shadcn, Tailwind, `@base-ui/react`, `class-variance-authority` (`package.json`, `components.json`, `postcss.config.*`, `@tailwind`/`@import "tailwindcss"` в CSS, классы `dark:`). Next-страница рендерит компоненты на сервере с CSS в HTML первого ответа: найди Next-страницу на `packages/ui`, сними её HTML `curl` и проверь `<style>` с правилами Tamagui до загрузки JS. `Dialog` открывается и закрывается на Next-странице.
- React и `react-dom` 19.3.0 в обоих приложениях, `overrides` в корневом `package.json`, `@tamagui/native` в корневом `package.json`; `apps/mobile/metro.config.js` без `resolveRequest` и `disableHierarchicalLookup`.
- Проверка дублей и импорта из `"tamagui"` — см. Шаг 1.
- Вес веб-сборки: базовое число 487 792 байт gzip на `dc10567` (спека 1.9); измерь gzip суммарного JS в `apps/web/public/_expo` и сравни с бюджетом +150 КБ. Отметь, что скрипт замера в репозитории не лежит (долг).
- Android-эмулятор и браузер: эмулятор — если есть, иначе NOT TESTED; iOS отложено, запись в `deferred-work.md` должна быть.
- `AGENTS.md` описывает `packages/ui`, AD-28 и ссылку на `tamagui.dev/llms.txt`.
- Код спайка удалён: нет `apps/mobile/app/spike.tsx` и тестовой страницы `apps/web/src/app/l/[token]` из спайка (если `/l/[token]` есть — убедись, что это рабочий код истории, а не спайк).
- Визуально (браузер, 390×844 и 1280×900): вход, регистрация, «Мой вишлист» пустой и с желанием, форма желания, выбор видимости, confirm удаления — не хуже DESIGN.md; один Lora на экран (известный долг — пустой «Мой вишлист»).

## Шаг 3. Сквозные сценарии в браузере

1. Аноним открывает `/` → экран входа; переход на регистрацию → регистрация → «Мой вишлист» (заглушка); перезагрузка — сессия жива; выход → экран входа.
2. Открыть `/l/<publicToken>` анонимом → регистрация → возврат к `/wishlist/<token>`.
3. Забыл пароль → письмо (лог/БД) → новый пароль → вход новым паролем.
4. Вход → добавить желание → сменить видимость через VisibilityPicker → удалить через ConfirmDialog (Esc, «Отмена», подтверждение); после закрытия фокус на кнопке, открывшей слой; Toast появляется.
5. Console и Network без ошибок и без 500; `message` из ответов сервера нигде не показан пользователю; нет предупреждений о второй копии React и о значениях Tamagui не токенами (известный долг `zIndex="1"`, `borderRadius="4"` — отметь, видно ли его в вебе).

## Шаг 4. Отчёт

Создай `_bmad-output/implementation-artifacts/epic-1-qa-report.md` (на русском, не коммить) со структурой:

1. **Итог** — 3–5 предложений: можно ли считать Epic 1 принятым.
2. **Окружение** — ОС, Node, PostgreSQL, что не удалось поднять (эмуляторы и т.п.).
3. **Автопроверки** — таблица команда / результат / примечание.
4. **Матрица AC** — таблица «История · критерий · вердикт · доказательство (команда, ответ, скриншот, путь к файлу)».
5. **Дефекты** — по каждому: серьёзность (blocker / major / minor), история и AC, шаги воспроизведения, ожидание, факт, файл:строка, если нашёл причину.
6. **Подтверждение известных долгов** из `deferred-work.md` — воспроизводится или нет. Обязательно пройди раздел «Deferred from: Story 1.9»: iOS и реальный Android не проверены; выбор видимости и confirm — диалог по центру, шторка на compact не подключена; скрипт замера веса и бюджет +150 КБ не в CI; `BottomSheet` и прерванная анимация закрытия; `layer.native.ts` и фокус диктора; клавиатурная модель `radiogroup` у `ChoiceList`; `role="alert"` вместе с `aria-live` и `accessibilityHint` в вебе; блок `components` DESIGN.md не сверяется тестом; предупреждения Tamagui `zIndex`/`borderRadius`; два Lora на пустом «Мой вишлист».
7. **Что не проверено и почему.**

В конце ответь в чате кратко: итог, число дефектов по серьёзности, путь к отчёту.
