# 1-en. Поисковые паттерны подарков и вишлистов: США и Великобритания

| Параметр | Значение |
|---|---|
| Рынки | США (US) и Великобритания (GB) |
| Язык запросов | `hl=en` (для автодополнения и сторов — `hl=en` + `gl=US` / `gl=GB`) |
| Дата прогона | 2026-11-05 |
| Модель | DeepSeek V4.1 Flash Free (OpenCode) |
| Метод | только чтение публичных страниц и API без логина: Google Suggest, Google Play, iTunes Search API, Google Trends. Ничего не покупалось, формы не отправлялись, капча и антибот не обходились |
| Главное ограничение | Google Trends дважды вернул `429 Too Many Requests` — относительных индексов 0–100 нет, поэтому ни одной цифры объёма спроса в отчёте нет (см. раздел 8) |

Контекст задания: выбрать название вишлиста из финалистов Wishparty, Wishmoon, Wishie, Wishlane, Wishday. Прочитаны `_bmad-output/research/naming/criteria.md` и `finalists-compare.md` (только чтение, 2026-11-05).

**Как читать цифры в отчёте.** Все числа ниже — это (а) частота слов в 400 собранных подсказках автодополнения, (б) доля названий приложений в топ-10 стора, (в) число оценок в App Store и ступень установок в Google Play. Это **не** объём поиска. Объёма поиска в этом отчёте нет ни в одной строке.

---

## 1. Seed-запросы

24 сида: 20 из ядра с модификаторами + 4 дополнительных, добавленных после того, как выяснилось, что сид `present` уводит в грамматику.

| # | Seed | Зачем |
|---|---|---|
| 1 | `gift` | ядро, самое общее слово |
| 2 | `gift ideas` | второй по силе кластер (запрос дарителя) |
| 3 | `wishlist` | главный термин категории, слитное написание |
| 4 | `wish list` | то же раздельно (проверка формы) |
| 5 | `wish` | чистый корень финалистов |
| 6 | `present` | британский синоним подарка |
| 7 | `birthday wishlist` | модификатор «день рождения» |
| 8 | `gift registry` | реестр подарков (свадьба, ребёнок) |
| 9 | `wishlist app` | модификатор «приложение» |
| 10 | `gift list` | «список подарков» — прямой конкурент слова wishlist |
| 11 | `gift list app` | «список подарков» + приложение |
| 12 | `gift ideas for him` | модификатор адресата |
| 13 | `gift ideas for her` | модификатор адресата |
| 14 | `christmas gift ideas` | сезонный модификатор (Рождество) |
| 15 | `birthday gift ideas` | сезонный модификатор (день рождения) |
| 16 | `baby registry` | реестр по случаю |
| 17 | `wedding registry` | реестр по случаю |
| 18 | `secret santa` | групповой обмен подарками (сильный кластер в сторах) |
| 19 | `gift exchange` | то же, другое слово |
| 20 | `christmas wishlist` | сезонный модификатор + вишлист |
| 21 | `presents` | доп.: британское множественное число |
| 22 | `christmas presents` | доп.: сезон + британская форма |
| 23 | `birthday presents` | доп.: день рождения + британская форма |
| 24 | `wedding gift list` | доп.: британский «gift list» в свадебном контексте |

Каждый сид прогнан по US и GB (Google Suggest, `client=firefox`, `hl=en`, `gl=<GEO>`), 5 сидов дополнительно по YouTube (`ds=yt`), 6 терминов — по сторам.

---

## 2. Google Trends

### 2.1 Результат прогона

Запросы вида `https://trends.google.com/trends/explore?geo=US&q=wishlist,gift%20ideas` (и API `trends/api/explore`, который отдаёт те же данные для страницы) вернули HTTP 429 «Error 429 (Too Many Requests)» — дважды, с интервалом в несколько минут, для обоих гео. Защиту не обходил.

| Термин | US, 12 мес. | US, 5 лет | GB, 12 мес. | GB, 5 лет |
|---|---|---|---|---|
| wishlist | 429 — нет данных | 429 — нет данных | 429 — нет данных | 429 — нет данных |
| gift ideas | 429 — нет данных | 429 — нет данных | 429 — нет данных | 429 — нет данных |
| wish | 429 — нет данных | 429 — нет данных | 429 — нет данных | 429 — нет данных |
| gift list | 429 — нет данных | 429 — нет данных | 429 — нет данных | 429 — нет данных |
| present | 429 — нет данных | 429 — нет данных | 429 — нет данных | 429 — нет данных |

Источник: `https://trends.google.com/trends/explore?geo=US&q=wishlist,gift%20ideas` — 2026-11-05 (HTTP 429); `https://trends.google.com/trends/explore?geo=GB&q=wishlist,gift%20ideas` — 2026-11-05 (HTTP 429).

### 2.2 Что не получено

Не получены: относительный индекс 0–100 по терминам, «Похожие запросы» (топ и растущие) по этапу 1.2, кривая сезонности с пиками. Эти пункты задания остались невыполненными по технической причине; вместо них ниже собраны **прокси-показатели** — и они помечены как прокси, а не как объём спроса.

### 2.3 Прокси вместо индекса Trends

| Прокси | Что показывает | Сила сигнала |
|---|---|---|
| Позиция термина в собственных подсказках | если Google первым делом достраивает сам термин + `app` / `maker` / `website`, значит по нему есть спрос на инструмент | средняя |
| Число подсказок с модификатором (`ideas`, `registry`, `app`) в 400 собранных | какие уточнения люди дописывают к ядру | средняя |
| Доля названий в топ-10 сторов, содержащих корень | насколько разработчики верят в ключ (это их ставка на спрос, а не сам спрос) | слабая, косвенная |
| Число оценок в App Store / ступень установок в Play | размер лидеров категории, то есть потолок спроса | средняя |

---

## 3. Автодополнение Google Suggest

Всего собрано 400 подсказок: 20 сидов × 2 гео × 10 подсказок. Ниже — по 10 подсказок на ключевые сиды; полный набор — в источнике (URL собирается подстановкой сида).

### 3.1 США (gl=US)

