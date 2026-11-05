# Поисковые паттерны подарков и вишлистов — рынок pt-BR (Бразилия)

## 1. Шапка

| Параметр | Значение |
|---|---|
| Рынок | Бразилия (BR) |
| Язык запросов | `hl=pt-BR`; гео в Suggest и Play — `gl=BR`; в App Store — `country=br` |
| Дата прогона | 2026-11-05 |
| Модель | DeepSeek V4.1 Flash (OpenCode) |
| Задание | `5-pt.md` (одно из шести рыночных заданий, сводка — `7-summary.md`) |
| Что сделано | 41 seed-запрос в Google Suggest (36 по ядру и модификаторам + 5 по именам финалистов) → 307 подсказок; 4 запроса в YouTube-подсказки; 2 попытки Google Trends; 7 поисковых выдач Google Play (70 позиций, установки сняты со всех 70 карточек) + 5 выдач Play по именам финалистов; iTunes Search API по 7 терминам и 5 именам финалистов в BR; проверки в pt.wikipedia и pt.wiktionary; 4 ряда месячных просмотров Википедии как прокси сезонности |
| Что не сделано | Google Trends недоступен (HTTP 429, две попытки с интервалом ~40 минут) — индексов 0–100, «похожих запросов» и кривых из Trends нет, см. разделы 3 и 8 |
| Изменения в репозитории | Только этот файл. Ничего не покупалось, не регистрировалось, не логинилось, не коммитилось |

Все числа ниже — либо снятые с сервиса значения, либо подсчёт по снятым данным с указанием способа подсчёта. Абсолютных объёмов поиска (показов в месяц) в отчёте нет: Google Keyword Planner требует логина и рекламного аккаунта, поэтому не использовался.

Техническая оговорка: Google Suggest с `client=firefox` в части ответов отдал строки без диакритики (`cha de bebe`, `traducao`, `aniversario`), поэтому в таблицах подсказки сохранены как пришли. В названиях приложений диакритика сохранена.

---

## 2. Seed-запросы

Ядро из задания: `presente`, `ideias de presente`, `lista de desejos`, `lista de presentes`, `wishlist`, `desejo`.

**Модификаторы и поводы (36 запросов):** `presente`, `ideias de presente`, `lista de desejos`, `lista de presentes`, `wishlist`, `desejo`, `presente de aniversário`, `presente de natal`, `presente para namorada`, `presente para namorado`, `presente para mãe`, `presente para pai`, `ideias de presente de natal`, `app de lista de desejos`, `aplicativo lista de desejos`, `lista de desejos online`, `criar lista de desejos`, `lista de presentes casamento`, `lista de presentes chá de bebê`, `wishlist app`, `o que dar de presente`, `amigo secreto`, `lista de desejos mercado livre`, `presente personalizado`, `lista de desejos app`, `site de lista de desejos`, `app para presentes`, `aplicativo de presentes`, `lista de desejos aniversário`, `presente dia dos namorados`, `presente dia das mães`, `lista de desejos compartilhar`, `wish list`, `lista de desejos bebê`, `wishlist tradução`, `lista de desejos para imprimir`.

**Отдельно по именам финалистов:** `wishparty`, `wishmoon`, `wishie`, `wishlane`, `wishday` (5 запросов, `gl=BR`).

Итого 41 запрос к Suggest, 307 подсказок: 277 по ядру и модификаторам (35 непустых ответов из 36) и 30 по именам финалистов (из 5 запросов два — `wishparty`, `wishmoon` — вернули пустой ответ). Полностью пустым пришёл ещё один запрос — `lista de desejos bebê`; почти пустыми (по одной подсказке) — `lista de desejos aniversário`, `lista de desejos para imprimir` и `aplicativo lista de desejos`, то есть по узким формулировкам спроса почти нет.

Из 36 запросов по ядру три английские (`wishlist`, `wishlist app`, `wish list`) и один смешанный (`wishlist tradução`); остальные 32 — португальские.

---

## 3. Google Trends

### 3.1 Что пробовали и что получили

| # | Запрос | Результат |
|---|---|---|
| 1 | `https://trends.google.com/trends/explore?geo=BR&hl=pt-BR&q=presente,lista de desejos,lista de presentes,wishlist` | **HTTP 429** (антибот/капча Google) |
| 2 | `https://trends.google.com/trends/explore?geo=BR&hl=pt-BR&q=presente,lista de desejos,lista de presentes` — повтор через ~40 минут | **HTTP 429** снова |
| 3 | Trends за 5 лет отдельным прогоном | Не пробовали: тот же хост и тот же лимит по IP; обход защиты (прокси, зеркала, смена IP) запрещён правилами задания |

Обе попытки зафиксированы как есть, защита не обходилась. Индексов 0–100, «похожих запросов» и сезонных кривых из Trends нет ни по одному термину — таблица 3.2 заполнена как «н/д (429)».

### 3.2 Таблица (как просили в задании)

| Термин | Индекс Trends, BR, 12 мес | Индекс Trends, BR, 5 лет | Похожие запросы | Сезонность |
|---|---|---|---|---|
| presente | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — 3.3 |
| ideias de presente | н/д (429) | н/д (429) | н/д | н/д |
| lista de desejos | н/д (429) | н/д (429) | н/д | н/д |
| lista de presentes | н/д (429) | н/д (429) | н/д | н/д |
| wishlist | н/д (429) | н/д (429) | н/д | н/д |
| desejo | н/д (429) | н/д (429) | н/д | н/д |

### 3.3 Косвенная замена Trends (помечено как прокси, не как объём поиска)

**(а) Просмотры статьи «Natal» в португальской Википедии**, monthly, `pt.wikipedia`, 2024-11 … 2026-10. Источник: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/Natal/monthly/20241101/20261031` — 2026-11-05.

| Месяц | Просмотры | Месяц | Просмотры |
|---|---|---|---|
| 2024-11 | 15 102 | 2025-11 | 7 225 |
| **2024-12** | **50 030** | **2025-12** | **29 093** |
| 2025-01 | 8 472 | 2026-01 | 4 181 |
| 2025-02 | 2 290 | 2026-02 | 1 643 |
| 2025-03 | 2 977 | 2026-03 | 1 846 |
| 2025-04 | 2 521 | 2026-04 | 1 681 |
| 2025-05 | 2 151 | 2026-05 | 1 644 |
| 2025-06 | 2 003 | 2026-06 | 1 562 |
| 2025-07 | 1 954 | 2026-07 | 1 411 |
| 2025-08 | 1 967 | 2026-08 | 1 563 |
| 2025-09 | 2 081 | 2026-09 | 2 105 |
| 2025-10 | 3 296 | 2026-10 | 2 492 |

Декабрь к ноябрю: **+231 %** (2024) и **+303 %** (2025); январь падает к декабрю на **−83 %** (2025) и **−86 %** (2026). Минимум — июнь-август. Октябрь 2026 к сентябрю **+18 %**, то есть разгон начинается в октябре, но слабее, чем в испанском ряду «Navidad» (+93 % по отчёту `4-es-report.md`, 2026-11-05).

**(б) Другие подарочные поводы Бразилии** — тот же API (2026-11-05):

- **«Dia das Mães»** (День матери, второе воскресенье мая): 2025-04 — 14 759, **2025-05 — 60 975** (+313 %); 2026-04 — 20 107, **2026-05 — 42 212** (+110 %). Остальные месяцы 900–2 300.
- **«Dia dos Namorados»** (12 июня в Бразилии; статья охватывает и 14 февраля в других странах): **2025-02 — 74 195**, 2025-05 — 13 672, **2025-06 — 47 917** (+250 %); **2026-02 — 60 393**, 2026-05 — 8 836, **2026-06 — 56 674** (+541 %). Февральский пик относится к международному 14 февраля и к бразильской дате не привязан; разделить два повода по этому ряду нельзя.
- **«Amigo secreto»** (тайный Санта): 2024-11 — 1 879, **2024-12 — 4 404** (+134 %); 2025-11 — 1 208, **2025-12 — 1 695** (+40 %); в остальные месяцы 60–280.

Вывод по прокси: у Бразилии **не один подарочный пик, а три** — май (День матери), июнь (День влюблённых) и декабрь (Рождество + amigo secreto). Это отличает рынок от Испании, где ряд «Navidad» даёт один доминирующий декабрьский пик (отчёт `4-es-report.md`, 2026-11-05). Прокси слабый: это просмотры энциклопедических статей, а не поисковый спрос.

---

## 4. Автодополнение Google (Suggest API)

Метод: `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=<seed>`, ответ — JSON в UTF-8, до 10 подсказок на запрос. Всего 307 подсказок по 41 запросу.

### 4.1 `lista de desejos` — вишлист цифрового магазина и название фильма

| # | Подсказка |
|---|---|
| 1 | lista de desejos |
| 2 | lista de desejos xbox |
| 3 | lista de desejos para superagüi |
| 4 | lista de desejos ff |
| 5 | lista de desejos em ingles |
| 6 | lista de desejos amazon |
| 7 | lista de desejos estacio |
| 8 | lista de desejos filme |
| 9 | lista de desejos steam |
| 10 | lista de desejos shopee |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos` — 2026-11-05.

