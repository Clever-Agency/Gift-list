# Поисковые паттерны подарков и вишлистов — рынок es

## 1. Шапка

| Параметр | Значение |
|---|---|
| Рынок | Испания (ES) и Мексика (MX) |
| Язык запросов | `hl=es`; гео в Suggest и Play — `gl=ES` / `gl=MX`; в App Store — `country=es` / `country=mx` |
| Дата прогона | 2026-11-05 |
| Модель | DeepSeek V4.1 Flash (OpenCode) |
| Задание | `4-es.md` (одно из шести рыночных заданий, сводка — `7-summary.md`) |
| Что сделано | 48 seed-запросов в Google Suggest (24 ES + 24 MX, из них 17 общих) → 465 подсказок; 10 запросов по именам финалистов; 2 попытки Google Trends; 12 поисковых выдач Google Play (6 ES, 4 MX, 2 по «Amigo invisible/secreto») + 26 карточек приложений для числа установок; iTunes Search API по 5 терминам в ES и 5 в MX; словарные и энциклопедические проверки (Wiktionary, Wikipedia); 2 ряда месячных просмотров Википедии как прокси сезонности |
| Что не сделано | Google Trends недоступен (HTTP 429, две попытки с интервалом ~20 минут) — индексов 0–100 и кривых сезонности из Trends нет, см. разделы 3 и 8 |
| Изменения в репозитории | Только этот файл. Ничего не покупалось, не регистрировалось, не логинилось, не коммитилось |

Все числа ниже — либо снятые с сервиса значения, либо подсчёт по снятым данным с указанием способа подсчёта. Абсолютных объёмов поиска (показов в месяц) в отчёте нет: Google Keyword Planner требует логина и рекламного аккаунта, поэтому не использовался.

Техническая оговорка: Suggest с `client=firefox` отдал строки без диакритики (`cumpleanos`, `ninos`, `bebe`), поэтому в таблицах подсказки сохранены как пришли. В названиях приложений диакритика сохранена.

---

## 2. Seed-запросы

Ядро из задания: `regalo`, `ideas de regalo`, `lista de deseos`, `lista de regalos`, `wishlist`, `deseo`.

**Модификаторы и поводы (ES, 24 запроса):** `regalo`, `ideas de regalo`, `ideas de regalos`, `lista de deseos`, `lista de regalos`, `wishlist`, `deseo`, `regalo cumpleaños`, `regalo navidad`, `regalo original`, `regalos personalizados`, `regalo para hombre`, `regalo para mujer`, `app para regalos`, `lista de deseos app`, `lista de regalos boda`, `lista de regalos bebe`, `wishlist app`, `que regalar`, `lista de deseos online`, `hacer lista de deseos`, `app lista de deseos`, `regalos de cumpleaños`, `deseos de cumpleaños`.

**MX:** те же 17 базовых плюс локальные поводы и ритейл: `regalo dia de reyes`, `regalo dia del amor y la amistad`, `lista de regalos liverpool`, `regalo posada`, `lista de regalos baby shower`, `regalo para mi novio`, `regalo navidad empresa`.

**Отдельно по именам финалистов:** `wishparty`, `wishmoon`, `wishie`, `wishlane`, `wishday` — в обоих гео (10 запросов, 60 подсказок: шесть ответов по 10 и четыре пустых, см. 4.10).

Итого: 48 запросов к Suggest по ядру и модификаторам (235 подсказок ES + 230 MX) и 10 запросов по именам. Из 48 запросов четыре — английские seed'ы (`wishlist`, `wishlist app` в каждом гео), остальные 44 — испаноязычные. Пустых ответов по ядру не было; пустыми пришли только два имени финалистов (`wishparty`, `wishmoon` — в обоих гео).

---

## 3. Google Trends

### 3.1 Что пробовали и что получили

| # | Запрос | Результат |
|---|---|---|
| 1 | `https://trends.google.com/trends/explore?geo=ES&hl=es&q=regalo,lista de deseos,lista de regalos,wishlist` | **HTTP 429** (антибот/капча Google) |
| 2 | Тот же запрос повторно через ~20 минут | **HTTP 429** снова |
| 3 | Trends для MX отдельным прогоном | Не пробовали: тот же хост и тот же лимит по IP; обход защиты (прокси, зеркала, смена IP) запрещён правилами задания |

Обе попытки зафиксированы как есть, защита не обходилась. Индексов 0–100, «похожих запросов» и сезонных кривых из Trends нет ни по одному термину — таблица 3.2 заполнена как «н/д (429)».

### 3.2 Таблица (как просили в задании)

| Термин | Индекс Trends, ES, 12 мес | Индекс Trends, MX, 12 мес | Похожие запросы | Сезонность |
|---|---|---|---|---|
| regalo | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — 3.3 |
| ideas de regalo | н/д (429) | н/д (429) | н/д | н/д |
| lista de deseos | н/д (429) | н/д (429) | н/д | н/д |
| lista de regalos | н/д (429) | н/д (429) | н/д | н/д |
| wishlist | н/д (429) | н/д (429) | н/д | н/д |
| deseo | н/д (429) | н/д (429) | н/д | н/д |

### 3.3 Косвенная замена Trends (помечено как прокси, не как объём поиска)

**(а) Просмотры статьи «Navidad» в испанской Википедии**, monthly, `es.wikipedia`, 2024-11 … 2026-10. Источник: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/Navidad/monthly/20241101/20261031` — 2026-11-05.

| Месяц | Просмотры | Месяц | Просмотры |
|---|---|---|---|
| 2024-11 | 102 791 | 2025-11 | 46 067 |
| **2024-12** | **229 287** | **2025-12** | **108 593** |
| 2025-01 | 27 467 | 2026-01 | 12 748 |
| 2025-02 | 9 163 | 2026-02 | 5 928 |
| 2025-03 | 9 686 | 2026-03 | 5 436 |
| 2025-04 | 8 046 | 2026-04 | 4 217 |
| 2025-05 | 8 118 | 2026-05 | 4 289 |
| 2025-06 | 6 627 | 2026-06 | 4 058 |
| 2025-07 | 6 060 | 2026-07 | 3 742 |
| 2025-08 | 6 339 | 2026-08 | 3 934 |
| 2025-09 | 9 097 | 2026-09 | 5 351 |
| 2025-10 | 22 100 | 2026-10 | 10 344 |

Декабрь к ноябрю: **+123 %** (2024) и **+136 %** (2025); январь падает к декабрю на **−88 %** (2025) и **−88 %** (2026). Минимум — июль-август. Октябрь уже вдвое выше сентября (+93 % в 2026) — сезонный разгон начинается в октябре. Это прокси: просмотры энциклопедической статьи, а не поисковый спрос, и масштаб несопоставим с поиском.

**(б) Статья «Regalo»** тем же API (`.../user/Regalo/monthly/20241101/20261031`, 2026-11-05): 2024-11 — 1 002, **2024-12 — 1 851**, 2025-01 — 780; 2025-11 — 252, **2025-12 — 517**, 2026-01 — 314; остальные месяцы 2025–2026 — 205…542. Направление то же (декабрьский пик, +85 % и +105 % к ноябрю), но база 200–500 просмотров в месяц — для выводов о спросе ряд слишком слабый.

**(в) Структурный признак сезонности из сторов.** Крупнейшие подарковые приложения испанского App Store — рождественские сервисы обмена подарками: «Amigo Invisible 22: ¿Sortealo!» — **32 972 оценки** (ES) и 19 024 (MX), «drawnames | Amigo Invisible» — 2 984 (ES) и **37 655** (MX, там он называется «Amigo Secreto»). Для сравнения: лучший вишлист в испанском App Store по запросу «lista de deseos» — Listful с 82 оценками, Wream — 339. То есть самый массовый «подарочный» сегмент рынка — не список желаний, а декабрьская жеребьёвка. Источники — таблицы раздела 5.

---

## 4. Автодополнение Google (Suggest API)

Метод: `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=<ES|MX>&q=<seed>`, ответ — JSON в UTF-8, 10 подсказок на запрос (иногда 8–9). Всего 465 подсказок по 48 запросам.

### 4.1 `lista de deseos` (ES)

| # | Подсказка |
|---|---|
| 1 | lista de deseos |
| 2 | lista de deseos en ingles |
| 3 | lista de deseos pelicula |
| 4 | lista de deseos xbox |
| 5 | lista de deseos amazon |
| 6 | lista de deseos netflix |
| 7 | lista de deseos cumpleanos |
| 8 | lista de deseos nintendo |
| 9 | lista de deseos play store |
| 10 | lista de deseos steam |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20deseos` — 2026-11-05.

