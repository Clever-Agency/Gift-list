# Отчёт: приёмочное тестирование Epic 1

Дата прогона: 2026-11-02. Код не менялся. Проверялась `main` на коммите `61a7e3b` («docs: итоговое приёмочное тестирование эпика и промпт для Epic 1»).

## 1. Итог

Epic 1 можно принимать. Регистрация создаёт сессию и ровно один вишлист, вход и выход гасят только текущую сессию, сброс пароля одноразовый, часовой пояс пишется один раз. Конверт `api/v1`, граница монорепозитория и веб-сборка SPA на том же домене соответствуют критериям.

Блокеров и major нет. Один minor: аноним и пользователь после выхода видят заглушку «Мой вишлист», а не экран входа. Сквозной сценарий «аноним открывает `/` → форма входа» из-за этого не сходится, но войти и зарегистрироваться с этой заглушки можно.

Известный обход лимита через первый `X-Forwarded-For` воспроизводится. Это уже записанный долг, не новый дефект.

## 2. Окружение

- ОС: Ubuntu 24.04.5 LTS, ядро Linux 6.12.94+.
- Node.js: 24.22.1 (npm 11.19.1). В PATH по умолчанию был Node 22.23.4 (`/exec-daemon/node`); прогон шёл на 24.22.1 из nvm.
- PostgreSQL: 16.15, кластер локальный (`apt`, не Docker: Docker в окружении нет). База `gift_list`, миграции `prisma migrate deploy` — три штуки, все применились.
- Сервер: `node apps/web/.next/standalone/apps/web/server.js` на `http://127.0.0.1:3000`. `RESEND_API_KEY` и `EMAIL_FROM` не заданы. `BETTER_AUTH_URL=http://localhost:3000`. `AUTH_DEV_TRUSTED_ORIGINS` включает `exp://`, `exp+giftlist://` и `http://localhost:8081`.
- UI: собранная SPA (`npm run build`) в headless Chrome. Вьюпорты 1280×900 и 390×844. Язык браузера `en-US`, пояс `UTC`.
- Не поднято: Android-эмулятор, iOS-симулятор, Metro (`npm run mobile:start` / `mobile:web`).

## 3. Автопроверки

| Команда | Результат | Примечание |
| --- | --- | --- |
| `npm ci` | успех | 1287 пакетов. `npm audit` при установке сообщил о 34 уязвимостях; в критерии эпика это не входит |
| `npm exec -w @gift-list/web -- prisma migrate deploy` | успех | `20261002000000_init_auth_lists`, `20261002120000_rate_limit`, `20261101143000_one_list_locale_timezone` |
| `npm run typecheck` | успех, 7 с | mobile, web (`prisma generate`, `next typegen`, `tsc`), contracts |
| `npm run lint` | успех, 6 с | ESLint трёх пакетов и `scripts/check-boundaries.mjs` |
| `npm test` (1-й) | успех, 3 с | mobile 40, web 114, contracts 54 |
| `npm test` (2-й) | успех, 4 с | те же числа. Таймаут `auth.test.ts` не проявился |
| `npm run build` | успех, 20 с | Expo web export, `next build`, standalone |
| `node apps/web/.next/standalone/apps/web/server.js` | успех | `GET /` → 200, HTML SPA. `GET /api/v1/me` → 401, `{ ok: false, code: "UNAUTHENTICATED" }` |

## 4. Матрица AC