Разбор: из 9 подсказок без самого термина **три** — про игровые сторы (xbox, `ff` = Free Fire, steam), **две** — про магазины (amazon, shopee), одна («em ingles») говорит о том, что люди уточняют перевод, одна («filme») — про кино, одна («estacio») — про вуз, и одна («para superagüi») — про бразильский документальный фильм «Lista de Desejos para Superagüi» (статья есть в pt.wikipedia, см. 4.10). Ни одной подарочной подсказки у этого seed'а нет. То есть **`lista de desejos` в бразильском поиске — это прежде всего вишлист магазина или игры, а не список подарков**.

Дополнительно от seed'ов `lista de desejos app` (8 подсказок) и `criar lista de desejos` (10): `lista de desejos app store`, `lista de desejos app xbox`, `lista de desejos ps app`, `lista de desejos kindle app`, `como ver lista de desejos no kindle app`, `app para fazer lista de desejos`; `criar lista de desejos ff`, `criar lista de desejos shopee`, `criar lista de desejos amazon`, `criar lista de desejos online`, `como criar lista de desejos no pokemon tcg pocket`, `como criar lista de desejos na shein`, `como criar lista de desejos na temu`, `site para criar lista de desejos`. Здесь «создать список желаний» — это действие **внутри чужого магазина** (Shopee, Amazon, Shein, Temu, Pokémon TCG), а не в отдельном приложении.

### 4.2 `lista de presentes` — реестр подарков, занятый ритейлом

| # | Подсказка |
|---|---|
| 1 | lista de presentes havan |
| 2 | lista de presentes de casamento |
| 3 | lista de presentes |
| 4 | lista de presentes cha de casa nova |
| 5 | lista de presentes magalu |
| 6 | lista de presentes cha de bebe |
| 7 | lista de presentes stardew valley |
| 8 | lista de presentes de aniversário |
| 9 | lista de presentes casamento havan |
| 10 | lista de presentes online |

Источник: `...&q=lista%20de%20presentes` — 2026-11-05.

Разбор: **подарочное** намерение здесь есть — casamento (свадьба), chá de bebê (детский «чай», аналог baby shower), chá de casa nova (новоселье), aniversário (день рождения), online. Но три позиции из десяти в топе — **крупные сети**: Havan (универмаг, две подсказки) и Magalu (Magazine Luiza). Дальше по seed'ам `lista de presentes casamento` и `lista de presentes chá de bebê` идут Casas Bahia, Shopee, Mercado Livre, Amazon, «casamento divertida», «casamento engraçada», «chá de bebê virtual/gratis/para imprimir». То есть `lista de presentes` — ровно та семантика «списка подарков к событию», которую в англоязычном мире называют registry, и она уже поделена между ритейлерами и свадебными платформами.

`stardew valley` в топе — игра, где есть механика подарков; это шум, но он показывает, что термин живёт и в игровом контексте.

### 4.3 `presente` и `ideias de presente` — слово дарителя

`presente`: presente dia dos pais; presente; presente dia dos professores; presente dia das crianças; presente para homem; presente para o dia dos pais; presente de casamento; presente de aniversário; **presente diario**; presentes.

`ideias de presente`: ideias de presente dia dos pais; ideias de presente; ideias de presente para namorado; ideias de presente dia dos professores; ideias de presente para amiga; ideias de presente para homem; ideias de presente dia das crianças; ideias de presente de aniversário; ideias de presente de casamento; ideias de presente para professora.

Источники: `...&q=presente`, `...&q=ideias%20de%20presente` — 2026-11-05.

Разбор: `presente` — слово **дарителя** и общий коммерческий термин. Верх выдачи — календарные поводы (День отца, День учителя 15 октября, День детей 12 октября), адресаты (para homem), и «presente diario» — религиозный ежедневник (devocional), то есть не подарок. `ideias de presente` — целиком подбор подарка («что подарить»), с поводами и адресатами, без единой подсказки про список.

**Ни одной подсказки про список желаний из seed'ов `presente` и `ideias de presente` не приходит** (проверено по всем 277 подсказкам: слово `lista` не встречается ни в одном ответе на эти seed'ы).

### 4.4 `wishlist` — слово известно, но означает музыку

| # | Подсказка |
|---|---|
| 1 | wishlist |
| 2 | **wishlist o que é** |
| 3 | wishlist pearl jam |
| 4 | wishlist amazon |
| 5 | wishlist taylor |
| 6 | wishlist steam |
| 7 | wishlist taylor swift |
| 8 | **wishlist ou wish list** |
| 9 | wishlist xbox |
| 10 | wishlist app |

Источник: `...&q=wishlist` — 2026-11-05.

`wish list` (два слова) даёт почти то же: wish list; **wish list tradução**; wish list taylor swift; wish list taylor; wish list taylor swift tradução; **wish list ou wishlist**; wish list amazon; **wish list significado**; wish list letra; wish list pearl jam.

`wishlist tradução` — 10 из 10 подсказок про перевод, из них минимум пять — тексты песен (Pearl Jam, Taylor Swift, TXT), остальные — переводы словосочетаний («my wishlist», «boys wishlist», «travel wishlist»).

Три наблюдения:

- **`wishlist o que é`** («что такое wishlist») стоит вторым номером — язык сам признаёт слово заимствованным. Плюс отдельные подсказки `wish list significado`, `wish list tradução`, `wishlist ou wish list` (как писать). У `lista de desejos` такой подсказки нет.
- «Wishlist» в Бразилии приросло к **музыке** (Pearl Jam — песня «Wishlist», сингл 5 мая 1998 года из альбома Yield, `https://en.wikipedia.org/wiki/Wishlist_(song)` — 2026-11-05; Taylor Swift) и к магазинам (Amazon, Steam, Xbox), а не к подаркам. Ни одной подарочной подсказки у seed'а `wishlist` нет.
- **Ни один из 32 португальских seed-запросов не дал подсказки с корнем `wish`.** Все 40 подсказок с `wish`/`wishlist` пришли ровно из четырёх английских seed'ов. Обратный ход тоже не работает: на `wishlist` Google не подсказывает португальских форм вроде «lista de desejos».

### 4.5 `desejo` — сериалы, песни и взрослый контент

`desejo`: desejo de menina; desejo; desejo e reparação; desejo filme; desejo sombrio; desejo proibido; desejo fatal; desejos ocultos; desejo de matar 1; desejo netflix.

Источник: `...&q=desejo` — 2026-11-05.