**MX** (тот же seed, `gl=MX`): lista de deseos; lista de deseos pelicula; lista de deseos en ingles; lista de deseos xbox; **lista de deseos free fire**; lista de deseos amazon; **lista de deseos ff**; **lista de deseos xcaret mexico**; lista de deseos netflix; lista de deseos cumpleanos.

Разбор: из 9 подсказок без самого термина в ES **пять** — про игровые и медиасторы (xbox, netflix, nintendo, play store, steam), ещё по одной дают «pelicula», «en ingles» (перевод термина) и «amazon» (тоже вишлист магазина). Только одна («cumpleanos») — про подарок. В MX игровых три (xbox, free fire, ff), плюс медиа (netflix, pelicula) и парк Xcaret. То есть **«lista de deseos» в испаноязычном поиске в первую очередь означает вишлист цифрового магазина (Xbox, Steam, Nintendo, Netflix) или название фильма, а не список подарков**.

Дополнительно от seed'ов `lista de deseos app` и `app lista de deseos` (ES = MX, ответы идентичны): lista de deseos app; lista de deseos app store; lista de deseos apple; lista de deseos xbox app; mi lista de deseos app; lista de deseos ps app; app para lista de deseos; app para compartir lista de deseos; app para crear lista de deseos.

Это важный сдвиг: «app + lista de deseos» у половины подсказок уходит в **App Store / PS / Xbox**, то есть в приложения-магазины, а не в приложения-вишлисты. Живая часть — только три подсказки: `app para lista de deseos`, `app para compartir lista de deseos`, `app para crear lista de deseos`.

### 4.2 `lista de regalos` (ES)

| # | Подсказка |
|---|---|
| 1 | lista de regalos |
| 2 | lista de regalos para baby shower |
| 3 | lista de regalos de cumpleanos |
| 4 | lista de regalos stardew valley |
| 5 | lista de regalos para bebe |
| 6 | lista de regalos de boda |
| 7 | lista de regalos amazon |
| 8 | lista de regalos bebe |
| 9 | lista de regalos navidad |
| 10 | lista de regalos online |

Источник: `...&gl=ES&q=lista%20de%20regalos` — 2026-11-05.

**MX** отличается сильно: lista de regalos de despedida biblica; lista de regalos (сам термин); lista de regalos para baby shower biblico y su significado; **lista de regalos liverpool**; lista de regalos para baby shower; lista de regalos amazon; lista de regalos para baby shower religioso y su significado; lista de regalos para matrimonio; lista de regalos para baby shower y su significado; **lista de regalos mercado libre**.

Разбор: «lista de regalos» — единственный из двух «списочных» терминов с **подарочным** намерением: baby shower, день рождения, младенец, свадьба, Рождество, онлайн. В MX он вдобавок почти целиком занят **магазинными реестрами** (Liverpool, Amazon, Mercado Libre) и религиозным baby shower («biblico y su significado»). Это ровно та семантика «списка подарков к событию», которую в англоязычном мире называют registry.

От seed'ов `lista de regalos boda` и `lista de regalos bebe` (ES ≈ MX): boda-подсказки — cemaco, amazon, online, saga falabella, costa rica, el corte ingles, liverpool, boda civil, casa cuesta; bebe-подсказки — mundo, falabella, amazon, el corte ingles, paris, para bebe, recien nacidos, baby shower, nina. Практически весь список — **крупные ритейлеры**, то есть люди ищут реестр конкретной сети, а не приложение.

### 4.3 `regalo` и `regalos` (ES)

`regalo`: regalo original; regalos miguel; regalos; regalos personalizados; regalos revistas octubre 2026; regalos revistas septiembre 2026; regalos para hombres; regalos para mujer; regalos revistas diciembre 2026; regalo cachorros urgente.

`regalos` в MX (тот же seed, `gl=MX`): regalos; regalos para hombre; regalos de navidad; regalo de dios letra; regalos para mujer; **regalos virtuales**; regalo de dios; regalo de amor; regalos de cumpleanos; regalos para hombre cumpleanos.

Источники: `...&gl=ES&q=regalo`, `...&gl=MX&q=regalo` — 2026-11-05.

Разбор: «regalo» — слово дарителя и общий коммерческий термин. В ES верх выдачи занимают «original», «personalizados», подписные журналы и даже «regalos miguel» (цветочный магазин) — это подбор подарка, а не список желаний. В MX в верх добавляются «regalos virtuales» и «regalo de dios» (песня) — то есть запрос размывается виртуальными подарками (стриминговые/соцсетевые) и музыкой. **Ни одной подсказки про список желаний из seed'а «regalo» не приходит ни в ES, ни в MX** (проверено по всем 465 подсказкам: «lista de deseos» не встречается ни в одном ответе на seed без слова «deseo»).

### 4.4 `ideas de regalo(s)` (ES)

`ideas de regalo`: ideas de regalos; ideas de regalo para mujer; ideas de regalo para hombre; ideas de regalo para una amiga; ideas de regalos de cumpleanos; ideas de regalo para mi novio; ideas de regalos para bodas; ideas de regalos originales; ideas de regalos para tu mejor amiga; ideas de regalo de aniversario.

`ideas de regalos`: ideas de regalos; ideas de regalos de cumpleanos; ideas de regalos para mujer; ideas de regalos para hombres; ideas de regalos para amigas; ideas de regalos para bodas; ideas de regalos para novios; ideas de regalos para ninas de 12 anos; ideas de regalos personalizados; ideas de regalos originales.

MX: ideas de regalo para hombre; ideas de regalos; ideas de regalos para mi novio; ideas de regalos para mujer; ideas de regalos de cumpleanos; ideas de regalos para baby shower; ideas de regalos de cumpleanos para hombres; ideas de regalo sorpresa para quinceanera; ideas de regalo para una amiga; ideas de regalo para mama.

Разбор: кластер целиком про **дарителя** («что подарить маме/другу/девушке»), с возрастами и поводами. В MX добавляются baby shower и quinceañera — локальные поводы, которых нет в ES-топе.

### 4.5 `wishlist` (ES и MX — ответы почти идентичны)

| # | ES (`gl=ES`) | MX (`gl=MX`) |
|---|---|---|
| 1 | wishlist | wishlist |
| 2 | **wishlist que es** | **wishlist que es** |
| 3 | wishlist steam | wishlist amazon |
| 4 | wishlistr | wishlist taylor swift |
| 5 | wishlist app | wishlist mercado libre |
| 6 | wishlist pearl jam | wishlist pearl jam |
| 7 | wishlist amazon | wishlist cumpleanos |
| 8 | wishlist juego | wishlist steam |
| 9 | wishlist online | wishlist taylor |
| 10 | wishlist maker | wishlist xbox |

Источник: `...&q=wishlist` в обоих гео — 2026-11-05.

