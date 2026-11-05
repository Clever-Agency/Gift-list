# Поисковые паттерны подарков и вишлистов — рынок de

## 1. Шапка

| Параметр | Значение |
|---|---|
| Рынок | Германия (DE); дополнительно Австрия (AT) и Швейцария (CH) |
| Язык запросов | `hl=de`; гео в Suggest — `gl=DE`, отдельные прогоны `gl=AT` и `gl=CH`; в сторах — `gl=DE` / `country=de,at,ch` |
| Дата прогона | 2026-11-05 |
| Модель | DeepSeek V4.1 Flash Free (OpenCode) |
| Задание | `2-de.md` (одно из шести рыночных заданий, сводка — `7-summary.md`) |
| Что сделано | 28 немецких seed-запросов в Google Suggest (DE) + 2 английских + 4 запроса для AT/CH + 5 проверок имён финалистов; 6 поисковых выдач Google Play; iTunes Search API по 5 терминам в DE и по «wunschliste» в AT/CH; 2 попытки Google Trends; 28 карточек приложений в Play для числа установок |
| Что не сделано | Google Trends недоступен (HTTP 429, две попытки) — точных индексов и сезонности из Trends нет, см. раздел 3 и 8 |
| Изменения в репозитории | Только этот файл. Ничего не покупалось, не регистрировалось, не коммитилось |

Все цифры ниже — либо снятые с сервиса значения, либо подсчёт по снятым данным с указанием, как считалось. Относительные величины Google Trends (индекс 0–100) в отчёте отсутствуют, потому что сервис не ответил.

---

## 2. Seed-запросы

Составлены от ядра (Geschenk, Geschenkideen, Wunschliste, Wunschzettel, Wunsch, wishlist) с модификаторами «приложение», «список», «идеи», «для него/неё», «день рождения», «Рождество».

**Ядро:** `geschenk`, `geschenkideen`, `wunschliste`, `wunschzettel`, `wunsch`, `wishlist`.

**Модификаторы и поводы:** `geschenk app`, `geschenke app`, `wunschliste app`, `wunschzettel app`, `geschenk liste`, `geschenkeliste`, `wunschliste online erstellen`, `wunschliste kostenlos`, `wunschliste teilen`, `wunschliste kinder`, `geschenk geburtstag`, `geschenk hochzeit`, `weihnachtsgeschenke`, `wunschliste weihnachten`, `geschenk für ihn`, `geschenk für sie`, `geschenk für männer`, `geschenkideen männer`, `geschenkideen freundin`, `wunscherfüllung`, `wunschzettel vorlage`, `geschenk app kostenlos`.

**Английские:** `wishlist app`.

**AT/CH:** `wunschliste` (AT), `wunschliste` (CH), `geschenk` (AT), `geschenk` (CH).

Итого 36 запросов к Suggest: 31 по ядру, модификаторам и гео AT/CH (один дубль — `wunscherfüllung` отправлялся дважды для проверки умляутов) и 5 по именам финалистов. Один запрос (`geschenk app kostenlos`) вернул пустой список подсказок.

---

## 3. Google Trends

### 3.1 Что пробовали и что получили

| # | Запрос | Результат |
|---|---|---|
| 1 | `https://trends.google.com/trends/explore?geo=DE&q=geschenk,geschenkideen,wunschliste,wunschzettel,wishlist` (через API-эндпоинт `api/explore`, `hl=de`, 12 месяцев, geo=DE) | **HTTP 429** «Too Many Requests» — капча/антибот-страница Google |
| 2 | Тот же запрос повторно через ~15 минут (правило «попробовать один раз позже») | **HTTP 429** снова |
| 3 | Trends для AT/CH | Не пробовали: тот же хост и тот же лимит по IP, обход защиты запрещён правилами задания |

Попытки не обходились (без смены IP, без прокси, без сторонних зеркал). Индексов 0–100 нет ни по одному термину, поэтому таблица 3.2 заполнена как «н/д (429)».

### 3.2 Таблица (как просили в задании)

| Термин | Индекс Trends, DE, 12 мес | Индекс Trends, DE, 5 лет | Похожие запросы | Сезонность |
|---|---|---|---|---|
| Geschenk | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — см. 3.3 |
| Geschenkideen | н/д (429) | н/д (429) | н/д | н/д из Trends |
| Wunschliste | н/д (429) | н/д (429) | н/д | н/д из Trends |
| Wunschzettel | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — см. 3.3 |
| wishlist | н/д (429) | н/д (429) | н/д | н/д из Trends |

### 3.3 Косвенная замена Trends (помечено как прокси, не как объём поиска)

