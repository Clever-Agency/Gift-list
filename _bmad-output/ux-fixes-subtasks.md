# UX-фиксы: «Отмена» в форме желания и авто-скрытие toast

Ветка: `evivanchikov/ux-cancel-and-toast-autodismiss` (от main e56c298). Код пишет только opencode (`opencode-go/deepseek-v4.1-flash`). Одна подзадача — один локальный коммит. Без push/PR, Linear не трогаем.

- [x] A) ToastHost: авто-скрытие `max(4 с, 1 с + 60 мс × символ)` (DESIGN.md:415); пауза на hover/focus; при включённом дикторе toast с действием не скрывается сам; «Нет сети» (ошибка) не скрывается сам; новый toast заменяет старый (таймер перезапускается); таймеры чистятся при unmount; info → `role="status"`/polite, error → `role="alert"`/assertive (DESIGN.md:494). Тесты на fake timers.
- [x] B) Ghost-кнопка «Отмена» в UI-kit (DESIGN.md:383, зона 44×44), i18n: `apps/mobile/src/ui/ghost-button.tsx` + тесты. API как у `PrimaryButton` (`label`, `onPress`, `disabled`, `testID`), подпись приходит пропом из `app.giftForm.action.cancel` — новый ключ не заводили. Фон `transparent`, текст `colors.primary`, радиус `rounded.md`, `minHeight`/`minWidth` 44 и padding вместо `hitSlop`; pressed — `colors.muted`; disabled — 40% непрозрачности, `aria-disabled`/`accessibilityState.disabled`, остаётся в порядке фокуса, `onPress` не вызывается. Экраны в `apps/mobile/app` не менялись (это подзадача D).
- [x] C) Хелпер dirty-state формы + подтверждение «Сохранить изменения?» (EXPERIENCE.md:279, DESIGN.md:484); на вебе — модальный слой, без `window.confirm`.
- [x] D) «Отмена» рядом с «Сохранить» на `/gifts/new` и `/gifts/[id]/edit`: чистая форма закрывается сразу (back, иначе dismissTo списка), грязная — через подтверждение. Тесты.
- [x] D2) Системное «назад» (usePreventRemove из expo-router/react-navigation, хук useDiscardGuard) на грязной форме открывает тот же ConfirmDialog; «Не сохранять» повторяет заблокированное действие. Сохранение и чистая форма не перехватываются. Тесты.
- [x] E) Полная проверка: typecheck, lint, check-boundaries, тесты всех пакетов, build.
- [x] F) Диалог «Сохранить изменения?»: «Сохранить» (обычный submit; при ошибке форма остаётся), «Не сохранять» (уходит), крестик «Закрыть» / Esc / фон — назад к форме. i18n и спека (EXPERIENCE.md, DESIGN.md) обновлены. Тесты.
- [x] G2) Гонка в leave(): свои выходы (сохранение, «Не сохранять», чистая «Отмена») не перехватываются guard'ом независимо от рендера. Промпт: _bmad-output/ux-fixes-prompts/G2.md
- [x] G1) Браузерная «назад» на вебе для грязной формы открывает тот же диалог (+beforeunload). Промпт: _bmad-output/ux-fixes-prompts/G1.md
- [x] G3) Мелочи: disabled и защита от двойного тапа «Сохранить» в диалоге, фокус в диалог и обратно на «Отмена», крестик как остальные иконки, accessibilityLabel кнопок тоста. Промпт: _bmad-output/ux-fixes-prompts/G3.md
- [x] G4) Откат правок исторических артефактов (review-accessibility.md, validation-report.md/.html) к e56c298.
- [x] G5) Веб: на своих выходах (proceed, allowLeave) снимать beforeunload до history.go, чтобы не было нативного «Покинуть сайт?». Промпт: _bmad-output/ux-fixes-prompts/G5.md