`wishlist app` в обоих гео — **чисто английская выдача, одинаковая для ES и MX**: wishlist app; wishlist apparel; wishlist app free; wishlist app shopify; wishlist apparel dress; wishlist application; wishlist app for family; wishlist app to share with friends; wishlist app reddit; wishlist app for couples.

Три наблюдения:

- **`wishlist que es`** («что такое wishlist») стоит вторым номером в обоих гео — язык сам признаёт, что слово заимствованное и непонятное. Для сравнения: у «lista de deseos» такой подсказки нет.
- В ES/MX «wishlist» приросло к **магазинам и музыке** (Steam, Amazon, Xbox, Taylor Swift, Pearl Jam), а не к подаркам. Единственная подарочная подсказка — `wishlist cumpleanos` в MX.
- **Ни один из 44 испаноязычных seed-запросов не дал подсказки с корнем `wish`.** Все 40 подсказок с `wish`/`wishlist` (20 ES + 20 MX) пришли ровно из двух английских seed'ов — `wishlist` и `wishlist app`. Обратный ход тоже не работает: на `wishlist` Google не подсказывает испанских форм вроде «lista de deseos».

### 4.6 `deseo` — занято сериалом, фильмом и парфюмом

ES: deseo netflix; deseo; deseo pelicula; deseo pelicula 2026; deseo netflix reparto; **deseo absoluto perfume**; deseo pelicula 2026 reparto; deseo 54; deseo vigo; deseo reparto.

MX: deseo; deseo netflix; deseo pelicula; deseo netflix reparto; **deseo o deceo** (как пишется); deseo pelicula 2026; deseo sin fin en la carretera; deseos de cumpleanos; deseos fab; deseo pelicula 2026 reparto.

Разбор: одиночное «deseo» в обоих гео — это название сериала/фильма на Netflix, парфюм «Deseo absoluto» и проверка орфографии («deseo o deceo»). Как ключ для вишлиста слово не работает. Родственный кластер `deseos de cumpleaños` — это **поздравления** («deseos de cumpleaños para una amiga», «para mi hermana»), а не список подарков: 10 подсказок в ES, 11 в MX.

Из 65 подсказок ES с корнем `deseo`: 45 — «lista de deseos», 10 — поздравления, 10 — сам seed «deseo» (сериал/фильм/парфюм).

### 4.7 Самые частые модификаторы (по всем 465 подсказкам)

Считалось как число подсказок, содержащих основу (подстрока по нормализованному тексту без диакритики; для `app` — по границе слова).

| Модификатор | ES (из 235) | MX (из 230) | Что значит |
|---|---|---|---|
| `regalo*` (regalo/regalos/regalar) | 140 | 145 | самая частая основа; но это запросы дарителя |
| `deseo*` | 65 | 55 | из них 45/35 — «lista de deseos», 10/11 — поздравления |
| `lista de deseos` | 45 | 35 | «списочный» термин №1 по подсказкам |
| `cumpleaños` | 37 | 32 | главный повод |
| `app` | 35 | 33 | но крепится к «virtuales», «xbox», «steam» |
| `lista de regalos` | 29 | 46 | в MX заметно сильнее (ритейл-реестры) |
| `bebe` / `baby shower` | 20 | 27 | третий по силе повод |
| `ideas de regalo` | 20 | 11 | подбор подарка дарителем |
| `wishlist` | 20 | 20 | **только из английских seed'ов** |
| `wish` (корень) | 20 | 20 | то же |
| `original` | 18 | 1 | «небанальный подарок» — сильная испанская тема |
| `boda` | 16 | 13 | свадьба |
| `para mujer` | 15 | 3 | адресат |
| `para hombre` | 14 | 5 | адресат |
| `personalizado` | 13 | 1 | гравировка/футболка с фото |
| `navidad` | 13 | 22 | в MX сильнее |
| `crear` / `hacer` | 13 | 5 | «создать список» |
| `online` | 12 | 10 | |
| `amazon` | 6 | 5 | чужая экосистема вишлистов |
| игровые сторы (steam/xbox/nintendo/play store/free fire) | 7 | 6 | **основное значение «lista de deseos»** |
| `pelicula` | 6 | 6 | второе значение того же запроса |
| `gratis` | 2 | 2 | |
| `compartir` | 2 | 2 | |
| `tiktok` | 1 | 1 | «app para enviar regalos falsos en tiktok» |
| `amigo invisible` / `amigo secreto` | 1 | 1 | почти не всплывает из seed'ов, но огромно в сторах |

Источник: агрегат по 48 запросам к `https://suggestqueries.google.com/complete/search?client=firefox&hl=es` — 2026-11-05.

**Честная оговорка о сравнении ES и MX.** Наборы seed'ов различались (в ES были `regalo original`, `regalos personalizados`, `regalo para hombre/mujer`, `ideas de regalos`, `regalos de cumpleaños`; в MX — локальные поводы). Поэтому по 17 общим seed'ам (по 145 подсказок в каждом гео) картина почти совпадает: `regalo*` 70/70, `lista de deseos` 35/35, `lista de regalos` 29/29, `wishlist` 20/20, `navidad` 13/13, `app` 34/33. Отличия в пределах общей выборки: `cumpleaños` 4/11, `bebe/baby` 16/18, `para hombre` 2/4, `para mujer` 2/2. Вывод: Google Suggest для испанского **сильно глобализован**, ES и MX различаются не лексикой ядра, а акцентами (в MX больше дней рождения, младенцев и локальных ритейлеров).

**Куда крепится `app`.** Из 68 подсказок со словом `app` ни одна не идёт от seed'а `regalo` или `lista de regalos`. Крепления три: (1) `app para regalos` — и там выдача **про виртуальные подарки и TikTok**, а не про вишлист: `app para regalos virtuales`, `app para enviar regalos falsos en tiktok`, `app para ganar regalos gratis`, `app para enviar regalos a domicilio`; (2) `lista de deseos + app` — про App Store, Xbox, PS; (3) `wishlist app` — чисто английская выдача. То есть **связки «приложение + список желаний» в испанском поиске практически нет**: люди ищут категорию по названию списка, а не по слову «app».

### 4.8 ES против MX: где рынки расходятся

| Признак | ES | MX |
|---|---|---|
| «Список подарков» | `lista de regalos` (29 подсказок) | `lista de regalos` заметно сильнее (46), почти весь — Liverpool / Amazon / Mercado Libre |
| Рождество | `amigo invisible`, `navidad` 13 | `amigo secreto`, `posada`, `dia de reyes`, `navidad` 22 |
| День рождения | `cumpleaños` 37 | `cumpleaños` 32 + `quinceanera`, `dia del amor y la amistad` |
| Младенец | `bebe` 20 | `bebe`/`baby shower` 27, много религиозных формулировок |
| Прочее | `regalo original`, `personalizado` | `regalos virtuales`, `regalo de dios` (музыка) |

Источники: те же URL Suggest с `gl=MX` — 2026-11-05. Отдельные MX-проверки: `regalo dia de reyes` (9 подсказок — подарок на 6 января, упаковочная бумага, подарочная карта и текст песни), `regalo dia del amor y la amistad` (10, все про 14 февраля), `regalo posada` (10 — декабрьские посиделки: «regalo chusco para posada», «regalo para posada navidena», плюс мемы), `lista de regalos liverpool` (8, все про универмаг Liverpool).

### 4.9 YouTube/Play-подсказки

Не снимались: по заданию — «только если открываются без логина», а Google Suggest уже дал полную картину по всем ядрам. Зафиксировано в разделе 8.

### 4.10 Подсказки по именам финалистов