**(а) Сезонность по просмотрам статьи «Geschenk» в немецкой Википедии** (Wikimedia Pageviews API, monthly, `de.wikipedia`, 2024-11 — 2026-10): ноябрь 2024 — 1 149, **декабрь 2024 — 1 933**, январь 2025 — 936; ноябрь 2025 — 748, **декабрь 2025 — 1 012**, январь 2026 — 646; остальные месяцы 2025–2026 — 465…1 176. Источник: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Geschenk/monthly/20241101/20261031` — 2026-11-05.

Это прокси с большими оговорками: просмотры энциклопедической статьи, а не поисковый спрос; декабрьский пик +68 % (2024) и +35 % (2025) к ноябрю, база — 500–700 просмотров в месяц. Показывает только направление: подарки сезонны и пик — декабрь.

**(б) Статьи «Wunschzettel» и «Wunschliste» для этой проверки непригодны:** 1–27 просмотров в месяц (там нет статьи-понятия, люди идут в магазины и на сайты), поэтому по ним сезонность не построить. Тот же API, те же даты.

**(в) Структурный признак сезонности из сторов:** самое оценённое приложение подарков в немецком App Store — рождественское «drawnames | Online Wichteln» (Meetrix Online, 11 609 оценок), в Google Play «Wichteln 22: Geschenkaustausch» — 1 Mio.+ установок. То есть крупнейший подарковый сегмент рынка привязан к Рождеству, а не к дню рождения. Источники — таблицы раздела 5.

---

## 4. Автодополнение Google (Suggest API)

Метод: `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=<seed>`, ответ — UTF-8 JSON. 30 запросов по ядру и модификаторам (28 немецких и 2 английских; один немецкий seed отправлялся дважды) дали **293 подсказки**; пять отдельных запросов по именам финалистов — в разделе 4.8.

### 4.1 Ядро: `wunschliste`

| # | Подсказка |
|---|---|
| 1 | wunschliste |
| 2 | wunschliste erstellen |
| 3 | wunschliste online |
| 4 | wunschliste bei amazon erstellen |
| 5 | wunschliste tv |
| 6 | wunschliste geburtstag |
| 7 | wunschliste kindergeburtstag |
| 8 | wunschliste online erstellen |
| 9 | wunschliste amazon |
| 10 | wunschliste erstellen und teilen |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste` — 2026-11-05.

Отдельно, из запросов-модификаторов: `wunschliste app`, `wunschliste app zum teilen`, `wunschliste app kostenlos`, `wunschliste app familie`, `wunschliste teilen app`, `wunschliste kostenlos erstellen`, `wunschliste erstellen kostenlos ohne anmeldung`, `wunschliste online erstellen schweiz`, `kostenlose wunschliste app`, `beste wunschzettel app`, `app wunschliste erstellen`.

### 4.2 Ядро: `wunschzettel`

| # | Подсказка |
|---|---|
| 1 | wunschzettel |
| 2 | wunschzettel vorlage |
| 3 | wunschzettel weihnachtsmann |
| 4 | wunschzettel online |
| 5 | wunschzettel erstellen |
| 6 | wunschzettel weihnachten |
| 7 | wunschzettel zum ausdrucken |
| 8 | wunschzettel weihnachten zum ausdrucken |
| 9 | wunschzettel zum ausdrucken pdf |
| 10 | wunschzettel amazon |

Источник: `...&q=wunschzettel` — 2026-11-05.

### 4.3 Ядро: `geschenk`, `geschenkideen`, `geschenkeliste`

`geschenk`: geschenke für männer, geschenke zur einschulung, geschenk, geschenke für frauen, geschenke zur geburt, geschenk für freundin, geschenke, geschenke zur hochzeit, geschenkideen, geschenkideen frauen.

`geschenkideen`: geschenkideen frauen, geschenkideen männer, geschenkideen weihnachten, geschenkideen freundin, geschenkideen hochzeit, geschenkideen einschulung, geschenkideen 1. geburtstag, geschenkideen zum 30 geburtstag frau, geschenkideen mädchen 12 jahre.

`geschenkeliste`: geschenkeliste erstellen, geschenkeliste, geschenkeliste online, geschenkeliste bei amazon erstellen, geschenkeliste hochzeit, geschenkeliste amazon, geschenkeliste baby, geschenkeliste einschulung, geschenkeliste weihnachten vorlage.

Источники: `...&q=geschenk`, `...&q=geschenkideen`, `...&q=geschenkeliste` — 2026-11-05.

### 4.4 Ядро: `wunsch` — занято чужими товарами

`wunsch`: **wunschgutschein**, wunschgutschein einlösen, **wunschkennzeichen**, wunschgutschein partner, wunschgutschein einlösen amazon, wunschgutschein shops, wunschkennzeichen reservieren, wunschgutschein amazon, wunscherfüller gutschein, wunschgutschein.de einlösen.

Все 10 подсказок — про подарочные карты (Wunschgutschein, Wunscherfüller Gutschein) и номерные знаки (Wunschkennzeichen), ни одной про вишлист. `wunscherfüllung`: wunscherfüllung meditation, wunscherfüllung für kranke kinder, wunscherfüller gutschein, wunscherfüllung universum, wunscherfüllung theorie — эзотерика, благотворительность и подарочные карты.

Источники: `...&q=wunsch`, `...&q=wunscherf%C3%BCllung` — 2026-11-05.

### 4.5 Английское `wishlist`

| # | Подсказка |
|---|---|
| 1 | wishlist |
| 2 | wishlist erstellen |
| 3 | wishlist ideas |
| 4 | wishlist amazon |
| 5 | wishlist serie |
| 6 | wishliste |
| 7 | wishlist app |
| 8 | wishlist fernsehsendung |
| 9 | wishlist inspo |
| 10 | wishlist amazon erstellen |

`wishlist app`: wishlist app store, wishlist app ios, wishlist app android, wishlist apparel, wishlist app free, wishlist app shopify, wishlist app for family, wishlist app to share with friends.

Источники: `...&q=wishlist`, `...&q=wishlist%20app` — 2026-11-05.

Два наблюдения здесь важнее самих строк:

- **Немецкие seed-запросы не дают подсказок с корнем wish.** Проверено по всем 28 немецким запросам (27 уникальных seed): подсказки с `wish` появились только у двух английских seed (`wishlist`, `wishlist app`). Обратное неверно: английский seed выдал немецкие формы «wishlist **erstellen**», «**wishliste**» — то есть заимствование живёт, но только когда пользователь сам начал вводить английское слово.
- **«wishlist serie» и «wishlist fernsehsendung»** — в немецком поиске слово приросло к сериалу, а не к списку желаний. Подтверждение: «Wishlist» — немецкий мистический веб-сериал Funk (2016), показ на Das Erste, YouTube-канал 150 000+ подписчиков. Источник: `https://de.wikipedia.org/wiki/Wishlist` — 2026-11-05.

### 4.6 Модификаторы: частоты по всем 293 подсказкам

Считалось как число подсказок, содержащих слово/основу (подстрока; для `app` — по границе слова, чтобы не ловить apple/appenzell/approbation).

| Модификатор | Подсказок | Что значит |
|---|---|---|
| `geschenk*` | 146 | самая частая основа, но это запросы дарителя «что подарить» |
| `wunsch*` | 128 | основа вишлиста по-немецки |
| `wishlist`/`wishliste` | 20 | только из английских seed-запросов |
| `wunschliste` | 66 | главный «списочный» термин |
| `geschenkidee*` | 37 | идеи подарков |
| `wunschzettel` | 32 | рождественский/детский список |
| `geburtstag` | 35 | день рождения — главный повод после Рождества |
| `weihnacht*` | 33 | Рождество |
| `app` (по границе слова) | 35 | модификатор «приложение» |
| `erstellen` | 26 | «создать» — самый частый глагол |
| `online` | 17 | |
| `kostenlos` | 17 | |
| `vorlage` | 17 | «шаблон» — печатный бланк, а не приложение |
| `hochzeit` | 16 | свадьба |
| `amazon` | 15 | чужая экосистема вишлистов |
| `teilen` | 14 | «поделиться» |
| `geschenkeliste` | 19 | своя форма «списка подарков» |
| `ausdrucken` | 7 | «распечатать» |
| `für männer` | 12 | адресат-мужчина |
| `baby` | 5 | |

Источник: агрегат по 31 запросу к `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE` — 2026-11-05.

**Куда крепится «app»:** из 35 подсказок с `app` — 20 к `wunschliste`/`wunschzettel` (wunschliste app, wunschzettel app familie, beste wunschzettel app, wunschliste teilen app…) и 8 к `wishlist`; к `geschenk` — 5 (`geschenk app`, `geschenke app`, `geschenke app kostenlos` и др.), к `geschenkideen` — 1. Причём подсказки на `geschenk app` уходят в мусор: approbation, appenzell, apple. **Запроса «geschenk app» как категории в Германии практически нет** — категория называется «Wunschliste».

### 4.7 AT и CH

| Seed / гео | Подсказки (первые 5) | Отличие от DE |
|---|---|---|
| `wunschliste`, `gl=AT` | wunschliste erstellen, wunschliste tv, wunschliste amazon, wunschliste geburtstag, wunschliste online | добавлено `wunschliste rote rosen` (цветочный магазин) |
| `wunschliste`, `gl=CH` | wunschliste online erstellen, wunschliste erstellen, wunschliste geburtstag, wunschliste hochzeit, wunschliste tv | добавлено `wunschliste hochzeit`, `wunschliste baby`, `wunschliste app` |
| `geschenk`, `gl=AT` | geschenke für männer, geschenke für frauen, geschenk, geschenkideen, geschenke | добавлено `geschenke zur taufe`, `geschenkkorb` |
| `geschenk`, `gl=CH` | geschenkidee, **geschenkparadies**, geschenke für männer, geschenke, geschenkideen für männer | локальная сеть магазинов «Geschenkparadies» |

Источники: те же URL с `gl=AT` / `gl=CH` — 2026-11-05. Вывод: ядро совпадает, отдельной австрийской или швейцарской лексики нет.

### 4.8 Подсказки по именам финалистов (проверка спроса на сами имена)

| Seed | Что подсказывает Google DE | Чтение |
|---|---|---|
| `wishparty` | пусто — ни одной подсказки | поискового спроса на имя в DE нет |
| `wishmoon` | пусто | поискового спроса нет |
| `wishie` | wishes, wishes auf deutsch, wishes could kill, wisher, wished deutsch, wish… | автокоррекция уводит к слову «wishes»; самого имени в подсказках нет |
| `wishlane` | wishlane, **wishlane artist**, wishlane sunday, wishlane cheap talk, wishlane music, wishlane medispa, wishlane appleton | в DE это имя музыкального исполнителя, а не продукта |
| `wishday` | wishday, **wishday font**, **wishday app**, wishday ai, yogurt wishday, winter wishday, shampo wishday | имя разобрано шрифтом, приложением, «yogurt wishday» и шампунем |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=<имя>` — 2026-11-05.

Практический смысл: у «Wishparty» и «Wishmoon» в Германии нет ни брендового шума, ни поискового спроса — имя придётся создавать с нуля, зато оно ни на что не наталкивается. У «Wishlane» и «Wishday» шум есть, но чужой (музыкант; шрифт/приложение/продукты). У «Wishie» подсказки сразу исправляют на «wishes» — то есть на слух имя не опознаётся как отдельное слово.

---

## 5. Сторы

### 5.1 Google Play, DE (`hl=de&gl=DE`)

Установки сняты с карточек приложений (`Downloads`), это округлённые диапазоны Google, а не точные числа.

**Запрос `wunschliste`** — `https://play.google.com/store/search?q=wunschliste&c=apps&hl=de&gl=DE` (2026-11-05)

