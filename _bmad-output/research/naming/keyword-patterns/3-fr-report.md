# 3-fr. Поисковые паттерны подарков и вишлистов: Франция (FR), дополнительно BE/CA-fr

| Параметр | Значение |
|---|---|
| Рынки | Франция (FR); дополнительно Бельгия (BE) и франкоязычная Канада (CA) |
| Язык запросов | `hl=fr`; в автодополнении — `gl=FR`, точечно `gl=BE` и `gl=CA`; в сторах — `gl=FR` / `country=fr`, `be`, `ca` с `lang=fr_fr` |
| Дата прогона | 2026-11-05 |
| Модель | DeepSeek V4.1 Flash (OpenCode) |
| Задание | `_bmad-output/research/naming/keyword-patterns/3-fr.md` (одно из шести рыночных заданий, сводка — `7-summary.md`) |
| Что сделано | 39 запросов в Google Suggest (24 французских сида, 6 запросов по BE/CA, 5 имён финалистов, 4 запроса YouTube), 7 поисковых выдач Google Play FR, 30 карточек приложений Play ради числа установок, iTunes Search API по 6 терминам в FR/BE/CA + отдельная проверка `wish` в FR, 3 попытки Google Trends, прокси-сезонность по Wikimedia Pageviews |
| Изменения в репозитории | Только этот файл. Ничего не покупалось, не регистрировалось, формы не отправлялись, капча и антибот не обходились, коммитов нет |

Контекст прочитан (только чтение, 2026-11-05): `_bmad-output/research/naming/criteria.md`, `_bmad-output/research/naming/finalists-compare.md`. Финалисты: Wishparty, Wishmoon, Wishie, Wishlane, Wishday.

**Как читать цифры.** В отчёте три разных типа чисел: (а) сколько из 318 собранных подсказок содержат слово — это частота **слов в подсказках**, а не частота запросов; (б) доля названий приложений в топ-10 стора; (в) ступень установок в Google Play и число оценок в App Store. **Объёма поиска (показов в месяц) в отчёте нет ни в одной строке** — Google Trends не ответил, а Keyword Planner требует аккаунта.

---

## 1. Seed-запросы

Ядро задания: cadeau, idée cadeau, liste de souhaits, liste de cadeaux, wishlist, liste d'envies. К нему добавлены французские модификаторы: повод (`anniversaire`, `noel`), адресат (`pour elle`, `pour lui`, `enfant`), инструмент (`application`, `appli`, `en ligne`), случай (`liste de naissance`, `liste de mariage`), а также «сырые» корни для проверки шума (`liste`, `noel`).

| # | Seed | Зачем |
|---|---|---|
| 1 | `cadeau` | ядро, самое общее слово |
| 2 | `idée cadeau` | кластер дарителя «что подарить» |
| 3 | `liste de souhaits` | буквальный кальк «wish list» |
| 4 | `liste de cadeaux` | «список подарков» по-французски |
| 5 | `wishlist` | английское заимствование, слитно |
| 6 | `liste d'envies` | «список желаний» — живая французская форма |
| 7 | `idée cadeau anniversaire` | повод «день рождения» |
| 8 | `idée cadeau noel` | повод «Рождество» |
| 9 | `application liste de souhaits` | модификатор «приложение» |
| 10 | `liste d'envies application` | то же к форме «envies» |
| 11 | `cadeau pour elle` | адресат-женщина |
| 12 | `cadeau pour lui` | адресат-мужчина |
| 13 | `liste de naissance` | реестр по случаю «рождение» |
| 14 | `liste de mariage` | реестр по случаю «свадьба» |
| 15 | `wishlist app` | английское слово + приложение |
| 16 | `liste de souhaits en ligne` | «онлайн» |
| 17 | `application cadeau` | «приложение» + подарок (проверка жеребьёвки) |
| 18 | `cadeau de noel` | сезонный модификатор |
| 19 | `liste de cadeaux noel` | сезон + список |
| 20 | `idée cadeau enfant` | адресат-ребёнок |
| 21 | `idée de cadeau` | раздельное написание (проверка формы) |
| 22 | `noel` | чистый сезонный корень, проверка шума |
| 23 | `cadeau anniversaire` | повод без слова «idée» |
| 24 | `liste` | чистый корень «список» — что Google вообще думает о слове |

Дополнительно, для BE/CA: `cadeau`, `liste de souhaits`, `liste d'envies` × `gl=BE` и `gl=CA` (6 запросов). Отдельно — проверка имён: `wishparty`, `wishmoon`, `wishie`, `wishlane`, `wishday` (`gl=FR`).

Все 24 сида прогнаны по FR (`client=chrome`, `hl=fr`, `gl=FR`), каждый вернул от 0 до 15 подсказок; пустым пришёл только `liste d'envies application` (0 подсказок), у `application liste de souhaits` — 3. Итого **318 подсказок** по 23 непустым сидам.

---

## 2. Google Trends

### 2.1 Результат прогона

| # | Запрос | Результат |
|---|---|---|
| 1 | `https://trends.google.com/trends/explore?geo=FR&hl=fr&q=cadeau,idée%20cadeau,liste%20de%20souhaits,wishlist,liste%20d%27envies` | **HTTP 429** «Error 429 (Too Many Requests)» |
| 2 | `https://trends.google.com/trends/api/explore?hl=fr&tz=-60&req=…` (тот же набор, 12 месяцев, geo=FR) | **HTTP 429** |
| 3 | Повтор через ~20 минут: `.../explore?geo=FR&hl=fr&q=cadeau,liste%20de%20souhaits,wishlist` | **HTTP 429** снова |

Защита не обходилась: без смены IP, без прокси, без зеркал. Правило задания «попробовать один раз позже» выполнено (попытка №3).

### 2.2 Таблица (как просили в задании)

| Термин | Индекс Trends, FR, 12 мес | Индекс Trends, FR, 5 лет | Похожие запросы | Сезонность |
|---|---|---|---|---|
| cadeau | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — 2.3 |
| idée cadeau | н/д (429) | н/д (429) | н/д | н/д из Trends; косвенно — 2.3 |
| liste de souhaits | н/д (429) | н/д (429) | н/д | н/д из Trends |
| liste de cadeaux | н/д (429) | н/д (429) | н/д | н/д из Trends |
| wishlist | н/д (429) | н/д (429) | н/д | н/д из Trends |
| liste d'envies | н/д (429) | н/д (429) | н/д | н/д из Trends |

### 2.3 Косвенная замена Trends (помечено как прокси, не как объём поиска)

**(а) Сезонность по просмотрам статей французской Википедии** (Wikimedia Pageviews API, monthly, `fr.wikipedia`, 2024-11 — 2026-10):

| Статья | Ноя 2024 | **Дек 2024** | Янв 2025 | Ноя 2025 | **Дек 2025** | Янв 2026 | Остальные месяцы 2025–2026 |
|---|---|---|---|---|---|---|---|
| «Cadeau» | 513 | **957** | 493 | 713 | **988** | 400 | 246–443 |
| «Noël» | 26 634 | **112 522** | 15 027 | 19 671 | **77 329** | 9 739 | 2 808–6 470 |

Пик декабря к ноябрю: «Cadeau» +87 % (2024) и +39 % (2025); «Noël» +322 % (2024) и +293 % (2025). Источник: `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/Cadeau/monthly/20241101/20261031` и то же для `No%C3%ABl` — 2026-11-05.