Разбор: одиночное `desejo` — это название фильма («Desejo e Reparação» — «Atonement»), сериала/новеллы («Desejo Proibido», «Desejos Ocultos»), группы («Desejo de Menina») и криминального триллера («Desejo de Matar» — «Death Wish»). Как ключ для вишлиста слово не работает. Кластера «desejos de aniversário» (поздравления) в BR-топе нет — в отличие от испанского рынка, где он занимает 10–11 подсказок (отчёт `4-es-report.md`, 2026-11-05).

### 4.6 Самые частые модификаторы (по 277 подсказкам ядра)

Считалось как число подсказок, содержащих основу (подстрока по тексту без диакритики; для коротких форм — по границе слова). Набор seed'ов влияет на счёт: 10 из 36 запросов начинаются со слова `presente`, поэтому `presente*` завышен по построению.

| Модификатор | Подсказок | Что значит |
|---|---|---|
| `presente*` (presente/presentes) | 171 | самая частая основа; но это запросы дарителя |
| `lista` (слово) | 81 | «списочная» лексика |
| `desejo*` | 56 | из них 46 — «lista de desejos», остальное — фильмы и песни |
| `lista de desejos` | 46 | «списочный» термин №1 по подсказкам |
| `presentes` (мн. ч.) | 42 | |
| `lista de presentes` | 35 | |
| `wishlist` | 31 | **только из английских seed'ов** |
| `app` | 27 | крепится к магазинам и к «app para presentes» |
| `ideias de presente` | 23 | подбор подарка дарителем |
| `casamento` | 21 | свадьба — главный повод «списка подарков» |
| `natal` | 20 | Рождество |
| `aniversário` | 19 | день рождения |
| `namorado` | 15 | адресат |
| `bebê` | 13 | младенец |
| `personalizado` | 13 | гравировка, фото, ручная работа |
| `chá de` (bebê / casa nova / cozinha) | 12 | бразильские «чая»-поводы |
| `tradução` / `significado` | 12 | уточнение значения заимствований |
| `wish` (отдельное слово) | 11 | из английских seed'ов |
| `namorada` | 11 | адресат |
| `dia dos namorados` | 10 | 12 июня |
| `dia das mães` | 10 | май |
| `mãe` / `pai` | 10 / 10 | адресаты |
| `online` | 10 | |
| `homem` | 9 | адресат |
| `compartilhar` | 7 | «поделиться списком» |
| `criativo` | 7 | «небанальный подарок» |
| `como` (как сделать) | 7 | инструкции «как создать список в …» |
| `mercado livre` | 7 | ритейлер |
| `taylor` | 7 | музыка |
| `amazon` / `shopee` | 6 / 6 | ритейлеры |
| `havan` | 5 | сеть универмагов |
| `barato` | 5 | |
| `xbox` / `steam` / `kindle` | 4 / 3 / 2 | игровые и медиасторы |
| `stardew` | 2 | игра |
| `shein` / `temu` | 2 / 1 | маркетплейсы |
| `em ingles` | 2 | уточнение перевода |
| `amigo secreto` | 10 | но это отдельный seed, не из ядра |

Источник: агрегат по 36 запросам к `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR` — 2026-11-05.

**Куда крепится `app`.** Из 27 подсказок со словом `app` ни одна не идёт от seed'а `presente` или `ideias de presente`. Крепления три: (1) `app para presentes` и `app para lista de presentes` — и там выдача про **свадебные списки и «подарки на праздник»** (`app para presentes de casamento`, `app para criar lista de presentes`, `app para sugestões de presentes`), плюс одна мусорная `app para ganhar presentes`; (2) `lista de desejos + app` — про App Store, Xbox, PS, Kindle; (3) `wishlist app` — чисто английская выдача (`wishlist apparel`, `shopify app wishlist`, `wishlist app for couples`). То есть **связка «приложение + список подарков» на pt-BR существует и она про свадьбу**, а связка «приложение + список желаний» уводит в магазины приложений.

### 4.7 Сезонные и календарные поводы в подсказках

Отдельные seed'ы под бразильский календарь (2026-11-05):

| Seed | Верхние подсказки | Чтение |
|---|---|---|
| `presente dia dos namorados` | para homem, para namorada, para mulher, personalizado, virtual, online, feito a mão, criativo | 12 июня — крупный повод, отдельный от Рождества; треть подсказок про «сделай сам» и «персонализированное» |
| `presente dia das mães` | criativo, criativo e barato, ideias, personalizado, «criativo de papel», 2026, **cacau show**, **boticário**, mercado livre | май; в топе — сети шоколада и косметики |
| `presente de natal` | para criança, para namorado, **para funcionários**, filme, para mulher, «para funcionários barato», desenho | декабрь; сильный корпоративный сегмент (подарки сотрудникам) |
| `ideias de presente de natal` | para família, **para funcionarios**, para namorado, barato, para crianças, **para equipe**, feminino, **para colegas de trabalho**, **para colaboradores** | Рождество в Бразилии — ещё и корпоративный ритуал (4 из 10 подсказок про коллег и сотрудников) |
| `presente de aniversário` | para namorado, para mãe, para esposa, para amiga, para homem, para marido, para pai, de casamento | день рождения — универсальный повод |
| `o que dar de presente` | de casamento, para namorado, de dia dos pais, para uma amiga, «para uma menina de 15 anos», «para uma criança de 1 ano», «para uma menina de 10 anos», para homem | вопрос дарителя с возрастом и полом |
| `amigo secreto` | online, das cores, «é uma brincadeira tradicional nas festas de fim de ano», stardew valley, diferente, filme, sorteio online, em ingles, sorteio | декабрьская жеребьёвка: 3 из 10 подсказок — про жеребьёвку онлайн (`sorteio`), остальное — правила игры, «другой» вариант, фильм, игра Stardew Valley и перевод |

### 4.8 Подсказки YouTube (открываются без логина)

Метод: `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=pt-BR&gl=BR&q=<seed>` — 2026-11-05.

| Seed | Подсказки (сокращённо) | Чтение |
|---|---|---|
| `lista de desejos` | lista de desejos ff; lista de desejos; lista de desejos para superagui; lista de desejos atualizada ff; lista de desejos mais raras do free fire; afk arena; free fire; afk journey; estacio; pokemon tcg pocket; play store; dead island 2; ps5; filme | **9 из 14** — игры: Free Fire (4 подсказки), AFK Arena/Journey, Pokémon TCG, Dead Island 2, PS5; ещё одна (`play store`) — про магазин приложений. На YouTube термин почти полностью игровой |
| `lista de presentes` | de casamento; lista de presentes; google forms; casar.com; online; **icasei**; **magazine luiza**; mercado livre; havan; amazon; cha de cozinha; **prisminha**; cha de casa nova; de casamento online | свадебные реестры и сети; «google forms» — люди собирают список вручную в таблице |
| `ideias de presente` | feitos a mao; para o dia das maes; de aniversario; para o dia dos pais; ideias de presente; de dia das maes; para namorado; dia dos namorados; ... | подбор подарка, «ручная работа», календарные поводы |
| `wishlist` | taylor swift; pearl jam; wishlist; taylor swift traducao; taylor swift acoustic; pearl jam legendado; subliminal; x endgame; txt; traducao; lyrics; **notion**; karaoke | музыка и «wishlist в Notion» — то есть люди ведут список в заметках, а не в приложении |

YouTube-подсказки подтверждают две вещи: **«lista de desejos» на рынке — игровой термин**, а **«lista de presentes» — свадебно-ритейловый**; приложения-вишлисты в этой лексике не видны вообще.

### 4.9 Подсказки по именам финалистов (BR)