| История | Критерий | Вердикт | Доказательство |
| --- | --- | --- | --- |
| 1.1–1.2 | Workspaces `apps/web`, `apps/mobile`, `packages/contracts`; один корневой `package-lock.json` | PASS | Других lock-файлов в `apps/` и `packages/` нет. Скрипты корня проксируют `dev`/`build`/`test`/`lint`/`typecheck`/`migrate` |
| 1.1–1.2 | `packages/contracts` — исходники TS, без `dist/`, React, Prisma и `process.env` | PASS | `package.json` `exports` → `./src/index.ts`. `check-boundaries.mjs` ищет `react`, `@prisma/client`, `prisma` и `process.env` в `packages/contracts/src` |
| 1.1–1.2 | Prisma, `.env*` и секреты только в `apps/web`; в git нет боевых строк подключения | PASS | Схема `apps/web/src/db/schema.prisma`. `git ls-files` по `env`: только `.env.example`, `env.ts` и тесты. `postgresql://` в отслеживаемых файлах — плейсхолдеры CI, `.env.example`, `prisma.config.ts` и тесты. `apps/web/.env` в `.gitignore` |
| 1.1 | Нет оплаты, ЮKassa, COLLECTION в коде приложений | PASS | Поиск по `apps/` и `packages/` пустой |
| 1.1 | Next ^16.3.8, Prisma 7.10.0, README про `dev`/`migrate` | PASS | `apps/web/package.json`: `next` 16.4.3. Сервер написал `Next.js 16.4.3`. Prisma generate — 7.10.0. README описывает команды |
| 1.1 | Light only. Шрифты эпика — Lora и Manrope (D-46 заменил Fraunces и DM Sans из раннего текста 1.1) | PASS | В UI нет переключателя темы. `dark:` остаётся только в shadcn-примитивах сервера (долг, см. §6). Слово «Gift List» на экране: `font-family: Lora`, 24px, `rgb(47, 93, 58)` |
| 1.2 | `apps/mobile` не импортирует `apps/web`; проверка это ловит | PASS | Поиск импортов пустой. `scripts/check-boundaries.mjs` обходит текстовые файлы `apps/mobile` и падает на строки `apps/web`, `@gift-list/web` и относительный путь в `web/`. Lint этот скрипт уже выполнил |
| 1.3 | SPA с корня; пути Next не отдаёт SPA | PASS | `/` и `/login` — один и тот же `spa-index.html` (ETag совпал). `/.well-known/assetlinks.json` → `[]`, `apple-app-site-association` → JSON, не HTML. `/l/Ab_12` → 404 Next (`This page could not be found.`), без бандла Expo. `/api/v1/me` → JSON |
| 1.3 | Forest Paper, только светлая тема | PASS | Фон экрана `rgb(244, 241, 234)` (`#F4F1EA`), слово марки и ссылки `rgb(47, 93, 58)` (`#2F5D3A`). Кнопка регистрации в скриншоте того же зелёного (`colors.primary` в `PrimaryButton`). На экране входа цвета `#D4A017` нет. `userInterfaceStyle: "light"`. `StatusBar style="dark"` — тёмные иконки статус-бара, не тёмная тема |
| 1.3 | Lora + Manrope с кириллицей | PASS | `document.fonts`: Lora, Manrope и Manrope-600 в статусе `loaded`. Заголовок «Мой вишлист» — Manrope-600, тело — Manrope. «Алёна» и «желание» отрисованы |
| 1.3 | Нет литералов интерфейса; строки из каталога `ru` | PASS | Кириллица в `apps/mobile/app` и `src` — каталог не здесь. В коде экранов кириллица только в комментариях `NOTE FOR UX`, в тестовых данных сортировки `SORT_NAMES` и в тестах. Подписи форм совпали с `packages/contracts/src/i18n/ru` |
| 1.3 | Плюралы, цена BYN/RUB, дата `ru` | PASS | Текст на `/`: `1 желание · 3 желания · 5 желаний · 21 желание`, `10,50 BYN · 2 500,00 ₽`, `31.10.2026`, `Алена / Алёна / Яна` |
| 1.3 | Имя из env, URL API из env, без литерала адреса | PASS | `getBrandName()` / `getApiBaseUrl()` читают `EXPO_PUBLIC_*` только в `apps/mobile/src/config/env.ts`. Сборка без `EXPO_PUBLIC_BRAND_NAME` показала запасное «Gift List». В бандле нет `localhost:3000`. Пустой базовый URL даёт относительный `fetch`, и на том же домене запросы проходят; подпись при этом «не задан» — так и задумано в каталоге |
| 1.3 | Полифил плюралов не входит в веб-бандл | PASS | Единственное вхождение `intl-pluralrules` в `apps/web/public` — текст ошибки `@formatjs` («Try polyfilling it using @formatjs/intl-pluralrules»). `polyfill-force`, `locale-data/ru` и `__addLocaleData` в бандле нет. Веб-файл `apps/mobile/src/intl-polyfill.web.ts` пустой; нативный полифил в `intl-polyfill.native.ts` |
| 1.3 | Запуск на Android и iOS | NOT TESTED | Эмулятора и симулятора нет. См. §7 |
| 1.4 | `GET /api/v1/me` без сессии → `UNAUTHENTICATED` | PASS | 401, `{ ok: false, code: "UNAUTHENTICATED", message: "Authentication required" }` |
| 1.4 | Браузер: httpOnly cookie, без `Authorization`, с `Accept-Language` | PASS | `Set-Cookie: better-auth.session_token`, атрибуты `HttpOnly` и `SameSite=Lax`. После входа CDP видит cookie `httpOnly: true`, `document.cookie` пустой, перезагрузка оставляет сессию. Запросы SPA к `/api/v1/me` без `authorization`. Заголовок был `en-US` — это язык headless Chrome, не `ru` |
| 1.4 | Нативный путь: `expo-origin: giftlist://` отдаёт токен, Bearer открывает `/api/v1/me` | PASS | `POST /api/v1/session` с `expo-origin` и `Origin: giftlist://` → 200 и `set-auth-token` (длина 77), `Access-Control-Expose-Headers: set-auth-token`. Дальше `Authorization: Bearer` → 200. В браузерном ответе регистрации этого заголовка нет |
| 1.4 | Токен на телефоне в SecureStore, выход его удаляет | PASS | По коду и тестам, не на устройстве: `session-token.native.ts` пишет ключ `gift-list.auth.token`; веб-файл хранилища пустой. `auth-context.tsx` чистит токен на `UNAUTHENTICATED` и в `signOut`. Тесты `auth-context.test.tsx` это покрывают (8 сценариев в прогоне mobile) |
| 1.4 | Невалидное тело → `VALIDATION`, не 500 | PASS | Не-JSON, битый JSON, пустой объект (`field: email`), короткий пароль (`field: password`), тело 40 КБ — все 400 `VALIDATION` |
| 1.4 | Перезагрузка SPA восстанавливает сессию | PASS | После регистрации перезагрузка `/` показала «Выйти». В Network снова `GET /api/v1/me` без Authorization |
| 1.4 | OAuth и SMS нет | PASS | В `apps/web/src/lib/auth.ts` только email/пароль, `disableSignUp: true` на сыром эндпоинте Better Auth |
| 1.5 | Успех создаёт сессию и ровно один `List` с непустым `publicToken` | PASS | `POST /api/v1/register` → 200, `next: "/"`. В БД у `qa+1@example.test`: `locale=ru`, `emailVerified=f`, списков 1, длина токена 24. Сирот и пользователей без списка нет |
| 1.5 | Нет колонок DISCOVERABLE/FRIENDS_ONLY и второго списка | PASS | Колонки `List`: `createdAt`, `id`, `ownerId`, `publicToken`. `publicToken` в коде пишется только при `create` |
| 1.5 | Повтор email → `EMAIL_TAKEN` / «Этот email уже зарегистрирован.» и «Войти» с переносом email | PASS | API: 400, `field: email`, `reason: EMAIL_TAKEN`. UI: тот же русский текст и ссылка `/login?next=%2Fwishlist%2FAb_12&email=qa%2Bui1%40example.test`. На входе поле email уже заполнено. Английский `message` на экране не показан |
| 1.5 | Повтор ника, в том числе в другом регистре | PASS | `Qa_One` после `qa_one` → `NICK_TAKEN`, `field: nick`. UI для `qa_ui_1`: «Этот ник уже занят.» |
| 1.5 | Ник: 2 и 25 символов, кириллица, дефис, пробел отклоняются; 3, 24 и `_` проходят. Текст «3–24 символа: латиница, цифры, _». Превью `@ник` | PASS | API по каждому случаю. В форме после ника «Я» показаны правила, до отправки у `qa_ui_1` видно `@qa_ui_1` |
| 1.5 | Нет полей телефона, ДР и пола | PASS | На регистрации четыре поля: Email, Пароль, Имя, Ник |
| 1.5 | `User.locale` = `negotiateLocale(Accept-Language)`, без заголовка — `ru` | PASS | Без заголовка, `en`, `ru-BY` и `en-US,ru;q=0.8` — в БД везде `ru` (в каталоге поддерживается только `ru`) |
| 1.5 | `next`: `/l/<token>` → `/wishlist/<token>`, `/i/<token>` → `/invite/<token>`; чужие адреса → `/` | PASS | API: `/l/Ab_12`, `/i/Inv_1`, `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `%2F%2Fevil`. UI: регистрация с `?next=/l/Ab_12` открыла `http://127.0.0.1:3000/wishlist/Ab_12`, заголовок «Вишлист по ссылке» |
| 1.5 | Подтверждение email не блокирует сессию | PASS | Сразу после регистрации `GET /api/v1/me` → 200, в БД `emailVerified=false` |
| 1.5 | Лимит регистраций → `RATE_LIMITED` | PASS | Один и тот же `X-Forwarded-For`: 5 успехов, 6-й ответ 429, `code: RATE_LIMITED`, `params: { unit: "minute", count: 60 }`. Порог в коде: `REGISTER_LIMIT` = 5 попыток за 3600 с (`apps/web/src/lib/rate-limit.ts`) |
| 1.5 | Гонка одного email и одного ника | PASS | Два параллельных POST с одним email и ником: 200 и 400 `EMAIL_TAKEN`, в БД 1 пользователь и 1 список. Два POST с одним ником в разном регистре: 200 и 400 `NICK_TAKEN`, тоже одна строка. Ответов 500 не было |
| 1.6 | Верный пароль и `next` | PASS | `POST /api/v1/session` с `next: /l/Tok_1` → 200, `next: /wishlist/Tok_1`. В браузере верный пароль открывает «Мой вишлист» |
| 1.6 | Неверный пароль и неизвестный email неотличимы | PASS | Оба: 401 и тело `{ ok: false, code: "UNAUTHENTICATED", message: "Invalid email or password" }`. 12 замеров: известный email медиана 65 мс (62–77), неизвестный 69 мс (62–78), диапазоны совпадают. В UI оба случая: «Неверный email или пароль.», без английского `message` |
| 1.6 | Выход гасит только текущую сессию; повторный DELETE без сессии не 500 | PASS | Cookie-сессия и bearer одновременно. `DELETE` с cookie → `{ ok: true, data: { signedOut: true } }`, cookie дальше 401, bearer всё ещё 200. `DELETE` без сессии → 200 и тот же успех. В браузере «Выйти» убирает сессию: снова видны «Войти» и «Регистрация» |
| 1.7 | Forgot одинаков для существующего и неизвестного email | PASS | Оба 200 `{ ok: true, data: { accepted: true } }`. В UI: «Если аккаунт с этим email есть, мы отправили ссылку.» |
| 1.7 | Ссылка ведёт на новый пароль; новый пароль работает, старый нет | PASS | Письмо не уходит: в логе standalone строка `Password reset email is not configured`, токена в логе нет. Сырой токен лежит в `Verification.identifier` (`reset-password:<token>`). `http://127.0.0.1:3000/reset?token=…` открывает «Новый пароль». После сохранения старый пароль → 401, новый → 200. В браузере тот же экран, «Пароль сохранён.», затем вход новым паролем на «Мой вишлист» |
| 1.7 | Повтор, выдуманный токен, пустой токен, просрочка → `RESET_LINK_STALE` и текст «Ссылка устарела. Запросите новую.» | PASS | API на все четыре случая: `reason: RESET_LINK_STALE`. Просрочка: `expiresAt` сдвинут на минуту назад. Пустой `/reset` и отправка выдуманного токена в UI показывают этот текст и ссылку «Отправить ещё раз» |
| 1.7 | Короткий пароль при живом токене — ошибка поля, токен не сгорает | PASS | API: 400 `VALIDATION`, `field: password`, строка в `Verification` осталась. В UI под полями: «Проверьте введённые данные.» (каталог `errors.code.VALIDATION`), ссылка после этого всё ещё принимается |
| 1.7 | Лимит forgot → `RATE_LIMITED` | PASS | 5 ответов `accepted`, 6-й 429 `RATE_LIMITED`, тот же порог 5 за час |
| 1.7 | Email переносится между входом, регистрацией и сбросом; вкладок нет | PASS | Регистрация → «Войти» переносит email. Вход → «Забыли пароль» открывает `/forgot?email=…` с заполненным полем. Вход по `?email=` тоже заполнен. Отдельных вкладок на экранах нет |
| 1.8 | Первый заход с пустым поясом сохраняет пояс устройства | PASS | После регистрации в БД `timeZone` пустой. Браузер отправил `PUT /api/v1/me/time-zone` и записал `UTC` — это `Intl` данного Chrome. API с cookie и телом `Europe/Minsk` сохранил `Europe/Minsk` |
| 1.8 | `Mars/Olympus`, `""`, нет поля, `UTC+3` → `UTC` | PASS | Четыре отдельных пользователя, в ответе и в БД `UTC` |
| 1.8 | Уже заданный пояс не перезаписывается | PASS | После `Europe/Minsk` повторный PUT с `America/New_York` вернул и оставил `Europe/Minsk` |
| 1.8 | Без сессии → `UNAUTHENTICATED` | PASS | PUT без cookie → 401 |
| Сквозной | Аноним на `/` → вход → регистрация → «Мой вишлист» → перезагрузка → выход → вход | FAIL | Регистрация, перезагрузка и выход работают. Анонимный `/` и экран после выхода — заглушка «Мой вишлист», не форма входа. Дефект D1 |
| Сквозной | Аноним открывает `/l/<publicToken>` и с регистрации возвращается на вишлист | PASS с оговоркой | Сам `/l/Ab_12` — 404 Next: страницы ссылки в эпике нет (её экран — Story 3.3). Возврат проверен так, как его делает клиент: `/register?next=/l/Ab_12` → `/wishlist/Ab_12`. Аноним на `/wishlist/Ab_12` уходит на `/login?next=/wishlist/Ab_12` |
| Сквозной | Забыл пароль → токен из БД → новый пароль → вход | PASS | См. строку 1.7. Resend не вызывался |
| Сквозной | Console и Network без 500; `message` пользователю не показывают | PASS | Необработанных исключений страницы нет, ответов 500 нет. Chrome пишет `Failed to load resource` на ожидаемые 401, 400 и 404. На экранах только русские строки каталога (`reason` или `code`), не `message` |