Оговорка: это просмотры энциклопедических статей, а не поисковый спрос. Показывают только направление — подарки сезонны, пик в декабре, база мала (сотни просмотров в месяц у «Cadeau»).

**(б) Статья «Liste de naissance» в fr.wikipedia отсутствует** — API вернул 404 («we either do not have data for those date(s)…»). По спискам желаний сезонность через Википедию не построить.

**(в) Структурный признак сезонности из сторов:** в выдаче FR по `cadeau` вторую строку Play занимает рождественская жеребьёвка «drawnames | L'app Secret Santa» (1 M+ установок), рядом «Père Noël Secret 22: Tirage!» (1 M+); в App Store по `liste de cadeaux` в топ-10 стоят «The Christmas Gift List» (170 оценок) и «Liste de cadeaux de Noël»; по `liste de souhaits` — «Liste de souhaits de noël» (50 оценок). То есть заметная часть подаркового сегмента привязана к Рождеству. Источники — таблицы раздела 4.

---

## 3. Автодополнение Google Suggest

Метод: `https://suggestqueries.google.com/complete/search?client=chrome&hl=fr&gl=FR&q=<seed>`, ответ — JSON UTF-8. Пауза 4–5 с между запросами. 318 подсказок по 23 сидам FR; отдельно 6 запросов BE/CA, 4 запроса YouTube, 5 запросов по именам финалистов.

### 3.1 Ядро: `cadeau`

| # | Подсказка |
|---|---|
| 1 | cadeau homme |
| 2 | cadeau noel |
| 3 | cadeau femme |
| 4 | cadeau anniversaire |
| 5 | cadeau personnalisé |
| 6 | cadeau noel homme |
| 7 | cadeau de naissance |
| 8 | cadeau anniversaire femme |
| 9 | cadeau plus |
| 10 | cadeau mariage |
| 11 | cadeau noel femme |
| 12 | cadeau anniversaire homme |
| 13 | cadeau maman |
| 14 | cadeau enfant 2 ans |
| 15 | cadeau magazine novembre 2026 |

Источник: `...&q=cadeau` — 2026-11-05. Обратите внимание: подсказки без акцентов («noel», «personnalise») — Google отдаёт ту форму, которую набрал пользователь; при вводе с акцентом (`idée cadeau`) акценты в ответе сохраняются.

### 3.2 Ядро: `idée cadeau` и `idée de cadeau`

`idée cadeau`: idée cadeau femme · idée cadeau homme · idée cadeau anniversaire · idée cadeau anniversaire femme · idée cadeau femme 40 ans · idée cadeau fille 10 ans · idée cadeau homme 40 ans · idée cadeau femme 30 ans · idée cadeau anniversaire homme · idée cadeau bébé 1 an · idée cadeau fille 3 ans · idée cadeau homme 30 ans · idée cadeau crémaillère · idée cadeau fille 5 ans · idée cadeau femme 50 ans.

`idée de cadeau`: idée de cadeau d'anniversaire · idée de cadeau de noël · idée de cadeau homme · idée de cadeau pour fille de 12 ans · idée de cadeau femme · idée de cadeau pour ado garçon · idée de cadeau d'anniversaire homme · … · idée de cadeau 13 ans garçon.

Источники: `...&q=id%C3%A9e%20cadeau`, `...&q=id%C3%A9e%20de%20cadeau` — 2026-11-05. Вывод: ни одной подсказки про список или приложение — все 30 про адресата, возраст или повод.

### 3.3 Ядро: `liste de souhaits` — наполовину чужая территория

| # | Подсказка | Тип |
|---|---|---|
| 1 | liste de souhaits xbox | игры |
| 2 | liste de souhaits mots fléchés | кроссворд («список пожеланий» как определение) |
| 3 | liste de souhaits steam | игры |
| 4 | liste de souhaits nintendo | игры |
| 5 | liste de souhaits wikimasters | чужой сайт |
| 6 | liste de souhaits amazon | магазин |
| 7 | liste de souhaits ps5 | игры |
| 8 | liste de souhaits 10 lettres | кроссворд |
| 9 | liste de souhaits ou revendications 10 lettres | кроссворд |
| 10 | liste de souhaits en anglais | «как будет по-английски» |
| 11 | liste de souhaits play store | магазин приложений |
| 12 | liste de souhaits cadeaux | **по теме** |
| 13 | liste de souhaits noel | **по теме** |
| 14 | liste de souhaits google play | магазин приложений |
| 15 | liste de souhaits en ligne | **по теме** |

Источник: `...&q=liste%20de%20souhaits` — 2026-11-05. 6 из 15 — игровые вишлисты (Xbox, Steam, Nintendo, PS5, Play Store, Google Play), 3 — кроссворды, 1 — «как по-английски». Только 3 подсказки описывают наш сценарий.

То же для модификатора: `application liste de souhaits` вернул всего 3 подсказки — «application liste de souhait», «appli liste de souhaits», «appli liste de souhait»; у `liste d'envies application` — **0 подсказок**. То есть связки «список желаний + приложение» во французском почти нет.

### 3.4 Ядро: `liste de cadeaux` — чистый списочный интент

liste de cadeaux anniversaire · liste de cadeaux en ligne · liste de cadeaux de noël · liste de cadeaux de mariage · liste de cadeaux mes envies · liste de cadeaux de naissance · liste de cadeaux amazon · **liste de cadeaux application** · liste de cadeaux baby shower · liste de cadeaux surprise loto quebec.

Источник: `...&q=liste%20de%20cadeaux` — 2026-11-05. 10 из 10 попаданий по теме, включая `liste de cadeaux application` — прямое доказательство, что категорию ищут именно этой фразой.

### 3.5 Ядро: `liste d'envies`

liste d envies amazon · liste d envies anniversaire · liste d envies de gadgets technologiques · liste d'envies noel · liste d'envies en anglais · liste d envies temu · liste d'envie cadeau · liste d'envie naissance · liste d envie amazon comment ça marche · liste d'envie kindle · liste d'envie bebe · liste d envie cadeau noel · liste d'envie shein · liste d envie cadeau anniversaire · liste d envie exemple.

Источник: `...&q=liste%20d%27envies` — 2026-11-05. Google сам схлопывает апостроф в пробел и пишет «envie» без «s» — обе формы живые. 15 из 15 подсказок по теме; 5 из 15 тянут в чужие экосистемы (Amazon ×2, Kindle — тоже Amazon, Temu, Shein).

### 3.6 Ядро: `wishlist` — слово знают, но не понимают

| # | Подсказка | Чтение |
|---|---|---|
| 1 | wishlist en ligne | по теме |
| 2 | wishlist anniversaire | по теме |
| 3 | wishlist def | **«что это значит»** |
| 4 | wishlist noel | по теме |
| 5 | wishlistr | чужой сервис |
| 6 | wishlist steam | игры |
| 7 | wishliste | немецкое написание — шум |
| 8 | wishlist amazon | магазин |
| 9 | wishlist automne | «осенний вишлист» — жанр видео |
| 10 | wishlist c'est quoi | **«что это такое»** |
| 11 | wishlist livre | книги |
| 12 | wishlist app | приложение |
| 13 | wishlist site | сайт |
| 14 | wishlist femme | мода |
| 15 | wishlist traduction | **«перевод»** |

Источник: `...&q=wishlist` — 2026-11-05. Три подсказки из 15 — «объясните слово» (`def`, `c'est quoi`, `traduction`), плюс отдельно `liste de souhaits en anglais`. Английское слово живёт, но требует перевода.

