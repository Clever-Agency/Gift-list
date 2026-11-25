---
title: 'CLE-86: проверка обновления приложения — мягкое предложение и блокирующий экран'
type: 'feature'
created: '2026-11-20'
status: 'ready-for-dev'
route: 'dispatch'
baseline_commit: '84a34e8d89960502bbe897c7a4734f84a82cbd6f'
review_loop_iteration: 0
story_key: ''
context:
  - '{project-root}/apps/web/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-gift-list-2026-09-30/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-gift-list-2026-09-30/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Версия приложения (`apps/mobile/app.config.ts`, сейчас `0.1.0`) нигде не сверяется с сервером. Если сборка устарела или сломана, показать «обновитесь» нечем: обновление в сторе — единственный путь, а приложение о нём не просит; блокировать заведомо несовместимую версию тоже нечем. Решение Евгения от 11.11.2026 (CLE-86, отдельной истории в `epics.md` нет).

**Approach:** Политика обновления — константы в `packages/contracts/src/app-version.ts`; сервер отдаёт их публичным `GET /api/v1/app-version` (без входа, без БД), поэтому поднять `latestVersion` или `minSupportedVersion` = задеплоить сервер, без пересборки приложения. Нативный клиент при запуске и при возврате на передний план сравнивает `Constants.expoConfig?.version` с ответом: ниже `latestVersion` — закрываемое предложение «Доступно обновление» (один раз на конкретную `latestVersion`), ниже `minSupportedVersion` — полноэкранный блок без обхода. Любой сбой (сеть, 5xx, невалидный ответ, нечитаемая версия) — fail open: ничего не показываем и не блокируем. Веб-сборка не затрагивается.

## Boundaries & Constraints

**Always:**
- Политика и правила версий живут только в `packages/contracts/src/app-version.ts` (AD-17: без React, Prisma и env). Клиент читает политику **только из ответа сервера**; локальные константы политики в приложении не читаются, иначе после публикации магазина старые сборки не получат ссылку.
- Формат версии — строго `MAJOR.MINOR.PATCH` из цифр: `^\d{1,9}\.\d{1,9}\.\d{1,9}$`. Сравнение числовое по трём сегментам (`0.1.10` > `0.1.9`), не строковое. `v1.0.0`, `1.0`, `1.0.0.0`, `1.0.0-beta`, пробелы, пустая строка и сегмент длиннее 9 цифр — невалидны.
- Значения по умолчанию для обеих платформ: `latestVersion = minSupportedVersion = "0.1.0"`, `storeUrl = null`. При таких значениях никому ничего не показывается. Пока магазины не опубликованы, значения по умолчанию не поднимаются (см. «Открытые вопросы»).
- В политике `minSupportedVersion <= latestVersion`; `storeUrl` — абсолютный `https`-URL или `null`. Нарушение — невалидный ответ: сервер отвечает 500 без конверта, клиент уходит в fail open.
- Ответ — конверт AD-12: `{ ok: true, data: { android: {...}, ios: {...} } }`. Эндпоинт без сессии, без БД и без персональных данных; `Cache-Control: private, no-store` (общий `toResponse`); прочие методы — `notFoundResponse`.
- Версия клиента — `Constants.expoConfig?.version` (`expo-constants` уже есть), прочитанная в одном месте с `try/catch`. Пусто или невалидно — fail open.
- Проверка идёт только на нативном клиенте (`Platform.OS` ∈ `android`, `ios`). В браузере — ни запроса, ни UI, ни подписки на события (веб-сборка обновляется перезагрузкой и в CLE-86 не входит).
- Мягкое предложение — `Dialog` (`packages/ui`): закрывается крестиком, Esc, системной «Назад», нажатием на затемнение и кнопкой «Закрыть». Блокирующий экран — обычный полноэкранный экран (`Screen` → `SafeArea` → `PageScroll`), **не** `Dialog`: его нельзя закрыть, и под ним не остаётся навигации.
- «Закрыл предложение» хранится для конкретной `latestVersion` (SecureStore на телефоне, ключ без личных данных). Новое `latestVersion` — снова одно предложение. Блок закрытие игнорирует. Ошибка чтения хранилища не подавляет показ, ошибка записи только мешает запомнить.
- Ссылка в магазин — только `Linking.openURL(storeUrl)` из ответа (`expo-linking` уже есть). `storeUrl = null` — блокирующий экран без кнопки, мягкое предложение только с «Закрыть». URL магазинов в коде не выдумываются.
- Проверка никогда не задерживает первый кадр: приложение стартует как обычно, ответ применяется, когда придёт (таймаут запроса — общий 10 с из `apiRequest`).
- Тексты интерфейса — только `app.appVersion.*` из `packages/contracts/src/i18n/ru/app.json` (AD-27).
- Новых пакетов, env-переменных и миграций Prisma нет. Схема `prisma` не меняется.