| Seed | Подсказки | Чтение |
|---|---|---|
| `wishparty` | пусто, ни одной подсказки | спроса на имя нет |
| `wishmoon` | пусто | спроса нет |
| `wishie` | wish, wishes, wishin, wish you were here, wish you were here tradução, wishlist, wish natal, **wish foz do iguaçu**, wish you were here cifra, **wish serrano gramado** | автокоррекция уводит в общее «wish» и в песню Pink Floyd; «wish» в Бразилии — ещё и часть названий отелей (Wish Foz do Iguaçu, Wish Serrano Gramado); принадлежность не проверялась |
| `wishlane` | wishlane, wishlane artist, wishlane sunday, wishlane cheap talk, wishlane music, wishlane nobody's listening, **wishlane medispa**, wishlane look at me, wishlane appleton, wishlane aesthetics | имя музыканта |
| `wishday` | wishday, **wishday app**, wish day tradução, **wishday significado**, **wishday ai**, wishday font, **yogurt wishday**, winter wishday, **shampoo wishday**, wishday とは | имя уже занято: йогурт, шампунь, шрифт, приложение |

Источник: `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=<имя>` — 2026-11-05.

Практический смысл: у Wishparty и Wishmoon в бразильском поиске нет ни брендового шума, ни спроса. Wishie не опознаётся как слово и распадается на «wish». Wishlane — музыкант. Wishday — йогурт и шампунь, причём в BR-поиске даже появилась подсказка `wishday significado` («что значит wishday»), то есть люди ищут значение чужого бренда.

### 4.10 Словарные и энциклопедические проверки

| Проверка | Результат |
|---|---|
| `https://pt.wikipedia.org/w/api.php?action=query&titles=Lista%20de%20desejos` | страницы нет (`missing`) — понятие «список желаний» в португальской Википедии не описано |
| `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=lista%20de%20desejos` | первый результат — **«Lista de Desejos para Superagüi»**, бразильский документальный фильм; дальше — списки эпизодов и монархов |
| `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=amigo%20secreto` | статья «Amigo secreto»: «brincadeira tradicional das festividades de fim de ano, como Natal» |
| `https://pt.wiktionary.org/w/api.php?action=parse&page=wishlist` | статья **есть**, но помечена как английское слово: `={{-en-}}=`, «Uma lista de coisas desejadas», вариант написания — `wish list`. То есть португальский Викисловарь признаёт слово, но как заимствование |
| `https://pt.wiktionary.org/w/api.php?action=query&titles=presente` и `desejo` | статьи есть; машинный экстракт пустой (структура страниц), содержание не снималось |

---

## 5. Сторы

### 5.1 Google Play, BR (`hl=pt-BR&gl=BR`)

Установки сняты с отдельных карточек (`downloads`), это округлённые диапазоны Google. В португальском интерфейсе Play пишет `100 mil+` (сто тысяч), `1 mi+` (миллион), `10 mil+` (десять тысяч) — в таблицах переведено в те же величины.

**Запрос `lista de desejos`** — `https://play.google.com/store/search?q=lista%20de%20desejos&c=apps&hl=pt-BR&gl=BR` (2026-11-05)

| # | Название | Разработчик | Установок | Ключевое слово в названии |
|---|---|---|---|---|
| 1 | Wishlists - online wishlist | Christian Konnerth | 100 000+ | wishlist (en) |
| 2 | Wishdo: lista de desejos | Andrei Romaha | 100+ | Wish (en) + lista de desejos |
| 3 | Wishlist Maker - Listful | Listful | 100 000+ | Wishlist (en) |
| 4 | Wishlist Maker - Moonsift | MOONSIFT | 100 000+ | Wishlist (en) |
| 5 | Wishes: Lista de desejos | Wiheads ApS | 10 000+ | Wishes (en) + Lista de desejos |
| 6 | wantic: Wish List & Registry | Günther / Günther GbR | 5 000+ | Wish List (en) |
| 7 | Wishlists & Gifts - WishOwl | Kenji Sakai | 1 000+ | Wish + Gifts (en) |
| 8 | GiftList - Wishlist & Registry | GiftList | 10 000+ | Gift + Wishlist (en) |
| 9 | Family Gift:Lista de Presentes | Trempette Inc. | 100 000+ | Gift (en) + Lista de Presentes |
| 10 | Wishr - Wishlist & Mood Board | wishr.com | 1 000+ | Wish + Wishlist (en) |

**Запрос `lista de presentes`** — `...?q=lista%20de%20presentes...`

| # | Название | Разработчик | Установок | Ключевое слово |
|---|---|---|---|---|
| 1 | MyWishlist: Lista de Presentes | Grace Labs Tecnologia | 1 000+ | Wishlist + Lista de Presentes |
| 2 | Lista Ideal – Presentes Online | Lista Ideal | 10 000+ | Lista + Presentes |
| 3 | Simplista \| Lista de Presentes | Simplista | 5 000+ | Lista de Presentes |
| 4 | Lista de Presentes Havan | Havan | 100 000+ | Lista de Presentes (ритейлер) |
| 5 | iCasei \| Lista de Casamento | iCasei - Sites de Casamento | 1 000 000+ | Lista de Casamento (свадьба) |
| 6 | Family Gift:Lista de Presentes | Trempette Inc. | 100 000+ | Gift + Lista de Presentes |
| 7 | ListaPresentes | -EasyApps | 10 000+ | ListaPresentes |
| 8 | Amigo Secreto 22 - Sorteio | Bocadil Infinite | 1 000 000+ | Amigo Secreto (жеребьёвка) |
| 9 | Lejour - Lista de Casamentos | Lejour | 100 000+ | Lista de Casamentos |
| 10 | Meus Convidados | Leandro Fogaça | 5 000+ | (список гостей, не подарки) |

**Запрос `wishlist`** — `...?q=wishlist...`: Wishlists (100 000+), Listful (100 000+), GiftList (10 000+), Moonsift (100 000+), **GoWish (1 000 000+)**, Share a Wish (10 000+), WishOwl (1 000+), wantic (5 000+), Giftful (100 000+), Wishr (1 000+). Выдача почти совпадает с `lista de desejos` — те же международные приложения, порядок другой.

**Запрос `presente`** — `...?q=presente...`: **Vale Presente** (500 000+, кошелёк подарочных карт, `br.com.socialbank.android.wallet`), Presente (Fondo de Empleados Presente, CO, 50 000+), Amigo Secreto 22 (1 000 000+), Simplista (5 000+), MyWishlist (1 000+), Family Gift (100 000+), Presente (Bunker360, 50+), Surprising Gift Service (100 000+), GiftList (10 000+), Amigo secreto: Secret Santa (Motecso, 500 000+). По запросу «подарок» Play показывает **подарочные карты и жеребьёвку**, а не вишлисты.

**Запрос `ideias de presente`** — `...?q=ideias%20de%20presente...`: GiftList (10 000+), Family Gift (100 000+), Lista de presentes - GiftX (10 000+), Simplista (5 000+), MyWishlist (1 000+), Amigo Secreto 22 (1 000 000+), Surprising Gift Service (100 000+), Ideias de presentes (Desarrollando Tendencias, 1 000+), ListaPresentes (10 000+), HeyGifts: Presentes com IA (1 000+). То есть «идеи подарков» в Play тоже упираются в вишлисты, а не в каталоги идей.

**Запрос `lista de presentes casamento`** — `...?q=lista%20de%20presentes%20casamento...`: iCasei (1 000 000+), MyWishlist (1 000+), Simplista (5 000+), Havan (100 000+), Lejour (100 000+), Meus Convidados (5 000+), **Planejador de Casamento: MyWed** (1 000 000+), TulleBook (100+), Lista Convidados Casamento (50 000+), Family Gift (100 000+). Свадебный сегмент в BR — это планировщики свадьбы и реестры сетей, а не вишлисты.

**Отдельная проверка: `amigo secreto`** — `...?q=amigo%20secreto...`

| # | Название | Разработчик | Установок |
|---|---|---|---|
| 1 | Amigo Secreto Online | Emerson S Carvalho | 1 000 000+ |
| 2 | Sorteio Amigo Secreto | Central Dev | 1 000 000+ |
| 3 | Amigo Secreto 22 - Sorteio | Bocadil Infinite | 1 000 000+ |
| 4 | Amigo Secreto Sorteio Fácil | WGP Apps | 500 000+ |
| 5 | Amigo Secreto Sorteio | costaw | 10 000+ |
| 6 | drawnames \| Secret Santa app | drawnames | 1 000 000+ |
| 7 | Papelzinho - Amigo Secreto | Orla Digital LTDA | 500 000+ |
| 8 | Amigo Secreto: Sorteio Online | DevTiago | 500+ |
| 9 | Amigo Secreto: Sorteio Online | PrimApps Dev | 1 000+ |
| 10 | Amigo Secreto Fácil | Grupo BlackWolf | 5 000+ |