| # | Название | Разработчик | Установок | Ключевое слово в названии |
|---|---|---|---|---|
| 1 | Wunschzettel Wunschlisten App | Simon Reger | 50.000+ | Wunschzettel / Wunschlisten |
| 2 | Wishlists - dein Wunschzettel | Christian Konnerth | 100.000+ | Wishlists (en) + Wunschzettel |
| 3 | Wishbob – Online-Wunschliste | Wishbob | 100.000+ | Wish (en) + Wunschliste |
| 4 | Wunschliste & Geschenkideen | Kenji Sakai | 1.000+ | Wunschliste + Geschenkideen |
| 5 | Wishes – Wunschliste erstellen | Wiheads ApS | 10.000+ | Wishes (en) + Wunschliste |
| 6 | Giftful – Wunschliste | Giftful | 100.000+ | Gift (en) + Wunschliste |
| 7 | GoWish | Ønskeskyen ApS | 1 Mio.+ | Wish (en), немецкого слова нет |
| 8 | wantic: Deine Wunschliste | Günther / Günther GbR | 5.000+ | Wunschliste |
| 9 | Wishlist Maker - Listful | Listful | 100.000+ | Wishlist (en), немецкого слова нет |
| 10 | Wishdo: Wunschliste Geschenke | Andrei Romaha | 100+ | Wish (en) + Wunschliste |

**Запрос `wunschzettel`** — `...?q=wunschzettel...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | Wunschzettel Wunschlisten App | Simon Reger | 50.000+ | Wunschzettel |
| 2 | Wishlists - dein Wunschzettel | Christian Konnerth | 100.000+ | Wishlists + Wunschzettel |
| 3 | Wishbob – Online-Wunschliste | Wishbob | 100.000+ | Wish + Wunschliste |
| 4 | GoWish | Ønskeskyen ApS | 1 Mio.+ | Wish |
| 5 | Giftful – Wunschliste | Giftful | 100.000+ | Gift + Wunschliste |
| 6 | bitte.kaufen Wunschlisten-App | Sascha Depold | 5.000+ | Wunschlisten |
| 7 | Wishlist Maker - Listful | Listful | 100.000+ | Wishlist |
| 8 | Wunschzettel.io - Wunschlisten | FS Develop | 10+ | Wunschzettel (домен) |
| 9 | wantic: Deine Wunschliste | Günther / Günther GbR | 5.000+ | Wunschliste |
| 10 | Wunschliste & Geschenkideen | Kenji Sakai | 1.000+ | Wunschliste |

**Запрос `wishlist`** — `...?q=wishlist...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | Wishlists - dein Wunschzettel | Christian Konnerth | 100.000+ | Wishlists + Wunschzettel |
| 2 | GoWish | Ønskeskyen ApS | 1 Mio.+ | Wish |
| 3 | Wishlist Maker - Listful | Listful | 100.000+ | Wishlist |
| 4 | Giftful – Wunschliste | Giftful | 100.000+ | Gift + Wunschliste |
| 5 | Wishlist Maker - Moonsift | MOONSIFT | 100.000+ | Wishlist |
| 6 | GiftList - Wishlist & Registry | GiftList | 10.000+ | Gift + List + Wishlist |
| 7 | Wunschzettel Wunschlisten App | Simon Reger | 50.000+ | Wunschzettel |
| 8 | Share a Wish: Wunschliste | Northern Development | 10.000+ | Wish + Wunschliste |
| 9 | Wishes – Wunschliste erstellen | Wiheads ApS | 10.000+ | Wishes + Wunschliste |
| 10 | wantic: Deine Wunschliste | Günther / Günther GbR | 5.000+ | Wunschliste |

**Запрос `geschenk`** — `...?q=geschenk...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | Schenkbar: Geschenke & Ideen | SEEL Digital | 10+ | Geschenke (Schenken) |
| 2 | Giftful – Wunschliste | Giftful | 100.000+ | Gift + Wunschliste |
| 3 | Geschenkideen mit Geschenkbob | Wishbob | 1.000+ | Geschenkideen |
| 4 | Geschenk Lotse | Steffen Edinger | 10+ | Geschenk |
| 5 | Wishlist Maker - Listful | Listful | 100.000+ | Wishlist |
| 6 | Wichteln 22: Geschenkaustausch | Bocadil Infinite | 1 Mio.+ | Wichteln (нем.) + Geschenk |
| 7 | Secret Santa: Wichteln online | Flying Unicorn | 5.000+ | Wichteln |
| 8 | ASMR Presents | A. S. Ivchuk | 50.000+ | Presents (en) |
| 9 | Wishlists - dein Wunschzettel | Christian Konnerth | 100.000+ | Wishlists + Wunschzettel |
| 10 | Wunschzettel Wunschlisten App | Simon Reger | 50.000+ | Wunschzettel |

**Запрос `geschenkideen`** — `...?q=geschenkideen...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | Geschenkideen mit Geschenkbob | Wishbob | 1.000+ | Geschenkideen |
| 2 | Schenkki – Geschenkideen | RPK Labs UG | 10+ | Geschenkideen |
| 3 | Present Planner: Geschenkideen | Ulrich & Hellenbrand GbR | 100+ | Present + Geschenkideen |
| 4 | Christmas Gift List | engApps | 1 Mio.+ | Gift + List (en), Рождество |
| 5 | Jinnie: Wunschlisten | Melted Butter | 1.000+ | Wunschlisten |
| 6 | Wishr: Geschenkideen & Liste | SteinFluss | 10.000+ | Wish (en) + Geschenkideen |
| 7 | Schenkbar: Geschenke & Ideen | SEEL Digital | 10+ | Geschenke |
| 8 | Wishlist Maker - Listful | Listful | 100.000+ | Wishlist |
| 9 | Wunschliste & Geschenkideen | Kenji Sakai | 1.000+ | Wunschliste + Geschenkideen |
| 10 | Change Sorted: Zen Coin Stack | FourM Inc. | не снято | нерелевантно — выдача размыта игрой |