| Seed | Подсказки (как выдал Google, порядок сохранён) |
|---|---|
| `gift` | giftful · giftcardmall/mygift · gift cards · gifts · giftster · gifts for men · gift shops near me · gifted · gifts for women · gifted movie |
| `gift ideas` | gift ideas · for women · for men · for mom · for teen girls · for female friend · for dad · for boyfriend · for girlfriend · gift ideas 2026 |
| `wishlist` | wishlist · **wishlist maker** · **wishlist app** · **wishlist website** · wishlist ideas · wishlistr · wishlist clothing · wishlist lyrics taylor swift · **wishlist or wish list** · wishlist apparel |
| `wish list` | wish list · **wish list app** · **wish list maker** · wish list lyrics · taylor swift · lyrics taylor swift · **wish list website** · wish list amazon · **wish list or wishlist** · wish list ideas |
| `wish` | wishlist · wish · wishbone · wish you were here · wishmaster · wish tv · wish movie · wishbone dog · wishlist maker · wishful |
| `present` | present · presentation · presented synonym · present meaning · present mic · presentation templates · present tense · present value calculator · present perfect tense · present value formula |
| `birthday wishlist` | birthday wishlist · ideas · **maker** · registry · **app** · website · template · ideas teen girl · amazon · inspo |
| `gift registry` | gift registry · amazon · website · wedding · target · **for birthday** · in spanish · sites · meaning · **app** |
| `wishlist app` | wishlist app · wishlist apparel · wishlist apparel dress · **wishlist app free** · **for kids** · wishlist apparel tops · **for family** · reddit · **for christmas** · wishlist apparel skirt |
| `gift list` | gift list · **gift list maker** · **gift list website** · **gift list app** · gift list 2026 · gift list stardew valley · gift list amazon · gift list registry · gift list ideas · gift list site |
| `gift list app` | gift list app · **to share with family** · free · for android · iphone · uk · for kids · for family · how to archive · reddit |
| `gift ideas for him` | for him · birthday · anniversary · on sweetest day · 5 senses · 25th wedding anniversary · 10 year anniversary · 4th wedding anniversary · 1 year anniversary · christmas |
| `gift ideas for her` | for her · birthday · 2026 · under $50 · 50th birthday · 30th birthday · anniversary · 40th birthday · uk · nz |
| `christmas gift ideas` | christmas gift ideas · 2026 · for teen girls · for women 2026 · for women · for men · for teen boys · for kids · for coworkers · girl |
| `birthday gift ideas` | for her · for him · for mom · for wife · for best friend · for husband · for women · for dad · for men |
| `baby registry` | baby registry · amazon · search · must haves · finder · target · checklist · list · sites · amazon search |
| `wedding registry` | wedding registry · ideas · search · sites · websites · amazon · must haves · target · finder · items |
| `secret santa` | secret santa · **generator** · **form** · **app** · questionnaire · website · gifts · list · wishlist · ideas |
| `gift exchange` | generator · ideas · gift exchange · games · name generator · theme ideas · ideas for adults · app · questionnaire · codes for pokemon unite |
| `christmas wishlist` | christmas wishlist · ideas · template · **maker** · **app** · 2026 · **website** · ideas teenage girl · ideas girl · ideas 2026 |
| `presents` | presents · synonym · meaning · for men · for mom · for 1 year old · for dad · for boyfriend · presents of mind · presents in spanish |
| `christmas presents` | christmas presents · 2026 · ideas · for kids · for girls · for mom · for women · for men · for boys · for dad |
| `birthday presents` | for mom · for dad · for wife · for men · for girlfriend · for boyfriend · for girls · for 1 year old · for husband |
| `wedding gift list` | wedding gift list · **name** · **called** · by year · ideas · online · website · **uk** · registry · **john lewis** |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=US&q=<seed>` — 2026-11-05.

### 3.2 Великобритания (gl=GB)

| Seed | Подсказки |
|---|---|
| `gift` | **gift nifty** · gift nifty live · gifts for men · gift · gift cards · gift shops near me · gifts for women · gifted · gift for girls · gift box |
| `gift ideas` | for women · gift ideas · for men · **for girls** · for female friend · for mom · for boyfriend · for dad · for boys · **for husband** |
| `wishlist` | wishlist · **maker** · **app** · wishlist adalah · wishlist store · wishlist meaning · wishlist taylor swift lyrics · **website** · ideas · lyrics |
| `wish list` | wish list · taylor swift lyrics · lyrics · taylor swift · **app** · taylor swift meaning · **maker** · wish list drama · chords · meaning |
| `wish` | **wishcare** · wishcare hair growth serum · wish · wishcare lip balm · wishcare sunscreen · wishlist · wish you were here · wishbone · wish you were here lyrics · wish dragon |
| `present` | present · presentation · present perfect tense · present continuous tense · presentation ai · present tense · present perfect · present indefinite tense · present perfect continuous tense · presented synonym |
| `birthday wishlist` | birthday wishlist · ideas · **maker** · **for a girl** · **website** · **for a lady** · template · **app** · registry · ideas teen girl |
| `gift registry` | gift registry · meaning · **website** · wedding · amazon · australia · for baby shower · for birthday · baby · target |
| `wishlist app` | wishlist app · wishlist apparel · **free** · **shopify** · apparel dress · **for kids** · **for couples** · apparel tops · **for family** · **for shopping** |
| `gift list` | gift list · **maker** · **app** · **website** · stardew valley · **for wedding** · ideas · **for men** · amazon · registry |
| `gift list app` | gift list app · **to share with family** · free · for android · iphone · uk · for kids · for family · how to archive · reddit |
| `gift ideas for him` | for him · birthday · anniversary · on sweetest day · christmas · **uk** · **and her** · on engagement · 25th wedding anniversary · pinterest |
| `gift ideas for her` | for her · birthday · **uk** · nz · 2026 · 30th birthday · 50th birthday · under $50 · 60th birthday · anniversary |
| `christmas gift ideas` | for 2026 · for women · for her · for men · for kids · for coworkers · for him · for teen girls · for adults |
| `birthday gift ideas` | for her · **for girls** · for husband · for him · for women · for best friend · for wife · for men · for mom |
| `baby registry` | baby registry · amazon · search · must haves · finder · checklist · target · **canada** · list · **australia** |
| `wedding registry` | wedding registry · ideas · search · sites · websites · amazon · must haves · finder · items · target |
| `secret santa` | secret santa · **generator** · **app** · gifts · questionnaire · **name generator** · **website** · **box** · **name draw** · gift ideas |
| `gift exchange` | generator · ideas · gift exchange · games · ideas for women · name generator · ideas for adults · ideas for friends · app · theme ideas |
| `christmas wishlist` | christmas wishlist · ideas · template · **app** · 2026 · **website** · **maker** · ideas teenage girl · ideas girl · ideas 2026 |
| `presents` | presents · synonym · meaning · **for dad** · **for mum** · for men · for 1 year old · for boyfriend · presents of mind · for women |
| `christmas presents` | for men · ideas · **for mum** · for kids · **for 2 year old** · for girls · for dad · 2026 · for her |
| `birthday presents` | **for mum** · for dad · for her · for men · for mom · for girls · for boyfriend · for him · for women |
| `wedding gift list` | wedding gift list · name · called · ideas · online · website · **uk** · by year · registry · **john lewis** |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=GB&q=<seed>` — 2026-11-05.