## 5. Дефекты

### D1. Анонимный `/` и экран после выхода — не вход

- Серьёзность: minor
- История и AC: Story 1.3 (заглушка главного экрана — для вошедшего, вход и регистрация — для анонима); сквозной сценарий «аноним открывает `/` → экран входа»
- Шаги: открыть `http://127.0.0.1:3000/` без cookie. Либо войти и нажать «Выйти».
- Ожидание: форма «Вход».
- Факт: заголовок «Мой вишлист», смоук-строки про желания, цены и дату, ссылки «Войти» и «Регистрация». Сессия при этом корректно отсутствует (`GET /api/v1/me` → 401).
- Где: `apps/mobile/app/(app)/index.tsx` показывает заглушку и ссылки при `anonymous` (около строк 57–65). Редиректа на `/login` в `app/_layout.tsx` нет. Спека 1.3 как раз оставляла `/` без auth-gate; сквозной сценарий приёмки ждёт экран входа.

## 6. Подтверждение известных долгов

Из `deferred-work.md`, только ещё не зачёркнутые пункты.

| Долг | Статус на этом прогоне |
| --- | --- |
| Prisma-клиент читает `process.env.DATABASE_URL`, а не `getEnv()` | В силе. `apps/web/src/db/client.ts` по-прежнему берёт строку из `process.env`. Сборку без `.env` заново не гонял: отдельный пункт про ленивый `getEnv()` уже закрыт |
| Классы `dark:` в shadcn-примитивах | В силе. Они есть в `apps/web/src/components/ui/button.tsx` и `input.tsx`. Экраны аккаунта — SPA, тёмной темы у пользователя нет |
| `parseJsonBody` без ограничения размера | Не воспроизводится. В `apps/web/src/lib/api-v1.ts` лимит `MAX_JSON_BYTES` = 32 КиБ. Тело 40 КБ на `POST /api/v1/session` → 400 `VALIDATION`, не 500 |
| Лимит берёт IP из первого `X-Forwarded-For` | Воспроизводится. 6 регистраций с `10.8.8.8` упёрлись в 429, седьмая с `10.8.8.9` прошла. Без заголовка клиенты делят один ключ. Так устроен `clientIp` в `apps/web/src/lib/rate-limit.ts` |
| `/wishlist/:token` и `/invite/:token` только принимают возврат | В силе и совпадает с проверкой. Наполнения списка и дружбы нет. Аноним с `/wishlist/:token` уходит на вход |
| `AUTH_DEV_TRUSTED_ORIGINS` не проверяет значения и не запрещён в проде | В силе по коду: `devTrustedOriginsSchema` — массив любых строк (`apps/web/src/lib/env.ts`). Прод с `NODE_ENV=production` этим прогоном не проверялся: standalone как раз production и CORS на `/api/v1` не добавляет |
| Better Auth дописывает `BETTER_AUTH_TRUSTED_ORIGINS` мимо `getEnv()` | В силе по коду: `node_modules/better-auth/dist/context/helpers.mjs`, строка с `env.BETTER_AUTH_TRUSTED_ORIGINS`. Переменную в прогоне не задавал |
| `Origin: exp://…` без `expo-origin` не получает `set-auth-token` | Воспроизводится. `POST /api/v1/session` с `Origin: exp://127.0.0.1:8081` → 200 без заголовка токена. Тот же вход с `expo-origin: giftlist://` токен отдаёт. Текущий клиент заголовок шлёт сам (`apps/mobile/src/api/client.ts`) |
| Флейк таймаута `apps/web/src/lib/auth.test.ts` на холодном импорте под Windows | Не воспроизводится. Два `npm test` на Linux и Node 24.22.1 зелёные, 3 с и 4 с |

## 7. Что не проверено и почему

- Android-эмулятор и iOS-симулятор недоступны, поэтому `npm run mobile:start` не запускался. Нативный bearer проверен заголовками `expo-origin` / `Authorization` против localhost. SecureStore — по коду и тестам `apps/mobile/src/session`, не на устройстве.
- Metro и Expo web на порту 8081 не поднимались. Браузерный сценарий шёл на SPA, которую `npm run build` положил в standalone.
- Письмо Resend не отправлялось: ключ по инструкции не задавался. Ссылка сброса взята из `Verification`, не из письма. В логе сервера токена нет, только «Password reset email is not configured».
- Страница `GET /l/:token` как вход анонима в регистрацию не существует (404 Next). Это маршрут следующей истории, не дыра в возврате `next`.
- Прод и Vercel не вызывались.