**Запрос `geschenke app`** (проверка гипотезы «приложение + подарки») — `...?q=geschenke%20app...`: выдача почти совпадает с `wunschliste` (Wunschzettel Wunschlisten App, Listful, Giftful, Wishlists, Wunschliste & Geschenkideen, GoWish, Wishbob, Wishdo, wantic, Moonsift). То есть даже по запросу «geschenke app» Play показывает вишлисты — категория понимается как «список желаний», а не «идеи подарков».

### 5.2 App Store, DE (iTunes Search API)

`https://itunes.apple.com/search?term=<term>&country=de&entity=software&limit=25&lang=de_de` — 2026-11-05. iTunes не отдаёт число установок; в колонке — `userRatingCount`, то есть **количество оценок**, не загрузок.

**`term=wunschliste`** (24 результата)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Wishlists - dein Wunschzettel | Wishlists GmbH | 1 516 |
| 2 | GoWish | Onskeskyen ApS | 2 949 |
| 3 | Mein Online Wunschzettel | Simon Reger | 435 |
| 4 | Wishbob – Online-Wunschliste | Caner Tankir | 1 376 |
| 5 | Giftful – Wunschliste & Tisch | Giftful LLC | 130 |
| 6 | Familien Wunschliste | Samuel Schmidt | 6 |
| 7 | Listful - Wishlist Maker | Listful LLC | 327 |
| 8 | StarSnoopy | x-root Software GmbH | 687 |
| 9 | WishlistX: Wunschlisten | SaveStrike | 255 |
| 10 | bitte.kaufen Wunschlisten-App | Sascha Depold | 61 |

**`term=wunschzettel`** (23): Mein Online Wunschzettel (435), Wishlists (1 516), GoWish (2 949), Wunschzettel.io - Wunschliste (0), Wishbob (1 376), drawnames | Online Wichteln (11 609), Wantd - Wunschliste (11), Secret Santa Online Wichteln (749), StarSnoopy (687), okurimono. Wunschlisten (25).

**`term=wishlist`** (24): Wishlists (1 516), GoWish (2 949), Listful (327), Giftful (130), Sortd | Shopping Wishlist App (10), Ohmywishes: Wunschlisten (116), WishlistX (255), Wishlist Maker - Moonsift (40), Mein Online Wunschzettel (435), SpoilMe – Wunschliste machen (41).

**`term=geschenk`** (21): Giving Gifts: Geschenke planen (28), Geschenke (Christoph Emrich, 2), AR Wrap (16), Wisher: Geschenkideen (1), Die passende Geschenkidee (Simon Reger, 1), Wishr: Geschenkideen & Liste (65), Media Rewards: Geschenkkarten (580), **drawnames | Online Wichteln (11 609)**, Cameo (209), Wichteln 22 (306).

**`term=geschenkideen`** (22): GiftFinderAI - Geschenkideen (0), Geschenkideen mit Geschenkbob (0), Geschenkideen – Geschenkliste (0), Geschenke (2), Wisher (1), Wishr (65), Die passende Geschenkidee (1), Schenkki (12), mydealz (36 786), Wunschliste & Geschenkideen (0). Выдача по «идеям» слабая: половина приложений с нулём оценок, сверху влезает купонный mydealz.

**`term=wish` (DE)** — отдельная проверка, чем занято английское слово: 1) **Wish: Shoppen und Sparen, ContextLogic Inc. — 241 345 оценок**; 2) GoWish — 2 949; далее AliExpress, Temu, SHEIN, Joom. То есть в немецком App Store «Wish» в первую очередь = дисконтный маркетплейс wish.com.

### 5.3 AT и CH (`term=wunschliste`)

| # | AT (`country=at`) | Оценок | CH (`country=ch`) | Оценок |
|---|---|---|---|---|
| 1 | Wishlists - dein Wunschzettel | 92 | Wishlists - dein Wunschzettel | 101 |
| 2 | GoWish | 57 | Wishbob – Online-Wunschliste | 104 |
| 3 | Mein Online Wunschzettel | 4 | GoWish | 81 |
| 4 | Giftful – Wunschliste & Tisch | 19 | Wantd - Wunschliste | 4 |
| 5 | Wunschlist - die Wunschliste | 5 | Mein Online Wunschzettel | 9 |

Лидеры те же, что в DE; в CH Wishbob обгоняет GoWish. Отдельной австрийской или швейцарской лексики нет — рынок читается как один немецкоязычный.

### 5.4 Какие корни доминируют в названиях

Подсчёт по **69 уникальным названиям** из шести выдач Play (топ-12) и пяти выдач App Store DE (топ-12), дубликаты схлопнуты:

| Корень в названии | Названий | Примеры |
|---|---|---|
| `wish` (англ.) | 30 | GoWish, Wishbob, Wishdo, Wishes, Wishlist Maker |
| `wunsch` (нем.) | 30 | Wunschzettel Wunschlisten App, wantic: Deine Wunschliste, Wunschhelden |
| оба корня в одном названии | 14 | Wishbob – Online-Wunschliste, Wishdo: Wunschliste Geschenke, Wishy: Wunschliste & Wichteln, Rewish: Wunschliste erstellen |
| `wishlist` (подстрока) | 15 | Wishlists, WishlistX, GiftList - Wishlist & Registry |
| `wunschliste` (подстрока, включает «Wunschlisten») | 27 | Wunschliste & Geschenkideen, bitte.kaufen Wunschlisten-App |
| `wunschzettel` (подстрока) | 3 | Wishlists - dein Wunschzettel, Wunschzettel.io |
| `geschenk` | 14 | Geschenk Lotse, Schenkki – Geschenkideen |
| `gift` (англ.) | 17 | Giftful, GiftList, Christmas Gift List |
| `wichtel` (нем., Secret Santa) | 5 | drawnames \| Online Wichteln, Wichteln 22 |
| `idee` | 7 | Geschenkideen mit Geschenkbob, Schenkbar: Geschenke & Ideen |
| ни wish, ни wunsch | 23 | drawnames, Schenkki, Geschenk Lotse, Secret Santa |

Главный вывод по неймингу конкурентов: **27 из 69 названий содержат «Wunschliste» и только 3 — «Wunschzettel»**; «Wunschzettel» живёт в подсказках, но в сторах почти не используется как ключ. И 14 названий склеивают английский бренд с немецким ключом — это состоявшаяся конвенция рынка.

---

## 6. Паттерны и выводы

### 6.1 Сводная таблица (задание 4.1)

| Термин | Индекс Trends (DE) | Подсказки Google DE (из 293) | В названиях приложений (из 69) |
|---|---|---|---|
| Geschenk / Geschenke | н/д (429) | 146 | 14 |
| Geschenkideen | н/д (429) | 37 | 7 (`idee`, из них 5 — `geschenkidee`) |
| Geschenkeliste | н/д (429) | 19 | 0 |
| Wunschliste | н/д (429) | 66 | 27 |
| Wunschzettel | н/д (429) | 32 | 3 |
| Wunsch (отдельно) | н/д (429) | 128 (корень) | — (занято Wunschgutschein / Wunschkennzeichen) |
| wishlist (en) | н/д (429) | 20 (только из английских seed) | 15 |
| wish (en, корень) | н/д (429) | 0 из немецких seed | 30 |
| app | — | 35 | — |

### 6.2 Выводы

**1. Немец ищет по-немецки, и это не «wish», а «Wunschliste».** Ни один из 28 немецких запросов (27 уникальных seed) не дал подсказки с корнем `wish`; все 20 подсказок с `wishlist`/`wishliste` пришли из двух английских seed. Обратный ход работает: на `wishlist` Google подсказывает немецкое «wishlist **erstellen**» — заимствование понимают, но сами к нему не идут. Для DE ключевое слово — `Wunschliste` (66 подсказок, 27 названий в сторах), затем `Geschenkideen` (37) и `Wunschzettel` (32).

**2. «Geschenk» — это запрос дарителя, а не владельца списка.** Он самый частый по основе (146 подсказок), но почти всегда с адресатом: «geschenke für männer/frauen», «geschenk geburtstag», «weihnachtsgeschenke». Это подбор идей, не список желаний. Наш продукт по немецкой лексике — «Wunschliste», а не «Geschenk».

**3. Глаголы и модификаторы списочного намерения — «erstellen», «teilen», «online», «kostenlos», «ohne Anmeldung», «Familie».** `erstellen` — 26 подсказок (самый частый глагол), `teilen` — 14, `online` и `kostenlos` — по 17. Пользователь ищет «создать список и поделиться», причём бесплатно и без регистрации (`wunschliste erstellen kostenlos ohne anmeldung`). Это прямое описание нашего сценария.

**4. «Wunschzettel» — бумажный рождественский бланк, «Wunschliste» — цифровой список.** У `wunschzettel` подсказки: `vorlage`, `weihnachtsmann`, `zum ausdrucken`, `pdf` (17 подсказок со словом «vorlage», 7 — «ausdrucken»). У `wunschliste` — `online`, `erstellen`, `teilen`, `amazon`, `app`. В сторах это подтверждается: «Wunschliste» в 27 названиях, «Wunschzettel» — в 3. Если выбирать немецкий ключ для подзаголовка — это **Wunschliste**, а «Wunschzettel» уместен только в рождественском сезонном тексте.

**5. Английское «wishlist» в DE существует, но с двумя чужими значениями.** Первое — сериал: «wishlist serie», «wishlist fernsehsendung», сериал Funk «Wishlist» (2016). Второе — магазин: в App Store DE по запросу `wish` первым стоит «Wish: Shoppen und Sparen» (241 345 оценок), вокруг Temu, SHEIN, AliExpress. Плюс сам ключ занят: точный домен `wunschliste.de` — это **«TV Wunschliste»**, телегид (`https://www.wunschliste.de/`, title: «TV Wunschliste – Serien, TV-News, Streaming…»), а в Play лидер по запросу — приложение с названием «Wishlists».

**6. Сезонность — Рождество, второй повод — день рождения.** Из подсказок: `geburtstag` — 35 упоминаний, `weihnacht*` — 33, `hochzeit` — 16. Из сторов: крупнейшие подарковые приложения — рождественские «Wichteln»-сервисы (drawnames — 11 609 оценок в DE, Wichteln 22 — 1 Mio.+ установок). Из прокси-данных Википедии — декабрьский пик статьи «Geschenk» (+35…68 % к ноябрю). Точных коэффициентов сезонности нет: Trends отдал 429.