**Never:**
- Play In-App Updates на Android (нужен новый пакет) — отложено, на Android только ссылка в магазин.
- `expo-updates`, OTA, EAS Update, каналы и откаты.
- Придуманные или захардкоженные URL `play.google.com` / `apps.apple.com`, когда `storeUrl` пуст или невалиден.
- Правка веб-сборки, серверных страниц (`/l`, `/i`, `/u`, `/admin`), сплэша и веб-метаданных.
- Таблица `Notification`, письма, `deliverAfter`, `recordGiftEvent` — это Epic 6 и к обновлению не относится.
- Блокировка по невалидному, неполному или устаревшему ответу; «догадки» о версии из `Platform.constants` или `manifest2`.
- Блокировка при нечитаемой версии клиента, обрыве сети и 5xx.
- Проверка на веб-клиенте, в Storybook и в тестах веб-сборки.
- Изменение `sprint-status.yaml`, PRD, эпиков, `DESIGN.md`, `EXPERIENCE.md`.
- Миграции и подключение к живой БД.

## I/O & Edge-Case Matrix

| ID | Вход / состояние | Ожидаемое поведение | Ошибка / примечание |
|----|------------------|---------------------|---------------------|
| UPDATE_SOFT | current `0.1.0`, min `0.1.0`, latest `0.2.0`, `storeUrl = null` | `Dialog` «Доступно обновление» с «Закрыть», без кнопки магазина | — |
| UPDATE_SOFT_STORE | то же, `storeUrl = https://…` | `Dialog` с «Обновить» (открывает магазин) и «Закрыть» | отказ `openURL` не ломает экран |
| UPDATE_BLOCK | current `0.1.0`, min `0.2.0`, latest `0.3.0` | полноэкранный «Обновите приложение», навигации под ним нет | — |
| NO_STORE_URL | блок, `storeUrl = null` | текст «…Обновите приложение в магазине.», кнопки нет | тупик по согласованию, см. «Открытые вопросы» |
| UP_TO_DATE | current `0.2.0` = latest | ничего не показывается | запрос всё равно сделан |
| CURRENT_AHEAD | current `0.3.0` > latest `0.2.0` (dev-сборка впереди) | ничего не показывается | — |
| FAIL_OPEN_NETWORK | обрыв, DNS, таймаут 10 с | ничего не показывается, текущее состояние не меняется | `apiRequest` → `{ network: true }` |
| FAIL_OPEN_5XX | 500 без конверта (БД/сбой сервера) | ничего, текущее состояние не меняется | не-конверт = `network` |
| FAIL_OPEN_INVALID | не-конверт, битый JSON, нет платформы, `1.0`, `min > latest`, `ftp://` | ничего, текущее состояние не меняется | схема ответа отклоняет (лишние поля она срезает, а не отклоняет) |
| FAIL_OPEN_NO_VERSION | `Constants.expoConfig?.version` пуст или невалиден | запрос не нужен, ничего не показывается | — |
| FAIL_OPEN_TOKEN_STORE | упало чтение сохранённого токена в `apiRequest` | ничего не показывается | жёсткая цена общего транспорта, принято |
| FAIL_OPEN_ALREADY_BLOCKED | блок уже показан, следующая проверка упала | блок остаётся | fail open не снимает блок |
| WEB_SKIP | `Platform.OS = web`, Storybook, тесты веб-сборки | нет запроса, нет UI, дети рендерятся как есть | — |
| DISMISSED_SAME_VERSION | закрыл `0.2.0`, перезапуск, latest всё ещё `0.2.0` | мягкое предложение не показывается; блок при этом покажется | — |
| DISMISSED_NEW_VERSION | закрыл `0.2.0`, latest стал `0.3.0` | предложение показывается один раз | — |
| DISMISSED_THEN_MIN | закрыл `0.2.0`, min стал `0.2.0` | блок, закрытие не помогает | блок сильнее запоминания |
| FOREGROUND_RECHECK | приложение вернулось на передний план (`AppState → active`) | новый запрос и применение результата | свернул/вернул — ровно один запрос на переход |
| CHECK_IN_FLIGHT | два запуска проверки подряд | запрос не дублируется; применяется последний ответ | устаревший ответ отбрасывается по номеру попытки |
| STORE_OPEN_FAILED | `Linking.openURL` отклонил промис | экран остаётся, падения нет | — |