### 3.3 Частота модификаторов (400 подсказок, US+GB вместе)

Счёт по границам слов. Цифра — сколько из 400 подсказок содержат слово. Это частота **слов в подсказках**, а не частота запросов.

| Модификатор | Подсказок | Комментарий |
|---|---|---|
| `gift` | 190 | ядро рынка |
| `ideas` | 129 | самый частый модификатор: людям нужны идеи, а не список |
| `wishlist` | 84 | второе по силе слово категории |
| `registry` | 64 | сильно в США (baby/wedding), слабее в GB |
| `birthday` | 52 | второй праздник после Рождества |
| `app` | 48 | спрос именно на приложение |
| `christmas` | 43 | сезонный, но в выборке было 2 «рождественских» сида — число завышено |
| `wish` | 29 | корень финалистов, отдельно от `wishlist` встречается редко |
| `for him` / `for her` | 23 / 23 | симметричный модификатор адресата |
| `present` | 14 | все 14 — из сида `present` в грамматическом смысле (present perfect, presentation), ни одного про подарок |
| `website` | 13 | конкуренты-сайты, не только приложения |
| `maker` | 11 | «сделать список» — глагольная рамка |
| `amazon` | 11 | реестры живут на Amazon |
| `2026` | 11 | пользователи ждут год в запросе |
| `for women` / `for men` | 10 / 9 | адресат по полу |
| `taylor swift` | 7 | музыкальный шум вокруг слова wishlist |
| `taylor swift` + `lyrics` | 7 + 8 | в сумме музыкальная примесь заметная |
| `for kids`, `family` | 6 / 6 | семейный сценарий |
| `meaning`, `generator` | 6 / 7 | «что это» и «сделай жеребьёвку» |
| `template`, `free` | 4 / 4 | слабые |
| `reddit` | 3 | запрос рекомендаций приложения |
| `couples`, `shopify` | 1 / 1 | ниша и B2B-хвост |

Источник: сводный счёт по 400 подсказкам из двух запросов выше — 2026-11-05.

### 3.4 YouTube-подсказки (ds=yt) — медийный слой

YouTube открылся без логина. Он показывает, что происходит со словом `wishlist` вне магазинного контекста.

| Seed | US | GB |
|---|---|---|
| `wishlist` | **wishlist ideas** · wishlist · **taylor swift** · **pearl jam** · acoustic · **denzel curry** · taylor swift clean · txt · ideas 2026 · **app** | ideas · wishlist · **taylor swift** · taylor swift lyrics · ideas 2026 · txt · **christmas** · **song** · taylor swift acoustic · **pearl jam** |
| `wish list` | wish list · **taylor swift** · wishlist clean · taylor swift lyrics · ideas · app · acoustic · **wish list cats millionaire** · taylor · karaoke | wish list · taylor swift · **natok** · acoustic · taylor swift lyrics · taylor · ideas · clean · song · karaoke |
| `gift list` | gift list ideas · gift list · **app** · for nerds · 2026 · for girl · **angela scanlon** · for men | gift list · ideas · **john lewis** · **app** · for girl · for men · for nerds · 2026 |
| `secret santa` | secret santa · **east idaho news** · 2026 east idaho news · **katseye** · **carter kench** · gift ideas · kalogeras · tomska · gift exchange · f1 | secret santa · east idaho news · gift ideas · **2025** · f1 · ideas · celebration part 1 · celebration part 4 |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=US&q=wishlist` (и аналоги с `gl=GB`, `q=gift%20list` и т. д.) — 2026-11-05.

Что это даёт: в YouTube `wishlist` — это в первую очередь песни (Taylor Swift, Pearl Jam, Denzel Curry), а `gift list` в GB — это **John Lewis** (крупнейший британский ритейлер, у которого «gift list» — собственный сервис) и телешоу Angela Scanlon. То есть в британском сознании `gift list` уже занят ритейлером.

### 3.5 Названия приложений прямо в подсказках

Google достраивает бренды конкурентов, то есть по этим словам люди ищут приложения:

- `gift` (US) → **giftful**, **giftster**; `gift` (GB) → gift nifty (индийский финансовый термин, шум).
- `wishlist` (US) → **wishlistr**, **wishlist apparel** (бренд одежды), `wishlist clothing`.
- `wishlist app` (GB) → **wishlist apparel**, `wishlist app shopify`.
- `wishlist` (GB) → `wishlist store`, `wishlist adalah` (индонезийский шум).

Источник: те же запросы Google Suggest от 2026-11-05.

### 3.6 Подсказки по именам финалистов

Проверка, что Google думает о самих именах (US и GB одинаково, кроме отмеченного).

| Имя | Подсказки US | Подсказки GB | Вывод |
|---|---|---|---|
| `wishparty` | пусто | пусто | спроса нет, столкновений нет |
| `wishmoon` | пусто | пусто | спроса нет, столкновений нет |
| `wishie` | wishier protein bar · wishie · wishy washy · wishiwashi · wishiecat · wishier · wishy flower · wishiecat twitch · windshield washer fluid · wishiwashi ex | wishier protein bar · wishie · wishielts · wishy washy · wishier · wishiwashi · wishiecat · wishes · wishield · wishiecat twitch | окружение — протеиновые батончики, стример wishiecat и идиома wishy-washy |
| `wishlane` | wishlane · **wishlane artist** · **wishlane sunday** · **wishlane cheap talk** · **wishlane music** · **wishlane medispa** · wishlane nobody's listening · wishlane look at me | то же | имя занято музыкантом (и клиникой medispa) |
| `wishday` | wishday · **woshday** · woshday shampoo · woshday dry shampoo · woshday shampoo review · woshday dry shampoo puff · woshday scalp purifying shampoo · wishday shampoo ingredients · **wishday font** · **wishday app** | то же | рядом фонетический сосед-шампунь Woshday; при этом «wishday app» уже подсказывается |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=US&q=wishlane` и аналоги — 2026-11-05.