**7. В немецких сторах английский бренд и немецкий ключ стоят рядом.** 14 из 69 названий содержат оба корня («Wishbob – Online-Wunschliste», «Wishdo: Wunschliste Geschenke», «Wishy: Wunschliste & Wichteln», «Share a Wish: Wunschliste»). Это ровно та схема, которую предписывает `criteria.md`: бренд латиницей, ключи — в локализованном подзаголовке.

---

## 7. Влияние на финалистов (Wishparty, Wishmoon, Wishie, Wishlane, Wishday)

Общее для всех пяти: **имя на «Wish-» на рынке DE не даёт ни ASO-, ни SEO-преимущества**, потому что немецкий пользователь набирает «Wunschliste», а не «wish». Ключи всё равно уходят в подзаголовок стора («Wunschliste», «Wunschzettel für die Familie», «Geschenkideen») — это соответствует правилу из `criteria.md` (в имя ключи не зашивать). Зато «Wish-» не мешает: конвенция «английский бренд + немецкий ключ» на рынке уже принята.

| Финалист | Плюсы для DE | Минусы и риски для DE |
|---|---|---|
| **Wishparty** | «Party» — немецкое заимствование, пишется и читается по-немецки без сюрпризов; «вечеринка» стыкуется с главными поводами рынка (день рождения 35 упоминаний, Рождество 33) | «Party» сужает до события и не говорит «список»; в выдаче по «wish» рядом стоит маркетплейс Wish |
| **Wishmoon** | Второй элемент — базовое английское слово, произносится с первого раза | В DE «Mond» тянет эзотерику (`wunscherfüllung meditation`, `wunscherfüllung universum` — ровно этот кластер в подсказках); к списку желаний отношения не имеет |
| **Wishie** | Суффикс «-ie» в немецком привычен (Selfie, Handy, Party); ласково, легко выговаривается | На слух почти неотличимо от «Wishi»/«Wischy», а «Wisch» — см. ниже; в DE уже есть Wishy и Wishes в сторах |
| **Wishlane** | Нейтрально, ничего плохого не значит | «Lane» немцу не слово: смысл не читается, а только транслитерируется («Вишлане/Вишлейн»); семантически самое слабое для DE; в подсказках DE это имя музыканта (см. 4.8) |
| **Wishday** | «Day» понятно, «день желаний» стыкуется с поводом (день рождения) | Привязка к одному дню; на слух «Wishday»/«Wish day» немцы могут писать как «Wischday»; подсказки DE уводят в шрифт, чужое приложение и «yogurt wishday» (см. 4.8) |

**Отдельный риск, общий для всех пяти (интерпретация, проверять на носителях):** немецкое «w» читается как /v/, поэтому «Wish» произносится [vɪʃ] — ровно как немецкое слово **«Wisch»**. По Wiktionary: «Wisch», IPA [vɪʃ], значение [1] — «umgangssprachlich, abwertend: Schriftstück, das als wertlos betrachtet wird» (разговорно-пренебрежительно: бумажка, которая считается ничего не стоящей). Источник: `https://de.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Wisch&format=json` — 2026-11-05. Опасность не блокирующая (не непристойность, оттенок мягкий и разговорный), но неприятная по смыслу: приложение, которое выдаёт «Wisch» — то есть бумажку. Практический риск выше: услышав название, немец наберёт **«Wischparty»**/«Wischmoon» и не найдёт приложение. Лечится подзаголовком с «Wunschliste» и точным написанием бренда в описании.

**Что делать по итогам рынка DE (для сводки 7-summary):**

1. Немецкий подзаголовок стора строить вокруг **«Wunschliste»** (не «Wunschzettel», не «Geschenk»): это и ключ с наибольшим числом подсказок, и самое частое слово в названиях конкурентов.
2. В описание добавить связку «erstellen / teilen / kostenlos / ohne Anmeldung / Familie» — это фактические модификаторы спроса.
3. «Wunschzettel» держать для рождественского сезонного текста и для детских/семейных сценариев.
4. По неймингу для DE нет ни одного финалиста с преимуществом; выбор можно делать по другим рынкам. Если решать по DE, наименее рискованны **Wishparty** (второй элемент — немецкое слово) и **Wishday** (прозрачная семантика), наиболее слаб по смыслу **Wishlane**.

---

## 8. Пробелы