### 3.7 Модификаторы: частоты по всем 318 подсказкам

Счёт по вхождению подстроки в нормализованную строку (без акцентов и апострофов).

| Модификатор | Подсказок | Что значит |
|---|---|---|
| `cadeau` | 196 | самая частая основа рынка |
| `liste` | 97 | «список» — вторая по массе |
| `idee` | 89 | «идеи» — запрос дарителя |
| `noel` | 76 | Рождество |
| `anniversaire` | 46 | день рождения |
| `homme` / `femme` | 27 / 24 | адресат по полу |
| `enfant` | 21 | ребёнок |
| `souhait` | 22 | «желание» |
| `naissance` | 19 | рождение (реестр) |
| `mariage` | 19 | свадьба (реестр) |
| `envie` | 18 | «желание» в живой форме |
| `app` / `appli` / `application` (по границе слова) | 31 | инструмент |
| `wishlist` (и `wish`) | 30 / 30 | все 30 — из двух английских сидов, ни одной из французских |
| `en ligne` | 10 | «онлайн» |
| `elle` / `lui` | 10 / 6 | адресат |
| `amazon` | 6 | чужая экосистема |
| `ado` | 6 | подросток |
| `2026` | 5 | год в запросе |
| `maman` / `papa` | 5 / 4 | родители |
| `gratuit` | 4 | «бесплатно» |
| `personnalise` | 3 | «с именем» |
| `pas cher` | 2 | «недорого» |
| `famille` / `entreprise` / `tirage` | 2 / 2 / 2 | сценарии |
| `couple` | 1 | сценарий |

Источник: агрегат по 23 непустым запросам `https://suggestqueries.google.com/complete/search?client=chrome&hl=fr&gl=FR` — 2026-11-05. Частоты смещены составом сидов (пять сидов содержали слово «cadeau», три — «noel»), поэтому числа сравнимы между собой только как грубый порядок.

**Куда крепится «app/application»:** 31 подсказка: 12 — к `wishlist` (все английские, включая мусор `wishlist app shopify`, `wishlist app design`), 15 — к `cadeau`/`application cadeau` (там же `application cadeau de noel tirage au sort`, `application cadeau commun`, `application cadeau secret santa`, `application cadeau famille`), 3 — к `liste de souhaits`, 1 — к `liste de cadeaux`. То есть **«приложение» во французском крепится к «подарку» и к английскому «wishlist», но не к «списку желаний»**; и даже внутри «подарка» это чаще жеребьёвка и групповой подарок, чем список.

### 3.8 BE и CA-fr

| Гео | Seed | Подсказки (как выдал Google) | Отличие от FR |
|---|---|---|---|
| BE | `cadeau` | cadeau homme · cadeau anniversaire · cadeau personnalisé · cadeau noel · cadeau femme · cadeau plus · cadeau naissance · cadeaux · **cadeaucity** · cadeau anniversaire femme · **cadeau proximus** · cadeau anniversaire homme · **cadeaubox** · cadeau de mariage · **cadeau test achat** | локальные бренды: Cadeaucity, Proximus (оператор), Cadeaubox; есть `cadeau test achat` (дегустационные наборы) |
| BE | `liste de souhaits` | идентично FR (15 из 15 совпали) | отличий нет |
| BE | `liste d'envies` | идентично FR | отличий нет |
| CA | `cadeau` | cadeau noel · cadeau femme · cadeau homme · cadeaux · cadeau de mariage · cadeau pour femme · **cadeau éducatrice** · cadeau pour homme · cadeau enfant 2 ans · cadeau personnalisé · cadeau de noel 2026 · cadeau enfant 3 ans · **cadeau casino rewards** · **cadeau éducatrice garderie** · cadeau fete sephora | квебекское `cadeau éducatrice` (подарок воспитателю детсада) — дважды |
| CA | `liste de souhaits` | идентично FR | отличий нет |
| CA | `liste d'envies` | идентично FR | отличий нет |

Источники: те же URL с `gl=BE` / `gl=CA` — 2026-11-05. Вывод: **ядро у FR, BE и CA-fr одно**; расходятся только локальные бренды в широком слове `cadeau`. Отдельной бельгийской или квебекской лексики для вишлиста нет.

### 3.9 YouTube-подсказки (`ds=yt`)

| Seed | Подсказки |
|---|---|
| `wishlist` | wishlist noel · wishlist noel 2026 · wishlist anniversaire · wishlist 2026 · wishlist noel 2025 · wishlist automne · wishlist origami · wishlist txt · wish liste · wishlist birthday · wishlist idea · wishlist cadeau anniversaire · wishlist x endgame · **wishlist tf1** · wishlist francais |
| `liste de souhaits` | comment faire une liste de souhaits sur zepeto (одна подсказка) |
| `liste d'envies` | пусто |
| `liste de cadeaux` | liste de cadeaux de noël · liste de cadeaux d'anniversaire · idées de cadeaux surprises · idée de cadeaux · idées de cadeaux romantiques · idées de cadeaux pour anniversaire · … · idées de cadeaux pour la fête des mères · … |

Источник: `https://suggestqueries.google.com/complete/search?client=chrome&ds=yt&hl=fr&gl=FR&q=<seed>` — 2026-11-05.

Что это даёт: на YouTube `wishlist` — это жанр видео («осенний вишлист», «вишлист на Рождество», `wishlist txt` — k-pop), а не инструмент. Отдельно всплывает **`wishlist tf1`**. Проверка: «Wish List : La Liste de vos envies» — французское телешоу, выходившее на TF1 с 6 июля 2015 по 15 января 2016, адаптация британского «Win Your Wish List» BBC One, ведущий Кристоф Дешаван. Источник: `https://fr.wikipedia.org/wiki/Wish_List_:_la_liste_de_vos_envies` — 2026-11-05. То есть во французском медиаполе сочетание «wish list» уже занято телеигрой.

### 3.10 Подсказки по именам финалистов (FR)

| Имя | Что подсказывает Google FR | Чтение |
|---|---|---|
| `wishparty` | wish party studio · wish party studio lalitpur · wish party · wish party studio reviews · wish party studio location · wish party decorations · wish party supplies · wish party ideas · wish party favors · wish party shop · wish party entertainment · wish party miku | Google разбивает на «wish party» + английские товары для вечеринок; единственный бренд — фотостудия Wish Party Studio в Лалитпуре (Непал). Французского продукта нет |
| `wishmoon` | wishomee · wishmuu · wish moonlight destiny · wishmountain · wimoony | самого имени в подсказках нет, только фонетические соседи. Спроса нет |
| `wishie` | wishies · wishie meaning · wishier protein · wishiee tiktok · wish tattoo · wishiecat arc raiders · **wishie plant** · wish tickets · wishies mackay · wishie wishie pressure washing · wish cat · happy wishes · wishie adalah · **washie washie** · wishier protein bar | шум: протеиновые батончики, стример wishiecat, растение, автомойка, индонезийское «adalah». Отдельно `wishie meaning` — Google считает слово непонятным |
| `wishlane` | **dashlane** · dashlane connexion · dashlane mot de passe · dashlane extension · dashlane extension chrome · dashlane générateur de mot de passe · dashlane login · dashlane mon compte · dashlane generator · dashlane prix · dashlane gratuit · dashlane generate password · dashlane chrome · dashlane mdp · dashlane password | **все 15 подсказок — про Dashlane**, широко известный во Франции менеджер паролей. Самого `wishlane` в подсказках нет вообще |
| `wishday` | **wishday app** · wishday ai · wishday font · yogurt wishday · winter wishday · wishday とは · wish day tradução · wishday significado · shampo wishday | есть подсказка `<имя> app` и `<имя> ai`, но рядом йогурт, шампунь, шрифт и японско-португальский шум |