---

## 4. Сторы: Google Play и App Store

Метод. Play: страница поиска `?c=apps&hl=en&gl=<GEO>`, из HTML берутся название, разработчик и id первых 10 приложений; установки со страницы поиска **не отдаются** (в HTML нет ни `Downloads`, ни числа установок), поэтому установки добраны со страниц приложений для 16 лидеров. App Store: iTunes Search API, установок не публикует вообще — вместо них число оценок (`userRatingCount`).

### 4.1 Google Play, топ-10 по терминам (US и GB рядом)

**`wishlist`**

| # | US | Установки | GB | Установки |
|---|---|---|---|---|
| 1 | GoWish - Your Digital Wishlist (Ønskeskyen ApS) | 1M+ | GoWish - Your Digital Wishlist (Ønskeskyen ApS) | 1M+ |
| 2 | Wishlist Maker - Listful (Listful) | 100K+ | Wishlist Maker - Listful (Listful) | 100K+ |
| 3 | Giftful - Gift List & Wishlist (Giftful) | 100K+ | Wishlists - online wishlist (Christian Konnerth) | 100K+ |
| 4 | GiftList - Wishlist & Registry (GiftList) | 10K+ | Wishlist Maker - Moonsift (MOONSIFT) | 100K+ |
| 5 | Wishlists - online wishlist (Christian Konnerth) | 100K+ | Giftful - Gift List & Wishlist (Giftful) | 100K+ |
| 6 | Wishlist Maker - Moonsift (MOONSIFT) | 100K+ | GiftList - Wishlist & Registry (GiftList) | 10K+ |
| 7 | Giftster - Wish List Registry (MyGiftster Corporation) | 100K+ | Things To Get Me - Wishlist (Things To Get Me) | 50K+ |
| 8 | Share a Wish: Wishlist & Gifts (Northern Development) | н/д | Wishes – Wish List & Registry (Wiheads ApS) | н/д |
| 9 | Wishes – Wish List & Registry (Wiheads ApS) | н/д | Wishlists & Gifts - WishOwl (Kenji Sakai) | 1K+ |
| 10 | Wishlists & Gifts - WishOwl (Kenji Sakai) | 1K+ | Share a Wish: Wishlist & Gifts (Northern Development) | н/д |

**`gift list`**

| # | US | GB | Установки |
|---|---|---|---|
| 1 | GiftList - Wishlist & Registry (GiftList) | GiftList - Wishlist & Registry (GiftList) | 10K+ |
| 2 | Christmas Gift List (engApps) | GiftTracker: Gift List Planner (Leewrigg) | 1M+ / 50K+ |
| 3 | Giftful - Gift List & Wishlist (Giftful) | GoWish - Your Digital Wishlist (Ønskeskyen ApS) | 100K+ / 1M+ |
| 4 | Giftster - Wish List Registry (MyGiftster) | Giftful - Gift List & Wishlist (Giftful) | 100K+ / 100K+ |
| 5 | GoWish - Your Digital Wishlist (Ønskeskyen ApS) | Giftster - Wish List Registry (MyGiftster) | 1M+ / 100K+ |
| 6 | Wishlist Maker - Listful (Listful) | Wishlist Maker - Moonsift (MOONSIFT) | 100K+ / 100K+ |
| 7 | GiftTracker: Gift List Planner (Leewrigg) | Family Gift : Shared Wish List (Trempette Inc.) | 50K+ / 100K+ |
| 8 | Family Gift : Shared Wish List (Trempette Inc.) | Things To Get Me - Wishlist (Things To Get Me) | 100K+ / 50K+ |
| 9 | Wishlist Maker - Moonsift (MOONSIFT) | Wishlist Maker - Listful (Listful) | 100K+ / 100K+ |
| 10 | Things To Get Me - Wishlist (Things To Get Me) | Wishlist & Gift Ideas - GiftX (PatStudio LLC) | 50K+ / н/д |

**`gift registry`**

| # | US | GB | Установки |
|---|---|---|---|
| 1 | Giftster - Wish List Registry (MyGiftster) | Giftster - Wish List Registry (MyGiftster) | 100K+ |
| 2 | MyRegistry.com (MyRegistry.com) | Giftful - Gift List & Wishlist (Giftful) | 100K+ / 100K+ |
| 3 | Giftful - Gift List & Wishlist (Giftful) | MyRegistry.com (MyRegistry.com) | 100K+ / 100K+ |
| 4 | Wishlist & Gift Registry (Giftbuster) | Wishlist & Gift Registry (Giftbuster) | 10K+ / 10K+ |
| 5 | GiftList - Wishlist & Registry (GiftList) | GiftList - Wishlist & Registry (GiftList) | 10K+ |
| 6 | Family Gift : Shared Wish List (Trempette Inc.) | Family Gift : Shared Wish List (Trempette Inc.) | 100K+ |
| 7 | GifTaTy - Smart Gift Registry (GifTaTy) | GiftTracker: Gift List Planner (Leewrigg) | н/д / 50K+ |
| 8 | GiftTracker: Gift List Planner (Leewrigg) | GifTaTy - Smart Gift Registry (GifTaTy) | 50K+ / н/д |
| 9 | Wishlist: Gift List & Registry (Awaytix) | Wishlist: Gift List & Registry (Awaytix) | н/д |
| 10 | Gift Recorder: Log & Ideas (Tetsuya Asano) | Wishlist & Gift Ideas - GiftX (PatStudio LLC) | н/д |

**`wish list`** — тот же набор, что `wishlist`, порядок чуть другой: US 1) Listful, 2) GoWish, 3) GiftList; GB 1) GoWish, 2) Listful, 3) GiftList. Отдельная таблица не нужна.

