---
title: 'R2/F10: строгая проверка origin в normalizeWebOrigin'
type: 'bugfix'
created: '2026-11-06'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `normalizeWebOrigin` в `apps/mobile/src/config/env.ts` объявлен как «схема, хост и необязательный порт», но регулярное выражение `^(https?:\/\/[^/?#\s]+)\/*$` пропускает userinfo и обратную косую черту. `wishlistShareLink` из явно заданного `EXPO_PUBLIC_WEB_ORIGIN` или `EXPO_PUBLIC_API_BASE_URL` тогда собирает `https://gift.example@evil.com/l/<token>`: браузер открывает `evil.com`, а пароль из `user:pass@` попадает в копируемую ссылку.

**Approach:** сузить проверку до `http(s)://` + хост (DNS-имя, IPv4, `localhost` или IPv6 в скобках) + необязательный числовой порт 1…65535; отклонять userinfo (`@`), обратную косую черту, путь, query, fragment и прочие схемы. Порядок источников «явный origin → API-base → origin страницы», правило «негодное явное значение не подменяется» и native-guard не меняются.

</frozen-after-approval>

## Implementation Notes

- `apps/mobile/src/config/env.ts`: `WEB_ORIGIN` заменён на `^(https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::([0-9]{1,5}))?)\/*$/i`; после совпадения порт проверяется на диапазон 1…65535. Возвращается прежняя группа scheme+host+port без хвостовых слэшей. Комментарий к константе объясняет, почему userinfo и обратная косая черта — не origin.
- `apps/mobile/src/config/env.test.ts`: добавлены отказы userinfo (`host@evil`, `user:pass@`, `user@`, `@host`), обратной косой черты, нечислового/пустого/внедиапазонного порта; принятие `localhost` и IPv6; проверки fail-closed для `resolvePublicWebOrigin` при userinfo/обратной косой в явном значении.
- `apps/mobile/src/wishlist/share-link.test.ts`: атакующие origin дают `null`.
- Границы: `wishlistShareLink` и формат `/l/<token>`, серверные ссылки по `BETTER_AUTH_URL`, порядок источников и native-ветка не менялись; production-хосты не хардкодятся. Задача без истории Linear — микрозадача устранения находки аудита F10.