</frozen-after-approval>

## Контракт

`packages/contracts/src/app-version.ts`:

```ts
export const APP_VERSION_PATTERN = /^\d{1,9}\.\d{1,9}\.\d{1,9}$/;
export const DEFAULT_APP_VERSION = "0.1.0";
export const APP_PLATFORMS = ["android", "ios"] as const;
export type AppPlatform = (typeof APP_PLATFORMS)[number];

export const appVersionPolicySchema = z.object({
  latestVersion: z.string().regex(APP_VERSION_PATTERN),
  minSupportedVersion: z.string().regex(APP_VERSION_PATTERN),
  storeUrl: z.url({ protocol: /^https$/ }).nullable(),
});

export type AppVersionPolicy = z.infer<typeof appVersionPolicySchema>;

/** `data` ответа `GET /api/v1/app-version`; обе платформы обязательны. */
export const appVersionDataSchema = z
  .object({ android: appVersionPolicySchema, ios: appVersionPolicySchema })
  .superRefine(/* minSupportedVersion <= latestVersion у каждой платформы */);

export type AppVersionData = z.infer<typeof appVersionDataSchema>;

export const APP_VERSION_STATUSES = ["UPDATE_SOFT", "UPDATE_BLOCK", "UP_TO_DATE"] as const;
export type AppVersionStatus = (typeof APP_VERSION_STATUSES)[number];

/** `null`, если хотя бы одна строка не в формате. */
export function compareAppVersions(left: string, right: string): -1 | 0 | 1 | null;

/** Fail open внутри правила: `null`/невалидный current → `UP_TO_DATE`. */
export function appVersionStatus(
  current: string | null,
  policy: AppVersionPolicy,
): AppVersionStatus;

/** Значения по умолчанию: `0.1.0` / `0.1.0` / `null` для обеих платформ. */
export const APP_VERSION_POLICY: AppVersionData;

/** Проверка собственных констант; бросает `ZodError` на невалидных. */
export function parseAppVersionPolicy(value: unknown): AppVersionData;
```

> Примечание (R1, 2026-11-20, CLE-86). `APP_VERSION_POLICY` — обычная константа
> (`satisfies AppVersionData`), без вызова парсера при импорте пакета: контракты
> импортирует и мобильное приложение, поэтому опечатка в константах не должна
> бросать исключение при загрузке всего пакета и ронять старт приложения.
> Валидность держат тест `parseAppVersionPolicy(APP_VERSION_POLICY)` в
> `app-version.test.ts` и проверка в `getAppVersionPolicy` на сервере (исключение →
> 500 на маршруте).

Схемы ответа — `z.object`, **не** `z.strictObject`: лишнее поле, добавленное сервером позже, не должно молча выключать проверку у старых сборок. Это осознанное отличие от схем карточек и тел запросов, чтобы fail open не срабатывал на расширение ответа.

Ответ `GET /api/v1/app-version` (200, без входа, без БД, `Cache-Control: private, no-store`):

```json
{
  "ok": true,
  "data": {
    "android": { "latestVersion": "0.1.0", "minSupportedVersion": "0.1.0", "storeUrl": null },
    "ios": { "latestVersion": "0.1.0", "minSupportedVersion": "0.1.0", "storeUrl": null }
  }
}
```

Правило выбора статуса: `current < min` → `UPDATE_BLOCK`; `min <= current < latest` → `UPDATE_SOFT`; `current >= latest` → `UP_TO_DATE`.