| Seed | ES (`gl=ES`) | MX (`gl=MX`) | Чтение |
|---|---|---|---|
| `wishparty` | пусто, ни одной подсказки | пусто | спроса на имя нет ни в одном гео |
| `wishmoon` | пусто | пусто | спроса нет |
| `wishie` | **wishies, wishiwashi, wishiwashi pokemon, wishiwashi evolution, wishiwashi stats, wishiwashi pokemon go…** | wishies, wishlist, wish, wish you were here, wishmaster… | в ES автокоррекция уводит в **покемона Wishiwashi** (10 из 10 подсказок), в MX — в общее «wish» |
| `wishlane` | wishlane, **wishlane artist**, wishlane sunday, wishlane cheap talk, wishlane music, wishlane nobody's listening, wishlane medispa | то же | имя музыканта в обоих гео |
| `wishday` | wishday, **wishday yogurt griego**, **wishday app**, wishday font, wishday yogur, wishday ai, **shampoo wishday**, winter wishday | то же | в испаноязычном поиске имя уже занято **греческим йогуртом** и шампунем |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=<ES|MX>&q=<имя>` — 2026-11-05.

Практический смысл: у Wishparty и Wishmoon в испаноязычном мире нет ни брендового шума, ни спроса — имя придётся создавать с нуля, но оно ни на что не наталкивается. Wishie в Испании мгновенно превращается в покемона — это худший результат из пяти. Wishlane — имя музыканта. Wishday — йогурт и шампунь; для рынка это самый «занятый» из пяти.

---

## 5. Сторы

### 5.1 Google Play, ES (`hl=es&gl=ES`)

Установки сняты с отдельных карточек (`Descargas`), это округлённые диапазоны Google. В испанском интерфейсе Play пишет `100 mil+` (сто тысяч), `1 M+` (миллион), `10 mil+` (десять тысяч) — в таблицах переведено в те же величины.

**Запрос `lista de deseos`** — `https://play.google.com/store/search?q=lista%20de%20deseos&c=apps&hl=es&gl=ES` (2026-11-05)

| # | Название | Разработчик | Установок | Ключевое слово в названии |
|---|---|---|---|---|
| 1 | Giftful - Lista de deseos | Giftful | 100 000+ | Gift (en) + Lista de deseos |
| 2 | Wishlists - online wishlist | Christian Konnerth | 100 000+ | wishlist (en) |
| 3 | Wishlist Maker - Listful | Listful | 100 000+ | Wishlist (en) |
| 4 | Lista Deseos: Amigo Invisible | Kenji Sakai | 1 000 000+ | Lista de deseos + Amigo invisible |
| 5 | GiftList - Lista de Regalos | GiftList | 10 000+ | Gift + Lista de regalos |
| 6 | Giftster - Wish List Registry | MyGiftster Corporation | 100 000+ | Wish List (en) |
| 7 | Wishes: Lista de deseos | Wiheads ApS | 10 000+ | Wishes (en) + Lista de deseos |
| 8 | GoWish | Onskeskyen ApS | 1 000 000+ | Wish (en) |
| 9 | Wishlist Maker - Moonsift | MOONSIFT | 100 000+ | Wishlist (en) |
| 10 | Family Gift : lista de regalos | Trempette Inc. | 100 000+ | Gift + lista de regalos |

**Запрос `lista de regalos`** — `...?q=lista%20de%20regalos...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | GiftList - Lista de Regalos | GiftList | 10 000+ | Gift + Lista de regalos |
| 2 | Family Gift : lista de regalos | Trempette Inc. | 100 000+ | Gift + lista de regalos |
| 3 | Giftster - Wish List Registry | MyGiftster Corporation | 100 000+ | Wish List |
| 4 | Wishlist Maker - Listful | Listful | 100 000+ | Wishlist |
| 5 | Giftful - Lista de deseos | Giftful | 100 000+ | Gift + Lista de deseos |
| 6 | GiftTracker: Lista de Regalos | Leewrigg | 50 000+ | Gift + Lista de Regalos |
| 7 | Wishlists - online wishlist | Christian Konnerth | 100 000+ | wishlist |
| 8 | Wishlist Maker - Moonsift | MOONSIFT | 100 000+ | Wishlist |
| 9 | Amigo Invisible 22: ¿Sortealo! | Bocadil Infinite | 1 000 000+ | Amigo Invisible (жеребьёвка) |
| 10 | Lista Deseos: Amigo Invisible | Kenji Sakai | 1 000 000+ | Lista de deseos + Amigo invisible |

**Запрос `wishlist`** — `...?q=wishlist...`

| # | Название | Разработчик | Установок |
|---|---|---|---|
| 1 | Wishlists - online wishlist | Christian Konnerth | 100 000+ |
| 2 | Wishlist Maker - Listful | Listful | 100 000+ |
| 3 | GoWish | Onskeskyen ApS | 1 000 000+ |
| 4 | Giftful - Lista de deseos | Giftful | 100 000+ |
| 5 | GiftList - Lista de Regalos | GiftList | 10 000+ |
| 6 | Wishlist Maker - Moonsift | MOONSIFT | 100 000+ |
| 7 | Lista Deseos: Amigo Invisible | Kenji Sakai | 1 000 000+ |
| 8 | wantic: Wish List & Registry | Günther / Günther GbR | 5 000+ |
| 9 | Wishes: Lista de deseos | Wiheads ApS | 10 000+ |
| 10 | Wishr - Wishlist & Mood Board | wishr.com | 1 000+ |

**Запрос `regalo`** — `...?q=regalo...`

| # | Название | Разработчик | Установок |
|---|---|---|---|
| 1 | Regalos Segunda Mano | RSTU | 10 000+ (нерелевантно: объявления о бесплатных вещах) |
| 2 | Amigo Invisible 22: ¿Sortealo! | Bocadil Infinite | 1 000 000+ |
| 3 | GiftList - Lista de Regalos | GiftList | 10 000+ |
| 4 | drawnames \| Amigo Invisible | drawnames | 1 000 000+ |
| 5 | Family Gift : lista de regalos | Trempette Inc. | 100 000+ |
| 6 | Regalo | Lcom | 100+ |
| 7 | SodaGift - Earn, Save, Gift | Sodacrew Global Inc. | 100 000+ |
| 8 | Giftful - Lista de deseos | Giftful | 100 000+ |
| 9 | GiftTracker: Lista de Regalos | Leewrigg | 50 000+ |
| 10 | Mr.Wonderful - Regalos | Mr. Wonderful | 50 000+ (бренд открыток, не вишлист) |

**Запрос `ideas de regalo`** — `...?q=ideas%20de%20regalo...`

| # | Название | Разработчик | Установок |
|---|---|---|---|
| 1 | GiftList - Lista de Regalos | GiftList | 10 000+ |
| 2 | Amigo Invisible 22: ¿Sortealo! | Bocadil Infinite | 1 000 000+ |
| 3 | Family Gift : lista de regalos | Trempette Inc. | 100 000+ |
| 4 | Ideas de Regalos | Desarrollando Tendencias | 1 000+ |
| 5 | Surprising Gift Service | artrayd | 100 000+ |
| 6 | Regalos Segunda Mano | RSTU | 10 000+ |
| 7 | GiftTracker: Lista de Regalos | Leewrigg | 50 000+ |
| 8 | Lista de regalos - GiftX | PatStudio LLC | 10 000+ |
| 9 | Amigo Invisible: Sorteo Online | Flying Unicorn | 5 000+ |
| 10 | Giftster - Wish List Registry | MyGiftster Corporation | 100 000+ |

**Запрос `app para regalos`** — `...?q=app%20para%20regalos...`: GiftList (10 000+), drawnames (1 000 000+), Amigo Invisible 22 (1 000 000+), Regalos Segunda Mano (10 000+), Family Gift (100 000+), Giftster (100 000+), Surprising Gift Service (100 000+), SodaGift (100 000+), Giftful (100 000+), GiftTracker (50 000+). То есть по запросу «приложение для подарков» Play показывает **жеребьёвку Secret Santa и вишлисты**, а не «идеи подарков» — категория в сознании рынка всё-таки про список, а не про подбор.

### 5.2 Google Play, MX (`hl=es&gl=MX`)

**`lista de deseos`** — `https://play.google.com/store/search?q=lista%20de%20deseos&c=apps&hl=es&gl=MX` (2026-11-05)

