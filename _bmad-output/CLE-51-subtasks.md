# CLE-51 — Story 2.3: Видимость и удаление желания — микрозадачи

Основа: локальная ветка CLE-48 (Story 3.2, VisibilityPolicy), не смержена в main.
Спека: `epics.md` → Story 2.3; FR-10, FR-11, D-23, AD-7, AD-8; EXPERIENCE.md (Visibility chip, Gift card, Shtorka/Dialog, статусы); DESIGN.md (VisibilityChip, BottomSheet/Dialog).

| # | Микрозадача | Слой |
|---|---|---|
| 01 | i18n-ключи: подпись чипа, выбор видимости, toast «Видимость: …», блокировка видимости в форме, удаление с подтверждением | contracts |
| 02 | updateGift: смена видимости у RESERVED/CLOSED → VALIDATION (field `visibility`), атомарно; deleteGift (только OPEN) + `DELETE /api/v1/me/gifts/{id}` | web |
| 03 | Клиент `deleteGift(id)` в `src/api/my-gifts.ts` | mobile |
| 04 | `VisibilityPicker` (диалог с radiogroup) + `VisibilityChip` как кнопка у OPEN; чип вынесен из Pressable карточки | mobile |
| 05 | «Мой вишлист»: смена видимости с чипа — optimistic, откат и toast при ошибке, toast «Видимость: …» | mobile |
| 06 | Экран правки: видимость заблокирована у не-OPEN (и не отправляется), «Удалить желание» с подтверждением у OPEN → список с toast | mobile |
| 07 | Документы: sprint-status `2-3` → done, deferred-work (⋯-меню, удаление RESERVED/CLOSED — 5.4/2.6) | docs |