## Файлы по подзадачам

**A2 — контракт и версии (`@gift-list/contracts`)**
- `packages/contracts/src/app-version.ts` — новый модуль выше (константа политики, схемы, `compareAppVersions`, `appVersionStatus`, `parseAppVersionPolicy`).
- `packages/contracts/src/index.ts` — именованный реэкспорт нового модуля (как `./brand`, `./search`).
- `packages/contracts/src/i18n/ru/app.json` — новая ветка `appVersion` (тексты ниже, AD-27).
- `packages/contracts/src/app-version.test.ts` — таблица сравнения, невалидные форматы, `min > latest`, `storeUrl` без `https`, `appVersionStatus` и её fail open.

**A3 — сервер (`apps/web`)**
- `apps/web/src/actions/app-version.ts` — `import "server-only"`; `getAppVersionPolicy(): Promise<ActionResult<AppVersionData>>` из констант через `parseAppVersionPolicy`; ошибка констант — исключение (не `NOT_FOUND`).
- `apps/web/src/app/api/v1/app-version/route.ts` — `GET` → `toResponse`, `catch` → `infrastructureErrorResponse()`; `POST/PUT/PATCH/DELETE/HEAD = notFoundResponse`.
- `apps/web/src/app/api/v1/app-version/route.test.ts` — образец `apps/web/src/app/api/v1/tags/route.test.ts`.
- `docs/deployment-environments.md` — короткая заметка «поднять `latestVersion`/`minSupportedVersion` = поменять константы и задеплоить сервер; без магазина `min` не поднимать». Файл общий: согласовать с координатором, иначе не трогать и отметить в отчёте.

**A4 — логика клиента (`apps/mobile`)**
- `apps/mobile/src/api/app-version.ts` — `fetchAppVersionPolicy(): Promise<ClientResult<unknown>>` через `apiRequest` (образец — `src/api/public-wishlist.ts`), без своего fetch и без разбора конверта.
- `apps/mobile/src/app-version/platform.ts` — `appVersionPlatform(): AppPlatform | null` из `Platform.OS`.
- `apps/mobile/src/app-version/current-version.ts` — `currentAppVersion(): string | null` из `Constants.expoConfig?.version` в `try/catch`.
- `apps/mobile/src/app-version/dismissed.ts` — веб/тестовая заглушка (`null`, запись — no-op); `dismissed.native.ts` — `expo-secure-store`, ключ `gift-list.app-version.dismissed`, значение — строка `latestVersion`, ошибки гасятся.
- `apps/mobile/src/app-version/foreground.ts` — no-op подписка; `foreground.native.ts` — `AppState.addEventListener("change", …)`, `active` после не-`active`, возвращает функцию отписки.
- `apps/mobile/src/app-version/check.ts` — чистое решение `resolveAppVersion(state, result)` (матрица, запоминание по `latestVersion`, блок сильнее запоминания) и оркестрация одного запроса.
- `apps/mobile/src/api/app-version.test.ts`, `apps/mobile/src/app-version/check.test.ts`, `apps/mobile/src/app-version/dismissed.native.test.ts` — моки `@/api/client`, `expo-secure-store`, `expo-constants`.

**A5 — UI и включение (`apps/mobile`)**
- `apps/mobile/src/app-version/app-version-gate.tsx` — провайдер/гейт: на web сразу дети; на native проверка на монтировании и на переднем плане, состояние `idle | soft | block`, `dismiss()`, блок заменяет дерево, мягкое предложение рисуется поверх.
- `apps/mobile/app/_layout.tsx` — `<AppVersionGate>` внутри `IntlProvider` и `SafeAreaProvider`, выше `AuthProvider` (проверка не зависит от сессии).
- `apps/mobile/src/ui/app-update-soft-dialog.tsx` — `Dialog` из `@gift-list/ui`; тексты `app.appVersion.*`, `storeUrl`/`onOpenStore`/`onDismiss` пропсами; `displayName`.
- `apps/mobile/src/ui/app-update-block-screen.tsx` — `Screen`/`SafeArea`/`PageScroll`/`PageContainer`/`Column` по образцу `session-error-screen.tsx`; `role="alert"`, `Heading level={1}`; `displayName`.
- `apps/mobile/src/ui/app-update-soft-dialog.stories.tsx`, `app-update-block-screen.stories.tsx` — раздел `App/…`: со ссылкой, без ссылки, длинная кириллица, 360 px (`globals.viewport`); экранная story — `parameters: { layout: "fullscreen", screenFrame: true }`.
- `apps/mobile/src/app-version/app-version-gate.test.tsx` — happy-dom, моки пяти модулей выше: soft, block, dismissed, foreground, web skip, fail open, «блок не снимается ошибкой».
- `_bmad-output/implementation-artifacts/deferred-work.md` — пункты из «Отложено».