| # | Название | Разработчик | Установок |
|---|---|---|---|
| 1 | Giftful - Lista de deseos | Giftful | 100 000+ |
| 2 | Wishlists - online wishlist | Christian Konnerth | 100 000+ |
| 3 | Lista Deseos: Amigo Invisible | Kenji Sakai | 1 000 000+ |
| 4 | GiftList - Lista de Regalos | GiftList | 10 000+ |
| 5 | Wishlist Maker - Listful | Listful | 100 000+ |
| 6 | Wishes: Lista de deseos | Wiheads ApS | 10 000+ |
| 7 | Giftster - Wish List Registry | MyGiftster Corporation | 100 000+ |
| 8 | Lista de deseos - Share a Wish | Northern Development | 10 000+ |
| 9 | Wishdo: lista de deseos | Andrei Romaha | 100+ |
| 10 | wantic: Wish List & Registry | Günther / Günther GbR | 5 000+ |

Остальные проверки MX дали тот же пул с перестановками: `lista de regalos` (GiftList, Giftster, Family Gift, Giftful, Wishlists, Listful, GiftTracker, drawnames 1 000 000+, Moonsift, Lista Deseos: Amigo Invisible), `wishlist` (те же + Share a Wish, wantic), `regalo` (drawnames 1 000 000+, SodaGift 100 000+, Amigo Invisible 22 1 000 000+, GiftTracker 50 000+, GiftList, Family Gift, Surprising Gift Service, Amigo Invisible: Sorteo Online 5 000+, Regalo 100+, **eGifter - Online Gift Cards** — установки не снято). Источники: те же URL с `gl=MX` — 2026-11-05.

**Рождественский сегмент, отдельная проверка:**

| ES, `q=amigo invisible` | MX, `q=amigo secreto` |
|---|---|
| Amigo Invisible 22: ¿Sortealo! (1 000 000+) | Sorteo Amigo Secreto (Central Dev) |
| Sorteo Amigo Secreto (Central Dev) | Amigo Invisible 22: ¿Sortealo! (1 000 000+) |
| drawnames \| Amigo Invisible (1 000 000+) | drawnames \| Amigo Invisible (1 000 000+) |
| Amigo invisible: sorteo facil (Nuvola Studio) | Amigo Invisible 2026 Sorteo (Zura Dev) |
| Amigo Invisible: Sorteo (drossan.com) | Amigo secreto: Secret Santa (Motecso) |
| Dedoman amigo invisible (Sergio Angel) | O Amigo Secreto: Sorteo (Marcel Piva) |

Установки для мелких приложений из этих двух выдач не снимались — они не нужны для вывода: топ-3 в обоих гео совпадает и держит миллионные установки.

### 5.3 App Store, ES (iTunes Search API)

`https://itunes.apple.com/search?term=<term>&country=es&entity=software&limit=25&lang=es_es` — 2026-11-05. iTunes не отдаёт установки; в колонке — `userRatingCount`, то есть **количество оценок**, не загрузок.

**`term=lista de deseos`** (25 результатов)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Listful - Wishlist Maker | Listful LLC | 82 |
| 2 | GoWish | Onskeskyen ApS | 245 |
| 3 | Wishbob - Lista de deseos | Caner Tankir | 193 |
| 4 | Giftful - Lista y registro | Giftful LLC | 70 |
| 5 | To do list - MinimaList | Inner Grow Limited | 1 041 (нерелевантно: список задач) |
| 6 | Wiset: Lista de Deseos Regalos | Leandro Gartner | 2 |
| 7 | Wishlist Maker - Wishdeck | WishDeck Software Inc. | 2 |
| 8 | **Wream: Tu Wishlist de Regalos** | WREAMAPP SL | 339 |
| 9 | Bring! Lista de compras | Bring! Labs AG | 19 624 (список покупок) |
| 10 | Wishlist Maker - Moonsift | Moonsift Limited | 12 |
| 11 | GiftList - Wishlist & Registry | Malibu Vista Ventures | 4 |
| 12 | Lista de la compra - Listonic | Listonic sp. z o.o. | 7 628 (список покупок) |

**`term=lista de regalos`** (25): Wishbob (193), GoWish (245), **HelloWish** (HELLOBB SL, 62), **drawnames | Amigo Invisible** (2 984), SmileBaby - Listas de regalos (15), Giftful (70), Family Gift (13), Wream (339), The Christmas Gift List (58), **Amigo Invisible 22: ¿Sortealo!** (32 972), Lista de Deseos y Regalos (2), Lista de Regalos: Presupuesto (0).

**`term=wishlist`** (22): Wishlists - online wishlist (241), GoWish (245), Sortd (5), Giftful (70), Listful (82), SpoilMe - Haz tu wishlist (36), Ohmywishes: listas de deseos (28), Shop: Sigue, paga y descubre (25 320 — Shopify), Wantd (9), Wream (339).

**`term=regalo`** (22): Amigo Invisible 22 (32 972), Udora: Flores & Regalos (165), drawnames (2 984), Wream (339), Intercambio de regalos (17), Lalalab - Impresión de fotos (16 229), Etsy (24 319), Weekendesk (173), Dinero App (26 406), Regalo (0).

**`term=deseo`** (24): верх — «Sex Dice: Explora Tus Deseos!», «Universo Deseo», «Querido Deseo», «La ley de la atracción: Metas», «DESEO VPN», «Pide un deseo - 24H Manifiesta». **Вишлистов в топе нет**; слово в App Store означает эзотерику, VPN и контент для взрослых.

### 5.4 App Store, MX (iTunes Search API)

`...&country=mx&lang=es_mx` — 2026-11-05.

**`term=lista de deseos`** (23)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Listful - Wishlist Maker | Listful LLC | 98 |
| 2 | GoWish | Onskeskyen ApS | 177 |
| 3 | Snapchat: Fotos con Amigos | Snap, Inc. | 81 844 (нерелевантно) |
| 4 | Wishbob - Lista de deseos | Caner Tankir | 7 |
| 5 | Giftful - Lista y registro | Giftful LLC | 152 |
| 6 | Lista de Deseos - Mara | AppLiks Sp. z O.O. | 1 |
| 7 | Google Keep - Notas y listas | Google LLC | 4 420 (нерелевантно) |
| 8 | Memo Bloc de Notas Adhesivas | Hive 5 Studio DOO | 2 975 (нерелевантно) |
| 9 | Todoist | Todoist Inc. | 6 882 (нерелевантно) |
| 10 | Reminder: Todo planner daily | Inner Grow Limited | 1 348 (нерелевантно) |
| 11 | Wishes - Lista de deseos | Wiheads ApS | 1 |
| 12 | Fight List - Categorias | Voodoo | 1 630 (нерелевантно) |

**Важное отличие MX:** в топе App Store по «lista de deseos» **6 из 12 позиций — обычные списки задач и заметки** (Snapchat, Keep, Memo, Todoist, Reminder, Fight List). В ES таких 3 из 12 (MinimaList, Bring!, Listonic). То есть в Мексике категория «список желаний» в App Store ещё не отделилась от «просто списка» — признак более низкой зрелости спроса.