Три приложения с миллионом установок в декабрьской жеребьёвке — это самый массовый «подарочный» сегмент бразильского Play.

### 5.2 App Store, BR (iTunes Search API)

`https://itunes.apple.com/search?term=<term>&country=br&entity=software&limit=25&lang=pt_br` — 2026-11-05. iTunes не отдаёт установки; в колонке — `userRatingCount`, то есть **количество оценок**, не загрузок.

**`term=lista de desejos`** (24 результата)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Listful - Wishlist Maker | Listful LLC | 97 |
| 2 | Wishlists - online wishlist | Wishlists GmbH | 510 |
| 3 | WishGrid - Lista de desejos | Tomas Lassak | 0 |
| 4 | Bloco de notas, listas | Orange dog d.o.o. | 1 058 (нерелевантно: заметки) |
| 5 | Mochi: Lista fofa | Guan Feng Lai | 7 (нерелевантно) |
| 6 | To do list - MinimaList | Inner Grow Limited | 1 487 (нерелевантно: список задач) |
| 7 | Wish: Lista de desejos | Kirill Inozemtsev | 0 |
| 8 | Wisher: Ideias de Presentes | Yurii Yefimov | 6 |
| 9 | Jinnie: Lista de desejos | Karlie Alexis Kowalska | 0 |
| 10 | Giftful – Desejos & enxoval | Giftful LLC | 34 |
| 11 | Lista de Compras - Memo rápido | Komorebi Inc. | 1 796 (нерелевантно: покупки) |
| 12 | Whering: Guarda-Roupa Virtual | Whering Ltd | 5 565 (нерелевантно: гардероб) |
| 13 | GoWish - Your Digital Wishlist | Onskeskyen ApS | 224 |
| 14 | Curato: Lista de Desejos | Muhammed Gokhan Percem | 0 |
| 15 | Any.do: lista de tarefas | Any.DO inc. | 5 653 (нерелевантно: задачи) |

**`term=lista de presentes`** (25)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Lista Ideal – Presentes Online | Caio Rolla | 273 |
| 2 | MyWishlist: Lista Presentes | Mauricio Silveira | 185 |
| 3 | **Lista de Presentes Havan** | Havan Lojas de Departamentos | **6 562** |
| 4 | ListaPresentes | Guilherme Hackmann | 69 |
| 5 | iCasei \| Lista de Casamento | iCasei | 799 |
| 6 | Lejour \| Lista de Casamento | Lejour Mobile | 982 |
| 7 | Simplista \| Lista de presentes | Felippe Bisca | 13 |
| 8 | Enxoval de Bebê: Companinho | Tichan Tecnologia | 57 |
| 9 | Jinnie: Lista de desejos | Karlie Alexis Kowalska | 0 |
| 10 | **Casamentos.com.br** | Wedding Planner S.L. | **18 076** |
| 11 | SmileBaby – Lista de presentes | Devontic Technology | 3 |
| 12 | Giftful – Desejos & enxoval | Giftful LLC | 34 |
| 13 | Americanas: Compras Online | americanas s.a. | 1 031 553 (нерелевантно: магазин) |
| 14 | Wishr: Ideias Presente & Lista | Felix Wortmann | 35 |
| 15 | Wedy - Casamento e Eventos | Wertice Publicidade Virtual | 165 |

**`term=wishlist`** (24): Wishlists (510), GoWish (224), My Wishlist (5), Listful (97), Sortd (7), MinimaList (1 487, задачи), Giftful (34), Whering (5 565, гардероб), Moonsift (2), Simple Wishlist (0), Bloomwish: Wishlists & Gifts (0), Pikki: lista de presentes (1), TickTick (10 122, задачи), Wishlist de Compras \| Shopie (0), **Wish (ContextLogic) — 469 222** (маркетплейс, не вишлист).

**`term=presente`** (22): **Vale Presente** (277, рейтинг 1,98 — кошелёк подарочных карт), Udora (116), **Edenred Wallet** (8 590), Meu Vale Presente (6), Lista Ideal (273), MyWishlist (185), Havan (6 562), Presente PIX (10), Presente app (0), Amigo Secreto presente sorteio (2 904), **Vivara** (21 519, ювелирная сеть), iCasei (799), Simplista (13), **Amigo Secreto 22: Sorteio** (23 493), Foxy List (14).

**`term=ideias de presente`** (25): Ideias de Presente: Ribbons (0), Wisher (6), Wishr (35), Amigo Secreto Sorteio Fácil (109), **Pinterest** (1 223 444), WishMe: Ideias de Presente IA (0), Ideias de Presentes (0), RegalOS (0), Lista de presentes - GiftX (0), Listful (97), Presentes, Ideias e Desejos (0), Gift Galaxy AI (0), Wishes (0), Wantd (0), Pikki (1). То есть «идеи подарков» в App Store — это Pinterest и пачка пустых приложений: категория не сформирована.

**`term=desejo`** (25): верх — **«Desejo - Mahmoud Baydoun»** (510, разработчик зарегистрирован как «ensino e sexologia»), «Sex Dice: Explore Teus Desejos» (0), «Universo Desejo» (327), «Lei da Atração com Afirmações» (141), «Mensagens Desejos SMS Coleção» (221), **«Maca Desejo BTvibro»** (0 — товар для взрослых), «Lista de Desejos – Mara» (0). **Вишлистов в топе почти нет**; слово в App Store означает эзотерику, взрослый контент и открытки.

**`term=amigo secreto`** (25): Sorteio Amigo Secreto (5 400), **Amigo Secreto 22: Sorteio (23 493)**, Amigo Secreto Sorteio Fácil (109), **Papelzinho - Amigo Secreto (43 909)**, Amigo Secreto Sorteio (1), Amigo Secreto Sortear (7), **drawnames | Amigo Secreto (6 867)**, Amigo Secreto presente sorteio (2 904), Amigo Secreto: Sorteio Online (4), Amigo Oculto 2026 (14), Sorteio Amigo Secreto Online (3), Amigo Ideal (1), Rafi - Sorteio para Instagram (17 659), Amigo secreto: Secret Santa (439), O Amigo Secreto: Sorteio (3).

### 5.3 Какие корни доминируют в названиях

Подсчёт по **33 уникальным названиям** из шести «подарочных» выдач Play (70 позиций, дубликаты схлопнуты). Выдача `amigo secreto` в этот корпус не входит, о ней — ниже.

| Корень в названии | Названий | Примеры |
|---|---|---|
| `wish` (англ., подстрока) | 12 | Wishlists, Wishdo, Wishes, WishOwl, Wishr, GoWish, wantic: Wish List |
| `presente` (порт.) | 11 | MyWishlist: Lista de Presentes, Lista Ideal – Presentes Online, ListaPresentes |
| `gift` (англ.) | 8 | GiftList, Giftful, Family Gift, HeyGifts |
| `casamento` (порт.) | 4 | iCasei \| Lista de Casamento, Lejour, Planejador de Casamento |
| `desejo` (порт.) | 3 | Giftful – Desejos & enxoval, Wishes: Lista de desejos, Wishdo: lista de desejos |
| `registry` / `registro` | 2 | GiftList - Wishlist & Registry, wantic: Wish List & Registry |
| ни `wish`, ни `gift` | 16 | Lista Ideal, ListaPresentes, Simplista, Lejour, Havan, Meus Convidados, Vale Presente |

Два вывода по неймингу конкурентов:

