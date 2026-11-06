---
title: 'Story 2.5.2: quantity в форме желания'
type: 'feature'
created: '2026-11-05'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** API и контракт уже принимают `quantity` (`SINGLE | UNLIMITED`, по умолчанию `SINGLE`), но форма создания и редактирования желания не даёт выбрать тип. Пользователь не может пометить желание безлимитным, а поле `quantity` не участвует в валидации, dirty-state и отправке. Дефолт `SINGLE` продублирован в payload создания.

**Approach:** Добавить в общую форму `GiftForm` выбор типа через `ChoiceList` из `@gift-list/ui`: «Один раз» / «Можно дарить снова», по умолчанию `SINGLE`; при редактировании показывать сохранённое значение; вне `OPEN` — заблокировать с пояснением. Включить `quantity` в dirty-state, маппинг серверных ошибок (`field: "quantity"`) и отправку. Дефолт брать из контракта, а create-действие клиента принимать input-тип схемы (`z.input`), чтобы не дублировать `SINGLE`.

</frozen-after-approval>

## Implementation Notes

- Контракт: `DEFAULT_QUANTITY` — единственный источник дефолта; `quantityFieldSchema.default(DEFAULT_QUANTITY)`. Добавлен `GiftInputDraft = z.input<typeof giftInputSchema>`, `createGift` клиента принимает его. `new.tsx` больше не хардкодит `SINGLE`.
- Форма: выбор `ChoiceList`/`Choice` (`rows`) после видимости; подпись группы «Сколько раз можно дарить», варианты «Один раз» / «Можно дарить снова» с подсказками; `quantity` входит в `GiftFormValues`, dirty-state и `firstErrorField` (после `visibility`).
- Подписи вариантов лежат в общем каталоге `app.gift.quantity` (как `app.gift.visibility`), подсказки и подпись блокировки — в `app.giftForm.field`.
- Блокировка: проп `quantityLocked` повторяет паттерн `visibilityLocked` (строки `disabled`, подпись «Сколько раз можно дарить — меняется только у открытого желания.»). Экран правит оба пропа при `status !== "OPEN"`.
- Отправка: `toGiftUpdate` добавляет `quantity` только у `OPEN`; вне `OPEN` поле (как и `visibility`) не отправляется, поэтому неизменённая правка не сбрасывает сохранённое значение.
- Серверная ошибка `field: "quantity"` маппится на группу типа и показывает `error.quantityLocked` (реалистичная причина — желание стало не-`OPEN` во время правки), а не общий «Проверьте введённые данные.». У `ChoiceList` нет `role="alert"`, поэтому тест проверяет текст внутри группы.
- Тесты: форма (дефолт, выбор, блокировка, dirty, маппинг ошибки), экраны создания и правки (payload, сохранение `UNLIMITED`, отсутствие `quantity` вне `OPEN`), контрактные/сквозные ожидания обновлены.
- Проверки: `npm run typecheck`, `npm run lint`, `npm test` (mobile 467, web 398, contracts 140, ui 55, boundaries 5/5), `npm run build` — успешно. Нативная и браузерная визуальная проверка не выполнялась.

## Review Triage Log

- Подсказка `UNLIMITED` ссылалась на ещё не существующую кнопку «Куплю сам» — `low`, patch: текст заменён на описание правила («нельзя забронировать — дарить можно сколько угодно раз»).
- Подпись блокировки вводила термин «Тип желания», отличный от подписи поля — `low`, patch: формулировка приведена к «Сколько раз можно дарить…». Общая подпись над обоими замороженными блоками по `DESIGN.md` — `low`, defer: это меняет и поведение Story 2.3.
- Подписи вариантов должны жить в общем каталоге, как у видимости — `low`, patch: перенесены в `app.gift.quantity`.
- Серверная ошибка `quantity` показывала общий текст валидации — `medium`, patch: добавлен `error.quantityLocked`.
- Перечитывание желания при серверной ошибке `quantity` (как в `CONFLICT`) — `low`, defer: новое поведение экрана за пределами среза.
- `ChoiceList` не даёт `role="alert"`, `aria-invalid` и связи ошибки/подписи с `radiogroup` — `low`, defer: существующий компонент `packages/ui`, затрагивает и видимость.
- Подпись блокировки — muted и не связана с группой через `aria-describedby` — `low`, defer: тот же существующий паттерн `visibilityLocked`.
- `DEFAULT_VISIBILITY = "PUBLIC"` остаётся вторым источником дефолта — `low`, defer: не относится к `quantity`, отдельный фикс.
- `DEFAULT_QUANTITY` типизирован как объединение, а не литерал — `low`, patch: `"SINGLE" satisfies (typeof QUANTITIES)[number]`.
- Комментарии утверждали, что клиент «не повторяет» дефолты, хотя он отправляет выбранное значение — `low`, patch: формулировки исправлены на «нет литералов, значения из контракта/формы».
- Тест `UNLIMITED` не менял другое поле — `medium`, patch: тест правит название и проверяет, что `quantity` остаётся `UNLIMITED`.
- Не-`OPEN` тест использовал `SINGLE` — `medium`, patch: `RESERVED` с `UNLIMITED` проверяет показ сохранённого значения и отсутствие `quantity` в теле.
- Подсказка «бронировавший получит уведомление» при правке `RESERVED` отсутствует — `low`, defer: пробел Story 2.3, не этой микротаски.
- Docstring формы, `ChoiceGroup`, `fieldErrorCopy` и экрана правки не упоминали `quantity` — `low`, patch: обновлены.