Источник: `https://suggestqueries.google.com/complete/search?client=chrome&hl=fr&gl=FR&q=<имя>` — 2026-11-05.

---

## 4. Сторы: Google Play и App Store

Метод. Play: страница поиска `?c=apps&hl=fr&gl=FR`, из HTML берутся название (`span.DdYX5`), разработчик (`span.wMUdtb`) и id; установки со страницы поиска не отдаются, поэтому они добраны с 30 карточек приложений (`div.ClM7O` + подпись «Téléchargements»). App Store: iTunes Search API, установок не публикует — вместо них число оценок (`userRatingCount`).

### 4.1 Google Play FR, топ-10 по терминам

**`liste de souhaits`** — `https://play.google.com/store/search?q=liste%20de%20souhaits&c=apps&hl=fr&gl=FR` (2026-11-05)

| # | Название | Разработчик | Установок | Ключ в названии |
|---|---|---|---|---|
| 1 | Wishlists - online wishlist | Christian Konnerth | 100 k+ | wishlist (англ.) |
| 2 | GoWish - Your Digital Wishlist | Ønskeskyen ApS | 1 M+ | wish (англ.) |
| 3 | Giftful – Liste de souhaits | Giftful | 100 k+ | gift + liste de souhaits |
| 4 | Wishlist Maker - Listful | Listful | 100 k+ | wishlist |
| 5 | Wishes – Liste de souhaits | Wiheads ApS | 10 k+ | wishes + liste de souhaits |
| 6 | Liste de Souhaits & Cadeaux | Kenji Sakai | 1 k+ | liste + souhaits + cadeaux |
| 7 | GiftList - Wishlist & Registry | GiftList | 10 k+ | gift + list + wishlist |
| 8 | Crave : Liste de souhaits | Codemint | 1+ | liste de souhaits |
| 9 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | gift + liste de cadeaux |
| 10 | Liste de souhaits et cadeaux | Awaytix | 100+ | liste + souhaits + cadeaux |

**`liste d'envies`** — `...?q=liste%20d%27envies...`

| # | Название | Разработчик | Установок | Ключ |
|---|---|---|---|---|
| 1 | Envy : liste d'envies cadeaux | Fabazad | 500 k+ | envies + cadeaux |
| 2 | Wishbob – Liste de cadeaux | Wishbob | 100 k+ | wish + liste de cadeaux |
| 3 | iKadoo - Liste de cadeaux | iKadoo | 10 k+ | liste de cadeaux |
| 4 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | liste de cadeaux |
| 5 | Wishlists - online wishlist | Christian Konnerth | 100 k+ | wishlist |
| 6 | Listéa - Liste de naissance | Listéa | 100+ | liste de naissance |
| 7 | minipouce - Liste de naissance | minipouce | 10 k+ | liste de naissance |
| 8 | Oh My Wish ! Liste de cadeaux | OhMyWish | 10 k+ | wish + liste de cadeaux |
| 9 | Liste d'envies & idées - GiftX | PatStudio LLC | 10 k+ | envies + idées |
| 10 | Ma liste naissance | Navard | 100+ | liste naissance |

**`liste de cadeaux`** — `...?q=liste%20de%20cadeaux...`

| # | Название | Разработчик | Установок | Ключ |
|---|---|---|---|---|
| 1 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | liste de cadeaux |
| 2 | iKadoo - Liste de cadeaux | iKadoo | 10 k+ | liste de cadeaux |
| 3 | Wishbob – Liste de cadeaux | Wishbob | 100 k+ | wish + liste de cadeaux |
| 4 | GiftList - Wishlist & Registry | GiftList | 10 k+ | gift + list |
| 5 | Listy - La wishlist réinventée | Listy SAS | 5 k+ | wishlist |
| 6 | Oh My Wish ! Liste de cadeaux | OhMyWish | 10 k+ | wish + liste de cadeaux |
| 7 | GoWish - Your Digital Wishlist | Ønskeskyen ApS | 1 M+ | wish |
| 8 | Giftful – Liste de souhaits | Giftful | 100 k+ | gift + souhaits |
| 9 | Liste de Souhaits & Cadeaux | Kenji Sakai | 1 k+ | liste + souhaits + cadeaux |
| 10 | GiftTracker: Liste de Cadeaux | Leewrigg | 50 k+ | gift + liste de cadeaux |

**`wishlist`** — `...?q=wishlist...`

| # | Название | Разработчик | Установок | Ключ |
|---|---|---|---|---|
| 1 | Wishlists - online wishlist | Christian Konnerth | 100 k+ | wishlist |
| 2 | GoWish - Your Digital Wishlist | Ønskeskyen ApS | 1 M+ | wish |
| 3 | Wishlist Maker - Listful | Listful | 100 k+ | wishlist |
| 4 | Listy - La wishlist réinventée | Listy SAS | 5 k+ | wishlist |
| 5 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | liste de cadeaux |
| 6 | GiftList - Wishlist & Registry | GiftList | 10 k+ | wishlist |
| 7 | Giftful – Liste de souhaits | Giftful | 100 k+ | souhaits |
| 8 | Wishlist Maker - Moonsift | MOONSIFT | 100 k+ | wishlist |
| 9 | Share a Wish - Liste d'envies | Northern Development | 10 k+ | wish + envies |
| 10 | Wishes – Liste de souhaits | Wiheads ApS | 10 k+ | wishes + souhaits |

**`idée cadeau`** — `...?q=id%C3%A9e%20cadeau...`

| # | Название | Разработчик | Установок | Ключ |
|---|---|---|---|---|
| 1 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | liste de cadeaux |
| 2 | iKadoo - Liste de cadeaux | iKadoo | 10 k+ | liste de cadeaux |
| 3 | Giftster - Wish List Registry | MyGiftster Corporation | 100 k+ | wish + list |
| 4 | Liste d'envies & idées - GiftX | PatStudio LLC | 10 k+ | envies + idées |
| 5 | Giftful – Liste de souhaits | Giftful | 100 k+ | souhaits |
| 6 | Liste de Souhaits & Cadeaux | Kenji Sakai | 1 k+ | souhaits + cadeaux |
| 7 | Gifts.com: Custom Gifts App | PlanetArt | 10 k+ | gifts |
| 8 | GiftTracker: Liste de Cadeaux | Leewrigg | 50 k+ | gift + cadeaux |
| 9 | Wishbob – Liste de cadeaux | Wishbob | 100 k+ | wish + cadeaux |
| 10 | drawnames \| L'app Secret Santa | drawnames | 1 M+ | secret santa |

**`cadeau`** — `...?q=cadeau...`