**`term=lista de regalos`** (25): SmileBaby (0), **drawnames | Amigo Secreto** (37 655), Listful (98), Giftful (152), Lista de Regalos: Presupuesto (0), Wishbob (7), GoWish (177), Wishes (1), Lista de Deseos y Regalos (0), Wream (14), **Amigo Secreto 22: ¿Sortealo!** (19 024), Family Gift (5).

**`term=wishlist`** (23): Wishlists (184), GoWish (177), Sortd (3), Giftful (152), drawnames | Amigo Secreto (37 655), Listful (98), GiftList (1), Moonsift (4), iWish - Life Goals, Bucket List, Wishlist (10), SpoilMe (62), Reminder (1 348), Shop (57 873).

**`term=regalo`** (24): drawnames | Amigo Secreto (37 655), Amigo Secreto 22 (19 024), Intercambio de regalos (9 963), Enviaflores.com (28 049), Wishr: Ideas Regalo & Lista (4), Udora (4), Etsy (22 066), Poll Pay (65 490), Wantd - Deseos y regalos (3), Dinero App (20 369), Wream (14), Regalo (0).

**`term=deseo`** (24): «Sex Dice», «Querido Deseo», «Pide un deseo - 24H Manifiesta», Listful (98), «Universo Deseo», «Chica en el centro comercial», «Tarjetas de Cumpleaños Bonitas». Та же картина, что в ES: вишлистов в топе нет.

### 5.5 Какие корни доминируют в названиях

Подсчёт по **26 уникальным названиям** из выдач Play по десяти «подарочным» запросам (6 ES + 4 MX, топ-10 в каждом, дубликаты схлопнуты; два запроса про `amigo invisible`/`amigo secreto` в этот корпус не входят, о них — ниже).

| Корень в названии | Названий | Примеры |
|---|---|---|
| `wish` (англ.) | 10 | GoWish, Wishes, Wishdo, Wishr, wantic: Wish List |
| `gift` (англ.) | 9 | Giftful, GiftList, Giftster, GiftTracker, GiftX |
| `lista` (исп.) | 9 | Giftful - Lista de deseos, Lista Deseos: Amigo Invisible |
| `regalo` (исп.) | 8 | GiftList - Lista de Regalos, Ideas de Regalos, Regalo |
| `deseo` (исп.) | 5 | Wishes: Lista de deseos, Wishdo: lista de deseos |
| `amigo invisible` | 4 | drawnames \| Amigo Invisible, Amigo Invisible 22 |
| `wishlist` (подстрока) | 4 | Wishlists, Wishlist Maker, Wishr - Wishlist & Mood Board |
| `tracker` / `maker` / `registry` | 5 | Wishlist Maker, Wish List Registry, GiftTracker |
| ни `wish`, ни `gift` | 8 | drawnames, Regalo, Mr.Wonderful - Regalos, Ideas de Regalos, Amigo Invisible 22, Regalos Segunda Mano |

Два вывода по неймингу конкурентов:

1. **Английский бренд + испанский ключ через тире/двоеточие — состоявшаяся конвенция.** 8 из 26 названий построены так: «Giftful - Lista de deseos», «Wishes: Lista de deseos», «Wishdo: lista de deseos», «GiftTracker: Lista de Regalos», «Family Gift : lista de regalos», «Lista de regalos - GiftX», «Lista de deseos - Share a Wish», «GiftList - Lista de Regalos». При этом **склеенных в одно слово «wish+gift», как в Германии, почти нет — только Giftster**. То есть на испаноязычном рынке бренд оставляют латиницей, а ключ дописывают отдельным испанским словом — ровно то, что предписывает `criteria.md` (ключи в подзаголовок, не в имя).
2. **Корень `wish` в сторах сильнее испанских слов** (10 против 9 у `lista`), но это не испанский спрос, а глобальные бренды, локализованные подсказкой. Испанский ключ в названии почти всегда идёт **вторым**, после английского бренда.

Отдельно: в семи названиях из проверки Secret Santa **все семь** содержат «amigo invisible/secreto» или «sorteo» — рождественский сегмент почти целиком испаноязычный по неймингу; единственное исключение — «Amigo secreto: Secret Santa» с английским «Secret Santa» во второй половине.

---

## 6. Паттерны и выводы

### 6.1 Сводная таблица (задание 4.1)