1. **Английский бренд + португальский ключ через двоеточие — рабочая конвенция, но слабее, чем в испанском.** Так построены 5 из 33 названий: «Wishdo: lista de desejos», «Wishes: Lista de desejos», «Family Gift:Lista de Presentes», «MyWishlist: Lista de Presentes», «Giftful – Desejos & enxoval». Зато **локальные бразильские игроки вообще не берут английский корень**: Lista Ideal, ListaPresentes, Simplista, Lejour, Havan, iCasei, Casamentos.com.br. Английский корень в BR — признак импортированного приложения, португальский — признак местного.
2. **Два разных пула приложений по двум терминам.** По `lista de desejos` и `wishlist` в топе одни и те же международные вишлисты (Wishlists, Listful, Moonsift, GoWish, WishOwl, wantic, Wishr). По `lista de presentes` и `lista de presentes casamento` — бразильские реестры (Havan, iCasei, Lejour, Lista Ideal, MyWishlist, Simplista, ListaPresentes) плюс свадебные планировщики. Пересечение — только Family Gift и MyWishlist.

Отдельно: в выдаче `amigo secreto` **все десять** названий содержат `amigo secreto`/`sorteio` (или английское `Secret Santa` у drawnames). Это самый «свой» сегмент рынка, и он полностью португалоязычный по неймингу.

---

## 6. Паттерны и выводы

### 6.1 Сводная таблица (задание 4.1)