| # | Название | Разработчик | Установок | Ключ |
|---|---|---|---|---|
| 1 | Family Gift : Liste de cadeaux | Trempette Inc. | 100 k+ | liste de cadeaux |
| 2 | drawnames \| L'app Secret Santa | drawnames | 1 M+ | secret santa |
| 3 | iKadoo - Liste de cadeaux | iKadoo | 10 k+ | liste de cadeaux |
| 4 | Giftful – Liste de souhaits | Giftful | 100 k+ | souhaits |
| 5 | Pluxee Cadeaux (ex Glady) | Pluxee Cadeaux | 1 M+ | cadeaux (подарочные карты) |
| 6 | Père Noël Secret 22: Tirage! | Bocadil Infinite | 1 M+ | père noël secret |
| 7 | Wishbob – Liste de cadeaux | Wishbob | 100 k+ | wish + cadeaux |
| 8 | SodaGift - Earn, Save, Gift | Sodacrew | 100 k+ | gift |
| 9 | GiftTracker: Liste de Cadeaux | Leewrigg | 50 k+ | gift + cadeaux |
| 10 | Gift.cool | ifeelgoods | н/д | gift |

Примечание: в выдаче по `cadeau` 4 из 10 — вообще не вишлисты (подарочные карты, жеребьёвки), то есть широкое слово размывает категорию.

Источник установок: `https://play.google.com/store/apps/details?id=<id>&hl=fr&gl=FR` для 30 id (перечислены в разделе 8) — 2026-11-05.

### 4.2 Отдельная проверка: чем занят корень `wish` в Google Play FR

`https://play.google.com/store/search?q=wish&c=apps&hl=fr&gl=FR` (2026-11-05), первые строки: 1) **Wish** (com.contextlogic.wish — маркетплейс) · 2) WishQue · 3) Share a Wish - Liste d'envies · 4) Temu · 5) Etsy · 6) Alibaba.com · 7) Joom · 8) AliExpress · 9) GoWish · 10) Liste de Souhaits & Cadeaux · 11) Wish'O Matic – Listes cadeaux · 12) Wishwave: Liste de Cadeaux.

То есть по слову `wish` первым стоит маркетплейс, за ним — весь шопинг-блок, и только потом вишлисты. При этом **французские приложения уже используют схему «Wish- + французский подзаголовок»**: Wish'O Matic – Listes cadeaux, Wishwave: Liste de Cadeaux, Wishbob – Liste de cadeaux, Share a Wish - Liste d'envies, Wishbox : liste d'envies, WishGrid - Liste de cadeaux, Oh My Wish ! Liste de cadeaux. Схема на рынке принята.

### 4.3 App Store FR (iTunes Search API), топ-10 с числом оценок

`https://itunes.apple.com/search?term=<term>&country=fr&entity=software&limit=25&lang=fr_fr` — 2026-11-05.

**`term=liste de souhaits`** (24 результата)

| # | Название | Разработчик | Оценок |
|---|---|---|---|
| 1 | Liste de souhaits - Farha | DOCTISTO LLC | 2 |
| 2 | Wishes – Liste de souhaits | Wiheads ApS | 14 |
| 3 | Listful - Wishlist Maker | Listful LLC | 598 |
| 4 | SpoilMe – Crée ta wishlist | Spoildotme Ltd | 3 219 |
| 5 | drawnames \| L'app Secret Santa | Meetrix Online | 9 272 |
| 6 | Liste de souhaits de noël | Giftbuster Inc. | 50 |
| 7 | Ohmywishes, listes de souhaits | Ohmywishes, LLC | 26 |
| 8 | Pikki : liste de cadeaux | Cyrille Varin | 37 |
| 9 | Oh My Wish ! Liste de cadeaux | Anselme Chorein | 28 |
| 10 | Jinnie: Liste de souhaits | KARLIE ALEXIS KOWALSKA | 1 |

**`term=liste d'envies`** (25): Wantd - Liste d'envies (SEDONA TECH, 50) · Dresslist – Listes d'envies (4) · WishGrid - Liste de cadeaux (6) · Wishbox : liste d'envies (1) · Lists4Gifts (0) · Share a Wish (3) · Lalaliste (20) · Wishbob (183) · **iKadoo (2 150)** · minipouce (884) · Mes Envies (61) · Pikki (37).

**`term=liste de cadeaux`** (25): **iKadoo (2 150)** · Family Gift (711) · Listful (598) · Wishbob (183) · Mes Envies (61) · Wishlist & Cadeaux - Hopy (26) · Milirose (137) · The Christmas Gift List (170) · Liste de Cadeaux et Envies (6) · Giftful – Souhaits & registre (159) · drawnames (9 272) · Ohmywishes (26).

**`term=wishlist`** (24): Wishlists - online wishlist (742) · GoWish (860) · **SpoilMe (3 219)** · Listy (116) · Listful (598) · Sortd (17) · WISHUPON (402) · Giftful (159) · To do list & Rappel (1 812, нерелевантно) · Wishlist Maker - Moonsift (16).

**`term=idée cadeau`** (22): Wishlist & Cadeaux - Hopy (26) · Giftruly : idée cadeau (0) · Wantd (50) · Lupna (5) · Oh My Wish (28) · GiftOS (0) · GiftIn (1) · The Gift App (3) · Wonder Gift (7) · Lalalab (108 596, фотопечать — нерелевантно).

**`term=cadeau`** (23): iKadoo (2 150) · Family Gift (711) · drawnames (9 272) · **Pluxee Cadeaux (44 775)** · Choose (30 279) · **Etsy (120 315)** · Cadeaux - Gagner de l'argent (5 289) · GoWish (860) · Mes Envies (61) · Listful (598).

**Отдельно `term=wish` (FR)** — корень занят маркетплейсом: 1) **Wish: shopping à petit prix (ContextLogic, 336 145 оценок)** · 2) Whish Money · 3) AliExpress (364 666) · 4) Temu (201 031) · 5) GoWish (860) · 6) SHEIN (409 881) · … 9) DHgate · 11) Cdiscount. Источник: `https://itunes.apple.com/search?term=wish&country=fr&entity=software&limit=12&lang=fr_fr` — 2026-11-05.

### 4.4 BE и CA-fr: отличия

`country=be` и `country=ca`, те же 6 терминов + `lang=fr_fr` — 2026-11-05.

| Термин | BE: первые три | CA: первые три |
|---|---|---|
| `liste de souhaits` | Liste de souhaits - Farha (0) · Wishes (3) · Liste de souhaits – Noël (0); ниже в списке, но выше по оценкам drawnames (13 461) | Liste de souhaits - Farha (0) · Liste de souhaits - Wishly (0) · Wishes (11); ниже в списке, но выше по оценкам **Elfster (26 758)**, **drawnames (17 150)**, Giftful (3 293) |
| `liste d'envies` | Wantd (18) · Share a Wish (1) · Wishbox (0) | Wantd (4) · Share a Wish (1) · WishGrid (2) |
| `liste de cadeaux` | iKadoo (77) · Family Gift (137) · Wishbob (89) | Liste de cadeaux de Noël (0) · Listful (1 095) · Family Gift (84) |
| `wishlist` | Wishlists (441) · GoWish (686) · Listful (97) | GoWish (2 222) · Giftful (3 293) · Wishlists (356); на 9-м месте **Wish: shopping à petit prix (327 672)** |
| `idée cadeau` | Giftruly (0) · Hopy (1) · Wantd (18) | Giftruly (0) · Hopy (0) · Wantd (4) |
| `cadeau` | **drawnames (13 461)** · GoWish (686) · Family Gift (137) | **drawnames (17 150)** · Liste de cadeaux de Noël (0) · GoWish (2 222) |

Вывод: в BE и CA-fr те же лидеры, что в FR; в CA сверху стоят Secret Santa-сервисы (Elfster, drawnames) и маркетплейс Wish, в BE — drawnames. Отдельной лексики нет.