**`gift ideas`** — сюда попадают те же вишлисты плюс AI-подборщики: US 1) Giftster, 2) GoWish, 3) Giftful, 4) GiftList, 5) GiftTracker, 6) Family Gift, 7) Secret Santa 22, 8) Gifts.com, 9) GiftMe (подарочные карты), 10) Giftlo (AI). GB 1) Giftster, 2) GiftList, 3) Giftful, 4) GoWish, 5) GiftTracker, 6) Family Gift, 7) Gifts.com, 8) Giftlo, 9) GIFTIT, 10) GiftX. Видно, что «идеи» и «список» в Play не разделены — выдача пересекается.

**`secret santa`**

| # | US | GB |
|---|---|---|
| 1 | drawnames \| Secret Santa app (drawnames) | drawnames \| Secret Santa app |
| 2 | Elfster: The Secret Santa App (Elfster) | Santa's Secret Keeper (T. P. Donahoe) |
| 3 | Santa's Secret Keeper (T. P. Donahoe) | Elfster: The Secret Santa App |
| 4 | Secret Santa 22: Gift exchange (Bocadil Infinite) | Secret Santa 22: Gift exchange |
| 5 | Secret Santa: Gift Exchange (Flying Unicorn) | Secret Santa: Kris Kringle (Motecso OG) |
| 6 | Secret Santa Helper App (Appstractive) | Secret Santa Helper App |
| 7 | Simple Secret Santa Generator (Anthony Dito) | Secret Santa: Gift Exchange (Flying Unicorn) |
| 8 | Secret Santa (Elapps) | Gift Shuffle: Secret Santa (Pasarela48) |
| 9 | Gift Shuffle: Secret Santa (Pasarela48) | Secret Santa (Elapps) |
| 10 | MySanta: The Secret Santa App (MySanta) | Secret Santa & Gifts - Zivanor (Visionhost) |

Установки лидеров жеребьёвки: drawnames 1M+, Elfster 1M+.

Источники: `https://play.google.com/store/search?q=wishlist&c=apps&hl=en&gl=US` (и `q=gift%20list`, `q=gift%20registry`, `q=gift%20ideas`, `q=wish%20list`, `q=secret%20santa`; `gl=GB` — те же) — 2026-11-05; установки — `https://play.google.com/store/apps/details?id=com.gowish.app&hl=en&gl=US` и аналоги для 16 id — 2026-11-05.

### 4.2 App Store, топ-10 по терминам (US и GB, в скобках — число оценок)

**`wishlist`**

| # | US | GB |
|---|---|---|
| 1 | GoWish - Your Digital Wishlist (Onskeskyen ApS, 210 787) | GoWish - Your Digital Wishlist (17 465) |
| 2 | Giftful - Wishlist & Registry (Giftful LLC, 105 716) | Wishlists - online wishlist (Wishlists GmbH, 791) |
| 3 | Wishlists - online wishlist (Wishlists GmbH, 2 730) | Listful - Wishlist Maker (Listful LLC, 1 443) |
| 4 | Listful - Wishlist Maker (Listful LLC, 25 990) | Giftful - Wishlist & Registry (1 348) |
| 5 | Sortd \| Shopping Wishlist App (Sortd, 956) | Sortd \| Shopping Wishlist App (61) |
| 6 | GiftList – Wishlist & Registry (Malibu Vista, 1 400) | Wishlist Maker - Moonsift (Moonsift Limited, 794) |
| 7 | Locker \| Shopping Wishlist (Locker 2.0, 2 235) | WishGrid - Wishlist & Registry (Tomas Lassak, 11) |
| 8 | **Wish: Shop and Save (ContextLogic, 2 333 616)** | Wantd - Curated Wishlist (SEDONA TECH, 14) |
| 9 | Wishlist Maker - Moonsift (Moonsift Limited, 2 103) | Things To Get Me (45) |
| 10 | Ohmywishes: Wishlists & Gifts (944) | Wishlist Maker - Wishdeck (Wishdeck Software, 27) |

**`gift list`**

| # | US | GB |
|---|---|---|
| 1 | GiftList – Wishlist & Registry (1 400) | Christmas Gift List Tracker (LW Brands, 8 590) |
| 2 | Christmas Gift List Tracker (LW Brands, 27 140) | The Christmas Gift List (Denys Ievenko, 2 081) |
| 3 | GoWish - Your Digital Wishlist (210 787) | GiftList – Wishlist & Registry (56) |
| 4 | Giftful - Wishlist & Registry (105 716) | GoWish - Your Digital Wishlist (17 465) |
| 5 | The Christmas Gift List (Denys Ievenko, 6 092) | Gift List: Budget Tracker (Craig Osborne, 67) |
| 6 | Listful - Wishlist Maker (25 990) | Gift Lists+ (256 Arts, 4) |
| 7 | Giftster: The Family Wish List (19 805) | GiftTracker: Gift List Planner (11) |
| 8 | MyRegistry.com (7 379) | Giftful - Wishlist & Registry (1 348) |
| 9 | Elfster: The Secret Santa App (332 101) | Listful - Wishlist Maker (1 443) |
| 10 | GiftTracker: Gift List Planner (3) | Christmas Gift Planner & List (1) |

**`gift registry`**

| # | US | GB |
|---|---|---|
| 1 | Giftful - Wishlist & Registry (105 716) | MyRegistry.com (441) |
| 2 | MyRegistry.com (7 379) | GiftList – Wishlist & Registry (56) |
| 3 | GoWish - Your Digital Wishlist (210 787) | GoWish - Your Digital Wishlist (17 465) |
| 4 | GiftList – Wishlist & Registry (1 400) | Giftful - Wishlist & Registry (1 348) |
| 5 | Giftster: The Family Wish List (19 805) | Giftster: The Family Wish List (800) |
| 6 | Babylist Baby Registry (143 805) | Elfster: The Secret Santa App (13 194) |
| 7 | Elfster: The Secret Santa App (332 101) | Shopping Wishlist - GiftBuster (128) |
| 8 | Wisp: Wishlist & Gift Registry (3) | Wishlists - online wishlist (791) |
| 9 | Gift List: Gift Registry Maker (2) | Honeyfund Wedding Registry (0) |
| 10 | Wishlists - online wishlist (2 730) | WishGrid - Wishlist & Registry (11) |

