# CLE-48 — Story 3.2: VisibilityPolicy и wire DTO доступа — микрозадачи

Ветка: `evivanchikov/cle-48-story-32-visibilitypolicy-i-wire-dto-dostupa` (от main, независима от CLE-46). Код пишет opencode (`opencode-go/deepseek-v4.1-flash`). Промпты — `_bmad-output/CLE-48-prompts/NN.md`.

AC (epics.md:558-575): любой server read списка/желания вызывает `resolve`; ответ `{ access: gifts | not_found, gifts }` без гейтов; в `gifts` только разрешённые (SECRET — владелец; FRIENDS — владелец и друг; PUBLIC — + подписчик, ContactMatch, обладатель ссылки, включая анонима); число и названия отфильтрованных не отдаются; архив видит только владелец; второй `findMany` по listId без policy запрещён; поля брони — по роли зрителя (D-13), `reservedBy` может быть `null` при RESERVED; контракт карточки не меняется.

Решение по отсутствующим таблицам (Friendship/Subscription/Block/ContactMatch — Epic 4/8): domain получает готовые факты отношения `ViewerRelations` через порт `RelationshipReader`; текущий адаптер честно отвечает «отношений нет» (кроме владельца и ссылки), Epic 4/8 только подменяет адаптер.

- [ ] 01 domain: `ViewerRelations`, `VisibilityPolicy.canSee` + `resolve` (список) — чистые правила + матричные тесты на утечки
- [ ] 02 domain: `toViewerGiftCard` — карточка не-владельца и держателя по D-13 + тесты
- [ ] 03 порт `RelationshipReader` + адаптер «отношений ещё нет» (Epic 4/8) + тесты
- [ ] 04 application: единый `readWishlist` (единственный `gift.findMany`), перевод `getMyGifts` на него + тесты на утечку
- [ ] 05 application: `getGift` (загрузка формы) через `VisibilityPolicy.canSee` + тест
- [ ] 06 guard-тест: `gift.findMany` вне `readWishlist` запрещён
- [ ] 07 docs: sprint-status 3.2 → done, deferred-work