### 4.5 Какие корни доминируют в названиях

Уникальные названия из топ-10 шести выдач Play FR (29 шт.) и шести выдач App Store FR (45 шт.), дубликаты схлопнуты.

| Корень в названии | Play FR (29) | App Store FR (45) |
|---|---|---|
| французский ключ (`liste`/`listes` отдельным словом, `cadeau`, `envie`, `souhait`) | 17 (59 %) | 28 (62 %) |
| английский корень (`wish`, `gift`, `registry`) | 18 (62 %) | 25 (56 %) |
| оба типа в одном названии | 8 | 14 |
| только французский ключ | 9 | 14 |
| только английский корень | 10 | 11 |
| ни то, ни другое | 2 (drawnames, Père Noël Secret 22) | 6 (drawnames, Lalaliste, Milirose, To do list & Rappel, Lalalab, Etsy) |

Точные подстроки: `liste`/`listes` отдельным словом — 16 в Play и 20 в App Store; `cadeau(x)` — 9 и 16; `envie(s)` — 3 и 8; `souhait(s)` — 5 и 6; `wishlist` целиком — 7 и 8; `wish` (корень) — 11 и 16; `gift` — 9 и 9. (`wishlist` в подсчёт французского ключа не входит — это английское слово, хотя содержит `list`.)

**По терминам Play FR:** французский ключ есть в 6 из 10 названий для `liste de souhaits`, в 9 из 10 для `liste d'envies`, в 7 из 10 для `liste de cadeaux`, в 4 из 10 для `wishlist`, в 7 из 10 для `idée cadeau` и в 6 из 10 для `cadeau`. Зато **любой** ключ категории (французское слово либо `wishlist`/`wish`/`gift`/`registry`) есть в 10 из 10 для четырёх «списочных» терминов, в 9 из 10 для `idée cadeau` и в 8 из 10 для `cadeau` — без ключа в топ не попадает почти никто.

Источник: подсчёт по таблицам 4.1 и 4.3 — 2026-11-05.

---

## 5. Паттерны и выводы

### 5.1 Сводная таблица (задание 4.1)

| Термин | Trends (FR) | В подсказках (из 318) | В названиях приложений (из 29 Play / 45 App Store) |
|---|---|---|---|
| `cadeau` | н/д (429) | 196 | 9 / 16 |
| `liste` / `liste de cadeaux` | н/д (429) | 97 / ядро | 16 / 20 (`liste`/`listes` отдельным словом) |
| `idée cadeau` | н/д (429) | 89 (`idee`) | 1 / 2 |
| `noel` | н/д (429) | 76 | 1 / 1 |
| `anniversaire` | н/д (429) | 46 | — (в названиях не встречается) |
| `liste de souhaits` | н/д (429) | 22 (`souhait`) | 5 / 6 |
| `liste d'envies` | н/д (429) | 18 (`envie`), но 15 из 15 подсказок сида — по теме | 3 / 8 |
| `wishlist` (англ.) | н/д (429) | 30 — **только из английских сидов**, ни одной из французских | 7 / 8 |
| `wish` (англ. корень) | н/д (429) | 0 из французских сидов | 11 / 16 |
| `app` / `application` | — | 31 | — |

### 5.2 Выводы

**1. Живая французская форма — «liste de cadeaux» и «liste d'envies», а не «liste de souhaits».** `liste de souhaits` — буквальный кальк с английского, и он уходит в чужие значения: 6 из 15 подсказок — игровые вишлисты (Xbox, Steam, Nintendo, PS5, Play Store, Google Play), 3 — кроссворды («10 lettres», «mots fléchés»), 1 — «как по-английски». У `liste de cadeaux` — 10 из 10 подсказок по теме, включая `liste de cadeaux application`; у `liste d'envies` — 15 из 15 по теме. В названиях приложений это видно прямо: слово `liste`/`listes` стоит в 16 из 29 названий Play FR, `cadeau` — в 9, `souhait` — только в 5.

**2. Английское «wishlist» во французском существует, но как слово-иностранное.** 30 подсказок с `wishlist` пришли **только** из двух английских сидов — ни один из 22 французских сидов не дал ни одной подсказки с корнем `wish`. Плюс три подсказки прямо спрашивают смысл: `wishlist def`, `wishlist c'est quoi`, `wishlist traduction`, и ещё `liste de souhaits en anglais`. То есть слово узнаётся, но не является само собой понятным — в отличие от Германии, где заимствование тоже есть, здесь оно ещё и объясняется через перевод.

**3. «Wish-» во французских сторах — не чужой префикс, а местная конвенция.** 11 из 29 названий Play FR и 16 из 45 App Store FR содержат `wish`, и почти всегда с французским подзаголовком: «Wishbob – Liste de cadeaux», «Share a Wish - Liste d'envies», «Oh My Wish ! Liste de cadeaux», «Wishbox : liste d'envies», «WishGrid - Liste de cadeaux», «Wish'O Matic – Listes cadeaux», «Wishwave: Liste de Cadeaux». Это ровно схема «английский бренд + локализованный ключ», которую предписывает `criteria.md`.