**`gift ideas`** — отдельный, очень «свежий» слой AI-подборщиков с почти нулевыми оценками. US: GoWish (210 787) · Gift Suggester: AI Gift Ideas (45) · Ribbon - Gift Ideas (0) · Giftful (105 716) · Gift Idea Tracker (21) · GiftFinderAI (0) · GiftPal (2) · Gift Finder AI (0) · Unwrapped (1) · Gift Galaxy AI (1). GB: GoWish (17 465) · Idea Gift (0) · GiftOS (0) · Giftly: AI Gift Finder (2) · Wishlist & Gift Ideas - GiftX (1) · Unwrapped (1) · Gift Galaxy AI (0) · Giftful (1 348) · Gifture (0) · Giftruly (0).

**`wish`** — корень занят маркетплейсом. US: **Wish: Shop and Save (2 333 616)** · GoWish (210 787) · Whish Money (421) · Temu (2 250 439) · Giftful (105 716) · AliExpress · SHEIN · Five Below · DHgate · eBay. GB: Wish (401 300) · GoWish (17 465) · AliExpress · Whish Money · Temu · DHgate · SHEIN · Joom · 123Wish · WishApp: Wishlist & Registry.

**`wish list`** — идентичен `wishlist` по составу в обоих сторах: Google Play и Apple схлопывают пробел.

Источник: `https://itunes.apple.com/search?term=wishlist&country=us&entity=software&limit=25` (и `term=gift%20list`, `term=gift%20ideas`, `term=gift%20registry`, `term=wish`, `term=wish%20list`; `country=gb` — те же) — 2026-11-05.

### 4.3 Какие корни доминируют в названиях

Топ-10 по четырём «списочным» терминам (`wishlist`, `wish list`, `gift list`, `gift registry`), дубликаты схлопнуты по названию.

| Корень в названии | Google Play (20 уникальных) | App Store (28 уникальных) |
|---|---|---|
| `list` | 17 (85 %) | 23 (82 %) |
| `wish` | 15 (75 %) | 16 (57 %) |
| `wishlist` / `wish list` целиком | 15 (75 %) | 15 (54 %) |
| `gift` | 13 (65 %) | 13 (46 %) |
| `registry` | 7 (35 %) | 8 (29 %) |
| `present` | **0** | **0** |
| `wish` и `gift` вместе в одном названии | 9 (45 %) | 6 (21 %) |

По термину `wishlist` отдельно: **10 из 10** приложений в топ-10 и в US, и в GB содержат и `wish`, и `list` — то есть по этому запросу без ключа в названии не видно никого. По `gift list` — **10 из 10** содержат `list` в обоих гео.

Источник: подсчёт по таблицам раздела 4.1 и 4.2 — 2026-11-05.

---

## 5. Паттерны и выводы

### 5.1 Сводная таблица

| Термин | Trends (US/GB) | Подсказки | Названия в сторах |
|---|---|---|---|
| `wishlist` | 429 — нет данных | сам термин + `maker`, `app`, `website`, `ideas`, `registry`; US отдельно подсказывает `wishlist or wish list` | 10/10 в топ-10 Play содержат `wish`+`list`; в App Store лидер GoWish (210 787 оценок US) |
| `wish list` | 429 — нет данных | то же; много музыкального (Taylor Swift), `wish list amazon` | выдача в сторах идентична `wishlist` — пробел не различается |
| `wish` | 429 — нет данных | уводит в бренды и медиа: `wishbone`, `wish tv`, `wishcare` (GB), `wish dragon` | в App Store корень держит маркетплейс Wish: 2 333 616 оценок US, 401 300 GB |
| `gift` | 429 — нет данных | `gift cards`, `gift shops near me`, бренды `giftful`, `giftster` | `gift` есть в 65 % (Play) и 46 % (App Store) названий |
| `gift list` | 429 — нет данных | `maker`, `app`, `website`, `stardew valley` (игра), GB: `john lewis` | 10/10 содержат `list` |
| `gift ideas` | 429 — нет данных | 129/400 подсказок с `ideas`; `for him/her/mom/dad` | отдельный слой AI-подборщиков с 0–45 оценками — рынок только открывается |
| `gift registry` | 429 — нет данных | `wedding`, `baby`, `amazon`, `target`, GB: `meaning` | 6/10 содержат `registry` |
| `birthday wishlist` | 429 — нет данных | `ideas`, `maker`, `app`, `website`, `template` | отдельного приложения-лидера нет: подсказки гонят в общие вишлисты |
| `present` | 429 — нет данных | **0 из 10 подсказок про подарки** — только грамматика и презентации; `presents` тоже уводит в `synonym`/`meaning` | **0 из 20 и 0 из 28** названий содержат `present` |
| `secret santa` | 429 — нет данных | `generator`, `form`, `app`, `questionnaire` | отдельная полка: drawnames и Elfster по 1M+ установок, слово `wish` в названиях 0/10 |

### 5.2 Выводы