| Термин | Индекс Trends (ES/MX) | Подсказки Google (из 465) | В названиях приложений (из 26) |
|---|---|---|---|
| regalo / regalos | н/д (429) | 140 ES / 145 MX | 8 |
| ideas de regalo(s) | н/д (429) | 20 / 11 | 1 («Ideas de Regalos») |
| lista de deseos | н/д (429) | 45 / 35 | 5 (в составе названий) |
| lista de regalos | н/д (429) | 29 / 46 | 4 |
| wishlist (en) | н/д (429) | 20 / 20 (только из английских seed'ов) | 4 |
| wish (en, корень) | н/д (429) | 20 / 20 | 10 |
| deseo | н/д (429) | 65 / 55 (из них 45/35 — «lista de deseos») | 5 |
| amigo invisible / secreto | н/д (429) | 1 / 1 (в подсказках), но топ сторов | 4 + весь рождественский сегмент |
| app | — | 35 / 33 | — |

### 6.2 Выводы

**1. Испаноязычный пользователь ищет вишлист словами `lista`, `regalo`, `deseo`, а не `wish`.** Из 44 испаноязычных seed-запросов ни один не дал подсказки с корнем `wish`; все 40 таких подсказок пришли из двух английских seed'ов. Но **два испанских «списочных» термина означают разное**:
- `lista de deseos` — то, что понимают все, но в поиске это в основном **вишлист магазина** (Xbox, Steam, Nintendo, Netflix, Amazon): 5 из 9 значимых подсказок в ES. Плюс есть подсказка «lista de deseos en ingles» — то есть люди уточняют перевод.
- `lista de regalos` — **подарочный** список к событию (baby shower, день рождения, свадьба, Рождество), но в MX он занят реестрами сетей (Liverpool, Amazon, Mercado Libre) и религиозным baby shower.

Для приложения «список желаний для друзей и семьи» точнее **`lista de regalos`**, а `lista de deseos` придётся отбивать у игровых магазинов в подзаголовке.

**2. `regalo` — слово дарителя, `lista` — слово владельца.** `regalo*` — самая частая основа (140/145 подсказок), но она почти всегда с адресатом и возрастом: «regalo para hombre 50 anos», «que regalar a una nina de 10 anos», «ideas de regalo para mi novio». Наш продукт по испанской лексике — **`lista de deseos` / `lista de regalos`**, а `regalo` — ключ для описания («crea tu lista de regalos»), не для имени.

**3. Английское `wishlist` на рынке понимают не все и не так.** Подсказка `wishlist que es` стоит второй в обоих гео; в испанской Википедии статьи «Wishlist» как понятия нет — есть статья про EP группы NCT Wish (`https://es.wikipedia.org/wiki/Wishlist`, 2026-11-05). В испанском Викисловаре статьи `wishlist` тоже нет (`https://es.wiktionary.org/wiki/wishlist`, 2026-11-05). При этом слово живёт в испанском сторе как бренд (Wishlists, Wishlist Maker, Wishr) и в ритейле. Вывод: **`wishlist` — узнаваемый, но не «свой» термин**; как ключ в подзаголовке он слабее «lista de deseos».

**4. Главные поводы — Рождество и день рождения; в MX добавляются Три короля, День любви и дружбы и посады.** По подсказкам: `cumpleaños` 37/32, `navidad` 13/22, `boda` 16/13, `bebe/baby shower` 20/27. По сторам: самый массовый подарковый сегмент — декабрьская жеребьёвка (`Amigo Invisible 22` — 32 972 оценки в ES, `drawnames` — 37 655 в MX). Прокси Википедии подтверждает декабрьский пик (+123…136 % к ноябрю) и разгон с октября. Точных коэффициентов сезонности нет — Trends отдал 429.

**5. Связки «приложение + список желаний» в испанском поиске нет.** 68 подсказок со словом `app`, и ни одна не приходит от seed'ов `regalo` или `lista de regalos` — только от `app para regalos` (про **виртуальные подарки и TikTok**), `lista de deseos app` (про App Store/PS/Xbox) и `wishlist app` (английская выдача). Значит, ASO в испаноязычных сторах строится не на «app para regalos», а на «lista de deseos» / «lista de regalos» / «amigo invisible» в подзаголовке.

**6. ES и MX — один язык, но разные поводы и разная зрелость категории.** На 17 общих seed'ах подсказки совпадают почти дословно (Google глобализует испанский), а расходятся в поводах: в MX сильнее день рождения, младенец, Три короля, День любви и дружбы, посады и ритейл Liverpool; в ES — «regalo original» и «personalizado». В App Store MX по «lista de deseos» 6 из 12 топ-позиций — обычные списки задач, в ES — 3 из 12. Категория в Мексике менее зрелая: там легче зайти, но и объяснять продукт придётся больше.

**7. Рождественский сегмент испаноязычный по неймингу.** Все семь названий из выдачи «amigo invisible»/«amigo secreto» содержат `amigo`/`secreto`/`sorteo`, английский корень есть только в одном («Amigo secreto: Secret Santa»). Это самый «свой» сегмент рынка: конкурентов с латинским брендом там нет, и по нему мы можем говорить на языке пользователя.

---

## 7. Влияние на финалистов (Wishparty, Wishmoon, Wishie, Wishlane, Wishday)

Общее для всех пяти: **имя на «Wish-» не даёт на рынке es ни ASO-, ни SEO-преимущества**, потому что испаноязычный пользователь набирает `lista de deseos`, `lista de regalos` или название бренда, а не «wish». Ключи всё равно уходят в подзаголовок стора, как требует `criteria.md`. Зато «Wish-» не мешает: конвенция «английский бренд + испанский ключ через тире» на рынке уже принята (8 из 26 названий).

| Финалист | Плюсы для es | Минусы и риски для es |
|---|---|---|
| **Wishparty** | В подсказках ES и MX имени нет вообще — ни брендового шума, ни чужой семантики; «party» в испанском узнают как «fiesta», ассоциация с праздником стыкуется с главными поводами (день рождения, Рождество, amigo invisible) | «Party» сужает до вечеринки и не говорит «список»; по-испански слово читается «güishparti» и на слух распадается на два английских куска; в подзаголовке всё равно нужен «lista de regalos» |
| **Wishmoon** | Подсказок нет ни в одном гео — имя чистое; произносится с первого раза (два простых слога) | «Moon» испанцу — не слово, а только звук: смысл «луна желаний» не читается; эзотерический оттенок слабее, чем в DE, но тоже возможен (в App Store ES по `deseo` верх — «Universo Deseo», «Pide un deseo - 24H Manifiesta»); семантически самое слабое для es |
| **Wishie** | Ласковый суффикс, короткое, легко набирается | **Худший результат из пяти в ES:** все 10 подсказок на `wishie` — покемон **Wishiwashi** («wishie» → «wishiwashi pokemon», «wishiwashi evolution»). В MX автокоррекция уводит в общее «wish»/«wishlist» — то есть имя не опознаётся как отдельное слово. Плюс в сторах уже есть Wishy, Wishes, Wishi |
| **Wishlane** | Нейтрально, ничего плохого не значит; в сторах ES/MX имени нет | В обоих гео подсказки — **музыкант** (`wishlane artist`, `wishlane music`, `wishlane sunday`); «lane» по-испански не читается (carril, callejón), остаётся транслитерация «вишлейн»/«уишлейн»; семантически пусто |
| **Wishday** | «Day» понятно, «день желаний» стыкуется с днём рождения — самым частым поводом ES (37 подсказок) | В испаноязычном поиске имя **уже занято**: `wishday yogurt griego`, `wishday yogur`, `shampoo wishday`, `wishday font`, `wishday app`. Для испанского пользователя «Wishday» — это в первую очередь йогурт, а не приложение; брендовый запрос будет размыт |

**Отдельный риск, общий для всех пяти (интерпретация, проверять на носителях):** в испанском Испании и Мексики нет отдельной фонемы [ʃ], а заимствования с «wi-» передаются через «güi-» — словарная форма whisky в испанском «güisqui» (`https://es.wiktionary.org/wiki/güisqui`, 2026-11-05: «castellanización de whisky», «grafía alternativa de whisky»). Поэтому «Wish…» на слух превращается в «güish…» или «uish…», а на письме — в «Güishparty», «Wuishday» и т. п. Риск не блокирующий (не непристойность), но реальный: услышав название, испанец может не найти приложение. Лечится точным написанием бренда в описании стора и подзаголовком с «lista de deseos».

**Что делать по итогам рынка es (для сводки 7-summary):**

1. Испанский подзаголовок строить вокруг **«Lista de deseos»** (для сценария «список для друзей и семьи») с добавкой **«Lista de regalos»** — второе точнее передаёт подарок к событию и лучше индексируется в MX. «Regalo» и «ideas de regalo» — в описание, для дарителя.
2. Для рождественского сезона (октябрь–декабрь) — отдельная строка с **«Amigo invisible»** (ES) / **«Amigo secreto»** (MX): это самый массовый подарковый сегмент стора, и по нему нет ни одного английского названия-конкурента.
3. В описание добавить фактические модификаторы спроса: `crear`, `compartir`, `online`, `gratis` — они встречаются в подсказках, но редко, то есть конкуренция за них низкая.
4. По неймингу для es преимущества нет ни у одного финалиста: все пять одинаково «английские» для этого рынка. Наименее рискованны **Wishparty** (нулевой шум, праздничная ассоциация) и **Wishmoon** (нулевой шум, но пустая семантика). **Wishie** в Испании опасен (покемон), **Wishday** занят йогуртом и шампунем, **Wishlane** — музыкантом.

---

## 8. Пробелы

1. **Google Trends недоступен.** Два обращения к `trends.google.com` вернули HTTP 429 (антибот). Индексов 0–100, «похожих запросов» и кривых сезонности из Trends нет. Повтор сделан один раз, как требует задание; защиту не обходили, прокси и зеркала не использовали. Следствие: сравнить `lista de deseos` и `lista de regalos` по относительному объёму нельзя — только по числу подсказок и названий в сторах.
2. **Абсолютных объёмов поиска нет ни у одного термина.** Google Keyword Planner требует логина и рекламного аккаунта — по правилам задания не использовался. Все «частоты» в отчёте — счётчики подсказок и названий, а не показы в месяц.
3. **Сезонность измерена только прокси.** Wikimedia Pageviews по статьям «Navidad» и «Regalo» — слабый индикатор (энциклопедические статьи, а не поисковый спрос), хотя направление совпадает со сторами. Точных коэффициентов декабрьского пика для поисковых запросов нет.
4. **Google Play не показывает установки в выдаче.** Числа сняты с 26 отдельных карточек; это округлённые диапазоны Google («100 mil+», «1 M+»), а не точные значения. Для 10 приложений (в основном мелкие из выдачи Secret Santa и `eGifter`) установки не снимались — помечено в таблицах.
5. **App Store не отдаёт установки.** В таблицах — количество оценок (`userRatingCount`), это не загрузки; сравнивать с Play по абсолютным числам нельзя. Оценки сильно занижены у испаноязычных приложений (Wream 339, Wishbob 193) и сильно завышены у глобальных (Snapchat 81 844).
6. **Suggest отдал строки без диакритики** (`cumpleanos`, `ninos`). Возможно, это особенность эндпоинта `client=firefox`, а не отражение того, как люди пишут. Формы сохранены как пришли; на подсчёты это не влияет (нормализация), но цитаты выглядят «без ñ».
7. **Сравнение ES и MX ограничено набором seed'ов.** Полные наборы различались (24 против 24, общих 17), поэтому сравнение по модификаторам сделано и по всем подсказкам, и по 17 общим seed'ам; второе надёжнее.
8. **YouTube/Play-подсказки не снимались** — по заданию «только если открываются без логина»; запросы на это не тратились, потому что Google Suggest дал картину по всем ядрам.
9. **Восприятие «wish» не проверено на носителях.** Что испанец прочитает «Wishparty» как «güishparti» — гипотеза, опирающаяся на словарную передачу «whisky → güisqui». Нужен опрос или транскрипционный тест.
10. **Личность «Wishday» как йогурта не подтверждена первоисточником.** Подсказки `wishday yogurt griego` и `wishday yogur` устойчивы в обоих гео, но бренд-владелец не проверялся: `wishday.es` не отвечает (DNS-ошибка), веб-поиск в этой сессии был недоступен. Факт в отчёте сформулирован как «по подсказкам имя занято йогуртом», а не «бренд X принадлежит Y».
11. **Реклама и кампании конкурентов не проверялись.** Есть только косвенный признак: в App Store ES по `deseo` верх занимают эзотерика и VPN, а по `regalo` — цветочные доставки и кэшбэк-приложения.
12. **Не проверялось**, как испаноязычные пользователи называют вишлист в разговорной речи (например, «mi lista» без уточнения) — для этого нужны форумы и соцсети, а они в эту сессию не снимались.

---

## 9. Список источников

Все — 2026-11-05.

**Google Suggest (ядро и модификаторы, `gl=ES`)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=ideas%20de%20regalo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=ideas%20de%20regalos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20deseos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20regalos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishlist`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=deseo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo%20cumplea%C3%B1os`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo%20navidad`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo%20original`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalos%20personalizados`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo%20para%20hombre`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalo%20para%20mujer`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=app%20para%20regalos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20deseos%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20regalos%20boda`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20regalos%20bebe`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishlist%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=que%20regalar`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=lista%20de%20deseos%20online`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=hacer%20lista%20de%20deseos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=app%20lista%20de%20deseos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=regalos%20de%20cumplea%C3%B1os`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=deseos%20de%20cumplea%C3%B1os`

**Google Suggest (`gl=MX`)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=ideas%20de%20regalo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20deseos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20regalos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=wishlist`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=deseo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20cumplea%C3%B1os`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20navidad`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=app%20para%20regalos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20deseos%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20regalos%20boda`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20regalos%20bebe`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=wishlist%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=que%20regalar`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20deseos%20online`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=app%20lista%20de%20deseos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=deseos%20de%20cumplea%C3%B1os`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20dia%20de%20reyes`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20dia%20del%20amor%20y%20la%20amistad`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20regalos%20liverpool`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20posada`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=lista%20de%20regalos%20baby%20shower`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20para%20mi%20novio`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=MX&q=regalo%20navidad%20empresa`

**Google Suggest (имена финалистов, ES и MX)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishparty` (пусто)
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishmoon` (пусто)
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishie`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishlane`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=es&gl=ES&q=wishday`
- те же пять с `gl=MX`

**Google Trends (недоступен)**
- `https://trends.google.com/trends/explore?geo=ES&hl=es&q=regalo,lista%20de%20deseos,lista%20de%20regalos,wishlist` — HTTP 429
- Тот же запрос повторно через ~20 минут — HTTP 429; Trends для MX отдельно не запрашивали (см. 3.1)

**Google Play**
- `https://play.google.com/store/search?q=lista%20de%20deseos&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=lista%20de%20regalos&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=regalo&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=ideas%20de%20regalo&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=app%20para%20regalos&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=lista%20de%20deseos&c=apps&hl=es&gl=MX`
- `https://play.google.com/store/search?q=lista%20de%20regalos&c=apps&hl=es&gl=MX`
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=es&gl=MX`
- `https://play.google.com/store/search?q=regalo&c=apps&hl=es&gl=MX`
- `https://play.google.com/store/search?q=amigo%20invisible&c=apps&hl=es&gl=ES`
- `https://play.google.com/store/search?q=amigo%20secreto&c=apps&hl=es&gl=MX`
- Карточки для установок: `https://play.google.com/store/apps/details?id=<id>&hl=es&gl=ES`, где `<id>` — `com.giftful.Giftful`, `com.ckbusiness.Wishlists`, `com.happywishlist.app`, `com.wishowl.app`, `com.giftlist`, `com.Giftster.Giftster`, `com.wiheads.wishes`, `com.gowish.app`, `com.moonsift.wish.list.maker.christmas.birthday.baby.shopping.gift.list`, `com.trempette.family_gift_2`, `moloapps.gifttracker`, `com.bocadil.amigoinvisible22`, `io.wantic.app`, `com.wishr.mobileapp`, `rstu.cosasgratis_alerts`, `com.meetrixonline.drawnames`, `com.lcom.regalo`, `com.sodacrew.sodagift`, `com.lluraferi.mrwonderful`, `com.developingtrends.giftideas`, `me.gifft.twa`, `giftx.tech`, `com.jeremieleroy.secretsanta`, `com.share.a.wish`, `io.wishdo.app`, `nod.wishbob`

**App Store (iTunes Search API)**
- `https://itunes.apple.com/search?term=lista%20de%20deseos&country=es&entity=software&limit=25&lang=es_es`
- `https://itunes.apple.com/search?term=lista%20de%20regalos&country=es&entity=software&limit=25&lang=es_es`
- `https://itunes.apple.com/search?term=wishlist&country=es&entity=software&limit=25&lang=es_es`
- `https://itunes.apple.com/search?term=regalo&country=es&entity=software&limit=25&lang=es_es`
- `https://itunes.apple.com/search?term=deseo&country=es&entity=software&limit=25&lang=es_es`
- `https://itunes.apple.com/search?term=lista%20de%20deseos&country=mx&entity=software&limit=25&lang=es_mx`
- `https://itunes.apple.com/search?term=lista%20de%20regalos&country=mx&entity=software&limit=25&lang=es_mx`
- `https://itunes.apple.com/search?term=wishlist&country=mx&entity=software&limit=25&lang=es_mx`
- `https://itunes.apple.com/search?term=regalo&country=mx&entity=software&limit=25&lang=es_mx`
- `https://itunes.apple.com/search?term=deseo&country=mx&entity=software&limit=25&lang=es_mx`

**Словари, энциклопедии, сезонность**
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/Navidad/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/es.wikipedia/all-access/user/Regalo/monthly/20241101/20261031`
- `https://es.wikipedia.org/wiki/Wishlist` — статья про EP группы NCT Wish (2026), не про список желаний
- `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=Amigo%20invisible&format=json` — «amigo invisible / amigo secreto / angelito: игра, в которой люди дарят друг другу подарки, не зная, кто кому»
- `https://es.wiktionary.org/wiki/wishlist` — статьи нет (слово не словарное)
- `https://es.wiktionary.org/wiki/g%C3%BCisqui` — «castellanización de whisky», «grafía alternativa de whisky»
- `https://es.wiktionary.org/wiki/regalo` — «cosa que se da de forma voluntaria y gratuita», синонимы obsequio, presente

ГОТОВО 4-es