## Тексты (ru)

Все строки — **новые тексты, без утверждения в UX** (в `DESIGN.md`/`EXPERIENCE.md` их нет; формулировки короткие и простые, согласовать с Сергеем).

| Ключ | Текст | Где |
|------|-------|-----|
| `app.appVersion.soft.title` | Доступно обновление | заголовок `Dialog` |
| `app.appVersion.soft.body` | Вышла новая версия приложения. Обновите его, когда будет удобно. | описание `Dialog` |
| `app.appVersion.soft.update` | Обновить | кнопка магазина |
| `app.appVersion.soft.close` | Закрыть | закрытие предложения |
| `app.appVersion.block.title` | Обновите приложение | заголовок экрана |
| `app.appVersion.block.body` | Эта версия больше не поддерживается. Обновите приложение в магазине, чтобы продолжить. | тело при наличии `storeUrl` |
| `app.appVersion.block.bodyNoStore` | Эта версия больше не поддерживается. Обновите приложение в магазине. | тело без `storeUrl` |
| `app.appVersion.block.openStore` | Открыть магазин | кнопка при наличии `storeUrl` |

## Отложено

- **Play In-App Updates (Android)** — нужен новый пакет (`react-native-in-app-updates`/аналог), ночью пакеты не ставим. Пока Android открывает ссылку через `Linking.openURL`.
- **URL магазинов и реальные значения политики** — магазины не опубликованы, `storeUrl = null`, `latest = min = 0.1.0`. Заполнить после публикации (владелец — Евгений/Сергей), тогда же поднимать `latest`/`min`.
- **Другие языки** — сейчас каталог только `ru` (AD-27), новые ключи добавлены в него; переводы — когда появятся локали.
- **`expo-updates`/OTA, принудительное обновление без магазина, откат версии, телеметрия отказов** — вне CLE-86.

## Открытые вопросы (решают Евгений/Сергей)

1. **Fail open можно обойти.** Пользователь ниже `minSupportedVersion` с выключенной сетью видит обычное приложение: так требует задача. Это принимается как есть, или нужен «последний известный ответ» в хранилище (тогда офлайн-блок сохраняется, но появляется риск залипшего блока)?
2. **Блок без `storeUrl` — тупик.** Пока магазин не опубликован, поднимать `minSupportedVersion` нельзя. Правило записано в спеку и в docs; подтвердить, что этого достаточно, без технической блокировки в схеме.
3. **Когда поднимать `latestVersion`.** Каждый релиз сборки? Или только когда есть смысл просить обновиться? Кто и в каком чек-листе это делает.
4. **Тексты** — см. таблицу выше, нужны правки UX.
5. **Частота проверки.** Сейчас ровно один запрос на запуск и один на каждый выход на передний план, без троттлинга; ответ ~1 КБ. Оставляем или добавляем минимальный интервал?
6. **`minSupportedVersion` при сломанном API.** Нужен ли отдельный «аварийный» путь блокировки без магазина (например, сборка вообще не может работать) — или это не наш сценарий.

## Tasks & Acceptance