1. **Слово категории — `wishlist`, и оно слитное.** Пользователи сами спрашивают Google, как писать: в US подсказка `wishlist or wish list` стоит 9-й по `wishlist` и 9-й по `wish list`, в GB — `wishlist meaning` и `wish list meaning`. Сторы при этом считают `wish list` и `wishlist` одним запросом: выдача совпадает почти полностью. Практический вывод: в подзаголовке стора нужно писать `wishlist` одним словом и не полагаться на раздельную форму.
2. **Люди ищут инструмент, а не понятие.** 48 из 400 подсказок содержат `app`, 11 — `maker`, 13 — `website`; самые частые хвосты — `wishlist app`, `wishlist maker`, `gift list app`, `christmas wishlist app`. Отдельно живёт запрос «что поставить»: `wishlist app reddit`, `gift list app reddit`. То есть в сторе человек уже знает, что ищет приложение, и ему нужен признак «список», а не «идеи».
3. **`gift ideas` — трафик дарителя, а не название продукта.** Это второй по массе кластер (129/400 подсказок с `ideas`), и он весь про адресата: `for him`, `for her`, `for mom`, `for dad`, `for teen girls`, `under $50`, `2026`. Наши финалисты все на `wish`, то есть на стороне владельца списка — это соответствует строке «Соответствие продукту» в `criteria.md`, а `ideas` должен жить в подзаголовке и описании, не в имени.
4. **`present` на англоязычном рынке как ключ не работает.** Сид `present` в US дал 10 подсказок про грамматику и презентации, в GB — про времена английского; ни одной про подарки. Британцы говорят `presents` (`presents for mum`, `christmas presents for mum` — с британским `mum`, тогда как US даёт `mom`), но в названиях приложений слово не встречается ни разу: 0/20 в Play и 0/28 в App Store. Вывод: `present` — лексика разговора, не лексика стора.
5. **Корень `wish` в одиночку занят чужими брендами и музыкой.** В App Store по `wish` первым стоит маркетплейс Wish (2,3 млн оценок в US, 401 тыс. в GB), и он же тянет за собой Temu, AliExpress, SHEIN, DHgate, eBay — весь шопинг-блок. В YouTube `wishlist` — это песни Taylor Swift, Pearl Jam, Denzel Curry. Поэтому связка `wish` + `list` обязательна: она вытаскивает из медийно-маркетплейсного шума.
6. **Британский рынок отличается лексикой и «своим» ритейлером.** GB даёт `mum` вместо `mom`, а `gift list` в YouTube и в подсказках ведёт на **John Lewis** (`wedding gift list john lewis`, `gift list john lewis`) — у ритейлера это named-сервис. Значит в GB слово `gift list` воспринимается как чужая фича магазина, а `wishlist` — как нейтральное. Для GB подзаголовок лучше строить вокруг `wishlist`, не вокруг `gift list`.
7. **Сезонность подтвердить не удалось.** Trends отдал 429, поэтому пиков по месяцам в отчёте нет. Косвенно: 43 из 400 подсказок содержат `christmas`, 52 — `birthday`, 11 — `2026`; в GB есть `christmas gift ideas for 2026` и `christmas presents for 2 year old`, в US — `gift ideas 2026`. Это говорит о том, что год в запросе и рождественский сценарий живут в языке запросов, но не даёт кривой и не доказывает пик в ноябре–декабре. **Не подтверждено данными.**

---

## 6. Влияние на финалистов (en-US и en-GB)

Общая рамка для всех пяти: ни одно имя не содержит `wishlist`, `gift` или `list`, поэтому по общим запросам (`wishlist`, `gift list`, `gift ideas`) ни одно не будет находиться само — 10/10 лидеров по `wishlist` содержат ключ в названии. Значит для всех пяти обязателен английский подзаголовок с ключами (`Wishlist & gift list for family` и т. п.) — это ровно то, что требует `criteria.md` в пункте ASO. Ниже — что даёт само имя.

| Имя | en-US | en-GB | Итог для рынка |
|---|---|---|---|
| **Wishparty** | Пустая выдача в подсказках: столкновений нет, но и спроса на слово нет. `wish` + `party` читается как «праздник желаний»; `party` сужает до дня рождения/вечеринки, а в GB `party` ещё и политический контекст. `wishparty.com` занят (по `finalists-compare.md`) | То же, подсказки пустые | Чисто, но имя не помогает найти приложение; ключи — только в подзаголовке. Плюс: `wish` первым словом, то есть в алфавитном списке «Wish…» рядом с GoWish |
| **Wishmoon** | Подсказки пустые. `wish` + `moon`: в англоязычной голове `moon` — это «луна/мечтать», но и эзотерика, лунные календари; по запросу `moon` приложение не найдут. Плюс: `.app` и `.io` свободны (по `finalists-compare.md`) | То же | Самое нейтральное по столкновениям, но `moon` не даёт ни одной подсказки в подарках — имя полностью зависит от подзаголовка |
| **Wishie** | Подсказки дают `wishier protein bar`, `wishy washy`, `wishiecat` (Twitch-стример), `wishiwashi` (покемон), `windshield washer fluid`. `wishy-washy` по-английски — «нерешительный, мягкотелый»; для подарков это нежелательная коннотация. `Wishie` читается как уменьшительное, что в en-US работает на «милоту», но ASO-выдача размыта | `wishielts` (IELTS-подготовка) добавляется к тому же шуму | ASO-риск: 9 из 10 подсказок про чужие сущности. Минус по «произносимости и значениям» на en |
| **Wishlane** | Имя занято: `wishlane artist`, `wishlane music`, `wishlane sunday`, `wishlane cheap talk`, `wishlane nobody's listening`, плюс `wishlane medispa`. Это музыкальный проект с готовой брендовой выдачей; в Play уже есть игра Wish Lane (по `finalists-compare.md`) | То же, идентичный набор | Самый заметный конфликт на en-рынках: брендовый запрос уводит к артисту, а не к вишлисту. Ключ `lane` в подарках не значит ничего |
| **Wishday** | Подсказки забиты `woshday` (шампунь: `woshday dry shampoo`, `woshday scalp purifying shampoo`) — фонетический сосед в косметике; есть `wishday font` и, что важно, **`wishday app`** — то есть связка «wishday + app» уже подсказывается | То же | Двойственно: смысл «день желаний» считывается сразу (как `birthday`), и `wishday app` уже в подсказках — это плюс для ASO. Минус — фонетическая путаница с Woshday при голосовом поиске |

**Что из этого следует для выбора.** По данным en-US/en-GB чистыми по столкновениям выглядят Wishparty и Wishmoon (обе — ноль подсказок), но обе не несут узнаваемого ключа и требуют подзаголовка. Wishday — единственное имя, у которого уже есть подсказка вида `<имя> app`, и единственное, чей смысл читается по-английски без объяснений, но у него есть фонетический сосед в косметике. Wishlane — самый рискованный: имя занято музыкантом, и брендовая выдача будет уводить не туда. Wishie — риск размытия и отрицательной идиомы `wishy-washy`.

Отдельно: ни одно из пяти имён не должно пытаться встать на запрос `wish` в одиночку — там маркетплейс Wish с 2,3 млн оценок. Ставка на связку `wish` + `list` в подзаголовке работает для всех пяти одинаково.

---

## 7. Пробелы

