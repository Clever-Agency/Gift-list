# CLE-46 — Story 3.1: Смена Ника в настройках — микрозадачи

Ветка: `evivanchikov/cle-46-story-31-smena-nika-v-nastroikakh`. Исполнитель кода — opencode (`opencode-go/deepseek-v4.1-flash`). Промпты — `_bmad-output/CLE-46-prompts/NN.md`.

AC (epics.md, Story 3.1): экран «Настройки»; ввод нового nick 3–24 `[a-z0-9_]`; `nickNormalized` уникален без учёта регистра; превью `@ник` (AD-13, UX-DR7); `/u/{старый}` → «пользователь не найден»; `List.publicToken` не меняется; занятый ник → inline «Этот ник уже занят».

- [ ] 01 contracts: схема тела `PUT /api/v1/me/nick` + i18n-ключи экрана «Настройки»
- [ ] 02 web: use-case `updateNick` + маршрут `PUT /api/v1/me/nick` + тесты
- [ ] 03 mobile: клиент `updateNick` в `src/api` + обновление `me` в AuthContext + тесты
- [ ] 04 mobile: экран `/settings` с полем Ника, превью, inline-ошибками, тостом + тесты
- [ ] 05 mobile: временный вход в «Настройки» с «Мой вишлист» (до Story 6.2) + тест
- [ ] 06 docs: `sprint-status.yaml` → 3.1 `done`, заметка в deferred-work про `/u/{ник}` (маршрута профиля ещё нет, Story 3.4)