1. **Google Trends недоступен.** Два обращения к `trends.google.com` вернули HTTP 429 (антибот). Индексов 0–100, «похожих запросов» и кривых сезонности из Trends нет. Один повторный заход сделан, как требует задание; защиту не обходили, прокси и зеркала не использовали. Следствие: сравнить Wunschliste и Geschenkideen по относительному объёму нельзя, только по косвенным признакам (число подсказок, число названий в сторах).
2. **Абсолютных объёмов поиска нет ни у одного термина.** Google Keyword Planner требует логина и рекламного аккаунта — по правилам задания не использовался. Все «частоты» в отчёте — это счётчики подсказок и названий, а не показы в месяц.
3. **Сезонность измерена только прокси.** Wikimedia Pageviews по статье «Geschenk» — слабый индикатор (энциклопедическая статья, а не поисковый спрос); статьи «Wunschzettel»/«Wunschliste» для этого непригодны (1–27 просмотров в месяц). Точных коэффициентов декабрьского пика для поисковых запросов нет.
4. **Google Play не показывает установки в поисковой выдаче.** Числа сняты с 28 отдельных карточек приложений; это округлённые диапазоны Google («1 Mio.+», «100.000+»), а не точные значения, и они могут отличаться от реальных на порядок внутри диапазона. Для 1 позиции (`Change Sorted: Zen Coin Stack`) установки не снимались — приложение нерелевантно.
5. **App Store не отдаёт установки.** В таблицах — количество оценок (`userRatingCount`), это не загрузки; сравнение с Play по абсолютным числам некорректно.
6. **Один seed вернул пустой ответ** — `geschenk app kostenlos` (пустой список подсказок). Считаю это содержательным сигналом (запроса нет), но формально это пробел: возможно, сработала фильтрация Suggest.
7. **YouTube/Play-подсказки не снимались** — по заданию они «только если открываются без логина»; на это не тратил запросы, потому что Google Suggest уже дал картину по всем ядрам.
8. **AT/CH проверены точечно** (по одному seed в Suggest и по одному термину в App Store). Отличий в лексике не найдено, но глубокой проверки австрийских и швейцарских формулировок не было.
9. **«Wisch»-риск не проверен на носителях.** Значение слова подтверждено словарём, но то, что немцы действительно прочитают «Wishparty» как «Wischparty», — гипотеза. Нужен опрос или транскрипционный тест.
10. **Не проверялось**, есть ли в DE реклама или кампании у Wish.com, влияющие на восприятие корня «Wish»; в App Store видно только, что маркетплейс занимает первую строку по запросу `wish`.

---

## 9. Список источников

Все — 2026-11-05.

**Google Suggest**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenkideen`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschzettel`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunsch`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishlist`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenke%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschzettel%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenkeliste`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20liste`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20teilen`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20kostenlos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20online%20erstellen`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20weihnachten`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschliste%20kinder`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunschzettel%20vorlage`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20geburtstag`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20hochzeit`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=weihnachtsgeschenke`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20f%C3%BCr%20ihn`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20f%C3%BCr%20sie`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenk%20f%C3%BCr%20m%C3%A4nner`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenkideen%20m%C3%A4nner`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=geschenkideen%20freundin`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wunscherf%C3%BCllung`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishlist%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=AT&q=wunschliste`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=CH&q=wunschliste`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=AT&q=geschenk`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=CH&q=geschenk`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishparty`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishmoon`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishie`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishlane`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=de&gl=DE&q=wishday`

**Google Trends (недоступен)**
- `https://trends.google.com/trends/explore?geo=DE&q=geschenk,geschenkideen,wunschliste,wunschzettel,wishlist` — HTTP 429
- `https://trends.google.com/trends/api/explore?hl=de&tz=-60&req=…` (тот же набор, 12 месяцев, geo=DE) — HTTP 429 дважды

**Google Play**
- `https://play.google.com/store/search?q=wunschliste&c=apps&hl=de&gl=DE`
- `https://play.google.com/store/search?q=wunschzettel&c=apps&hl=de&gl=DE`
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=de&gl=DE`
- `https://play.google.com/store/search?q=geschenk&c=apps&hl=de&gl=DE`
- `https://play.google.com/store/search?q=geschenkideen&c=apps&hl=de&gl=DE`
- `https://play.google.com/store/search?q=geschenke%20app&c=apps&hl=de&gl=DE`
- Карточки для установок: `https://play.google.com/store/apps/details?id=<id>&hl=de&gl=DE`, где `<id>` — `de.meinonlinewunschzettel`, `com.ckbusiness.Wishlists`, `nod.wishbob`, `com.wishowl.app`, `com.wiheads.wishes`, `com.giftful.Giftful`, `com.gowish.app`, `io.wantic.app`, `com.happywishlist.app`, `io.wishdo.app`, `com.depold.bittekaufen`, `com.moonsift.wish.list.maker.christmas.birthday.baby.shopping.gift.list`, `com.share.a.wish`, `com.giftlist`, `com.steinfluss.wishlist`, `com.thingstogetme.easygiftlist`, `io.wunschzettel.app`, `com.seel.schenkbar`, `com.geschenkbob`, `de.geschenklotse.app`, `de.mobilinga.schenkki`, `com.ulrichwagner.presentplanner`, `com.xmaslist`, `com.wishlists.gifts`, `com.bocadil.amigoinvisible22`, `com.jeremieleroy.secretsanta`, `com.sodacrew.sodagift`, `com.andrewivchuck.asmrpresents`

**App Store (iTunes Search API)**
- `https://itunes.apple.com/search?term=geschenk&country=de&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=geschenkideen&country=de&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=wunschliste&country=de&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=wunschzettel&country=de&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=wishlist&country=de&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=wish&country=de&entity=software&limit=10&lang=de_de`
- `https://itunes.apple.com/search?term=wunschliste&country=at&entity=software&limit=25&lang=de_de`
- `https://itunes.apple.com/search?term=wunschliste&country=ch&entity=software&limit=25&lang=de_de`

**Словари, энциклопедии, сезонность**
- `https://de.wikipedia.org/wiki/Wishlist` — сериал Funk, 2016
- `https://de.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=Wisch&format=json` — «Wisch», IPA [vɪʃ], разговорно-пренебрежительное «бесполезная бумажка»
- `https://www.wunschliste.de/` — «TV Wunschliste», телегид (точный домен ключа занят)
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Geschenk/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Wunschzettel/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/de.wikipedia/all-access/user/Wunschliste/monthly/20241101/20261031`

**Внутренние документы (только чтение)**
- `_bmad-output/research/naming/criteria.md`
- `_bmad-output/research/naming/finalists-compare.md`

ГОТОВО 2-de