1. **Google Trends недоступен.** `trends.google.com` вернул HTTP 429 дважды (первый заход и повтор позже) для US и GB. Не получены: относительный индекс 0–100 за 12 месяцев и 5 лет, «Похожие запросы» (топ и растущие), кривая сезонности с пиками. Капча и антибот не обходились. Из-за этого в отчёте нет ни одного числа объёма спроса — только прокси (раздел 2.3), и сезонность в разделе 5.2 помечена как неподтверждённая.
2. **Установки в Google Play собраны не для всех.** Страница поиска Play не отдаёт число установок в HTML (проверено: строк `Downloads`/`downloads` в разметке нет), поэтому установки добраны со страниц приложений только для 16 лидеров; в таблицах у остальных стоит «н/д».
3. **В App Store нет публичного числа установок.** Вместо него — `userRatingCount` из iTunes Search API. Это число оценок, а не загрузок; сравнивать его с установками Play напрямую нельзя.
4. **Выдача сторов зависит от региона и персонализации.** Параметр `gl` влияет на Play лишь частично; порядок в US и GB совпал сильнее, чем можно было ожидать. Считать эти списки «объективным рейтингом» нельзя — это срез выдачи на 2026-11-05 без входа в аккаунт.
5. **`secret santa` и `gift exchange` не проверены в iTunes.** В Google Play они собраны, в App Store — нет: эти термины не входили в 6 отобранных для iTunes. Кластер `gift exchange` в подсказках выглядит как `generator`/`games`, то есть это про жеребьёвку, а не про вишлист, — но в App Store это не подтверждено.
6. **`wishlistr` (бренд из подсказок) не проверен в сторах.** Он всплывает в Google Suggest по `wishlist` в US, но в топ-10 Play и App Store по нашим терминам его нет. Отдельной проверки, что это за продукт и жив ли он, не делалось.
7. **Локальные варианты написания не проверены.** `wishlist` в GB дал индонезийское `wishlist adalah` и `wish list natok` в YouTube — это шум нецелевых рынков. Отфильтровать его по гео средствами Suggest нельзя.
8. **Не проверялись:** Google Play в вебе с другим устройством (мобильная выдача может отличаться), Play Pass/редакционные подборки, App Store Today, а также платные инструменты объёма (Keyword Planner, Ahrefs, Semrush) — они требуют аккаунта, а регистрация запрещена правилами задания.

---

## 8. Источники

Все обращения — 2026-11-05.

**Google Trends**
- `https://trends.google.com/trends/explore?geo=US&q=wishlist,gift%20ideas` — 2026-11-05 — HTTP 429, данных нет.
- `https://trends.google.com/trends/explore?geo=GB&q=wishlist,gift%20ideas` — 2026-11-05 — HTTP 429, данных нет.
- `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=...` (тот же запрос через API страницы) — 2026-11-05 — HTTP 429.

**Google Suggest (автодополнение)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=US&q=wishlist` — 2026-11-05.
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=GB&q=wishlist` — 2026-11-05.
- Тот же шаблон для 24 сидов из раздела 1 в обоих гео: `q=gift`, `q=gift%20ideas`, `q=wish%20list`, `q=wish`, `q=present`, `q=birthday%20wishlist`, `q=gift%20registry`, `q=wishlist%20app`, `q=gift%20list`, `q=gift%20list%20app`, `q=gift%20ideas%20for%20him`, `q=gift%20ideas%20for%20her`, `q=christmas%20gift%20ideas`, `q=birthday%20gift%20ideas`, `q=baby%20registry`, `q=wedding%20registry`, `q=secret%20santa`, `q=gift%20exchange`, `q=christmas%20wishlist`, `q=presents`, `q=christmas%20presents`, `q=birthday%20presents`, `q=wedding%20gift%20list` — 2026-11-05.
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=US&q=wishparty` (и `wishmoon`, `wishie`, `wishlane`, `wishday`; `gl=GB` — те же) — 2026-11-05.

**YouTube-подсказки**
- `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=en&gl=US&q=wishlist` — 2026-11-05.
- То же с `ds=yt` для `gift ideas`, `gift list`, `wish list`, `secret santa`, в обоих гео — 2026-11-05.

**Google Play**
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=en&gl=US` — 2026-11-05.
- `https://play.google.com/store/search?q=wish%20list&c=apps&hl=en&gl=US` — 2026-11-05.
- `https://play.google.com/store/search?q=gift%20list&c=apps&hl=en&gl=US` — 2026-11-05.
- `https://play.google.com/store/search?q=gift%20ideas&c=apps&hl=en&gl=US` — 2026-11-05.
- `https://play.google.com/store/search?q=gift%20registry&c=apps&hl=en&gl=US` — 2026-11-05.
- `https://play.google.com/store/search?q=secret%20santa&c=apps&hl=en&gl=US` — 2026-11-05.
- Те же шесть запросов с `gl=GB` — 2026-11-05.
- Установки: `https://play.google.com/store/apps/details?id=com.gowish.app&hl=en&gl=US`, а также `com.happywishlist.app`, `com.giftful.Giftful`, `com.giftlist`, `com.ckbusiness.Wishlists`, `com.moonsift.wish.list.maker.christmas.birthday.baby.shopping.gift.list`, `com.Giftster.Giftster`, `com.thingstogetme.easygiftlist`, `com.trempette.family_gift_2`, `com.wishowl.app`, `moloapps.gifttracker`, `com.giftbuster`, `com.myregistry`, `com.xmaslist`, `com.meetrixonline.drawnames`, `com.elfster.elfdroid` — 2026-11-05.

**App Store (iTunes Search API)**
- `https://itunes.apple.com/search?term=wishlist&country=us&entity=software&limit=25` — 2026-11-05.
- `https://itunes.apple.com/search?term=wish%20list&country=us&entity=software&limit=25` — 2026-11-05.
- `https://itunes.apple.com/search?term=gift%20list&country=us&entity=software&limit=25` — 2026-11-05.
- `https://itunes.apple.com/search?term=gift%20ideas&country=us&entity=software&limit=25` — 2026-11-05.
- `https://itunes.apple.com/search?term=gift%20registry&country=us&entity=software&limit=25` — 2026-11-05.
- `https://itunes.apple.com/search?term=wish&country=us&entity=software&limit=25` — 2026-11-05.
- Те же шесть запросов с `country=gb` — 2026-11-05.

**Внутренние документы (только чтение)**
- `_bmad-output/research/naming/criteria.md` — 2026-11-05.
- `_bmad-output/research/naming/finalists-compare.md` — 2026-11-05.

ГОТОВО 1-en