**Execution:**
- [ ] A2: `app-version.ts` — формат, сравнение, схемы, `parseAppVersionPolicy`; реэкспорт; тексты `app.appVersion.*`; таблица тестов сравнения и невалидных ответов.
- [ ] A3: действие и маршрут `GET /api/v1/app-version`; тест конверта, `no-store`, отсутствия сессии, 500 на сломанных константах, 404 на прочих методах.
- [ ] A4: клиент ответа, версия из `Constants`, платформа, запоминание в SecureStore, подписка на передний план, чистое решение; тесты soft/block/up-to-date/пять видов fail open/раздельные платформы.
- [ ] A5: `AppVersionGate` в `_layout.tsx`, `Dialog` и полноэкранный блок, stories, тесты гейта; пункты в `deferred-work.md`.
- [ ] Миграций нет, `sprint-status.yaml` не трогать, `_bmad-output/planning-artifacts/**` не менять.

**Acceptance Criteria:**
- Given политика `latest = 0.2.0`, `min = 0.1.0` и версия клиента `0.1.0`, when приложение запускается, then один раз показывается закрываемый `Dialog` «Доступно обновление», а после «Закрыть» он не появляется до смены `latestVersion`.
- Given `min = 0.2.0` и версия клиента `0.1.0`, when приложение запускается или выходит на передний план, then показывается полноэкранный «Обновите приложение» без закрытия, а под ним нет навигации.
- Given `storeUrl = null`, when показывается любое из двух состояний, then кнопки магазина нет и URL не придумывается; при `storeUrl` из ответа кнопка открывает его через `Linking.openURL`.
- Given сеть недоступна, сервер ответил 5xx или невалидным телом, when проверка идёт, then ничего не показывается и ранее показанный блок не снимается.
- Given `Platform.OS = web`, when приложение запускается, then нет ни запроса `/api/v1/app-version`, ни изменений интерфейса.
- Given Android и iOS с разными политиками, when каждая платформа проверяет версию, then решение принимается по своей ветке ответа.

## Design Notes

- **Почему константы, а не env.** Политика — публичные данные (версии и ссылка в магазин) и должна меняться деплоем сервера; env в `apps/web` потребовал бы ещё и `envSchema`, и переменных на Vercel. Константы в `packages/contracts` уже импортируются сервером, схема ответа лежит рядом (AD-17, AD-26).
- **Почему `no-store`.** `toResponse` уже ставит `private, no-store`; ответ крошечный (две платформы, три поля), проверок мало (запуск и передний план). Кэш мог бы задержать блокировку после смены политики.
- **Почему блок — экран, а не `Dialog`.** `Dialog` закрывается Esc, «Назад» и затемнением, и под ним остаётся навигация. Гейт при `UPDATE_BLOCK` рендерит экран вместо `children`, поэтому обойти его внутри приложения нечем.
- **Почему fail open на уровне правила.** `appVersionStatus` сам возвращает `UP_TO_DATE` при `null`/невалидном `current`, чтобы клиент не мог забыть проверку. Схема ответа (`z.object`) не падает на лишнем поле: расширение ответа не должно выключать проверку у старых сборок.
- **Почему запоминание по `latestVersion`.** «Навязывать при каждом запуске» запрещено, но и терять предложение навсегда нельзя: следующая версия — новый повод. Хранится только строка версии, без id пользователя и платформы.
- **Платформенные пары.** `dismissed.ts`/`dismissed.native.ts` и `foreground.ts`/`foreground.native.ts` — тот же приём, что `platform/session-token` и `friends/subscription-view`: веб-сборка не тянет нативные модули.
- **Старт без ожидания.** Первый кадр не ждёт сеть; при блоке состояние навигации под ним теряется — принято, блокирующий случай редкий и означает несовместимую сборку.

## Verification

**Commands:**
- `npm run test -w @gift-list/contracts` — таблица сравнения, невалидные форматы и политика, статус.
- `npm run test -w @gift-list/web` — маршрут: конверт, `no-store`, без сессии, 500 на сломанных константах, 404 на прочих методах.
- `npm run test -w @gift-list/mobile` — матрица гейта, запоминание, передний план, fail open, web skip, раздельные платформы.
- `npm run typecheck`, `npm run lint` — без ошибок.

**Manual checks (если есть чем):**
- На телефоне с политикой по умолчанию (`0.1.0`/`0.1.0`/`null`) ничего не появляется ни на запуске, ни при возврате на передний план.
- На веб-сборке в Network нет запроса `/api/v1/app-version`, интерфейс не меняется.
- Сборку и dev-серверы в ночном заходе не запускать: их гоняет координатор в конце.