| Термин | Индекс Trends (BR) | Подсказки Google (из 277) | В названиях приложений (из 33) |
|---|---|---|---|
| presente / presentes | н/д (429) | 171 | 11 |
| ideias de presente | н/д (429) | 23 | 1 («Ideias de presentes») |
| lista de desejos | н/д (429) | 46 | 3 (в составе названий) |
| lista de presentes | н/д (429) | 35 | 11 (через `presente`) |
| wishlist (en) | н/д (429) | 31 (только из английских seed'ов) | 7 (в составе названий) |
| wish (en, корень) | н/д (429) | 40 (31 из них — `wishlist`) | 12 |
| desejo | н/д (429) | 56 (46 из них — «lista de desejos») | 3 |
| lista (слово в подсказке) | — | 81 | 12 (в составе `lista`/`lista de …`) |
| amigo secreto | н/д (429) | 10 (отдельный seed) | весь декабрьский сегмент, 10 из 10 |
| app | — | 27 | — |

### 6.2 Выводы

**1. В Бразилии два разных «списка», и оба не про наше приложение в том виде, в каком их видит поиск.**
- `lista de desejos` — то, что понимают все, но в поиске это **вишлист магазина или игры**: из 9 значимых подсказок три про игровые сторы (xbox, Free Fire, steam) и две про магазины (Amazon, Shopee); на YouTube 9 из 14 подсказок — игры (Free Fire, AFK Arena, Pokémon TCG, Dead Island 2, PS5). Плюс это название бразильского документального фильма.
- `lista de presentes` — **подарочный** список к событию (свадьба, chá de bebê, chá de casa nova, день рождения), но он занят реестрами сетей (Havan, Magalu, Casas Bahia, Mercado Livre, Shopee, Amazon) и свадебными платформами (iCasei, Lejour, Casamentos.com.br).

Для приложения «список желаний для друзей и семьи» точнее **`lista de presentes`**: у него подарочное намерение и локальные игроки. `lista de desejos` придётся отбивать у игровых магазинов и у фильма — это ключ подзаголовка, а не имя.

**2. `presente` — слово дарителя, `lista` — слово владельца.** `presente*` — самая частая основа (171 из 277 подсказок), но она почти всегда с адресатом и поводом: «presente para namorado diferente», «ideias de presente para professora», «o que dar de presente para uma menina de 15 anos». Наш продукт по португальской лексике — **`lista de presentes` / `lista de desejos`**, а `presente` и `ideias de presente` — ключи для описания («crie sua lista de presentes»), не для имени. Отдельная бразильская деталь: по `ideias de presente de natal` 4 из 10 подсказок про **корпоративные** подарки (funcionários, equipe, colegas de trabalho, colaboradores) — в BR Рождество ещё и офисный ритуал.

**3. Английское `wishlist` в Бразилии знают, но оно означает музыку, а не подарки.** Подсказка `wishlist o que é` стоит второй, рядом — `wish list significado`, `wish list tradução`, `wishlist ou wish list`. Топ подсказок — **Pearl Jam** (песня «Wishlist») и Taylor Swift; на YouTube то же плюс «wishlist notion». Португальский Викисловарь статью `wishlist` имеет, но помечает её как английское слово (`={{-en-}}=`), вариант — `wish list`. Ни один из 32 португальских seed'ов не дал подсказки с корнем `wish`. Вывод: **`wishlist` узнаваем, но это чужое слово с чужой семантикой**; как ключ в подзаголовке он слабее `lista de presentes` и даже слабее `lista de desejos`.

**4. Поводов три, а не один: май, июнь, декабрь.** Прокси Википедии: «Natal» — декабрьский пик +231 %/+303 % к ноябрю; «Dia das Mães» — май +313 %/+110 %; «Dia dos Namorados» — июнь +250 %/+541 % (плюс февральский пик от международного 14 февраля, который к бразильской дате не относится); «Amigo secreto» — декабрь +134 %/+40 %. По подсказкам: `natal` 20, `casamento` 21, `aniversário` 19, `dia dos namorados` 10, `dia das mães` 10. В сторах самый массовый подарковый сегмент — **декабрьская жеребьёвка**: в Play три приложения с 1 млн+ установок, в App Store «Papelzinho» — 43 909 оценок, «Amigo Secreto 22» — 23 493, тогда как лучший вишлист по `lista de desejos` в BR App Store — «Wishlists» с 510 оценками.

**5. Связка «приложение + список» на pt-BR есть, и она свадебная.** 27 подсказок со словом `app`; из них `app para presentes`, `app para presentes de casamento`, `app para criar lista de presentes`, `aplicativo de presentes de casamento`, `aplicativo lista de presentes havan` — то есть люди ищут приложение под **свадьбу и конкретную сеть**, а `lista de desejos app` уводит в App Store / Xbox / PS / Kindle. Значит, ASO в BR строится на `lista de presentes` + `casamento` / `chá de bebê`, а `app para presentes` — плохой ключ: он ведёт в свадебные реестры.

**6. Бразильский рынок называет вещи по-португальски — сильнее, чем испанский.** Локальные лидеры (`Lista Ideal`, `ListaPresentes`, `Simplista`, `Lejour`, `iCasei`, `Havan`, `Casamentos.com.br`) вообще не используют английский корень; английские названия — у импортированных вишлистов. В испаноязычной выдаче конвенция «английский бренд + испанский ключ через тире» встречалась в 8 из 26 названий (по соседнему отчёту `4-es-report.md`, 2026-11-05), здесь — в 5 из 33, и все пять принадлежат иностранным разработчикам. Для бренда это значит: имя на «Wish-» в BR будет прочитано как **импортированное приложение**, что не мешает, но и не помогает.

**7. `desejo` в сторах — это взрослый контент и эзотерика.** В BR App Store по `desejo` верх занимают «Desejo» от разработчика с профилем «sexologia», «Sex Dice», «Maca Desejo BTvibro», «Universo Desejo», «Lei da Atração». Для нейминга это стоп-слово: бразилец, увидев «desejo» в названии, ждёт не список подарков. Хорошо, что ни один из пяти финалистов его не использует.

---

## 7. Влияние на финалистов (Wishparty, Wishmoon, Wishie, Wishlane, Wishday)

Общее для всех пяти: **имя на «Wish-» не даёт на рынке BR ни ASO-, ни SEO-преимущества** — бразилец набирает `lista de presentes`, `lista de desejos` или название бренда. Зато «Wish-» и не вредит: в BR App Store и Play уже стоят Wishlists, Wishdo, Wishes, WishOwl, Wishr, GoWish, wantic — рынок к такому виду названий привык. Ключи всё равно уходят в подзаголовок стора, как требует `criteria.md`.

Отдельно про произношение (гипотеза, не проверено на носителях): в бразильском португальском звук [ʃ] свойственный — он есть в `ch` (`chave`) и в `x` (`xícara`), а начальное `w` в заимствованиях читается как «у» (`wi-fi` → «uí-fi», WhatsApp → «uatsápi»). Поэтому «Wish…» читается «Uísh…» без спотыкания — **в отличие от испанского рынка, где [ʃ] нет и получается «güish»**. Это плюс BR для всех пяти имён; риск только в том, что «uísh» на слух не отличить от английского `wish`, которое в BR значит «желание» лишь для тех, кто знает английский.

| Финалист | Плюсы для pt-BR | Минусы и риски для pt-BR |
|---|---|---|
| **Wishparty** | В подсказках BR имени нет вообще — ни брендового шума, ни чужой семантики. В Play по `wishparty` точного совпадения нет (первым идёт Poster Maker). «Party» бразилец узнаёт как «festa» — стыкуется с главными поводами (день рождения, chá de bebê, amigo secreto) | «Party» сужает до вечеринки и не говорит «список»; в BR `festa` — это ещё и `chá de bebê`/`chá de casa nova`, а не только вечеринка. В подзаголовке всё равно нужен `lista de presentes` |
| **Wishmoon** | Подсказок нет ни одной — имя чистое. В Play точного совпадения нет (рядом только WishMo, `ro.daredigital.wishmo`). Произносится с первого раза: два простых слога, «Uíshmun» | «Moon» по-португальски не слово, а звук (луна — `lua`); смысл «луна желаний» не читается. Эзотерический оттенок в BR слабее, чем в DE, но категория «desejo» в App Store BR — как раз эзотерика и «Lei da Atração», так что соседство есть. Семантически самое слабое для BR |
| **Wishie** | Ласковый суффикс, короткое, легко набирается; в BR есть привычные уменьшительные на `-ie` | **Слабое место:** все 10 подсказок на `wishie` — это общее «wish» (Pink Floyd, `wish foz do iguaçu`, `wish serrano gramado`), то есть имя не опознаётся как отдельное слово. В BR App Store рядом стоят `Wishi`, `Wishy: Desejos & Amigo Secreto`, `Wishlist & Gifts - Wishy` — прямой конфликт в нише, причём Wishy уже позиционируется как «desejos + amigo secreto», то есть целится ровно в наш сегмент |
| **Wishlane** | Нейтрально, ничего плохого не значит; в BR App Store имени нет (0 результатов) | В подсказках — **музыкант** (`wishlane artist`, `wishlane music`, `wishlane sunday`), плюс `wishlane medispa`. В Play уже есть **«Wish Lane - Cosy Logic Puzzles»** (`com.WishLane`) — игра, которая в BR-выдаче стоит первой по запросу `wishlane`. «Lane» по-португальски не читается (`rua`, `alameda`), остаётся транслитерация «Uíshleyn»; семантически пусто |
| **Wishday** | «Day» понятно, «день желаний» стыкуется с днём рождения — частым поводом BR (19 подсказок) | **Самый занятый из пяти на этом рынке.** В подсказках: `wishday app`, `wishday significado`, `wishday ai`, `wishday font`, `yogurt wishday`, `shampoo wishday`. В Play BR **два** приложения с этим именем: «WishDay: AI Birthday Reminder» (`app.wishday`) и «WishDay: Birthdays & Events» (`com.krayknot.wishday`); в App Store BR — «WishDay: AI Birthday Reminder». Для бразильца «Wishday» — это напоминалка о днях рождения (или йогурт), а не вишлист |

**Что делать по итогам рынка pt-BR (для сводки 7-summary):**

1. Португальский подзаголовок строить вокруг **«Lista de presentes»** (сценарий «список для друзей и семьи») с добавкой **«Lista de desejos»** — второе точнее передаёт «желание», но его придётся отбивать у игровых магазинов. «Presente» и «ideias de presente» — в описание, для дарителя.
2. Для сезонов — отдельные строки: **«Amigo secreto»** на декабрь (самый массовый сегмент, три приложения с 1 млн+ установок в Play), **«Dia das mães»** на май, **«Dia dos namorados»** на июнь, **«Lista de presentes de casamento»** и **«chá de bebê»** — постоянно. Корпоративный сегмент декабря (`presente de natal para funcionários`) — отдельная строка для B2B.
3. В описание добавить фактические модификаторы спроса: `criar`, `compartilhar`, `online`, `personalizado`, `feito a mão`, `criativo` — они встречаются в подсказках, но редко, то есть конкуренция за них низкая. Слово **`desejo`** в название и заголовок не выносить: в BR-сторе оно ведёт во взрослый контент и эзотерику.
4. По неймингу для BR преимущества нет ни у одного финалиста, но и блокеров нет. Наименее рискованны **Wishparty** (нулевой шум, праздничная ассоциация, точного совпадения нет ни в Play, ни в App Store) и **Wishmoon** (нулевой шум, но пустая семантика). **Wishie** конфликтует с Wishy/Wishi, которые уже заняли нишу «desejos + amigo secreto». **Wishlane** — игра Wish Lane в Play и музыкант в поиске. **Wishday** — две напоминалки о днях рождения в Play BR и йогурт с шампунем в подсказках; для BR это самый занятый вариант.

---

## 8. Пробелы

1. **Google Trends недоступен.** Два обращения к `trends.google.com` вернули HTTP 429 (антибот). Индексов 0–100, «похожих запросов» и кривых сезонности из Trends нет. Повтор сделан один раз, как требует задание; защиту не обходили, прокси и зеркала не использовали. Следствие: сравнить `lista de presentes` и `lista de desejos` по относительному объёму нельзя — только по числу подсказок и названий в сторах.
2. **Абсолютных объёмов поиска нет ни у одного термина.** Google Keyword Planner требует логина и рекламного аккаунта — по правилам задания не использовался. Все «частоты» в отчёте — счётчики подсказок и названий, а не показы в месяц.
3. **Сезонность измерена только прокси.** Wikimedia Pageviews по статьям «Natal», «Dia das Mães», «Dia dos Namorados», «Amigo secreto» — слабый индикатор (энциклопедические статьи, а не поисковый спрос). У «Dia dos Namorados» февральский пик относится к международному 14 февраля, и по этому ряду нельзя отделить его от бразильского 12 июня. Точных коэффициентов сезонности поиска нет.
4. **Часть запросов к Викимедиа сначала отбилась 429.** Первый прогон (страницы pt.wiktionary и API pt.wikipedia с браузерным User-Agent) вернул 429 «bot-traffic» по всем шести URL. Повтор с описательным User-Agent (`GiftListNamingResearch/1.0`) через API сработал; защита не обходилась, интервал между запросами — 4–5 секунд. Не снято: содержание словарных статей `presente` и `desejo` (машинный экстракт пустой из-за структуры страниц).
5. **Google Play не показывает установки в выдаче.** Числа сняты с отдельных карточек; это округлённые диапазоны Google («100 mil+», «1 mi+»), а не точные значения. У семи позиций (три уникальных пакета: `br.com.simplista`, `com.mobile.iCasei`, `com.meetrixonline.drawnames`) первый заход вернул 404 из-за сбоя разбора названия с символом `|`; установки сняты повторным запросом, поэтому в таблицах они есть. Оценки (звёзды) снять не удалось — в HTML карточки разметка рейтинга не совпала с шаблоном, поэтому в таблицах Play только установки.
6. **App Store не отдаёт установки.** В таблицах — количество оценок (`userRatingCount`), это не загрузки; сравнивать с Play по абсолютным числам нельзя. Оценки сильно занижены у локальных вишлистов (Lista Ideal 273, MyWishlist 185) и сильно завышены у глобальных приложений (Americanas 1 031 553, Wish 469 222, Pinterest 1 223 444).
7. **Suggest отдал часть строк без диакритики** (`cha de bebe`, `traducao`, `aniversario`). Возможно, это особенность эндпоинта `client=firefox`, а не отражение того, как люди пишут. Формы сохранены как пришли; на подсчёты это не влияет (нормализация), но цитаты выглядят «без ã/ç».
8. **Сравнение «подсказки Google» и «YouTube-подсказки» сделано на разном числе seed'ов** (36 против 4). YouTube снимался выборочно, чтобы подтвердить семантику двух «списков»; полноценного корпуса по YouTube нет.
9. **Восприятие «wish» и произношение «Uísh…» не проверены на носителях.** Вывод о том, что [ʃ] в бразильском португальском свойственный и имя не спотыкается, — гипотеза, опирающаяся на наличие `ch`/`x` и на передачу `wi-fi` как «uí-fi». Нужен опрос или транскрипционный тест.
10. **Бренды «Wishday» (йогурт, шампунь) и «Wish Lane» (игра) не проверены по первоисточникам.** Факты сформулированы как «по подсказкам имя занято» и «в Play есть приложение с таким названием», а не «бренд X принадлежит Y». Владельцы не устанавливались.
11. **Реклама и кампании конкурентов не проверялись.** Есть только косвенный признак: в BR App Store по `presente` верх занимают подарочные карты (Vale Presente с рейтингом 1,98), ювелирная сеть Vivara и жеребьёвка.
12. **Не проверялось**, как бразильцы называют вишлист в разговорной речи (например, «minha lista» без уточнения) — для этого нужны форумы и соцсети, а они в эту сессию не снимались.

---

## 9. Список источников

Все — 2026-11-05.

**Google Suggest (ядро и модификаторы, `hl=pt-BR&gl=BR`)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=ideias%20de%20presente`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20presentes`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishlist`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=desejo`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20de%20anivers%C3%A1rio`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20de%20natal`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20para%20namorada`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20para%20namorado`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20para%20m%C3%A3e`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20para%20pai`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=ideias%20de%20presente%20de%20natal`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=app%20de%20lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=aplicativo%20lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20online`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=criar%20lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20presentes%20casamento`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20presentes%20ch%C3%A1%20de%20beb%C3%AA`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishlist%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=o%20que%20dar%20de%20presente`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=amigo%20secreto`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20mercado%20livre`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20personalizado`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20app`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=site%20de%20lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=app%20para%20presentes`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=aplicativo%20de%20presentes`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20anivers%C3%A1rio`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20dia%20dos%20namorados`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=presente%20dia%20das%20m%C3%A3es`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20compartilhar`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wish%20list`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20beb%C3%AA` (пусто)
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishlist%20tradu%C3%A7%C3%A3o`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=lista%20de%20desejos%20para%20imprimir`

**Google Suggest (имена финалистов)**
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishparty` (пусто)
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishmoon` (пусто)
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishie`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishlane`
- `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=BR&q=wishday`

**YouTube-подсказки**
- `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=pt-BR&gl=BR&q=lista%20de%20desejos`
- `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=pt-BR&gl=BR&q=lista%20de%20presentes`
- `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=pt-BR&gl=BR&q=ideias%20de%20presente`
- `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&hl=pt-BR&gl=BR&q=wishlist`

**Google Trends (недоступен)**
- `https://trends.google.com/trends/explore?geo=BR&hl=pt-BR&q=presente,lista%20de%20desejos,lista%20de%20presentes,wishlist` — HTTP 429
- `https://trends.google.com/trends/explore?geo=BR&hl=pt-BR&q=presente,lista%20de%20desejos,lista%20de%20presentes` — повтор через ~40 минут, HTTP 429

**Google Play**
- `https://play.google.com/store/search?q=lista%20de%20desejos&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=lista%20de%20presentes&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=presente&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=ideias%20de%20presente&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=lista%20de%20presentes%20casamento&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=amigo%20secreto&c=apps&hl=pt-BR&gl=BR`
- `https://play.google.com/store/search?q=wishparty&c=apps&hl=pt-BR&gl=BR`, `...?q=wishmoon...`, `...?q=wishie...`, `...?q=wishlane...`, `...?q=wishday...`
- Карточки для установок: `https://play.google.com/store/apps/details?id=<id>&hl=pt-BR&gl=BR`, где `<id>` — `com.ckbusiness.Wishlists`, `io.wishdo.app`, `com.happywishlist.app`, `com.moonsift.wish.list.maker.christmas.birthday.baby.shopping.gift.list`, `com.wiheads.wishes`, `io.wantic.app`, `com.wishowl.app`, `com.giftlist`, `com.trempette.family_gift_2`, `com.wishr.mobileapp`, `co.mywishlist.app`, `br.com.listaideal`, `br.com.simplista`, `com.havan.mobile.listapresente`, `com.mobile.iCasei`, `com.listapresentes`, `com.bocadil.amigoinvisible22`, `br.com.lejour.admin_gift_registry_app`, `com.meusconvidados.gerenciarfestas`, `com.gowish.app`, `com.share.a.wish`, `com.giftful.Giftful`, `br.com.socialbank.android.wallet`, `co.com.presente`, `com.presente.smarttime`, `me.gifft.twa`, `com.motecso.secretsanta.prod`, `giftx.tech`, `com.developingtrends.giftideas`, `app.rork.heygifts`, `app.mywed.android`, `com.tanzsoft.tullebook`, `com.wedding.planner.guest.list`, `net.pontocomdesenvolvimento.amigosecretoonline`, `com.sorteioamigosecreto`, `com.wgpapps.secretsantaeasyraffle`, `br.com.costaw.amigosecretosorteio`, `com.meetrixonline.drawnames`, `kaiquedamato.com.papelzinho`, `com.tiase.amigosecreto`, `com.primapps.amigosecreto`, `com.grupobw.amigosecretofacil`

**App Store (iTunes Search API, `country=br`)**
- `https://itunes.apple.com/search?term=lista%20de%20desejos&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=lista%20de%20presentes&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=wishlist&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=presente&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=ideias%20de%20presente&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=desejo&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=amigo%20secreto&country=br&entity=software&limit=25&lang=pt_br`
- `https://itunes.apple.com/search?term=wishparty&country=br&entity=software&limit=10&lang=pt_br` (0 результатов)
- `https://itunes.apple.com/search?term=wishmoon&country=br&entity=software&limit=10&lang=pt_br` (0)
- `https://itunes.apple.com/search?term=wishie&country=br&entity=software&limit=10&lang=pt_br`
- `https://itunes.apple.com/search?term=wishlane&country=br&entity=software&limit=10&lang=pt_br` (0)
- `https://itunes.apple.com/search?term=wishday&country=br&entity=software&limit=10&lang=pt_br`

**Словари, энциклопедии, сезонность**
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/Natal/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/Dia_das_M%C3%A3es/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/Dia_dos_Namorados/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/user/Amigo_secreto/monthly/20241101/20261031`
- `https://pt.wikipedia.org/w/api.php?action=query&titles=Lista%20de%20desejos&prop=info&format=json&redirects=1` — страницы нет
- `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=lista%20de%20desejos&format=json&srlimit=8` — «Lista de Desejos para Superagüi» (документальный фильм)
- `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=amigo%20secreto&format=json&srlimit=4` — «brincadeira tradicional das festividades de fim de ano, como Natal»
- `https://pt.wiktionary.org/w/api.php?action=parse&page=wishlist&prop=wikitext&format=json` — статья помечена как английская (`={{-en-}}=`), вариант `wish list`
- `https://pt.wiktionary.org/w/api.php?action=query&titles=presente&prop=info&format=json`
- `https://pt.wiktionary.org/w/api.php?action=query&titles=desejo&prop=info&format=json`
- `https://en.wikipedia.org/w/api.php?action=query&titles=Wishlist%20(song)&prop=extracts&exintro=1&explaintext=1&format=json&redirects=1` — «"Wishlist" is a song by the American rock band Pearl Jam… released on May 5, 1998»

ГОТОВО 5-pt