**4. Без ключа в названии в топ-10 не видно никого.** В выдаче Play FR по четырём «списочным» терминам (`liste de souhaits`, `liste d'envies`, `liste de cadeaux`, `wishlist`) все 10 из 10 названий содержат либо французское слово, либо `wishlist`/`wish`/`gift`. Рынок делится на два лагеря: локальные приложения с французским ключом («iKadoo - Liste de cadeaux», «Family Gift : Liste de cadeaux», «Envy : liste d'envies cadeaux», «Listy - La wishlist réinventée») и международные бренды, которые добавили французский подзаголовок («Giftful – Liste de souhaits», «Wishes – Liste de souhaits», «Wishbob – Liste de cadeaux»). Чисто английских названий без французского слова в пуле 10 из 29, и держатся они на массе установок (GoWish 1 M+, Wishlists 100 k+).

**5. Корень `wish` в одиночку занят маркетплейсом.** В App Store FR по `wish` первым стоит «Wish: shopping à petit prix» (336 145 оценок), за ним Whish Money, AliExpress (364 666), Temu (201 031), GoWish (860), SHEIN (409 881), Joom, DHgate, Alibaba, Cdiscount; в Play FR — Wish, WishQue, один вишлист Share a Wish, затем Temu, Etsy, Alibaba, Joom, AliExpress. Отдельно во французском медиаполе сочетание «wish list» занято телеигрой TF1 «Wish List : La Liste de vos envies» (2015–2016) — по подсказке `wishlist tf1` люди ищут её до сих пор. Вывод: `wish` работает только в связке, само по себе имя на «Wish-» будет соседствовать с шопингом в выдаче.

**6. «Приложение» во французском крепится к «подарку» и к «wishlist», но не к «списку желаний».** Из 31 подсказки с `app/appli/application`: 12 — к `wishlist` (в основном английский мусор: `wishlist app shopify`, `wishlist app design`), 15 — к `cadeau`/`application cadeau` (и это чаще не список, а жеребьёвка и групповой подарок: `tirage au sort` ×2, `secret santa`, `cadeau commun`, `cadeau famille`, `cadeau entreprise`, `cadeau shower`), 3 — к `liste de souhaits`, 1 — к `liste de cadeaux`. Связки `liste d'envies application` в подсказках нет вообще (0). То есть француз не набирает «приложение списка желаний» — он набирает «список подарков» и уже в сторе ищет приложение.

**7. Категория «список» во Франции институционализирована реестрами.** `liste de naissance` (19 подсказок) и `liste de mariage` (19): в подсказках — сети и сервисы (Orchestra, Aubert, vertbaudet, minipouce, bebe9; Mille Mercis, Mille et une listes, Galeries Lafayette, Le Bon Marché, Printemps). В сторах по `liste d'envies` в топ-10 попадают три реестра рождения (Listéa, minipouce, Ma liste naissance). Это значит: француз точно знает, что такое «список», но привык, что он живёт у магазина, а не в отдельном приложении — ниша независимого вишлиста свободнее, но требует объяснения.

**8. Сезонность — декабрь, второй повод — день рождения.** Из подсказок: `noel` — 76 упоминаний, `anniversaire` — 46, `mariage` — 19, `naissance` — 19. Из сторов: 1 M+ у рождественских жеребьёвок (drawnames, Père Noël Secret 22), рождественские списки в топ-10 App Store. Из прокси Википедии — декабрьский пик «Noël» +293…+322 % к ноябрю и «Cadeau» +39…+87 %. Точных коэффициентов для поисковых запросов нет: Trends отдал 429.

**9. `idée cadeau` — это трафик дарителя, и он не пересекается со списком.** 89 из 318 подсказок с `idee`, и почти все — про адресата, возраст или повод: «femme 40 ans», «homme 30 ans», «fille 10 ans», «bébé 1 an», «crémaillère», «à faire soi meme». В сторах по `idée cadeau` половина топа — AI-подборщики с 0–5 оценками (Giftruly 0, GiftOS 0, GiftIn 1, The Gift App 3, Wonder Gift 7). Это отдельный, ещё не сформировавшийся рынок, и к нему наши имена отношения не имеют.

**10. BE и CA-fr не отличаются от FR.** `liste de souhaits` и `liste d'envies` в BE и CA совпали с FR подсказка в подсказку; расходятся только локальные бренды в широком `cadeau` (Cadeaucity, Proximus, Cadeaubox в BE; `cadeau éducatrice` в Квебеке). Один французский рынок, одна лексика.

---

## 6. Влияние на финалистов (Wishparty, Wishmoon, Wishie, Wishlane, Wishday)

Общая рамка: **ни одно из пяти имён не содержит французского ключа**, поэтому по запросам `liste de cadeaux`, `liste d'envies`, `liste de souhaits` ни одно не будет найдено само — в четырёх «списочных» выдачах Play FR все 10 из 10 названий содержат либо французское слово, либо `wishlist`/`wish`/`gift`. Значит для всех пяти обязателен французский подзаголовок стора («Liste de cadeaux et d'envies», «Liste de souhaits à partager») — это ровно то, что требует `criteria.md` в пункте ASO. Зато префикс `Wish-` на французском рынке не чужой: 11 из 29 названий Play FR его используют, обычно вместе с французским подзаголовком.

| Имя | Плюсы для FR | Минусы и риски для FR |
|---|---|---|
| **Wishparty** | Во французской выдаче по имени нет ни одного французского продукта — только фотостудия Wish Party Studio (Непал) и английские товары для вечеринок. Стыкуется с главным поводом — днём рождения (46 подсказок) и Рождеством (76) | `party` сужает до праздника и не говорит «список»; по-французски вечеринка — «fête», так что второй элемент чужой. Брендового шума нет, но и спроса на слово нет — имя придётся создавать с нуля |
| **Wishmoon** | Подсказок по имени нет вообще (только фонетические соседи), столкновений в FR ноль. `moon` читается как английское «луна», пишется однозначно | Смысл не читается: «луна желаний» французу ничего не говорит; `moon` тянет эзотерику так же, как в других языках. Самое слабое по семантике для FR |
| **Wishie** | Плохих значений во французском нет, произносится как «уиши́», пишется однозначно | 15 из 15 подсказок — чужие сущности: `wishies`, `wishier protein`, `wishiecat`, `washie washie`, `wishie plant`; есть даже `wishie meaning` — Google считает слово непонятным. В App Store FR уже стоят «Wishes» и «Wishy» — имя размывается. Суффикс `-ie` для француза не ласкательный, а англоязычный |
| **Wishlane** | Формально во французском ничего не значит | **Худший результат на FR:** все 15 подсказок по `wishlane` — про **Dashlane**, известный во Франции менеджер паролей. Одна буква разницы, и автокоррекция уводит в чужой продукт. `lane` французу не слово (это «переулок», а не «аллея»), смысл не читается |
| **Wishday** | Единственное имя, у которого во французской выдаче уже есть подсказки `<имя> app` и `<имя> ai` — то есть связка «имя + приложение» существует | `day` французу не слово; рядом йогурт (`yogurt wishday`), шампунь (`shampo wishday`), шрифт (`wishday font`) и шум на японском/португальском. Смысл «день желаний» без перевода не считывается |

**Что из этого следует для выбора (по FR):**

1. По столкновениям в французской выдаче чище всех **Wishparty** и **Wishmoon** (у Wishmoon — ноль подсказок, у Wishparty — только непальская фотостудия). Но оба не помогают найти приложение: ключи уйдут в подзаголовок.
2. **Wishlane для FR — главный риск:** французский пользователь, набрав имя, попадёт в Dashlane. Это не блокер по смыслу, но прямая потеря трафика и путаница при устном упоминании.
3. **Wishday** — единственное имя с готовой подсказкой `<имя> app` на французском рынке, что даёт минимальный ASO-бонус; минус — бытовой шум (йогурт, шампунь).
4. **Wishie** проигрывает по размытию: рядом в сторе стоят Wishes и Wishy, а Google предлагает `wishie meaning`.
5. Французский подзаголовок для всех пяти: строить вокруг **`liste de cadeaux`** и **`liste d'envies`** (не `liste de souhaits` — она уводит в игровые вишлисты и кроссворды). В описание добавить модификаторы, которые реально набирают: `en ligne`, `à partager`, `anniversaire`, `noël`, `naissance`, `mariage`.
6. Ставку на одиночный `wish` во французском делать нельзя: первым в обоих сторах стоит маркетплейс Wish (336 145 оценок в App Store FR).

---

## 7. Пробелы

1. **Google Trends недоступен.** Три обращения к `trends.google.com` (два подряд и одно позже) вернули HTTP 429. Индексов 0–100 за 12 месяцев и 5 лет, «похожих запросов» и кривых сезонности из Trends нет. Защиту не обходили. Следствие: сравнить `liste de cadeaux` и `liste d'envies` по относительному объёму нельзя — только по косвенным признакам (число подсказок, число названий в сторах, установки).
2. **Абсолютных объёмов поиска нет ни у одного термина.** Google Keyword Planner требует логина и рекламного аккаунта — по правилам задания не использовался. Все «частоты» — счётчики подсказок и названий.
3. **Сезонность измерена только прокси.** Wikimedia Pageviews по статьям «Cadeau» и «Noël» — слабый индикатор (энциклопедические статьи, сотни и десятки тысяч просмотров), статьи «Liste de naissance» в fr.wikipedia нет (404). Точных коэффициентов декабрьского пика для поисковых запросов нет.
4. **Установки в Google Play — округлённые диапазоны.** Числа сняты с 30 отдельных карточек (`ClM7O` + «Téléchargements»); это «1 M+», «100 k+», «5 k+», а не точные значения. Для 1 позиции (`Gift.cool`) установки не снимались.
5. **App Store не отдаёт установки.** В таблицах — `userRatingCount`, то есть число оценок, а не загрузок; сравнивать с Play по абсолютным числам некорректно.
6. **Один сид вернул пустой ответ** — `liste d'envies application` (0 подсказок), у `application liste de souhaits` — только 3. Считаю это содержательным сигналом (связки нет), но формально это может быть фильтрация Suggest.
7. **Частоты модификаторов смещены составом сидов.** Пять сидов содержали «cadeau», три — «noel», два — «wishlist»; поэтому «cadeau 196» и «noel 76» — это в том числе следствие выбора запросов, а не только спроса.
8. **Выдача сторов зависит от региона и персонализации.** Списки — срез на 2026-11-05 без входа в аккаунт; считать их объективным рейтингом нельзя. Порядок в BE и CA считался отдельными запросами iTunes, в Play BE/CA не проверялся вовсе.
9. **YouTube-подсказки сняты только по 4 сидам** (`wishlist`, `liste de souhaits`, `liste d'envies`, `liste de cadeaux`), Play-подсказки (store suggestions) не снимались.
10. **Телешоу TF1 подтверждено по Википедии, а не по эфирным данным.** «Wish List : La Liste de vos envies», TF1, 6 июля 2015 — 15 января 2016 — факт из статьи fr.wikipedia; текущее медийное влияние на восприятие слова `wishlist` не измерялось.
11. **Восприятие «Wish-» носителями не проверено.** Все выводы о произношении — интерпретация по данным подсказок и сторов, опроса французов не было. Нужен тест на носителях, особенно для «Wishlane» / Dashlane и «Wishie» / Wishes.
12. **Не проверялись:** Google Play в мобильной выдаче, редакционные подборки Play и App Store, реклама Wish.com во Франции, а также Amazon.fr как владелец термина «liste d'envies» — видно только, что Amazon появляется в 6 подсказках.

---

## 8. Список источников

Все обращения — 2026-11-05.

**Google Suggest (автодополнение, `client=chrome`, `hl=fr`)**
- `https://suggestqueries.google.com/complete/search?client=chrome&hl=fr&gl=FR&q=cadeau`
- `...&q=id%C3%A9e%20cadeau`
- `...&q=liste%20de%20souhaits`
- `...&q=liste%20de%20cadeaux`
- `...&q=wishlist`
- `...&q=liste%20d%27envies`
- `...&q=id%C3%A9e%20cadeau%20anniversaire`
- `...&q=id%C3%A9e%20cadeau%20noel`
- `...&q=application%20liste%20de%20souhaits`
- `...&q=liste%20d%27envies%20application`
- `...&q=cadeau%20pour%20elle`
- `...&q=cadeau%20pour%20lui`
- `...&q=liste%20de%20naissance`
- `...&q=liste%20de%20mariage`
- `...&q=wishlist%20app`
- `...&q=liste%20de%20souhaits%20en%20ligne`
- `...&q=application%20cadeau`
- `...&q=cadeau%20de%20noel`
- `...&q=liste%20de%20cadeaux%20noel`
- `...&q=id%C3%A9e%20cadeau%20enfant`
- `...&q=id%C3%A9e%20de%20cadeau`
- `...&q=noel`
- `...&q=cadeau%20anniversaire`
- `...&q=liste`
- `...&gl=BE&q=cadeau`, `...&gl=BE&q=liste%20de%20souhaits`, `...&gl=BE&q=liste%20d%27envies`
- `...&gl=CA&q=cadeau`, `...&gl=CA&q=liste%20de%20souhaits`, `...&gl=CA&q=liste%20d%27envies`
- `...&q=wishparty`, `...&q=wishmoon`, `...&q=wishie`, `...&q=wishlane`, `...&q=wishday`
- YouTube: `https://suggestqueries.google.com/complete/search?client=chrome&ds=yt&hl=fr&gl=FR&q=wishlist` (и `q=liste%20de%20souhaits`, `q=liste%20d%27envies`, `q=liste%20de%20cadeaux`)

**Google Trends (недоступен)**
- `https://trends.google.com/trends/explore?geo=FR&hl=fr&q=cadeau,id%C3%A9e%20cadeau,liste%20de%20souhaits,wishlist,liste%20d%27envies` — HTTP 429
- `https://trends.google.com/trends/api/explore?hl=fr&tz=-60&req=…` — HTTP 429
- `https://trends.google.com/trends/explore?geo=FR&hl=fr&q=cadeau,liste%20de%20souhaits,wishlist` (повтор позже) — HTTP 429

**Сезонность (Wikimedia Pageviews)**
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/Cadeau/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/No%C3%ABl/monthly/20241101/20261031`
- `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/fr.wikipedia/all-access/user/Liste_de_naissance/monthly/20241101/20261031` — 404, статьи нет

**Google Play**
- `https://play.google.com/store/search?q=liste%20de%20souhaits&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=liste%20d%27envies&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=liste%20de%20cadeaux&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=wishlist&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=id%C3%A9e%20cadeau&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=cadeau&c=apps&hl=fr&gl=FR`
- `https://play.google.com/store/search?q=wish&c=apps&hl=fr&gl=FR`
- Установки: `https://play.google.com/store/apps/details?id=<id>&hl=fr&gl=FR`, где `<id>` — `com.ckbusiness.Wishlists`, `com.gowish.app`, `com.giftful.Giftful`, `com.happywishlist.app`, `com.wiheads.wishes`, `com.wishowl.app`, `com.giftlist`, `ro.codemint.crave`, `com.trempette.family_gift_2`, `com.awaytix.wishlist`, `com.mydesires.mydesires`, `nod.wishbob`, `com.app.ikadoo`, `fr.listea.app`, `com.malloc.minipouce`, `space.wishing.app`, `com.navard.listenaissance`, `fr.listy.app`, `moloapps.gifttracker`, `com.moonsift.wish.list.maker.christmas.birthday.baby.shopping.gift.list`, `com.share.a.wish`, `io.wantic.app`, `com.Giftster.Giftster`, `giftx.tech`, `com.planetart.gifts`, `com.meetrixonline.drawnames`, `com.wedoogift`, `com.bocadil.amigoinvisible22`, `com.sodacrew.sodagift`, `com.avantagenumerique.listecadeaux`

**App Store (iTunes Search API)**
- `https://itunes.apple.com/search?term=liste%20de%20souhaits&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=liste%20d%27envies&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=liste%20de%20cadeaux&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=wishlist&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=id%C3%A9e%20cadeau&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=cadeau&country=fr&entity=software&limit=25&lang=fr_fr`
- `https://itunes.apple.com/search?term=wish&country=fr&entity=software&limit=12&lang=fr_fr`
- Те же шесть терминов с `country=be` — 2026-11-05
- Те же шесть терминов с `country=ca` — 2026-11-05

**Энциклопедии и медиа**
- `https://fr.wikipedia.org/wiki/Wish_List_:_la_liste_de_vos_envies` — телеигра TF1, 6 июля 2015 — 15 января 2016, адаптация BBC «Win Your Wish List»
- `https://html.duckduckgo.com/html/?q=wishlist+tf1` — поиск, через который найдена статья (2026-11-05)

**Внутренние документы (только чтение)**
- `_bmad-output/research/naming/criteria.md` — 2026-11-05
- `_bmad-output/research/naming/finalists-compare.md` — 2026-11-05

ГОТОВО 3-fr
