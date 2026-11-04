# Микрозадача 15 — вся карточка желания открывает редактирование; чип видимости — соседняя кнопка поверх футера

Рабочая папка: `D:\Clever\Gift-list`, ветка `feat/cle-65-card-whole-pressable` от main 35406ad (уже создана и активна). Только локальные изменения, НЕ коммить, НЕ пушь, НЕ запускай `npm ci` / `npm install`. Не трогай `.env*`, Prisma, `apps/web`. Используй именованные функции, не анонимные (кроме однострочных style-колбэков, которые уже есть в файле).

## Контекст
Monorepo: `apps/mobile` — Expo Router (Android/iOS/web через react-native-web), тесты vitest + @testing-library/react-native. Тексты — только из i18n `packages/contracts/src/i18n/ru/*.json`. Перед UI-работой прочитай `.cursor/rules/ux-design.mdc` и `AGENTS.md`.

## Что сейчас (`apps/mobile/src/ui/gift-card.tsx`)
```
<View role="listitem">                                               // карточка
  <Pressable role=button aria-label="Изменить «…»"> {body} </Pressable>   // только верх
  <View style={styles.footer}> <VisibilityChip onPress=…/> </View>         // низ — вне кнопки
</View>
```
Репро (web, http://localhost:3000, «Мой вишлист»): клик по пустому месту низа карточки рядом с чипом «Всем» — ничего не происходит, курсор не pointer (клик попадает в div футера).

## Что нужно (решение пользователя — именно такая схема)
1. Общая обёртка: внешний `View role="listitem"` (`position: "relative"`), остаётся внешним элементом.
2. Внутри — кнопка редактирования карточки (`Pressable`, accessibilityRole="button", label `tGift("edit", {title})`), которая занимает ВСЮ площадь карточки, включая зону футера: body + зарезервированное место под футер (пустой спейсер той же высоты, что футер с чипом: `marginTop` футера + `chip-height` + `paddingBottom: card-padding`; используй токены `spacing`, без магических чисел). Клик в любом месте карточки, кроме самого чипа, открывает редактирование; курсор pointer по всей карточке.
3. Чип видимости — СОСЕДНИЙ элемент кнопки (не вложенный!), обёрнут в `View`, позиционированный абсолютно поверх зоны футера (`position: "absolute"`, `left: card-padding`, `bottom: card-padding`, `zIndex` выше кнопки), там же, где он сейчас визуально. Обёртка чипа не должна перехватывать клики вне чипа: `pointerEvents="box-none"` (через style `pointerEvents` для web), чтобы пустое место вокруг чипа уходило в кнопку карточки.
4. Никакой вложенности кнопок, stopPropagation не нужен (не добавляй).
5. Визуально карточка должна остаться идентичной (те же отступы, высота, позиция чипа). Чип некнопочный (RESERVED/CLOSED или без `onVisibilityPress`) — так же абсолютно в футере, не кнопка; клик по нему (pointerEvents none на нём допустим) открывает редактирование.
6. Без `onPress` (не-владелец) — тело простой `View`, футер можно оставить как сейчас (обычный поток) или той же схемой, но вид одинаковый.
7. Порядок Tab: сначала кнопка карточки, потом чип (DOM-порядок: кнопка, затем обёртка чипа).
8. Сохранить: тост `app.gift.toast.visibilityLocked` (логика экрана), возврат фокуса на чип после закрытия пикера (`visibilityChipRef`), pressed-опасити, mobile native поведение.
9. Обнови JSDoc в `gift-card.tsx` под новую схему.

## Тесты (обязательно), `apps/mobile/src/ui/gift-card.test.tsx`
- кнопка «Изменить «…»» содержит зарезервированный спейсер футера (или: её стиль покрывает футер) и press по ней вызывает `onPress`;
- press по чипу вызывает только `onVisibilityPress`, не `onPress`;
- чип НЕ внутри кнопки редактирования, оба — потомки listitem; кнопка идёт раньше чипа в порядке DOM (Tab-порядок);
- обёртка чипа имеет pointerEvents box-none, позиция absolute;
- клавиатура (если в файле есть web/DOM-тесты): Enter на кнопке → `onPress`, Enter на чипе → только `onVisibilityPress`;
- поправь существующие тесты (`gift-card.test.tsx` ~318, `my-wishlist-screen.test.tsx` ~616, `gift-flows.test.tsx` ~568), не удаляя проверки без замены.

## Проверки
`npm run typecheck`, `npm test`, `npm run lint`, `npm run check-boundaries` (имена скриптов — в корневом package.json). Отчитайся списком файлов и результатами.
