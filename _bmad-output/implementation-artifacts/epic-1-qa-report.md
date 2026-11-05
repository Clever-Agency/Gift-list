# Отчёт: приёмочное тестирование Epic 1

Дата прогона: 2026-11-05. Код не менялся. Проверялась `main` на коммите `6606d7a` («CLE-66: Story 1.9 — общий UI-пакет packages/ui на Tamagui (#48)»): PR Clever-Agency/Gift-list#48 влит 2026-11-05 10:46 UTC. Промпт — `epic-1-qa-prompt.md`, в этот прогон в него добавлены Story 1.9, проверки CI и долги Story 1.9.

Предыдущий прогон (2026-11-02, Stories 1.1–1.8, коммит `61a7e3b`) лежит в истории git этого файла. Здесь Stories 1.1–1.8 проверены регрессионно — API-сценарием и сквозным сценарием в браузере, — а Story 1.9 полностью.

## 1. Итог

Epic 1 можно принимать. Все критерии Story 1.9 выполнены или обоснованно отложены. В `packages/ui` тема из DESIGN.md, компоненты общие для приложения и Next. shadcn и Tailwind из `apps/web` убраны. React и Tamagui в одной копии, `check-boundaries.mjs` ловит дубли и импорт из `"tamagui"`. Dialog закрывается по Esc, крестиком и «Отмена» и возвращает фокус.

Регрессий в аккаунте (1.4–1.8) нет. Дефект D1 прошлого прогона исправлен: аноним на `/` и пользователь после выхода попадают на «Вход».

Блокеров и major нет. Найдено два minor: Windows-флейк таймаутов в `npm test` затрагивает больше файлов, чем записано в долге, а `next dev` переписывает отслеживаемый `apps/web/AGENTS.md`. Ещё одно low-наблюдение по доступности.

Вес веб-сборки в бюджете (+140 797 байт gzip при бюджете 150 КБ), но запас около 9 КБ, а CI бюджет не охраняет: это записанный долг. Его стоит закрыть до Story 3.3.

## 2. Окружение

- ОС: Windows 11 Pro 10.0.26200, Git Bash.
- Node.js 24.22.1, npm 11.19.1.
- PostgreSQL: Docker и PostgreSQL на машине не установлены. Временный кластер поднят пакетом `embedded-postgres` (PostgreSQL 18.6, beta-сборка пакета) в scratchpad сессии, порт 5433, база `gift_list`. `apps/web/.env` основного checkout указывает на Supabase — к нему не подключался.
- `apps/web/.env` — временный, локальные значения, после прогона удалён. `RESEND_API_KEY` не задан. `AUTH_DEV_TRUSTED_ORIGINS=http://localhost:8081`.
- Сервер: standalone `node apps/web/.next/standalone/apps/web/server.js` на `127.0.0.1:3100` (порт 3000 был занят чужим процессом). Для проверки Next-страницы `/ui-check` — `next dev` на 3200.
- UI: встроенный браузер Claude, вьюпорты 390×844 и 1280×900.
- Не поднято: Android-эмулятор, iOS-симулятор, Metro.

## 3. Автопроверки

| Команда | Результат | Примечание |
| --- | --- | --- |
| `npm ci` | успех | |
| `prisma migrate deploy` | успех, 17 с | на пустую базу |
| `npm run typecheck` | успех, 59 с | mobile, web, contracts, ui |
| `npm run lint` | успех, 86 с | ESLint четырёх пакетов и `scripts/check-boundaries.mjs` (код 0) |
| `npm test` (1-й) | **падение**, 93 с | mobile 429/429, contracts 130/130, ui 55/55. web: 2 теста и 1 хук упали по таймауту — `auth.test.ts` («exposes handler…», 15,7 с), `unknown-routes.test.ts` («unsupported methods…», 9 с), `actions/password-reset.test.ts` (hook 10 с). Из-за `&&` `node --test scripts/check-boundaries.test.mjs` не запустился |
| `npm test` (2-й) | **падение**, 64 с | web: упал только `unknown-routes.test.ts` (5,05 с при лимите 5 с) |
| Те же три файла отдельно | успех | `vitest run` трёх файлов: 24/24. Это таймауты холодного импорта, а не ошибки логики. Дефект D1 |
| `node --test scripts/check-boundaries.test.mjs` | успех | 5/5 |
| `npm run build` | успех, 92 с | канарейка `CI_ENV_FILE_CANARY` в `apps/web/.env`. Сборка удалила `.next/standalone/apps/web/.env`. `find .next/standalone -name '.env*'` вне `node_modules` — пусто |
| Standalone | успех | `GET /` → 200 HTML, `/register` → 200, `/login` → 200, `/api/v1/me` → 401 JSON, `/.well-known/assetlinks.json` → 200 JSON, `/ui-check` → 404 (в production так задумано), `/l/Ab_12` → 404 Next |
| CI на `main` | зелёный | `gh run list`: последние 4 прогона `success`, в том числе push `6606d7a` (3 мин 10 с, Linux) |

### Проверка `scripts/check-boundaries.mjs` на нарушениях

Репозиторий не менялся: правленые копии lock-файла лежат в scratchpad и подаются через `GIFT_LIST_LOCKFILE`.

| Подмена | Результат |
| --- | --- |
| Вторая копия `react-dom` (`node_modules/expo/node_modules/react-dom@19.2.0`) | код 1, `duplicate copies of react-dom … see AD-28` |
| Локальная копия `react` в workspace (`apps/mobile/node_modules/react`) | код 1, `duplicate copies of react` |
| `@tamagui/stacks` 3.1.9 при остальных 3.1.10 | код 1, `tamagui and @tamagui/* must share one version, found 3.1.10, 3.1.9` |
| Чистый lock | код 0. 107 записей `react`/`react-dom`/`tamagui`/`@tamagui/*`, у Tamagui одна версия 3.1.10 |

Регулярное выражение для импорта из `"tamagui"` проверено на образцах. Ловит `import … from "tamagui"`, многострочный import, `import "tamagui"`, `import type`, `export … from`, `export *`, `require("tamagui")`, `import("tamagui")` и `vi.mock("tamagui")`. Пропускает `tamagui/dialog` и `@tamagui/core`. Ещё пропускает `jest.mock("tamagui")` и динамическое имя модуля, но Jest в репозитории нет. Проверка `packages/ui/src` на Prisma, `@gift-list/web`/`contracts`, `next`, `expo*`, `better-auth` и `process.env` есть в скрипте и покрыта его тестом.

## 4. Матрица AC

### Story 1.9 — общий UI-пакет `packages/ui` на Tamagui

| Критерий | Вердикт | Доказательство |
| --- | --- | --- |
| Тема Tamagui со всеми значениями frontmatter DESIGN.md; токенов вне пакета нет; `apps/mobile/src/theme/tokens.ts` удалён | PASS | `packages/ui/src/tokens.test.ts` читает frontmatter DESIGN.md и сравнивает цвета, радиусы, отступы, размеры и типографику с `tokens.ts` — зелёный. `apps/mobile/src/theme` нет. Hex-цветов в `apps/mobile/app`, `apps/mobile/src`, `apps/web/src`, `packages/ui/src` вне `tokens.ts` и тестов нет. В браузере фон `#F4F1EA`, primary `#2F5D3A` |
| Исходники TS без сборки; нет API, Prisma, env и строк интерфейса; шрифты из `expo-font` и `next/font` | PASS | `exports` → `./src/index.ts`, `dist/` нет. Кириллицы в `packages/ui/src` вне тестов и комментариев нет. `check-boundaries` запрещает env, Prisma, Next, Expo и contracts. `apps/web/src/app/layout.tsx` грузит Lora и Manrope через `next/font/google` |
| Компоненты Button (4 варианта, настоящий `<button>`), TextField (label, подсказка, ошибка, связи для диктора), WishCard, StatusPill, BottomSheet, Dialog | PASS | Все экспортируются из `packages/ui/src/index.ts`. В DOM кнопки `Button` — `<button type="button">` («Зарегистрироваться», «Добавить желание», «Отмена», «Удалить»). TextField: `<label>` связан с `<input>`. После ошибки ника `aria-invalid="true"` и `aria-describedby` указывает на «3–24 символа: латиница, цифры, _». Подсказка пароля «Минимум 8 символов» тоже в `aria-describedby`. Прочие нажимаемые элементы — `div role="button"`, см. наблюдение N1 |
| BottomSheet и Dialog закрываются «Закрыть»/«Отмена», Esc и «Назад» на Android; фокус возвращается | PASS (веб) / по тестам (Android) | Браузер: диалог «Сохранить изменения?» закрыт Esc и крестиком «Закрыть», фокус оба раза вернулся на «Отмена». Пикер «Кто видит «Плед»» закрыт Esc, фокус на чипе «Видимость: друзьям. Изменить». Confirm удаления закрыт «Отмена», фокус на «Удалить желание». На Next-странице `/ui-check` Dialog закрыт Esc, фокус на «Открыть Dialog». Android «Назад»: `layer.native.ts` подписан на `BackHandler`, тест `layer.native.test.tsx` зелёный. Человек проверил на эмуляторе 2026-11-05 (спека 1.9). BottomSheet в приложении пока не используется (долг) |
| Экраны и `src/ui/*` `apps/mobile` только на `packages/ui`; поведение и тесты не меняются; вид не хуже | PASS | `StyleSheet.create` в `apps/mobile` нет. Из `react-native` импортируются только `useWindowDimensions`, `Platform`, `AccessibilityInfo` и тип `TextInputInstance`. Тесты mobile 429/429. В браузере пройдены вход, регистрация, «Мой вишлист» пустой и с желанием, форма желания, пикер, confirm и Toast. Вид соответствует Forest Paper |
| В `apps/web` нет shadcn, Tailwind, `@base-ui/react`, `cva`; SSR компонентов с CSS в первом ответе; Dialog на Next-странице | PASS | Поиск по `apps/web`, `apps/mobile`, `packages` и lock пуст. Единственное совпадение — комментарий про `lucide-react-native`. `components.json`, `postcss.config.*` и `dark:` нет. `curl /ui-check` (dev): 42 КБ HTML, 2 тега `<style>` (19 933 символа CSS с переменными темы), первый `<style>` раньше первого `<script>`, 3 `<button>` и текст карточек уже в HTML. Страница служебная: в production — 404, рабочих Next-страниц на `packages/ui` пока нет (`/l` и `/i` — Story 3.3) |
| React и `react-dom` 19.3.0 в обоих приложениях; `overrides` и `@tamagui/native` в корне; Metro без `resolveRequest`/`disableHierarchicalLookup` | PASS | `apps/web` и `apps/mobile`: `"react": "19.3.0"`, `"react-dom": "19.3.0"`. Корень: `overrides.react`/`react-dom` 19.3.0, `dependencies["@tamagui/native"]` 3.1.10. В `apps/mobile/metro.config.js` этих ключей нет |
| CI падает на второй копии `react`/`react-dom`/`tamagui`/`@tamagui/*` и на импорте из `"tamagui"` | PASS | См. §3: три подмены lock дают код 1, разбор регулярного выражения и тест скрипта 5/5 |
| Веб-сборка тяжелее не больше чем на 150 КБ gzip | PASS, впритык | gzip (zlib по умолчанию) всех JS `apps/web/public/_expo`: 628 589 байт, 14 файлов. Против базы 487 792 из спеки 1.9 это +140 797 байт, запас около 9,2 КБ до 150 000 байт. В PR и спеке было 625 627. Базу на `dc10567` не пересобирал: метод замера (уровень gzip, папка) взят из спеки, скрипта в репозитории нет |
| Проверено на Android-эмуляторе и в браузере; iOS — в `deferred-work.md` | PASS / NOT TESTED здесь | Браузер — этот прогон. Android — прогон человека на AVD 2026-11-05 (спека 1.9, коммит «Story 1.9 → done после проверки на Android-эмуляторе»), сам я эмулятор не запускал. iOS отложен, запись в `deferred-work.md` есть |
| `typecheck`, `lint`, `test`, `build`, standalone проходят; `AGENTS.md` описывает `packages/ui`, AD-28 и `tamagui.dev/llms.txt` | PASS (CI) / локально флейк | В CI на Linux всё зелёное. Локально на Windows `npm test` падает по таймаутам (D1). `AGENTS.md`, строки 22–23 и 43–44: `packages/ui`, AD-2, AD-28, `https://tamagui.dev/llms.txt` |
| Код спайка удалён или заменён | PASS | `apps/mobile/app/spike.tsx` нет, `apps/web/src/app/l` нет. Вместо тестовой страницы — `(dev)/ui-check`, 404 в production |

### Stories 1.1–1.8 — регрессия после Story 1.9

API — сценарий `fetch` против standalone, 31 проверка. Перед нативной частью счётчики `RateLimit` в локальной базе обнулены (см. примечание ниже).

| История | Критерий | Вердикт | Доказательство |
| --- | --- | --- | --- |
| 1.1–1.2 | Структура workspaces, один lock, `packages/contracts` без React/Prisma/env, Prisma и `.env` только в `apps/web` | PASS | Добавился `packages/ui`, других lock нет. `check-boundaries` зелёный |
| 1.1 | Нет оплаты, ЮKassa, COLLECTION; light only | PASS | Классов `dark:` больше нет: shadcn удалён |
| 1.3 | SPA с корня, пути Next не отдаёт SPA | PASS | См. §3: `/.well-known` → JSON, `/api/v1/me` → JSON, `/l/…` → 404 Next |
| 1.3 | Forest Paper, Lora + Manrope с кириллицей | PASS | Фон и primary совпадают. «Gift List» и «Пока пусто» — Lora 24px. Кириллица («Алёна», «Плед») отрисована |
| 1.4 | `/api/v1/me` без сессии → `UNAUTHENTICATED`; httpOnly cookie; в браузере нет `set-auth-token` | PASS | 401 `UNAUTHENTICATED`. `Set-Cookie` с `HttpOnly`. Заголовка токена в браузерном ответе нет |
| 1.4 | Нативный путь: `expo-origin` → `set-auth-token`, Bearer → `/me` 200 | PASS | 200, токен есть, `Access-Control-Expose-Headers: set-auth-token`. Bearer `/me` → 200 |
| 1.4 | Не-JSON и пустое тело → `VALIDATION` с `field` | PASS | 400 `VALIDATION`. Для пустого тела есть `field` |
| 1.4 | Перезагрузка SPA восстанавливает сессию | PASS | После перезагрузки на 1280×900 — «Мой вишлист» с «Выйти» |
| 1.5 | Регистрация → сессия, `next` `/l/…` → `/wishlist/…` | PASS | API 200 и `next: /wishlist/Ab_12`. В UI регистрация открыла «Мой вишлист» |
| 1.5 | `EMAIL_TAKEN` и текст «Этот email уже зарегистрирован.» со ссылкой «Войти» и переносом email | PASS | API `reason: EMAIL_TAKEN`, `field: email`. UI: текст под полем, ссылка `/login?email=qa%2B…` |
| 1.5 | `NICK_TAKEN` в другом регистре; ник 2/25 символов, кириллица, дефис, пробел → ошибка; правила и превью `@ник` | PASS | API: все пять случаев 400 `field: nick`. UI: «ab» → «3–24 символа: латиница, цифры, _», валидный ник → превью `@qa_alena_1` |
| 1.5/1.6 | Чужие `next` → `/`, `/i/…` → `/invite/…` | PASS | `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)` → `/` |
| 1.6 | Неверный пароль и неизвестный email неотличимы | PASS | Одинаковые статус и тело |
| 1.6 | Выход гасит только текущую сессию; DELETE без сессии не 500 | PASS | После выхода cookie → 401, bearer → 200. DELETE без сессии → 200. В UI «Выйти» открыл `/login?next=%2F` |
| 1.7 | forgot одинаков; выдуманный и пустой токен → `RESET_LINK_STALE`; лимит forgot | PASS | Тела совпадают. Оба токена `RESET_LINK_STALE`. 6-я попытка → 429 `RATE_LIMITED`. Полный цикл сброса через UI в этот прогон не повторял (см. §7) |
| 1.8 | Пояс пишется один раз; без сессии 401 | PASS | `Europe/Minsk` сохранён, повторный `America/New_York` вернул `Europe/Minsk`. Без сессии 401 |
| Epic 2 (контроль) | Создание желания после 1.9 | PASS | API `POST /api/v1/me/gifts` → 201. UI: создание, смена видимости, удаление |

Примечание о лимитах. На своём Node-сервере `X-Forwarded-For` подменяется адресом TCP-соединения (CLE-56). Поэтому все локальные запросы делят ключ `sign-in:127.0.0.1`, и после 10 входов в окне вход ответил 429 даже для нового пользователя. Это правильное поведение, не дефект. Для нативной части я удалил строки `RateLimit` в своей временной базе.

### Сквозные сценарии в браузере

| Сценарий | Вердикт | Доказательство |
| --- | --- | --- |
| Аноним на `/` → вход → регистрация → «Мой вишлист» → перезагрузка → выход → вход | PASS | `/` → `/login?next=%2F`. Регистрация → «Мой вишлист / Пока пусто». Перезагрузка сохраняет сессию. «Выйти» → «Вход». Дефект D1 прошлого прогона исправлен |
| Вход → добавить желание → видимость через VisibilityPicker → удалить через ConfirmDialog | PASS | Форма «Новое желание» с «Друзьям» → карточка «Плед / Открыт / Друзьям» и Toast «Добавлено в вишлист». Пикер открыт и закрыт Esc. «Удалить желание» → «Удалить «Плед»?» → «Отмена» (фокус вернулся) → «Удалить» → «Пока пусто» и Toast «Желание удалено.» |
| Console и Network без 500; `message` сервера не показан | PASS | В консоли SPA только `Failed to load resource` на ожидаемые 401 и 400. Ответов 500 нет. На экранах только строки каталога |
| Предупреждения Tamagui в вебе | Воспроизводится (dev) | На `/ui-check` в `next dev`: `[tamagui] zIndex="1" … nearest token is "base"` и `borderRadius="4" … nearest token is "sm"`. Предупреждений о второй копии React нет |

## 5. Дефекты

### D1. Windows: `npm test` падает по таймаутам холодного импорта в трёх файлах `apps/web`

- Серьёзность: minor. CI на Linux зелёный, логика не сломана.
- История и AC: Story 1.9, «`typecheck`, `lint`, `test`, `build` … проходят». Сквозное: AGENTS.md требует прогнать `npm test` локально перед PR.
- Шаги: Windows 11, Node 24.22.1, чистый `npm ci`, из корня `npm test` дважды.
- Ожидание: зелёный прогон.
- Факт: 1-й прогон — таймауты `src/lib/auth.test.ts` («exposes handler to toNextJsHandler's `in` check», 15,7 с при лимите 5 с), `src/app/api/unknown-routes.test.ts` («unsupported methods on known /api/v1 paths…», 9 с), хук в `src/actions/password-reset.test.ts` (10 с). 2-й прогон — только `unknown-routes.test.ts` (5,05 с). Те же файлы отдельно проходят, 24/24. Из-за `&&` в корневом `test` при падении web не запускается `node --test scripts/check-boundaries.test.mjs`.
- Где: таймауты по умолчанию в `apps/web/vitest.config.ts`. Долг в `deferred-work.md` (строка про `auth.test.ts`) описывает только один файл, теперь их три.

### D2. `next dev` переписывает отслеживаемый `apps/web/AGENTS.md`

- Серьёзность: minor (шум в рабочем дереве, риск случайно закоммитить правку).
- История и AC: Story 1.2 / AGENTS.md («`npm run dev` работает из корня»), правило «не смешивать несвязанные изменения в PR».
- Шаги: в `apps/web` запустить `npx next dev` (или `npm run dev` из корня), затем `git status`.
- Ожидание: рабочее дерево чистое.
- Факт: `M apps/web/AGENTS.md`. Next перегенерировал блок `<!-- BEGIN:nextjs-agent-rules -->` и сменил `# This is NOT the Next.js you know` на `## This is NOT the Next.js you know`. Правку я откатил `git checkout`.
- Где: блок `nextjs-agent-rules` в `apps/web/AGENTS.md`. Next 16 обновляет его при старте dev-сервера. Вероятно, достаточно закоммитить тот вид, который пишет Next (`##`), или отключить генерацию в `next.config.ts`.

### Наблюдение N1 (low, на усмотрение). Часть нажимаемых элементов — `div role="button"`, не `<button>`

- В браузере как `<div role="button" tabindex="0">` отрисованы «Показать пароль», крестик «Закрыть» в Dialog, «Удалить желание», «Выйти», «Настройки». Это `Pressable` пакета, не `Button`, поэтому AC про `Button` формально выполнен. Роль и фокус у них есть, а Enter/Space обрабатывает `pressOnKeyDown` (`packages/ui/src/press.ts`).
- Риск: поведение отличается от нативной кнопки (Space на `keyup`, отправка формы, режим высокой контрастности). Отдельную задачу заводить не обязательно: можно включить в работу по доступности (UX-DR8, NFR-5).

## 6. Подтверждение известных долгов

### Deferred from: Story 1.9

| Долг | Статус на этом прогоне |
| --- | --- |
| iOS и реальный Android не проверены, TalkBack и VoiceOver не проверялись | В силе. В этом прогоне эмулятора и устройства тоже не было |
| Выбор видимости и confirm — диалог по центру, шторка на compact не подключена | Воспроизводится. На 390×844 пикер «Кто видит «Плед»» и «Удалить «Плед»?» — диалоги по центру. `BottomSheet` в `apps/mobile` не используется |
| Скрипт замера веса не в репозитории, CI бюджет +150 КБ не охраняет | Воспроизводится. В `.github/workflows/ci.yml` шага замера нет. Замер этого прогона: +140 797 байт, запас около 9 КБ |
| `BottomSheet` и прерванная анимация закрытия | Не проверено: шторка в приложении не используется, на служебной странице её нет |
| `layer.native.ts`: фокус диктора и `onClosed` при размонтировании | Не проверено: нет Android с TalkBack |
| `ChoiceList`/`Choice` без клавиатурной модели `radiogroup` | Воспроизводится. В пикере у трёх `role="radio"` `tabIndex=0`, каждая строка — отдельная остановка Tab |
| Ошибка поля одновременно `role="alert"` и `aria-live="polite"`; `accessibilityHint` не доходит до диктора в вебе | Подтверждено по коду: `packages/ui/src/text-field.tsx`, строки 92–93 и 129/173. Связь `aria-describedby` в вебе при этом есть |
| Блок `components` DESIGN.md не сверяется тестом; типографика без `fontFamily`/`letterSpacing` | В силе. `tokens.test.ts` проверяет `colors`, `rounded`, `spacing`, размеры и типографику, блок `components` не проверяет |
| Предупреждения Tamagui `zIndex="1"` и `borderRadius="4"` | Воспроизводится и в вебе (`next dev`, `/ui-check`). Источник `zIndex: 1` — внутренний код `node_modules/@tamagui/dialog/dist/esm/Dialog.mjs`, не код проекта. Источник `borderRadius="4"` не найден. В production-сборке не проверял |
| Два Lora на пустом «Мой вишлист» | Воспроизводится в вебе: «Gift List» и «Пока пусто» — оба Lora 24px |

### Прежние долги, которые затронула Story 1.9

| Долг | Статус |
| --- | --- |
| Флейк таймаута `auth.test.ts` на Windows | Воспроизводится и шире записанного — дефект D1 |
| shadcn `dark:` и `@custom-variant dark` в примитивах | Устарел: shadcn и Tailwind удалены Story 1.9. Запись в `deferred-work.md` можно зачеркнуть |
| Ошибка поля не связана с вводом через `aria-invalid`/`aria-describedby` | Связь есть: после ошибки ника `aria-invalid="true"` и `aria-describedby`. Остаток пункта (фокус на первое поле с ошибкой, иконка) не проверял. Запись стоит уточнить |
| Форма сброса пароля не делается, заглушка `/forgot` | Устарел: Story 1.7 сделана (проверено в прошлом прогоне, API — в этом) |
| `X-Forwarded-For` обходит лимит | Закрыт CLE-56 и подтверждён: локально все запросы считаются по `127.0.0.1` независимо от заголовка |

## 7. Что не проверено и почему

- Android-эмулятор, реальное устройство и iOS: здесь их нет. Опираюсь на прогон человека на AVD 2026-11-05 и unit-тесты `layer.native`.
- Metro и Expo web на 8081 не поднимались: браузерный сценарий шёл на SPA из `npm run build`, отданной standalone.
- Полный цикл сброса пароля в UI (письмо → `/reset?token=` → новый пароль) в этот прогон не повторялся. Story 1.9 его экранов по логике не меняла, API сброса проверен, полный цикл прошёл 2026-11-02.
- SSR-CSS проверен только на служебной `/ui-check` в `next dev`: в production она 404, рабочих Next-страниц на `packages/ui` до Story 3.3 нет.
- Базовый вес на `dc10567` не пересобирался: сравнение с числом из спеки.
- PostgreSQL — 18.6 из `embedded-postgres`, не 16, как в CI и проде. Миграции и все сценарии прошли.
- Прод, Vercel и Supabase не вызывались.

## 8. Что завести в Linear

Заведено 2026-11-05: D1 — CLE-67, D2 — CLE-68 (Backlog, Low, связаны как «одним заходом»). Пункты 3 и 4 в Linear не заводились.

1. **D1** (CLE-67) — «Без истории»: стабилизировать `npm test` на Windows. Таймауты холодного импорта в `apps/web` (`auth.test.ts`, `unknown-routes.test.ts`, `password-reset.test.ts`), плюс корневой `test` не должен пропускать `check-boundaries.test.mjs` при падении workspace. Обновить пункт в `deferred-work.md`.
2. **D2** (CLE-68) — «Без истории»: `next dev` переписывает `apps/web/AGENTS.md`. Закоммитить формат Next или отключить перегенерацию.
3. Рекомендация, не дефект: вынести долг «замер веса веб-сборки в CI» из `deferred-work.md` в задачу до Story 3.3. Запас до бюджета около 9 КБ.
4. Уборка `deferred-work.md` (через `bmad-build` или вместе с п. 1): зачеркнуть устаревшие пункты про shadcn `dark:` и заглушку `/forgot`, уточнить пункт про `aria-invalid`/`aria-describedby`.
