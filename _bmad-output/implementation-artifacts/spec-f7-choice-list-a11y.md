---
title: 'F7: доступность ChoiceList (Q-08)'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/packages/ui/src/choice.tsx'
  - '{project-root}/packages/ui/src/choice.test.tsx'
  - '{project-root}/apps/mobile/src/ui/gift-form.tsx'
  - '{project-root}/apps/mobile/src/ui/gift-form.test.tsx'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Проблема:** у `radiogroup` из `packages/ui/src/choice.tsx` ошибка показывается текстом, но не связана с группой: нет `aria-invalid`, `aria-describedby`, `aria-errormessage` и `role="alert"`. Пояснение блокировки («Видимость меняется только у открытого желания», «Сколько раз можно дарить — меняется только у открытого желания») выводится отдельным текстом в `gift-form.tsx` и с группой не связано. Из-за этого диктор не узнаёт ни об ошибке выбора, ни о причине недоступности, хотя `DESIGN.md` и `EXPERIENCE.md` требуют программной связи ошибки и пояснения.

**Подход:** в `ChoiceList` добавить необязательное описание группы (пояснение блокировки) и связать с `radiogroup` и ошибку, и описание: в браузере — `aria-invalid`, `aria-describedby`, `aria-errormessage` и `role="alert"` у ошибки; на телефоне — `accessibilityHint` группы, как позволяет текущий примитив. В `gift-form.tsx` передавать существующие строки блокировки в `ChoiceList` вместо отдельного `Text`, сохранив внешний вид и порядок. Новых продуктовых лимитов, кодов и текстов нет; поведение выбора и блокировки не меняется.

</frozen-after-approval>

## Implementation Notes

- `ChoiceList` получил необязательное `description`; `ChoiceGroup` формы прокидывает его в `ChoiceList`. Отдельные `Text` блокировки удалены, текст остаётся тем же. Чтобы сохранить прежний отступ 16 px от формы, у описания `marginTop="$3"` при `gap="$1"` контейнера.
- Связь в браузере: `aria-describedby` собирает id ошибки и описания в этом порядке, `aria-invalid` выставлен только при ошибке, у ошибки `role="alert"` и `aria-live="polite"`. `aria-errormessage` намеренно не ставится: он дублировал бы тот же текст, а `DESIGN.md` → Форма и `TextField` уже используют `aria-describedby`.
- На телефоне `radiogroup`-контейнер не фокусируется, поэтому одного `accessibilityHint` группы мало: тот же текст через контекст добавляется к `accessibilityHint` каждого `Choice`. Свой hint опции идёт первым, текст группы — вторым; `joinSentences` не добавляет второй точки.
- Проверка диктором (NVDA/VoiceOver/TalkBack) не выполнялась — только DOM-атрибуты в тестах. Клавиатурная модель радиогруппы (стрелки, один Tab-stop) и копия блокировки «над группой» из `DESIGN.md` остаются вне F7.

## Verification

**Commands:**
- `npm run typecheck` — успешно, все 4 workspace.
- `npm run lint` — успешно, включая `scripts/check-boundaries.mjs`.
- `npm test` — 106 файлов Vitest: mobile 40/557, web 46/489, contracts 6/164, ui 14/78; плюс `check-boundaries` 5/5. Итого 1293 теста, 0 падений.
- `npm run build` — успешно: Expo-web экспорт, Prisma generate, Next.js 16.4.3 production build, standalone assets.

## Spec Change Log

- F7, 2026-11-06: в Intent упомянут `aria-errormessage`, но реализация его не ставит. Причина: `aria-errormessage` и `aria-describedby` указывали бы на один и тот же текст, что даёт двойное объявление у части дикторов; `DESIGN.md` → Форма и `TextField` уже используют `aria-describedby` для ошибки. Ошибка остаётся доступной через `aria-describedby`, `aria-invalid` и `role="alert"`. Также `accessibilityHint` добавлен не только группе, но и каждому радио: контейнер `radiogroup` на iOS/Android не фокусируется.

## Review Triage Log

- Native-путь не читал причину: `radiogroup` на iOS/Android не фокусируется — **исправлено**: текст группы добавлен в `accessibilityHint` каждого радио через контекст.
- Ошибка дублировалась в `aria-errormessage` и `aria-describedby` — **исправлено**: оставлен один канал `aria-describedby` + `role="alert"`, как в `TextField` и `DESIGN.md`.
- Двойная точка при склейке hint — **исправлено**: `joinSentences` схлопывает повторные точки.
- Отступ блокировки изменился с 16 на 4 px — **исправлено**: `marginTop="$3"` возвращает прежний ритм.
- Live-region создаётся уже заполненным, `role="alert"` вместе с `aria-live="polite"` — **низкий, не менялось**: тот же принятый паттерн, что у `TextField`; переделка в постоянный регион шире F7.
- Ошибка остаётся после смены выбора — **вне F7**: поведение существовало до правки (текст ошибки тоже оставался); менять его значит менять запрошенное поведение.
- Копия блокировки не совпадает с `DESIGN.md` («над группой», разные фразы для `RESERVED`/`CLOSED`) — **вне F7**: существующий долг Story 2.3/Q-11, тексты не менялись.
- Заголовок и `aria-label` — два источника имени, клавиатурная модель радиогруппы неполная — **вне F7**: существующее поведение, в спеке отмечено как не входящее.
- Тест формы не различал ошибку и блокировку по тексту — **усилено**: проверяется `role="alert"` только у ошибки и отсутствие alert у описания; package-тесты используют разные строки.
- Не покрыты уникальность id, chip-вариант, композиция hint — **частично исправлено**: добавлены тесты уникальности id и chip; `accessibilityHint` в DOM не выводится, поэтому проверяется только косвенно.
- Нет отчёта, статуса в плане/очереди, финального статуса спеки — **исправлено** в этом заходе.
- Ручная проверка диктором без владельца — **отмечено** в отчёте и плане; новых задач очереди не заводилось по условию F7.
