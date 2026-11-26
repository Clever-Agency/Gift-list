# Suite AD-7 — профильные поля

Проверки решения AD-7 (ред. 2026-11-26, D-58, FR-54, FR-55) и AD-29: кто видит ДР без года, пол, страну и «Обо мне» в ответе `GET /api/v1/u/:nick`. Канонические тесты остаются рядом с кодом, здесь — сценарная матрица и инвариант «поля не утекают».

## Как запускать

```bash
# только этот файл
npm run test -w @gift-list/web -- src/invariants/ad7

# весь набор веба (то же, что делает CI)
npm run test -w @gift-list/web
```

Файл попадает в обычный прогон через `apps/web/vitest.config.ts` (`include: ["src/**/*.test.{ts,tsx}"]`). Настоящей БД нет: `@/db/client` и `@/lib/auth` заменены детерминированным фейком, а `@/lib/relationships` работает настоящий — поэтому Block проверяется в обе стороны, как в SQL-запросе.

## Карта инварианта

| Инвариант | Канонический тест | Уровень / CI | Здесь |
|---|---|---|---|
| Профильные поля получает только сам владелец (всегда, вместе с `profileVisibleToFriends`) и принятый Друг при включённом переключателе | `domain/profile-details.test.ts` — матрица политики и маппера; `app/api/v1/u/[[...nick]]/route.test.ts` — блок `details` на проводе | домен + маршрут, мок, CI | `profile-fields.test.ts` — `getProfileByNick` |
| Подписчик, не-друг, аноним, Block в любую сторону не получают ни полей, ни ключа `details` (не `null`-заглушки) | `domain/profile-details.test.ts` — «остальным не отдаёт блок вообще»; `route.test.ts` — «hides the block from …» | домен + маршрут, мок, CI | `profile-fields.test.ts` — матрица и оба направления Block |
| `profileVisibleToFriends` не отдаётся никому, кроме владельца | `packages/contracts/src/profile.test.ts` — закрытые наборы `visibleProfileDetailsSchema` и `profileDetailsSchema` | контракт + маршрут, CI | `profile-fields.test.ts` — нет ключа в ответе другу |

## Отложено

| Что | Где появится |
|---|---|
| Показ полей на странице `/u/:nick` и в форме `/profile` | CLE-129 T8.3 (форма) и T8.4 (страница) |
| Профильные поля в поиске, `/l/:token` и уведомлениях | Не должны появляться никогда (AD-29); отдельных тестов не требуют, пока эти чтения их не собирают |
